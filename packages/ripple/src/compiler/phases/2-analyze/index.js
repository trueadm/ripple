import * as b from '../../../utils/builders.js';
import { walk } from 'zimmerframe';
import { create_scopes, ScopeRoot } from '../../scope.js';
import {
	get_delegated_event,
	get_parent_block_node,
	is_element_dom_element,
	is_inside_component,
	is_ripple_track_call,
	is_void_element,
	normalize_children,
} from '../../utils.js';
import { extract_paths } from '../../../utils/ast.js';
import is_reference from 'is-reference';
import { prune_css } from './prune.js';
import { analyze_css } from './css-analyze.js';
import { error } from '../../errors.js';
import { is_event_attribute } from '../../../utils/events.js';
import { validate_nesting } from './validation.js';

const valid_in_head = new Set(['title', 'base', 'link', 'meta', 'style', 'script', 'noscript']);

function mark_control_flow_has_template(path) {
	for (let i = path.length - 1; i >= 0; i -= 1) {
		const node = path[i];

		if (
			node.type === 'Component' ||
			node.type === 'FunctionExpression' ||
			node.type === 'ArrowFunctionExpression' ||
			node.type === 'FunctionDeclaration'
		) {
			break;
		}
		if (
			node.type === 'ForStatement' ||
			node.type === 'ForInStatement' ||
			node.type === 'ForOfStatement' ||
			node.type === 'TryStatement' ||
			node.type === 'IfStatement' ||
			node.type === 'SwitchStatement' ||
			node.type === 'TsxCompat'
		) {
			node.metadata.has_template = true;
		}
	}
}

function visit_function(node, context) {
	node.metadata = {
		scope: context.state.scope,
		tracked: false,
	};

	context.next({
		...context.state,
		function_depth: context.state.function_depth + 1,
		expression: null,
	});

	if (node.metadata.tracked) {
		mark_as_tracked(context.path);
	}
}

function mark_as_tracked(path) {
	for (let i = path.length - 1; i >= 0; i -= 1) {
		const node = path[i];

		if (node.type === 'Component') {
			break;
		}
		if (
			node.type === 'FunctionExpression' ||
			node.type === 'ArrowFunctionExpression' ||
			node.type === 'FunctionDeclaration'
		) {
			node.metadata.tracked = true;
			break;
		}
	}
}

