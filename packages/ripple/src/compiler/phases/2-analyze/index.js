import * as b from '../../../utils/builders.js';
import { walk } from 'zimmerframe';
import { create_scopes, ScopeRoot } from '../../scope.js';
import {
	get_delegated_event,
	is_event_attribute,
	is_inside_component,
	is_svelte_import,
	is_tracked_name,
} from '../../utils.js';
import { extract_paths } from '../../../utils/ast.js';
import is_reference from 'is-reference';
import { prune_css } from './prune.js';
import { error } from '../../errors.js';

function visit_function(node, context) {
	node.metadata = {
		hoisted: false,
		hoisted_params: [],
		scope: context.state.scope,
		tracked: false,
	};

	if (node.params.length > 0) {
		for (let i = 0; i < node.params.length; i += 1) {
			const param = node.params[i];
			if (param.type === 'ObjectPattern') {
				const paths = extract_paths(param);

				for (const path of paths) {
					const name = path.node.name;
					const binding = context.state.scope.get(name);

					if (binding !== null && is_tracked_name(name)) {
						const id = context.state.scope.generate('arg');
						node.params[i] = b.id(id);
						binding.kind = 'prop';

						binding.transform = {
							read: (_) => b.call('$.get_property', b.id(id), b.literal(name)),
						};
					}
				}
			}
		}
	}

	context.next({
		...context.state,
		function_depth: context.state.function_depth + 1,
		expression: null,
	});
}