const visitors = {
	_(node, { state, next, path }) {
		// Set up metadata.path for each node (needed for CSS pruning)
		if (!node.metadata) {
			node.metadata = {};
		}
		node.metadata.path = [...path];

		const scope = state.scopes.get(node);
		next(scope !== undefined && scope !== state.scope ? { ...state, scope } : state);
	},

	Program(_, context) {
		return context.next({ ...context.state, function_depth: 0, expression: null });
	},

	ServerBlock(node, context) {
		node.metadata = {
			...node.metadata,
			exports: [],
		};
		context.visit(node.body, { ...context.state, inside_server_block: true });
	},

	Identifier(node, context) {
		const binding = context.state.scope.get(node.name);
		const parent = context.path.at(-1);

		if (
			is_reference(node, /** @type {Node} */ (parent)) &&
			binding &&
			context.state.inside_server_block &&
			context.state.scope.server_block
		) {
			let current_scope = binding.scope;

			while (current_scope !== null) {
				if (current_scope.server_block) {
					break;
				}
				const parent_scope = current_scope.parent;
				if (parent_scope === null) {
					error(
						`Cannot reference client-side variable "${node.name}" from a server block`,
						context.state.analysis.module.filename,
						node,
					);
				}
				current_scope = parent_scope;
			}
		}

		if (
			binding?.kind === 'prop' ||
			binding?.kind === 'prop_fallback' ||
			binding?.kind === 'for_pattern'
		) {
			mark_as_tracked(context.path);
			if (context.state.metadata?.tracking === false) {
				context.state.metadata.tracking = true;
			}
		}

		if (
			is_reference(node, /** @type {Node} */ (parent)) &&
			node.tracked &&
			binding?.node !== node
		) {
			mark_as_tracked(context.path);
			if (context.state.metadata?.tracking === false) {
				context.state.metadata.tracking = true;
			}
		}

		if (
			is_reference(node, /** @type {Node} */ (parent)) &&
			node.tracked &&
			binding?.node !== node
		) {
			if (context.state.metadata?.tracking === false) {
				context.state.metadata.tracking = true;
			}
		}

		context.next();
	},

	MemberExpression(node, context) {
		const parent = context.path.at(-1);

		if (context.state.metadata?.tracking === false && parent.type !== 'AssignmentExpression') {
			context.state.metadata.tracking = true;
		}

		if (node.object.type === 'Identifier' && !node.object.tracked) {
			const binding = context.state.scope.get(node.object.name);

			if (binding && binding.metadata?.is_tracked_object) {
				const internalProperties = new Set(['__v', 'a', 'b', 'c', 'f']);

				let propertyName = null;
				if (node.property.type === 'Identifier' && !node.computed) {
					propertyName = node.property.name;
				} else if (node.property.type === 'Literal' && typeof node.property.value === 'string') {
					propertyName = node.property.value;
				}

				if (propertyName && internalProperties.has(propertyName)) {
					error(
						`Directly accessing internal property "${propertyName}" of a tracked object is not allowed. Use \`get(${node.object.name})\` or \`@${node.object.name}\` instead.`,
						context.state.analysis.module.filename,
						node.property,
					);
				}
			}

			if (
				binding !== null &&
				binding.initial?.type === 'CallExpression' &&
				is_ripple_track_call(binding.initial.callee, context)
			) {
				error(
					`Accessing a tracked object directly is not allowed, use the \`@\` prefix to read the value inside a tracked object - for example \`@${node.object.name}${node.property.type === 'Identifier' ? `.${node.property.name}` : ''}\``,
					context.state.analysis.module.filename,
					node,
				);
			}
		}

		context.next();
	},

	CallExpression(node, context) {
		// bug in our acorn pasrer: it uses typeParameters instead of typeArguments
		if (node.typeParameters) {
			node.typeArguments = node.typeParameters;
			delete node.typeParameters;
		}

		const callee = node.callee;

		if (context.state.function_depth === 0 && is_ripple_track_call(callee, context)) {
			error(
				'`track` can only be used within a reactive context, such as a component, function or class that is used or created from a component',
				context.state.analysis.module.filename,
				node,
			);
		}

		if (context.state.metadata?.tracking === false) {
			context.state.metadata.tracking = true;
		}

		if (!is_inside_component(context, true)) {
			mark_as_tracked(context.path);
		}

		context.next();
	},

	VariableDeclaration(node, context) {
		const { state, visit } = context;

		for (const declarator of node.declarations) {
			if (is_inside_component(context) && node.kind === 'var') {
				error(
					'`var` declarations are not allowed in components, use let or const instead',
					state.analysis.module.filename,
					declarator,
				);
			}
			const metadata = { tracking: false, await: false };

			if (declarator.id.type === 'Identifier') {
				const binding = state.scope.get(declarator.id.name);
				if (binding && declarator.init && declarator.init.type === 'CallExpression') {
					const callee = declarator.init.callee;
					// Check if it's a call to `track` or `tracked`
					if (
						(callee.type === 'Identifier' &&
							(callee.name === 'track' || callee.name === 'tracked')) ||
						(callee.type === 'MemberExpression' &&
							callee.property.type === 'Identifier' &&
							(callee.property.name === 'track' || callee.property.name === 'tracked'))
					) {
						binding.metadata = { ...binding.metadata, is_tracked_object: true };
					}
				}
				visit(declarator, state);
			} else {
				const paths = extract_paths(declarator.id);

				for (const path of paths) {
					if (path.node.tracked) {
						error(
							'Variables cannot be reactively referenced using @',
							state.analysis.module.filename,
							path.node,
						);
					}
				}

				visit(declarator, state);
			}

			declarator.metadata = metadata;
		}
	},

	ArrowFunctionExpression(node, context) {
		visit_function(node, context);
	},
	FunctionExpression(node, context) {
		visit_function(node, context);
	},
	FunctionDeclaration(node, context) {
		visit_function(node, context);
	},

	Component(node, context) {
		context.state.component = node;

		if (node.params.length > 0) {
			const props = node.params[0];

			if (props.type === 'ObjectPattern') {
				const paths = extract_paths(props);

				for (const path of paths) {
					const name = path.node.name;
					const binding = context.state.scope.get(name);

					if (binding !== null) {
						binding.kind = path.has_default_value ? 'prop_fallback' : 'prop';

						binding.transform = {
							read: (_) => {
								return path.expression(b.id('__props'));
							},
							assign: (node, value) => {
								return b.assignment('=', path.expression(b.id('__props')), value);
							},
							update: (node) =>
								b.update(node.operator, path.expression(b.id('__props')), node.prefix),
						};
					}
				}
			} else if (props.type === 'AssignmentPattern') {
				error(
					'Props are always an object, use destructured props with default values instead',
					context.state.analysis.module.filename,
					props,
				);
			}
		}
		const elements = [];

		// Track metadata for this component
		const metadata = { await: false };

		context.next({
			...context.state,
			elements,
			function_depth: context.state.function_depth + 1,
			metadata,
		});

		const css = node.css;

		if (css !== null) {
			// Analyze CSS to set global selector metadata
			analyze_css(css);

			for (const node of elements) {
				prune_css(css, node);
			}
		}

		// Store component metadata in analysis
		// Only add metadata if component has a name (not anonymous)
		if (node.id) {
			context.state.analysis.component_metadata.push({
				id: node.id.name,
				async: metadata.await,
			});
		}
	},

	ForStatement(node, context) {
		if (is_inside_component(context)) {
			error(
				'For loops are not supported in components. Use for...of instead.',
				context.state.analysis.module.filename,
				node,
			);
		}

		context.next();
	},

	SwitchStatement(node, context) {
		if (!is_inside_component(context)) {
			return context.next();
		}

		context.visit(node.discriminant, context.state);

		for (const switch_case of node.cases) {
			// Validate that each cases ends in a break statement, except for the last case
			const last = switch_case.consequent?.[switch_case.consequent.length - 1];

			if (
				last.type !== 'BreakStatement' &&
				node.cases.indexOf(switch_case) !== node.cases.length - 1
			) {
				error(
					'Template switch cases must end with a break statement (with the exception of the last case).',
					context.state.analysis.module.filename,
					switch_case,
				);
			}

			node.metadata = {
				...node.metadata,
				has_template: false,
				has_await: false,
			};

			context.visit(switch_case, context.state);

			if (!node.metadata.has_template && !node.metadata.has_await) {
				error(
					'Component switch statements must contain a template or an await expression in each of their cases. Move the switch statement into an effect if it does not render anything.',
					context.state.analysis.module.filename,
					node,
				);
			}
		}
	},

	ForOfStatement(node, context) {
		if (!is_inside_component(context)) {
			return context.next();
		}

		if (node.index) {
			const state = context.state;
			const scope = state.scopes.get(node);
			const binding = scope.get(node.index.name);
			binding.kind = 'index';

			if (binding !== null) {
				binding.transform = {
					read: (node) => {
						return b.call('_$_.get', node);
					},
				};
			}
		}

		if (node.key) {
			const state = context.state;
			const pattern = node.left.declarations[0].id;
			const paths = extract_paths(pattern);
			const scope = state.scopes.get(node);
			let pattern_id;
			if (state.to_ts) {
				pattern_id = pattern;
			} else {
				pattern_id = b.id(scope.generate('pattern'));
				node.left.declarations[0].id = pattern_id;
			}

			for (const path of paths) {
				const name = path.node.name;
				const binding = context.state.scope.get(name);

				binding.kind = 'for_pattern';
				if (!binding.metadata) {
					binding.metadata = {
						pattern: pattern_id,
					};
				}

				if (binding !== null) {
					binding.transform = {
						read: () => {
							return path.expression(b.call('_$_.get', pattern_id));
						},
					};
				}
			}
		}

		node.metadata = {
			...node.metadata,
			has_template: false,
			has_await: false,
		};
		context.next();

		if (!node.metadata.has_template && !node.metadata.has_await) {
			error(
				'Component for...of loops must contain a template or an await expression in their body. Move the for loop into an effect if it does not render anything.',
				context.state.analysis.module.filename,
				node,
			);
		}
	},

	ExportNamedDeclaration(node, context) {
		if (!context.state.inside_server_block) {
			return context.next();
		}
		const server_block = context.path.find((n) => n.type === 'ServerBlock');
		const declaration = node.declaration;

		if (declaration && declaration.type === 'FunctionDeclaration') {
			server_block.metadata.exports.push(declaration.id.name);
		} else if (declaration && declaration.type === 'Component') {
			// Handle exported components in server blocks
			if (server_block) {
				server_block.metadata.exports.push(declaration.id.name);
			}
		} else {
			// TODO
			throw new Error('Not implemented: Exported declaration type not supported in server blocks.');
		}

		return context.next();
	},

	TSTypeReference(node, context) {
		// bug in our acorn pasrer: it uses typeParameters instead of typeArguments
		if (node.typeParameters) {
			node.typeArguments = node.typeParameters;
			delete node.typeParameters;
		}
		context.next();
	},

	IfStatement(node, context) {
		if (!is_inside_component(context)) {
			return context.next();
		}

		node.metadata = {
			...node.metadata,
			has_template: false,
			has_await: false,
		};

		context.visit(node.consequent, context.state);

		if (!node.metadata.has_template && !node.metadata.has_await) {
			error(
				'Component if statements must contain a template or an await expression in their "then" body. Move the if statement into an effect if it does not render anything.',
				context.state.analysis.module.filename,
				node,
			);
		}

		if (node.alternate) {
			node.metadata.has_template = false;
			node.metadata.has_await = false;
			context.visit(node.alternate, context.state);

			if (!node.metadata.has_template && !node.metadata.has_await) {
				error(
					'Component if statements must contain a template or an await expression in their "else" body. Move the if statement into an effect if it does not render anything.',
					context.state.analysis.module.filename,
					node,
				);
			}
		}
	},
	/**
	 *
	 * @param {any} node
	 * @param {any} context
	 * @returns
	 */
	TryStatement(node, context) {
		if (!is_inside_component(context)) {
			return context.next();
		}

		if (node.pending) {
			// Try/pending blocks indicate async operations
			if (context.state.metadata?.await === false) {
				context.state.metadata.await = true;
			}

			node.metadata = {
				...node.metadata,
				has_template: false,
			};

			context.visit(node.block, context.state);

			if (!node.metadata.has_template) {
				error(
					'Component try statements must contain a template in their main body. Move the try statement into an effect if it does not render anything.',
					context.state.analysis.module.filename,
					node,
				);
			}

			node.metadata = {
				...node.metadata,
				has_template: false,
			};

			context.visit(node.pending, context.state);

			if (!node.metadata.has_template) {
				error(
					'Component try statements must contain a template in their "pending" body. Rendering a pending fallback is required to have a template.',
					context.state.analysis.module.filename,
					node,
				);
			}
		}

		if (node.finalizer) {
			context.visit(node.finalizer, context.state);
		}
	},

	ForInStatement(node, context) {
		if (is_inside_component(context)) {
			error(
				'For...in loops are not supported in components. Use for...of instead.',
				context.state.analysis.module.filename,
				node,
			);
		}

		context.next();
	},

	JSXElement(node, context) {
		const inside_tsx_compat = context.path.some((n) => n.type === 'TsxCompat');

		if (inside_tsx_compat) {
			return context.next();
		}
		error(
			'Elements cannot be used as generic expressions, only as statements within a component',
			context.state.analysis.module.filename,
			node,
		);
	},

	TsxCompat(_, context) {
		mark_control_flow_has_template(context.path);
		return context.next();
	},

	Element(node, context) {
		const { state, visit, path } = context;
		const is_dom_element = is_element_dom_element(node);
		const attribute_names = new Set();

		mark_control_flow_has_template(path);

		validate_nesting(node, state, context);

		// Store capitalized name for dynamic components/elements
		if (node.id.tracked) {
			const original_name = node.id.name;
			const capitalized_name = original_name.charAt(0).toUpperCase() + original_name.slice(1);
			node.metadata.ts_name = capitalized_name;
			node.metadata.original_name = original_name;

			// Mark the binding as a dynamic component so we can capitalize it everywhere
			const binding = context.state.scope.get(original_name);
			if (binding) {
				if (!binding.metadata) {
					binding.metadata = {};
				}
				binding.metadata.is_dynamic_component = true;
			}

			if (!is_dom_element && state.elements) {
				state.elements.push(node);
				// Mark dynamic elements as scoped by default since we can't match CSS at compile time
				if (state.component?.css) {
					node.metadata.scoped = true;
				}
			}
		}

		if (is_dom_element) {
			if (node.id.name === 'head') {
				// head validation
				if (node.attributes.length > 0) {
					error('<head> cannot have any attributes', state.analysis.module.filename, node);
				}
				if (node.children.length === 0) {
					error('<head> must have children', state.analysis.module.filename, node);
				}

				for (const child of node.children) {
					context.visit(child, { ...state, inside_head: true });
				}

				return;
			}
			if (state.inside_head) {
				if (node.id.name === 'title') {
					const chiildren = normalize_children(node.children);

					if (chiildren.length !== 1 || chiildren[0].type !== 'Text') {
						error(
							'<title> must have only contain text nodes',
							state.analysis.module.filename,
							node,
						);
					}
				}

				// check for invalid elements in head
				if (!valid_in_head.has(node.id.name)) {
					error(`<${node.id.name}> cannot be used in <head>`, state.analysis.module.filename, node);
				}
			}

			const is_void = is_void_element(node.id.name);

			if (state.elements) {
				state.elements.push(node);
			}

			for (const attr of node.attributes) {
				if (attr.type === 'Attribute') {
					if (attr.name.type === 'Identifier') {
						attribute_names.add(attr.name);

						if (attr.name.name === 'key') {
							error(
								'The `key` attribute is not a thing in Ripple, and cannot be used on DOM elements. If you are using a for loop, then use the `for (let item of items; key item.id)` syntax.',
								state.analysis.module.filename,
								attr,
							);
						}

						if (is_event_attribute(attr.name.name)) {
							const event_name = attr.name.name.slice(2).toLowerCase();
							const handler = visit(attr.value, state);
							const delegated_event = get_delegated_event(event_name, handler, state);

							if (delegated_event) {
								if (attr.metadata === undefined) {
									attr.metadata = {};
								}

								attr.metadata.delegated = delegated_event;
							}
						} else if (attr.value !== null) {
							visit(attr.value, state);
						}
					}
				}
			}

			if (is_void && node.children.length > 0) {
				error(
					`The <${node.id.name}> element is a void element and cannot have children`,
					state.analysis.module.filename,
					node,
				);
			}
		} else {
			for (const attr of node.attributes) {
				if (attr.type === 'Attribute') {
					if (attr.name.type === 'Identifier') {
						attribute_names.add(attr.name);
					}
					if (attr.value !== null) {
						visit(attr.value, state);
					}
				} else if (attr.type === 'SpreadAttribute') {
					visit(attr.argument, state);
				} else if (attr.type === 'RefAttribute') {
					visit(attr.argument, state);
				}
			}
			let implicit_children = false;
			let explicit_children = false;

			for (const child of node.children) {
				if (child.type === 'Component') {
					if (child.id.name === 'children') {
						explicit_children = true;
						if (implicit_children) {
							error(
								'Cannot have both implicit and explicit children',
								state.analysis.module.filename,
								node,
							);
						}
					}
				} else if (child.type !== 'EmptyStatement') {
					implicit_children = true;
					if (explicit_children) {
						error(
							'Cannot have both implicit and explicit children',
							state.analysis.module.filename,
							node,
						);
					}
				}
			}
		}

		// Validation
		for (const attribute of attribute_names) {
			const name = attribute.name;
			if (name === 'children') {
				if (is_dom_element) {
					error(
						'Cannot have a `children` prop on an element',
						state.analysis.module.filename,
						attribute,
					);
				}
			}
		}

		return {
			...node,
			children: node.children.map((child) => visit(child)),
		};
	},

	Text(node, context) {
		mark_control_flow_has_template(context.path);
		context.next();
	},

	/**
	 *
	 * @param {any} node
	 * @param {any} context
	 */
	AwaitExpression(node, context) {
		const parent_block = get_parent_block_node(context);

		if (is_inside_component(context)) {
			if (context.state.metadata?.await === false) {
				context.state.metadata.await = true;
			}

			if (parent_block !== null && parent_block.type !== 'Component') {
				if (context.state.inside_server_block === false) {
					error(
						'`await` is not allowed in client-side control-flow statements',
						context.state.analysis.module.filename,
						node,
					);
				}
			}
		}

		if (parent_block) {
			if (!parent_block.metadata) {
				parent_block.metadata = {};
			}
			parent_block.metadata.has_await = true;
		}

		context.next();
	},
};

export function analyze(ast, filename, options = {}) {
	const scope_root = new ScopeRoot();

	const { scope, scopes } = create_scopes(ast, scope_root, null);

	const analysis = {
		module: { ast, scope, scopes, filename },
		ast,
		scope,
		scopes,
		component_metadata: [],
	};

	walk(
		ast,
		{
			scope,
			scopes,
			analysis,
			inside_head: false,
			inside_server_block: options.mode === 'server',
			to_ts: options.to_ts ?? false,
		},
		visitors,
	);

	return analysis;
}