function mark_as_tracked(path) {
	for (let i = 0; i < path.length; i += 1) {
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

	Identifier(node, context) {
		const binding = context.state.scope.get(node.name);
		const parent = context.path.at(-1);

		if (
			is_reference(node, /** @type {Node} */ (parent)) &&
			context.state.metadata?.tracking === false &&
			is_tracked_name(node.name) &&
			binding?.node !== node
		) {
			context.state.metadata.tracking = true;
		}

		context.next();
	},

	MemberExpression(node, context) {
		const parent = context.path.at(-1);

		if (
			context.state.metadata?.tracking === false &&
			node.property.type === 'Identifier' &&
			!node.computed &&
			is_tracked_name(node.property.name) &&
			parent.type !== 'AssignmentExpression'
		) {
			context.state.metadata.tracking = true;
		}
		context.next();
	},

	CallExpression(node, context) {
		if (context.state.metadata?.tracking === false) {
			context.state.metadata.tracking = true;
		}

		context.next();
	},

	ObjectExpression(node, context) {
		for (const property of node.properties) {
			if (
				property.type === 'Property' &&
				!property.computed &&
				property.key.type === 'Identifier' &&
				property.kind === 'init' &&
				is_tracked_name(property.key.name)
			) {
				mark_as_tracked(context.path);
			}
		}

		context.next();
	},

	ArrayExpression(node, context) {
		for (const element of node.elements) {
			if (element !== null && element.type === 'Identifier' && is_tracked_name(element.name)) {
				mark_as_tracked(context.path);
			}
		}

		context.next();
	},

	VariableDeclaration(node, context) {
		const { state, visit, path } = context;

		for (const declarator of node.declarations) {
			const metadata = { tracking: false, await: false };
			const parent = path.at(-1);
			const init_is_untracked =
				declarator.init !== null &&
				declarator.init.type === 'CallExpression' &&
				is_svelte_import(declarator.init.callee, context) &&
				declarator.init.callee.type === 'Identifier' &&
				(declarator.init.callee.name === 'untrack' || declarator.init.callee.name === 'deferred');

			if (declarator.id.type === 'Identifier') {
				const binding = state.scope.get(declarator.id.name);

				if (binding !== null && parent?.type !== 'ForOfStatement') {
					if (is_tracked_name(declarator.id.name)) {
						binding.kind = 'tracked';

						mark_as_tracked(path);

						visit(declarator, { ...state, metadata });

						if (init_is_untracked && metadata.tracking) {
							metadata.tracking = false;
						}

						binding.transform = {
							read: (node) => {
								return metadata.tracking && !metadata.await
									? b.call('$.get_computed', node)
									: b.call('$.get_tracked', node);
							},
							assign: (node, value) => {
								return b.call('$.set', node, value, b.id('__block'));
							},
							update: (node) => {
								return b.call(
									node.prefix ? '$.update_pre' : '$.update',
									node.argument,
									b.id('__block'),
									node.operator === '--' && b.literal(-1),
								);
							},
						};
					} else if (binding.initial?.type !== 'Literal') {
						for (const ref of binding.references) {
							const path = ref.path;
							const parent_node = path?.at(-1);

							// We're reading a computed property, which might mean it's a reactive property
							if (parent_node?.type === 'MemberExpression' && parent_node.computed) {
								binding.transform = {
									assign: (node, value, computed) => {
										if (!computed) {
											return node;
										}
										return b.call('$.set_property', node, visit(computed), value, b.id('__block'));
									},
								};
								break;
							}
						}
					}

					visit(declarator, state);
				} else {
					visit(declarator, state);
				}
			} else {
				const paths = extract_paths(declarator.id);
				const has_tracked = paths.some(
					(path) => path.node.type === 'Identifier' && is_tracked_name(path.node.name),
				);

				if (has_tracked) {
					const tmp = state.scope.generate('tmp');
					declarator.transformed = b.id(tmp);

					if (declarator.init !== null) {
						visit(declarator.init, { ...state, metadata });
					}

					if (init_is_untracked && metadata.tracking) {
						metadata.tracking = false;
					}

					for (const path of paths) {
						const binding = state.scope.get(path.node.name);

						binding.transform = {
							read: (node) => {
								const value = path.expression?.(b.id(tmp));

								if (metadata.tracking && metadata.await) {
									// TODO
									debugger;
								} else if (metadata.tracking && !metadata.await) {
									if (is_tracked_name(path.node.name) && value.type === 'MemberExpression') {
										return b.call(
											'$.get_property',
											b.call('$.get_computed', value.object),
											value.property.type === 'Identifier'
												? b.literal(value.property.name)
												: value.property,
										);
									}

									const key =
										value.property.type === 'Identifier'
											? b.key(value.property.name)
											: value.property;

									return b.member(
										b.call('$.get_computed', value.object),
										key,
										key.type === 'Literal',
									);
								}

								if (is_tracked_name(path.node.name) && value.type === 'MemberExpression') {
									return b.call(
										'$.get_property',
										value.object,
										value.property.type === 'Identifier'
											? b.literal(value.property.name)
											: value.property,
									);
								}

								return value;
							},
						};
					}
				} else {
					visit(declarator, state);
				}
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

					if (binding !== null && is_tracked_name(name)) {
						binding.kind = 'prop';

						binding.transform = {
							read: (_) => b.call('$.get_property', b.id('__props'), b.literal(name)),
						};
					}
				}
			}
		}
		const elements = [];

		context.next({ ...context.state, elements });

		const css = node.css;

		if (css !== null) {
			for (const node of elements) {
				prune_css(css, node);
			}
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

	JSXElement(_, context) {
		{
			error(
				'Elements cannot be used as generic expressions, only as statements within a component',
				context.state.analysis.module.filename,
				node,
			);
		}
	},

	Element(node, { state, visit }) {
		const is_dom_element =
			node.id.type === 'Identifier' &&
			node.id.name[0].toLowerCase() === node.id.name[0] &&
			node.id.name[0] !== '$';
		const attribute_names = new Set();

		if (is_dom_element) {
			if (state.elements) {
				state.elements.push(node);
			}

			for (const attr of node.attributes) {
				if (attr.type === 'Attribute') {
					if (attr.name.type === 'Identifier') {
						attribute_names.add(attr.name);

						if (is_event_attribute(attr.name.name)) {
							const event_name = attr.name.name.slice(2).toLowerCase();
							const handler = visit(attr.value, state);
							const delegated_event = get_delegated_event(event_name, handler, state);

							if (delegated_event !== null) {
								if (delegated_event.hoisted) {
									delegated_event.function.metadata.hoisted = true;
									delegated_event.hoisted = true;
								}

								if (attr.metadata === undefined) {
									attr.metadata = {};
								}

								attr.metadata.delegated = delegated_event;
							}
						}
					}
				}
			}
		} else {
			for (const attr of node.attributes) {
				if (attr.type === 'Attribute') {
					if (attr.name.type === 'Identifier') {
						attribute_names.add(attr.name);
					}
				}
			}

			let implicit_children = false;
			let explicit_children = false;

			for (const child of node.children) {
				if (child.type === 'Component') {
					if (child.id.name === '$children') {
						explicit_children = true;
						if (implicit_children) {
							error(
								'Cannot have both implicit and explicit children',
								context.state.analysis.module.filename,
								node,
							);
						}
					}
				} else if (child.type !== 'EmptyStatement') {
					implicit_children = true;
					if (explicit_children) {
						error(
							'Cannot have both implicit and explicit children',
							context.state.analysis.module.filename,
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
				} else {
					error(
						'Cannot have a `children` prop on a component, did you mean `$children`?',
						state.analysis.module.filename,
						attribute,
					);
				}
			}

			if (is_tracked_name(name)) {
				attribute_names.forEach((n) => {
					if (n.name.slice(1) === name) {
						error(
							`Cannot have both ${name} and ${name.slice(1)} on the same element`,
							state.analysis.module.filename,
							n,
						);
					}
				});
			}
		}

		return {
			...node,
			children: node.children.map((child) => visit(child)),
		};
	},

	AwaitExpression(node, context) {
		if (is_inside_component(context)) {
			if (context.state.metadata?.await === false) {
				context.state.metadata.await = true;
			}
		}

		context.next();
	},
};

export function analyze(ast, filename) {
	const scope_root = new ScopeRoot();

	const { scope, scopes } = create_scopes(ast, scope_root, null);

	const analysis = {
		module: { ast, scope, scopes, filename },
		ast,
		scope,
		scopes,
	};

	walk(
		ast,
		{
			scope,
			scopes,
			analysis,
		},
		visitors,
	);

	return analysis;
}
