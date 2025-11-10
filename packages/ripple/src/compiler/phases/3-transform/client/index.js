/** @import {Expression, FunctionExpression, Node, Program, Statement} from 'estree' */

/** @typedef {Map<number, {offset: number, delta: number}>} PostProcessingChanges */
/** @typedef {number[]} LineOffsets */

import { walk } from 'zimmerframe';
import path from 'node:path';
import { print } from 'esrap';
import tsx from 'esrap/languages/tsx';
import * as b from '../../../../utils/builders.js';
import {
	IS_CONTROLLED,
	IS_INDEXED,
	TEMPLATE_FRAGMENT,
	TEMPLATE_SVG_NAMESPACE,
	TEMPLATE_MATHML_NAMESPACE,
} from '../../../../constants.js';
import { DEFAULT_NAMESPACE } from '../../../../runtime/internal/client/constants.js';
import { sanitize_template_string } from '../../../../utils/sanitize_template_string.js';
import {
	is_inside_component,
	build_assignment,
	visit_assignment_expression,
	escape_html,
	is_boolean_attribute,
	is_dom_property,
	is_declared_function_within_component,
	is_inside_call_expression,
	is_value_static,
	is_void_element,
	is_component_level_function,
	is_element_dom_element,
	is_top_level_await,
	is_ripple_track_call,
	normalize_children,
	build_getter,
	determine_namespace_for_children,
	index_to_key,
} from '../../../utils.js';
import is_reference from 'is-reference';
import { object } from '../../../../utils/ast.js';
import { render_stylesheets } from '../stylesheet.js';
import { is_event_attribute, is_passive_event } from '../../../../utils/events.js';
import { createHash } from 'node:crypto';

function add_ripple_internal_import(context) {
	if (!context.state.to_ts) {
		if (!context.state.imports.has(`import * as _$_ from 'ripple/internal/client'`)) {
			context.state.imports.add(`import * as _$_ from 'ripple/internal/client'`);
		}
	}
}

function visit_function(node, context) {
	// Function overload signatures don't have a body - they're TypeScript-only
	// Remove them when compiling to JavaScript
	if (!context.state.to_ts && !node.body) {
		return b.empty;
	}

	if (context.state.to_ts) {
		return context.next(context.state);
	}
	const metadata = node.metadata;
	const state = context.state;

	delete node.returnType;
	delete node.typeParameters;

	for (const param of node.params) {
		delete param.typeAnnotation;
		// Handle AssignmentPattern (parameters with default values)
		if (param.type === 'AssignmentPattern' && param.left) {
			delete param.left.typeAnnotation;
		}
	}

	let body = context.visit(node.body, {
		...state,
		// we are new context so tracking no longer applies
		metadata: { ...state.metadata, tracking: false },
	});

	if (metadata?.tracked === true) {
		const new_body = [];

		if (!is_inside_component(context, true) && is_component_level_function(context)) {
			add_ripple_internal_import(context);
			new_body.push(b.var('__block', b.call('_$_.scope')));
		}
		if (body.type === 'BlockStatement') {
			new_body.push(...body.body);
		}

		return /** @type {FunctionExpression} */ ({
			...node,
			params: node.params.map((param) => context.visit(param, state)),
			body: body.type === 'BlockStatement' ? { ...body, body: new_body } : body,
		});
	}

	context.next(state);
}

function visit_head_element(node, context) {
	const { state, visit } = context;

	const init = [];
	const update = [];
	const final = [];
	const template = [];

	transform_children(node.children, {
		visit,
		state: { ...state, init, update, final, template, inside_head: true },
		root: true,
	});

	if (init.length > 0 || update.length > 0 || final.length > 0) {
		context.state.init.push(
			b.call(
				'_$_.head',
				b.arrow(
					[b.id('__anchor')],
					b.block([...init, ...update.map((u) => u.operation), ...final]),
				),
			),
		);
	}
}

function apply_updates(init, update, state) {
	if (update.length === 1) {
		init.push(
			b.stmt(
				b.call(
					'_$_.render',
					b.thunk(
						b.block(
							update.map((u) => {
								if (u.initial) {
									return u.operation(u.expression);
								}
								return u.operation;
							}),
						),
						!!update.async,
					),
				),
			),
		);
	} else {
		const index_map = new Map();
		const initial = [];
		const render_statements = [];
		let index = 0;

		const grouped_updates = new Map();

		for (const u of update) {
			if (u.initial) {
				const id =
					u.identity.type === 'Identifier' ? state.scope.get(u.identity.name)?.initial : u.identity;
				let updates = grouped_updates.get(id);

				if (updates === undefined) {
					updates = [];
					grouped_updates.set(id, updates);
				}
				updates.push(u);
			}
		}

		for (const [, updates] of grouped_updates) {
			if (updates.length === 1) {
				const u = updates[0];
				const key = index_to_key(index);
				index_map.set(u.operation, key);
				initial.push(b.prop('init', b.id(key), u.initial));
				render_statements.push(
					b.var('__' + key, u.expression),
					b.if(
						b.binary('!==', b.member(b.id('__prev'), b.id(key)), b.id('__' + key)),
						b.block([
							u.operation(b.assignment('=', b.member(b.id('__prev'), b.id(key)), b.id('__' + key))),
						]),
					),
				);
				index++;
			} else {
				const key = index_to_key(index);
				/** @type {Array<Statement>} */
				const if_body = [
					b.stmt(b.assignment('=', b.member(b.id('__prev'), b.id(key)), b.id('__' + key))),
				];
				initial.push(b.prop('init', b.id(key), updates[0].initial));
				render_statements.push(
					b.var('__' + key, updates[0].expression),
					b.if(
						b.binary('!==', b.member(b.id('__prev'), b.id(key)), b.id('__' + key)),
						b.block(if_body),
					),
				);
				for (const u of updates) {
					index_map.set(u.operation, key);
					if_body.push(u.operation(b.id('__' + key)));
					index++;
				}
			}
		}

		for (const u of update) {
			if (!u.initial) {
				render_statements.push(u.operation);
			}
		}

		init.push(
			b.stmt(
				b.call(
					'_$_.render',
					b.arrow([b.id('__prev')], b.block(render_statements), !!update.async),
					b.object(initial),
				),
			),
		);
	}
}

function visit_title_element(node, context) {
	const normalized = normalize_children(node.children, context);
	const content = normalized[0];

	const metadata = { tracking: false, await: false };
	const result = context.visit(content, { ...context.state, metadata }).expression;

	if (metadata.tracking) {
		context.state.init.push(
			b.stmt(
				b.call(
					'_$_.render',
					b.thunk(b.block([b.assignment('=', b.id('_$_.document.title'), result)])),
				),
			),
		);
	} else {
		context.state.init.push(b.stmt(b.assignment('=', b.id('_$_.document.title'), result)));
	}
}

/**
 * @param {string} name
 * @param {any} context
 * @returns {string}
 */
function import_from_ripple_if_needed(name, context) {
	const alias = context.state.ripple_user_imports?.get?.(name);

	if (!alias && !context.state.imports.has(`import { ${name} } from 'ripple'`)) {
		context.state.imports.add(`import { ${name} } from 'ripple'`);
	}

	return alias ?? name;
}

const visitors = {
	_: function set_scope(node, { next, state }) {
		const scope = state.scopes.get(node);

		if (scope && scope !== state.scope) {
			return next({ ...state, scope });
		} else {
			return next();
		}
	},

	Identifier(node, context) {
		const parent = /** @type {Node} */ (context.path.at(-1));

		if (is_reference(node, parent)) {
			if (context.state.to_ts) {
				if (node.tracked) {
					// Check if this identifier is used as a dynamic component/element
					// by checking if it has a capitalized name in metadata
					const binding = context.state.scope.get(node.name);
					if (binding?.metadata?.is_dynamic_component) {
						// Capitalize the identifier for TypeScript
						const capitalized_name = node.name.charAt(0).toUpperCase() + node.name.slice(1);
						const capitalized_node = {
							...node,
							name: capitalized_name,
							metadata: {
								...node.metadata,
								original_name: node.name,
								is_capitalized: true,
							},
						};
						return b.member(capitalized_node, b.literal('#v'), true);
					}
					return b.member(node, b.literal('#v'), true);
				}
			} else {
				const binding = context.state.scope.get(node.name);
				const is_right_side_of_assignment =
					parent.type === 'AssignmentExpression' && parent.right === node;
				if (
					(context.state.metadata?.tracking === false ||
						(parent.type !== 'AssignmentExpression' && parent.type !== 'UpdateExpression') ||
						is_right_side_of_assignment) &&
					(node.tracked ||
						binding?.kind === 'prop' ||
						binding?.kind === 'index' ||
						binding?.kind === 'prop_fallback' ||
						binding?.kind === 'for_pattern') &&
					binding?.node !== node
				) {
					if (context.state.metadata?.tracking === false) {
						context.state.metadata.tracking = true;
					}
					if (node.tracked) {
						add_ripple_internal_import(context);
						return b.call('_$_.get', build_getter(node, context));
					}
				}
				add_ripple_internal_import(context);
				return build_getter(node, context);
			}
		}
	},

	ServerIdentifier(node, context) {
		return b.id('_$_server_$_');
	},

	ImportDeclaration(node, context) {
		if (!context.state.to_ts && node.importKind === 'type') {
			return b.empty;
		}

		return {
			...node,
			specifiers: node.specifiers
				.filter((spec) => context.state.to_ts || spec.importKind !== 'type')
				.map((spec) => context.visit(spec)),
		};
	},

	TSNonNullExpression(node, context) {
		if (context.state.to_ts) {
			return context.next();
		}
		return context.visit(node.expression);
	},

	CallExpression(node, context) {
		if (!context.state.to_ts) {
			delete node.typeArguments;
		}
		const callee = node.callee;
		const parent = context.path.at(-1);

		if (context.state.metadata?.tracking === false) {
			context.state.metadata.tracking = true;
		}

		if (!context.state.to_ts && is_ripple_track_call(callee, context)) {
			if (callee.name === 'track') {
				if (node.arguments.length === 0) {
					node.arguments.push(b.void0, b.void0, b.void0);
				} else if (node.arguments.length === 1) {
					node.arguments.push(b.void0, b.void0);
				} else if (node.arguments.length === 2) {
					node.arguments.push(b.void0);
				}
			}
			return {
				...node,
				arguments: [...node.arguments.map((arg) => context.visit(arg)), b.id('__block')],
			};
		}

		if (
			!is_inside_component(context, true) ||
			context.state.to_ts ||
			(parent?.type === 'MemberExpression' && parent.property === node) ||
			is_inside_call_expression(context) ||
			!context.path.some((node) => node.type === 'Component') ||
			is_declared_function_within_component(callee, context)
		) {
			return context.next();
		}

		// Handle array methods that access the array
		if (callee.type === 'MemberExpression') {
			const property = callee.property;

			if (callee.computed) {
				return b.call(
					'_$_.with_scope',
					b.id('__block'),
					b.thunk(
						b.call(
							'_$_.call_property',
							context.visit(callee.object),
							context.visit(property),
							callee.optional ? b.true : undefined,
							node.optional ? b.true : undefined,
							...node.arguments.map((arg) => context.visit(arg)),
						),
					),
				);
			}
		}

		return b.call(
			'_$_.with_scope',
			b.id('__block'),
			b.thunk(
				{
					...node,
					callee: context.visit(callee),
					arguments: node.arguments.map((arg) => context.visit(arg)),
				},
				context.state.metadata?.await ?? false,
			),
		);
	},

	TSTypeAliasDeclaration(_, context) {
		if (!context.state.to_ts) {
			return b.empty;
		}
		return context.next();
	},

	TSInterfaceDeclaration(_, context) {
		if (!context.state.to_ts) {
			return b.empty;
		}
		return context.next();
	},

	TSMappedType(_, context) {
		if (!context.state.to_ts) {
			return b.empty;
		}
		return context.next();
	},

	NewExpression(node, context) {
		const callee = node.callee;

		if (context.state.metadata?.tracking === false) {
			context.state.metadata.tracking = true;
		}

		// Special handling for TrackedMapExpression and TrackedSetExpression
		// When source is "new #Map(...)", the callee is TrackedMapExpression with empty arguments
		// and the actual arguments are in NewExpression.arguments
		if (callee.type === 'TrackedMapExpression' || callee.type === 'TrackedSetExpression') {
			// Use NewExpression's arguments (the callee has empty arguments from parser)
			const argsToUse = node.arguments.length > 0 ? node.arguments : callee.arguments;

			if (context.state.to_ts) {
				const className = callee.type === 'TrackedMapExpression' ? 'TrackedMap' : 'TrackedSet';
				const alias = import_from_ripple_if_needed(className, context);
				const calleeId = b.id(alias);
				calleeId.loc = callee.loc;
				calleeId.metadata = {
					tracked_shorthand: callee.type === 'TrackedMapExpression' ? '#Map' : '#Set',
				};
				return b.new(calleeId, ...argsToUse.map((arg) => context.visit(arg)));
			}

			const helperName = callee.type === 'TrackedMapExpression' ? 'tracked_map' : 'tracked_set';
			return b.call(
				`_$_.${helperName}`,
				b.id('__block'),
				...argsToUse.map((arg) => context.visit(arg)),
			);
		}

		if (
			context.state.to_ts ||
			!is_inside_component(context, true) ||
			is_inside_call_expression(context) ||
			is_value_static(node)
		) {
			if (!context.state.to_ts) {
				delete node.typeArguments;
			}

			return context.next();
		}

		const new_node = {
			...node,
			callee: context.visit(callee),
			arguments: node.arguments.map((arg) => context.visit(arg)),
		};
		if (!context.state.to_ts) {
			delete new_node.typeArguments;
		}

		return b.call('_$_.with_scope', b.id('__block'), b.thunk(new_node));
	},

	TrackedArrayExpression(node, context) {
		if (context.state.to_ts) {
			const arrayAlias = import_from_ripple_if_needed('TrackedArray', context);

			return b.call(
				b.member(b.id(arrayAlias), b.id('from')),
				b.array(node.elements.map((el) => context.visit(el))),
			);
		}

		return b.call(
			'_$_.tracked_array',
			b.array(node.elements.map((el) => context.visit(el))),
			b.id('__block'),
		);
	},

	TrackedObjectExpression(node, context) {
		if (context.state.to_ts) {
			const objectAlias = import_from_ripple_if_needed('TrackedObject', context);

			return b.new(b.id(objectAlias), b.object(node.properties.map((prop) => context.visit(prop))));
		}

		return b.call(
			'_$_.tracked_object',
			b.object(node.properties.map((prop) => context.visit(prop))),
			b.id('__block'),
		);
	},

	TrackedExpression(node, context) {
		return b.call('_$_.get', context.visit(node.argument));
	},

	MemberExpression(node, context) {
		const parent = context.path.at(-1);

		if (context.state.metadata?.tracking === false) {
			context.state.metadata.tracking = true;
		}

		if (node.tracked || (node.property.type === 'Identifier' && node.property.tracked)) {
			// In TypeScript mode, skip the transformation and let transform_ts_child handle it
			add_ripple_internal_import(context);

			if (!context.state.to_ts) {
				return b.call(
					'_$_.get_property',
					context.visit(node.object),
					node.computed ? context.visit(node.property) : b.literal(node.property.name),
					node.optional ? b.true : undefined,
				);
			}
		}

		if (node.object.type === 'MemberExpression' && node.object.optional) {
			const metadata = { tracking: false, await: false };

			const object = context.visit(node.object, { ...context.state, metadata });

			if (metadata.tracking) {
				if (context.state.metadata?.tracking === false) {
					context.state.metadata.tracking = true;
				}

				return {
					...node,
					optional: true,
					object,
					property: context.visit(node.property),
				};
			}
			if (metadata.await) {
				if (context.state.metadata?.await === false) {
					context.state.metadata.await = true;
				}
			}
		} else {
			return context.next();
		}
	},

	PropertyDefinition(node, context) {
		if (!context.state.to_ts) {
			delete node.typeAnnotation;
		}
		return context.next();
	},

	VariableDeclaration(node, context) {
		for (const declarator of node.declarations) {
			if (!context.state.to_ts) {
				delete declarator.id.typeAnnotation;
			}
		}

		return context.next();
	},

	VariableDeclarator(node, context) {
		// In TypeScript mode, capitalize identifiers that are used as dynamic components
		if (context.state.to_ts) {
			/**
			 * Recursively capitalize identifiers in patterns (ArrayPattern, ObjectPattern)
			 * @param {any} pattern - The pattern node to process
			 * @returns {any} The transformed pattern
			 */
			const capitalize_pattern = (pattern) => {
				if (pattern.type === 'Identifier') {
					const binding = context.state.scope.get(pattern.name);
					if (binding?.metadata?.is_dynamic_component) {
						const capitalized_name = pattern.name.charAt(0).toUpperCase() + pattern.name.slice(1);
						// Add metadata to track the original name for Volar mappings
						return {
							...pattern,
							name: capitalized_name,
							metadata: {
								...pattern.metadata,
								original_name: pattern.name,
								is_capitalized: true,
							},
						};
					}
					return pattern;
				} else if (pattern.type === 'ArrayPattern') {
					return {
						...pattern,
						elements: pattern.elements.map((element) =>
							element ? capitalize_pattern(element) : element,
						),
					};
				} else if (pattern.type === 'ObjectPattern') {
					return {
						...pattern,
						properties: pattern.properties.map((prop) => {
							if (prop.type === 'Property') {
								return {
									...prop,
									value: capitalize_pattern(prop.value),
								};
							} else if (prop.type === 'RestElement') {
								return {
									...prop,
									argument: capitalize_pattern(prop.argument),
								};
							}
							return prop;
						}),
					};
				} else if (pattern.type === 'RestElement') {
					return {
						...pattern,
						argument: capitalize_pattern(pattern.argument),
					};
				} else if (pattern.type === 'AssignmentPattern') {
					return {
						...pattern,
						left: capitalize_pattern(pattern.left),
						right: context.visit(pattern.right),
					};
				}
				return pattern;
			};

			const transformed_id = capitalize_pattern(node.id);
			if (transformed_id !== node.id) {
				return {
					...node,
					id: transformed_id,
					init: node.init ? context.visit(node.init) : null,
				};
			}
		}
		return context.next();
	},

	FunctionDeclaration(node, context) {
		return visit_function(node, context);
	},

	ArrowFunctionExpression(node, context) {
		return visit_function(node, context);
	},

	FunctionExpression(node, context) {
		return visit_function(node, context);
	},

	JSXText(node, context) {
		if (context.state.to_ts) {
			return context.next();
		}
		return b.literal(node.value + '');
	},

	JSXIdentifier(node, context) {
		if (context.state.to_ts) {
			return context.next();
		}
		return b.id(node.name);
	},

	JSXExpressionContainer(node, context) {
		if (context.state.to_ts) {
			return context.next();
		}
		return context.visit(node.expression);
	},

	JSXFragment(node, context) {
		if (context.state.to_ts) {
			return context.next();
		}
		const attributes = node.openingFragment.attributes;
		const normalized_children = node.children.filter((child) => {
			return child.type !== 'JSXText' || child.value.trim() !== '';
		});

		const props = b.object(
			attributes.map((attr) => {
				if (attr.type === 'JSXAttribute') {
					return b.prop('init', context.visit(attr.name), context.visit(attr.value));
				} else if (attr.type === 'JSXSpreadAttribute') {
					return b.spread(context.visit(attr.argument));
				}
			}),
		);

		if (normalized_children.length > 0) {
			props.properties.push(
				b.prop(
					'init',
					b.id('children'),
					normalized_children.length === 1
						? context.visit(normalized_children[0])
						: b.array(normalized_children.map((child) => context.visit(child))),
				),
			);
		}

		return b.call(
			normalized_children.length > 1 ? '__compat.jsxs' : '__compat.jsx',
			b.id('__compat.Fragment'),
			props,
		);
	},

	JSXElement(node, context) {
		if (context.state.to_ts) {
			return context.next();
		}
		const name = node.openingElement.name;
		const attributes = node.openingElement.attributes;
		const normalized_children = node.children.filter((child) => {
			return child.type !== 'JSXText' || child.value.trim() !== '';
		});

		const props = b.object(
			attributes.map((attr) => {
				if (attr.type === 'JSXAttribute') {
					return b.prop('init', context.visit(attr.name), context.visit(attr.value));
				} else if (attr.type === 'JSXSpreadAttribute') {
					return b.spread(context.visit(attr.argument));
				}
			}),
		);

		if (normalized_children.length > 0) {
			props.properties.push(
				b.prop(
					'init',
					b.id('children'),
					normalized_children.length === 1
						? context.visit(normalized_children[0])
						: b.array(normalized_children.map((child) => context.visit(child))),
				),
			);
		}

		return b.call(
			normalized_children.length > 1 ? '__compat.jsxs' : '__compat.jsx',
			name.type === 'JSXIdentifier' && name.name[0].toLowerCase() === name.name[0]
				? b.literal(name.name)
				: context.visit(name),
			props,
		);
	},

	TsxCompat(node, context) {
		const { state, visit } = context;

		state.template.push('<!>');

		const normalized_children = node.children.filter((child) => {
			return child.type !== 'JSXText' || child.value.trim() !== '';
		});
		const needs_fragment = normalized_children.length !== 1;
		const id = state.flush_node();
		const children_fn = b.arrow(
			[b.id('__compat')],
			needs_fragment
				? b.call(
						'__compat.jsxs',
						b.id('__compat.Fragment'),
						b.object([
							b.prop(
								'init',
								b.id('children'),
								b.array(normalized_children.map((child) => visit(child, state))),
							),
						]),
					)
				: visit(normalized_children[0], state),
		);

		context.state.init.push(
			b.stmt(b.call('_$_.tsx_compat', b.literal(node.kind), id, children_fn)),
		);
	},

	Element(node, context) {
		const { state, visit } = context;

		if (context.state.inside_head) {
			if (node.id.type === 'Identifier' && node.id.name === 'style') {
				state.template.push(`<style>${sanitize_template_string(node.css)}</style>`);
				return;
			}
			if (node.id.type === 'Identifier' && node.id.name === 'script') {
				const id = state.flush_node();
				state.template.push('<!>');
				context.state.init.push(
					b.stmt(b.call('_$_.script', id, b.literal(sanitize_template_string(node.content)))),
				);
				return;
			}
		}

		const is_dom_element = is_element_dom_element(node);
		const is_spreading = node.attributes.some((attr) => attr.type === 'SpreadAttribute');
		const spread_attributes = is_spreading ? [] : null;
		const child_namespace = is_dom_element
			? determine_namespace_for_children(node.id.name, state.namespace)
			: state.namespace;

		const handle_static_attr = (name, value) => {
			const attr_value = b.literal(
				` ${name}${
					is_boolean_attribute(name) && value === true
						? ''
						: `="${value === true ? '' : escape_html(value, true)}"`
				}`,
			);

			if (is_spreading) {
				// For spread attributes, store just the actual value, not the full attribute string
				const actual_value =
					is_boolean_attribute(name) && value === true
						? b.literal(true)
						: b.literal(value === true ? '' : value);
				spread_attributes.push(b.prop('init', b.literal(name), actual_value));
			} else {
				state.template.push(attr_value);
			}
		};

		if (is_dom_element) {
			let class_attribute = null;
			let style_attribute = null;
			/** @type {Array<Statement>} */
			const local_updates = [];
			const is_void = is_void_element(node.id.name);

			let scoping_hash = null;
			if (node.metadata.scoped && state.component.css) {
				scoping_hash = state.component.css.hash;
			} else {
				let inside_dynamic_children = false;
				for (let i = context.path.length - 1; i >= 0; i--) {
					const anc = context.path[i];
					if (anc && anc.type === 'Component' && anc.metadata && anc.metadata.inherited_css) {
						inside_dynamic_children = true;
						break;
					}
				}
				if (inside_dynamic_children) {
					for (let i = context.path.length - 1; i >= 0; i--) {
						const anc = context.path[i];
						if (anc && anc.type === 'Component' && anc.css) {
							scoping_hash = anc.css.hash;
							break;
						}
					}
				}
			}

			state.template.push(`<${node.id.name}`);

			for (const attr of node.attributes) {
				if (attr.type === 'Attribute') {
					if (attr.name.type === 'Identifier') {
						const name = attr.name.name;

						if (attr.value === null) {
							handle_static_attr(name, true);
							continue;
						}

						if (attr.value.type === 'Literal' && name !== 'class' && name !== 'style') {
							handle_static_attr(name, attr.value.value);
							continue;
						}

						if (name === 'class') {
							class_attribute = attr;

							continue;
						}

						if (name === 'style') {
							style_attribute = attr;

							continue;
						}

						if (name === 'value') {
							const id = state.flush_node();
							const metadata = { tracking: false, await: false };
							const expression = visit(attr.value, { ...state, metadata });

							if (metadata.tracking) {
								local_updates.push({ operation: b.stmt(b.call('_$_.set_value', id, expression)) });
							} else {
								state.init.push(b.stmt(b.call('_$_.set_value', id, expression)));
							}

							continue;
						}

						if (name === 'checked') {
							const id = state.flush_node();
							const metadata = { tracking: false, await: false };
							const expression = visit(attr.value, { ...state, metadata });

							if (name === '$checked' || metadata.tracking) {
								local_updates.push({
									operation: b.stmt(b.call('_$_.set_checked', id, expression)),
								});
							} else {
								state.init.push(b.stmt(b.call('_$_.set_checked', id, expression)));
							}
							continue;
						}

						if (name === 'selected') {
							const id = state.flush_node();
							const metadata = { tracking: false, await: false };
							const expression = visit(attr.value, { ...state, metadata });

							if (metadata.tracking) {
								local_updates.push({
									operation: b.stmt(b.call('_$_.set_selected', id, expression)),
								});
							} else {
								state.init.push(b.stmt(b.call('_$_.set_selected', id, expression)));
							}
							continue;
						}

						if (is_event_attribute(name)) {
							let capture = name.endsWith('Capture');
							let event_name = capture
								? name.slice(2, -7).toLowerCase()
								: name.slice(2).toLowerCase();
							let handler = visit(attr.value, state);

							if (attr.metadata?.delegated) {
								let delegated_assignment;

								if (!state.events.has(event_name)) {
									state.events.add(event_name);
								}

								if (
									(handler.type === 'Identifier' &&
										is_declared_function_within_component(handler, context)) ||
									handler.type === 'ArrowFunctionExpression' ||
									handler.type === 'FunctionExpression'
								) {
									delegated_assignment = handler;
								} else {
									delegated_assignment = b.array([handler, b.id('__block')]);
								}
								const id = state.flush_node();

								state.init.push(
									b.stmt(b.assignment('=', b.member(id, '__' + event_name), delegated_assignment)),
								);
							} else {
								const passive = is_passive_event(event_name);
								const id = state.flush_node();

								state.init.push(
									b.stmt(
										b.call(
											'_$_.event',
											b.literal(event_name),
											id,
											handler,
											capture && b.true,
											passive === undefined ? undefined : b.literal(passive),
										),
									),
								);
							}

							continue;
						}

						const metadata = { tracking: false, await: false };
						const expression = visit(attr.value, { ...state, metadata });
						// All other attributes
						if (metadata.tracking) {
							const attribute = name;
							const id = state.flush_node();

							if (is_dom_property(attribute)) {
								local_updates.push({
									operation: b.stmt(b.assignment('=', b.member(id, attribute), expression)),
								});
							} else {
								local_updates.push({
									operation: (key) =>
										b.stmt(b.call('_$_.set_attribute', id, b.literal(attribute), key)),
									expression,
									identity: attr.value,
									initial: b.void0,
								});
							}
						} else {
							const id = state.flush_node();

							if (is_dom_property(name)) {
								state.init.push(b.stmt(b.assignment('=', b.member(id, name), expression)));
							} else {
								state.init.push(
									b.stmt(b.call('_$_.set_attribute', id, b.literal(name), expression)),
								);
							}
						}
					}
				} else if (attr.type === 'SpreadAttribute') {
					spread_attributes.push(b.spread(visit(attr.argument, state)));
				} else if (attr.type === 'RefAttribute') {
					const id = state.flush_node();
					state.init.push(b.stmt(b.call('_$_.ref', id, b.thunk(visit(attr.argument, state)))));
				}
			}

			if (class_attribute !== null) {
				if (class_attribute.value.type === 'Literal') {
					let value = class_attribute.value.value;

					if (scoping_hash) {
						value = `${scoping_hash} ${value}`;
					}

					handle_static_attr(class_attribute.name.name, value);
				} else {
					const id = state.flush_node();
					const metadata = { tracking: false, await: false };
					let expression = visit(class_attribute.value, { ...state, metadata });

					const hash_arg = scoping_hash ? b.literal(scoping_hash) : undefined;
					const is_html = context.state.namespace === 'html' && node.id.name !== 'svg';

					if (metadata.tracking) {
						local_updates.push({
							operation: (key) =>
								b.stmt(b.call('_$_.set_class', id, key, hash_arg, b.literal(is_html))),
							expression,
							identity: class_attribute.value,
							initial: b.literal(''),
						});
					} else {
						state.init.push(
							b.stmt(b.call('_$_.set_class', id, expression, hash_arg, b.literal(is_html))),
						);
					}
				}
			} else if (scoping_hash) {
				handle_static_attr(is_spreading ? '#class' : 'class', scoping_hash);
			}

			if (style_attribute !== null) {
				if (style_attribute.value.type === 'Literal') {
					handle_static_attr(style_attribute.name.name, style_attribute.value.value);
				} else {
					const id = state.flush_node();
					const metadata = { tracking: false, await: false };
					const expression = visit(style_attribute.value, { ...state, metadata });

					if (metadata.tracking) {
						local_updates.push({
							operation: (key) => b.stmt(b.call('_$_.set_style', id, key)),
							identity: style_attribute.value,
							expression,
							initial: b.void0,
						});
					} else {
						state.init.push(b.stmt(b.call('_$_.set_style', id, expression)));
					}
				}
			}

			state.template.push('>');

			if (spread_attributes !== null && spread_attributes.length > 0) {
				const id = state.flush_node();
				state.init.push(
					b.stmt(b.call('_$_.render_spread', id, b.thunk(b.object(spread_attributes)))),
				);
			}

			/** @type {Array<Statement>} */
			const init = [];
			/** @type {Array<Statement>} */
			const update = [];

			if (!is_void) {
				transform_children(node.children, {
					visit,
					state: { ...state, init, update, namespace: child_namespace },
					root: false,
				});
				state.template.push(`</${node.id.name}>`);
			}

			update.push(...local_updates);

			if (update.length > 0) {
				if (state.scope.parent.declarations.size > 0) {
					apply_updates(init, update, state);
				} else {
					state.update.push(...update);
				}
			}

			if (init.length > 0) {
				state.init.push(b.block(init));
			}
		} else {
			const id = state.flush_node();

			state.template.push('<!>');

			const is_spreading = node.attributes.some((attr) => attr.type === 'SpreadAttribute');
			const props = [];
			let children_prop = null;

			for (const attr of node.attributes) {
				if (attr.type === 'Attribute') {
					if (attr.name.type === 'Identifier') {
						const metadata = { tracking: false, await: false };
						let property =
							attr.value === null ? b.literal(true) : visit(attr.value, { ...state, metadata });

						if (attr.name.name === 'class' && node.metadata.scoped && state.component.css) {
							if (property.type === 'Literal') {
								property = b.literal(`${state.component.css.hash} ${property.value}`);
							} else {
								property = b.array([property, b.literal(state.component.css.hash)]);
							}
						}

						if (metadata.tracking || attr.name.tracked) {
							if (attr.name.name === 'children') {
								children_prop = b.thunk(property);
								continue;
							}

							props.push(
								b.prop(
									'get',
									b.key(attr.name.name),
									b.function(null, [], b.block([b.return(property)])),
								),
							);
						} else {
							props.push(b.prop('init', b.key(attr.name.name), property));
						}
					} else {
						props.push(b.prop('init', b.key(attr.name.name), visit(attr.value, state)));
					}
				} else if (attr.type === 'SpreadAttribute') {
					props.push(
						b.spread(
							visit(attr.argument, { ...state, metadata: { ...state.metadata, spread: true } }),
						),
					);
				} else if (attr.type === 'RefAttribute') {
					const ref_id = state.scope.generate('ref');
					state.setup.push(b.var(ref_id, b.call('_$_.ref_prop')));
					props.push(b.prop('init', b.id(ref_id), visit(attr.argument, state), true));
				} else {
					throw new Error('TODO');
				}
			}

			if (node.metadata.scoped && state.component.css) {
				const hasClassAttr = node.attributes.some(
					(attr) =>
						attr.type === 'Attribute' &&
						attr.name.type === 'Identifier' &&
						attr.name.name === 'class',
				);
				if (!hasClassAttr) {
					const name = is_spreading ? '#class' : 'class';
					const value = state.component.css.hash;
					props.push(b.prop('init', b.key(name), b.literal(value)));
				}
			}

			const children_filtered = [];

			for (const child of node.children) {
				if (child.type === 'Component') {
					const id = child.id;
					props.push(b.prop('init', id, visit(child, { ...state, namespace: child_namespace })));
				} else {
					children_filtered.push(child);
				}
			}

			if (children_filtered.length > 0) {
				const component_scope = context.state.scopes.get(node);
				const children_component = b.component(b.id('children'), [], children_filtered);

				children_component.metadata = {
					...(children_component.metadata || {}),
					inherited_css: true,
				};

				const children = visit(children_component, {
					...context.state,
					scope: component_scope,
					namespace: child_namespace,
				});

				if (children_prop) {
					children_prop.body = b.logical('??', children_prop.body, children);
				} else {
					props.push(b.prop('init', b.id('children'), children));
				}
			}

			const metadata = { tracking: false, await: false };
			// We visit, but only to gather metadata
			b.call(visit(node.id, { ...state, metadata }));

			// We're calling a component from within svg/mathml context
			const is_with_ns = state.namespace !== DEFAULT_NAMESPACE;

			let object_props;
			if (is_spreading) {
				// Optimization: if only one spread with no other props, pass it directly
				if (props.length === 1 && props[0].type === 'SpreadElement') {
					object_props = b.call('_$_.spread_props', b.thunk(props[0].argument));
				} else {
					// Multiple items: build array of objects/spreads for proper merge order
					const items = [];
					let current_obj_props = [];

					for (const prop of props) {
						if (prop.type === 'SpreadElement') {
							// Flush accumulated regular props as an object
							if (current_obj_props.length > 0) {
								items.push(b.object(current_obj_props));
								current_obj_props = [];
							}
							// Add the spread argument directly
							items.push(prop.argument);
						} else {
							// Accumulate regular properties
							current_obj_props.push(prop);
						}
					}

					// Flush any remaining regular props
					if (current_obj_props.length > 0) {
						items.push(b.object(current_obj_props));
					}

					object_props = b.call('_$_.spread_props', b.thunk(b.array(items)));
				}
			} else {
				object_props = b.object(props);
			}
			if (metadata.tracking) {
				const shared = b.call('_$_.composite', b.thunk(visit(node.id, state)), id, object_props);
				state.init.push(
					is_with_ns
						? b.call('_$_.with_ns', b.literal(state.namespace), b.thunk(shared))
						: b.stmt(shared),
				);
			} else {
				const shared = b.call(visit(node.id, state), id, object_props, b.id('_$_.active_block'));
				state.init.push(
					is_with_ns
						? b.call('_$_.with_ns', b.literal(state.namespace), b.thunk(shared))
						: b.stmt(shared),
				);
			}
		}
	},

	Component(node, context) {
		let prop_statements;

		add_ripple_internal_import(context);

		const metadata = { await: false };

		if (context.state.to_ts) {
			const body_statements = [
				...transform_body(node.body, {
					...context,
					state: { ...context.state, component: node, metadata },
				}),
			];

			const func = b.function(
				node.id,
				node.params.map((param) => context.visit(param, { ...context.state, metadata })),
				b.block(body_statements),
			);
			// Mark that this function was originally a component
			func.metadata = { ...func.metadata, was_component: true };
			func.loc = node.loc; // Copy source location for Volar mappings
			return func;
		}

		let props = b.id('__props');

		if (node.params.length > 0) {
			let props_param = node.params[0];

			if (props_param.type === 'Identifier') {
				delete props_param.typeAnnotation;
				props = props_param;
			} else if (props_param.type === 'ObjectPattern') {
				delete props_param.typeAnnotation;
			}
		}

		const body_statements = [
			b.stmt(b.call('_$_.push_component')),
			...transform_body(node.body, {
				...context,
				state: { ...context.state, component: node, metadata },
			}),
			b.stmt(b.call('_$_.pop_component')),
		];

		if (node.css !== null && node.css) {
			context.state.stylesheets.push(node.css);
		}

		const func = b.function(
			node.id,
			node.params.length > 0
				? [b.id('__anchor'), props, b.id('__block')]
				: [b.id('__anchor'), b.id('_'), b.id('__block')],
			b.block([
				...(prop_statements ?? []),
				...(metadata.await
					? [b.stmt(b.call('_$_.async', b.thunk(b.block(body_statements), true)))]
					: body_statements),
			]),
		);
		// Mark that this function was originally a component
		func.metadata = { ...func.metadata, was_component: true };
		func.loc = node.loc; // Copy source location for Volar mappings
		return func;
	},

	AssignmentExpression(node, context) {
		if (context.state.to_ts) {
			return context.next();
		}

		const left = node.left;

		if (
			left.type === 'MemberExpression' &&
			(left.tracked || (left.property.type === 'Identifier' && left.property.tracked))
		) {
			add_ripple_internal_import(context);
			const operator = node.operator;
			const right = node.right;

			if (operator !== '=' && context.state.metadata?.tracking === false) {
				context.state.metadata.tracking = true;
			}

			return b.call(
				'_$_.set_property',
				context.visit(left.object, { ...context.state, metadata: { tracking: false } }),
				left.computed ? context.visit(left.property) : b.literal(left.property.name),
				operator === '='
					? context.visit(right)
					: b.binary(
							operator === '+=' ? '+' : operator === '-=' ? '-' : operator === '*=' ? '*' : '/',
							/** @type {Expression} */ (context.visit(left)),
							/** @type {Expression} */ (context.visit(right)),
						),
			);
		}

		if (left.type === 'Identifier' && left.tracked) {
			add_ripple_internal_import(context);
			const operator = node.operator;
			const right = node.right;

			return b.call(
				'_$_.set',
				context.visit(left, { ...context.state, metadata: { tracking: null } }),
				operator === '='
					? context.visit(right)
					: b.binary(
							operator === '+=' ? '+' : operator === '-=' ? '-' : operator === '*=' ? '*' : '/',
							/** @type {Expression} */ (
								context.visit(left, { ...context.state, metadata: { tracking: false } })
							),
							/** @type {Expression} */ (context.visit(right)),
						),
			);
		}

		return visit_assignment_expression(node, context, build_assignment) ?? context.next();
	},

	UpdateExpression(node, context) {
		if (context.state.to_ts) {
			return context.next();
		}
		const argument = node.argument;

		if (
			argument.type === 'MemberExpression' &&
			(argument.tracked || (argument.property.type === 'Identifier' && argument.property.tracked))
		) {
			add_ripple_internal_import(context);
			if (context.state.metadata?.tracking === false) {
				context.state.metadata.tracking = true;
			}

			return b.call(
				node.prefix ? '_$_.update_pre_property' : '_$_.update_property',
				context.visit(argument.object, { ...context.state, metadata: { tracking: false } }),
				argument.computed ? context.visit(argument.property) : b.literal(argument.property.name),
				node.operator === '--' ? b.literal(-1) : undefined,
			);
		}

		if (argument.type === 'Identifier' && argument.tracked) {
			return b.call(
				node.prefix ? '_$_.update_pre' : '_$_.update',
				context.visit(argument, { ...context.state, metadata: { tracking: null } }),
				node.operator === '--' ? b.literal(-1) : undefined,
			);
		}

		if (argument.type === 'TrackedExpression') {
			return b.call(
				node.prefix ? '_$_.update_pre' : '_$_.update',
				context.visit(argument.argument, { ...context.state, metadata: { tracking: null } }),
				node.operator === '--' ? b.literal(-1) : undefined,
			);
		}

		const left = object(argument);
		const binding = left && context.state.scope.get(left.name);
		const transformers = left && binding?.transform;

		if (left === argument) {
			const update_fn = transformers?.update || transformers?.update_tracked;
			if (update_fn) {
				return update_fn(node);
			}
		}

		context.next();
	},

	ForOfStatement(node, context) {
		if (!is_inside_component(context)) {
			return context.next();
		}
		const is_controlled = node.is_controlled;
		const index = node.index;
		const key = node.key;
		let flags = is_controlled ? IS_CONTROLLED : 0;

		if (index != null) {
			flags |= IS_INDEXED;
		}

		// do only if not controller
		if (!is_controlled) {
			context.state.template.push('<!>');
		}

		const id = context.state.flush_node(is_controlled);
		const pattern = node.left.declarations[0].id;
		const body_scope = context.state.scopes.get(node.body);

		context.state.init.push(
			b.stmt(
				b.call(
					key != null ? '_$_.for_keyed' : '_$_.for',
					id,
					b.thunk(context.visit(node.right)),
					b.arrow(
						index ? [b.id('__anchor'), pattern, index] : [b.id('__anchor'), pattern],
						b.block(
							transform_body(node.body.body, {
								...context,
								state: { ...context.state, scope: body_scope, namespace: context.state.namespace },
							}),
						),
					),
					b.literal(flags),
					key != null
						? b.arrow(index ? [pattern, index] : [pattern], context.visit(key))
						: undefined,
				),
			),
		);
	},

	SwitchStatement(node, context) {
		if (!is_inside_component(context)) {
			return context.next();
		}
		context.state.template.push('<!>');

		const id = context.state.flush_node();
		const statements = [];
		const cases = [];

		let i = 1;

		for (const switch_case of node.cases) {
			const consequent_scope =
				context.state.scopes.get(switch_case.consequent) || context.state.scope;
			const consequent_id = context.state.scope.generate(
				'switch_case_' + (switch_case.test == null ? 'default' : i),
			);
			const consequent = b.block(
				transform_body(switch_case.consequent, {
					...context,
					state: { ...context.state, scope: consequent_scope },
				}),
			);

			statements.push(b.var(b.id(consequent_id), b.arrow([b.id('__anchor')], consequent)));

			cases.push(
				b.switch_case(switch_case.test ? context.visit(switch_case.test) : null, [
					b.return(b.id(consequent_id)),
				]),
			);
			i++;
		}

		statements.push(
			b.stmt(
				b.call(
					'_$_.switch',
					id,
					b.thunk(b.block([b.switch(context.visit(node.discriminant), cases)])),
				),
			),
		);

		context.state.init.push(b.block(statements));
	},

	IfStatement(node, context) {
		if (!is_inside_component(context)) {
			return context.next();
		}
		context.state.template.push('<!>');

		const id = context.state.flush_node();
		const statements = [];

		const consequent_scope = context.state.scopes.get(node.consequent);
		const consequent = b.block(
			transform_body(node.consequent.body, {
				...context,
				state: { ...context.state, scope: consequent_scope },
			}),
		);
		const consequent_id = context.state.scope.generate('consequent');

		statements.push(b.var(b.id(consequent_id), b.arrow([b.id('__anchor')], consequent)));

		let alternate_id;

		if (node.alternate !== null) {
			const alternate_scope = context.state.scopes.get(node.alternate) || context.state.scope;
			let alternate_body = node.alternate.body;
			if (node.alternate.type === 'IfStatement') {
				alternate_body = [node.alternate];
			}
			const alternate = b.block(
				transform_body(alternate_body, {
					...context,
					state: { ...context.state, scope: alternate_scope },
				}),
			);
			alternate_id = context.state.scope.generate('alternate');
			statements.push(b.var(b.id(alternate_id), b.arrow([b.id('__anchor')], alternate)));
		}

		statements.push(
			b.stmt(
				b.call(
					'_$_.if',
					id,
					b.arrow(
						[b.id('__render')],
						b.block([
							b.if(
								context.visit(node.test),
								b.stmt(b.call(b.id('__render'), b.id(consequent_id))),
								alternate_id
									? b.stmt(
											b.call(
												b.id('__render'),
												b.id(alternate_id),
												node.alternate ? b.literal(false) : undefined,
											),
										)
									: undefined,
							),
						]),
					),
				),
			),
		);

		context.state.init.push(b.block(statements));
	},

	TSAsExpression(node, context) {
		if (!context.state.to_ts) {
			return context.visit(node.expression);
		}
		return context.next();
	},

	TSInstantiationExpression(node, context) {
		if (!context.state.to_ts) {
			// In JavaScript, just return the expression wrapped in parentheses
			return b.sequence([context.visit(node.expression)]);
		}
		return context.next();
	},

	ExportNamedDeclaration(node, context) {
		if (!context.state.to_ts && node.exportKind === 'type') {
			return b.empty;
		}

		// Remove TSDeclareFunction nodes (function overload signatures) in JavaScript mode
		if (!context.state.to_ts && node.declaration?.type === 'TSDeclareFunction') {
			return b.empty;
		}

		return context.next();
	},

	TSDeclareFunction(node, context) {
		// TSDeclareFunction nodes are TypeScript overload signatures - remove in JavaScript mode
		if (!context.state.to_ts) {
			return b.empty;
		}

		// In TypeScript mode, keep as TSDeclareFunction - esrap will print it with 'declare'
		// We'll remove the 'declare' keyword in post-processing
		return context.next();
	},

	TryStatement(node, context) {
		if (!is_inside_component(context)) {
			return context.next();
		}
		context.state.template.push('<!>');

		const id = context.state.flush_node();
		const metadata = { await: false };
		let body = transform_body(node.block.body, {
			...context,
			state: { ...context.state, metadata },
		});

		if (metadata.pending) {
			body = [b.stmt(b.call('_$_.async', b.thunk(b.block(body), true)))];
		}

		context.state.init.push(
			b.stmt(
				b.call(
					'_$_.try',
					id,
					b.arrow([b.id('__anchor')], b.block(body)),
					node.handler === null
						? b.literal(null)
						: b.arrow(
								[b.id('__anchor'), ...(node.handler.param ? [node.handler.param] : [])],
								b.block(transform_body(node.handler.body.body, context)),
							),
					node.pending === null
						? undefined
						: b.arrow([b.id('__anchor')], b.block(transform_body(node.pending.body, context))),
				),
			),
		);
	},

	AwaitExpression(node, context) {
		if (!is_top_level_await(context) || context.state.to_ts) {
			return context.next();
		}

		if (context.state.metadata?.await === false) {
			context.state.metadata.await = true;
		}

		return b.call(b.await(b.call('_$_.maybe_tracked', context.visit(node.argument))));
	},

	BinaryExpression(node, context) {
		return b.binary(node.operator, context.visit(node.left), context.visit(node.right));
	},

	TemplateLiteral(node, context) {
		const parent = context.path.at(-1);

		if (node.expressions.length === 0 && parent?.type !== 'TaggedTemplateExpression') {
			return b.literal(node.quasis[0].value.cooked);
		}

		const expressions = node.expressions.map((expr) => context.visit(expr));
		return b.template(node.quasis, expressions);
	},

	BlockStatement(node, context) {
		const statements = [];

		for (const statement of node.body) {
			statements.push(context.visit(statement));
		}

		return b.block(statements);
	},

	ServerBlock(node, context) {
		const exports = node.metadata.exports;

		if (exports.length === 0) {
			return b.empty;
		}
		const file_path = context.state.filename;

		return b.const(
			'_$_server_$_',
			b.object(
				exports.map((name) => {
					const func_path = file_path + '#' + name;
					// needs to be a sha256 hash of func_path, to avoid leaking file structure
					const hash = createHash('sha256').update(func_path).digest('hex').slice(0, 8);

					return b.prop(
						'init',
						b.id(name),
						b.function(
							null,
							[b.rest(b.id('args'))],
							b.block([b.return(b.call('_$_.rpc', b.literal(hash), b.id('args')))]),
						),
					);
				}),
			),
		);
	},

	Program(node, context) {
		const statements = [];

		for (const statement of node.body) {
			statements.push(context.visit(statement));
		}

		return { ...node, body: statements };
	},
};

/**
 * @param {Array<string | Expression>} items
 */
function join_template(items) {
	let quasi = b.quasi('');
	const template = b.template([quasi], []);

	/**
	 * @param {Expression} expression
	 */
	function push(expression) {
		if (expression.type === 'TemplateLiteral') {
			for (let i = 0; i < expression.expressions.length; i += 1) {
				const q = expression.quasis[i];
				const e = expression.expressions[i];

				quasi.value.cooked += /** @type {string} */ (q.value.cooked);
				push(e);
			}

			const last = /** @type {any} */ (expression.quasis.at(-1));
			quasi.value.cooked += /** @type {string} */ (last.value.cooked);
		} else if (expression.type === 'Literal') {
			/** @type {string} */ (quasi.value.cooked) += expression.value;
		} else {
			template.expressions.push(expression);
			template.quasis.push((quasi = b.quasi('')));
		}
	}

	for (const item of items) {
		if (typeof item === 'string') {
			quasi.value.cooked += item;
		} else {
			push(item);
		}
	}

	for (const quasi of template.quasis) {
		quasi.value.raw = sanitize_template_string(/** @type {string} */ (quasi.value.cooked));
	}

	quasi.tail = true;

	return template;
}

function transform_ts_child(node, context) {
	const { state, visit } = context;

	if (node.type === 'Text') {
		state.init.push(b.stmt(visit(node.expression, { ...state })));
	} else if (node.type === 'Html') {
		// Do we need to do something special here?
		state.init.push(b.stmt(visit(node.expression, { ...state })));
	} else if (node.type === 'Element') {
		// Use capitalized name for dynamic components/elements in TypeScript output
		// If node.id is not an Identifier (e.g., MemberExpression like props.children),
		// we need to visit it to get the proper expression
		let type_expression;
		let type_is_expression = false;
		if (node.id.type === 'MemberExpression') {
			// For MemberExpressions, we need to create a JSXExpression, not a JSXIdentifier
			type_expression = visit(node.id, state);
			type_is_expression = true;
		} else {
			type_expression = node.metadata?.ts_name || node.id.name;
		}
		const children = [];
		let has_children_props = false;

		const ref_attributes = [];
		const attributes = node.attributes.map((attr) => {
			if (attr.type === 'Attribute') {
				const metadata = { await: false };
				const name = visit(attr.name, { ...state, metadata });
				const value =
					attr.value === null ? b.literal(true) : visit(attr.value, { ...state, metadata });

				// Handle both regular identifiers and tracked identifiers
				let prop_name;
				if (name.type === 'Identifier') {
					prop_name = name.name;
				} else if (name.type === 'MemberExpression' && name.object.type === 'Identifier') {
					// For tracked attributes like {@count}, use the original name
					prop_name = name.object.name;
				} else {
					prop_name = attr.name.name || 'unknown';
				}

				const jsx_name = b.jsx_id(prop_name);
				if (prop_name === 'children') {
					has_children_props = true;
				}
				jsx_name.loc = attr.name.loc || name.loc;

				const jsx_attr = b.jsx_attribute(jsx_name, b.jsx_expression_container(value));
				// Preserve shorthand flag from parser (set for {identifier} syntax)
				jsx_attr.shorthand = attr.shorthand ?? false;
				return jsx_attr;
			} else if (attr.type === 'SpreadAttribute') {
				const metadata = { await: false };
				const argument = visit(attr.argument, { ...state, metadata });
				return b.jsx_spread_attribute(argument);
			} else if (attr.type === 'RefAttribute') {
				const createRefKeyAlias = import_from_ripple_if_needed('createRefKey', context);
				const metadata = { await: false };
				const argument = visit(attr.argument, { ...state, metadata });
				const wrapper = b.object([b.prop('init', b.call(createRefKeyAlias), argument, true)]);
				return b.jsx_spread_attribute(wrapper);
			}
		});

		if (!node.selfClosing && !has_children_props && node.children.length > 0) {
			const is_dom_element = is_element_dom_element(node);

			const component_scope = context.state.scopes.get(node);
			const thunk = b.thunk(
				b.block(
					transform_body(node.children, {
						...context,
						state: { ...state, scope: component_scope },
					}),
				),
			);

			if (is_dom_element) {
				children.push(b.jsx_expression_container(b.call(thunk)));
			} else {
				attributes.push(b.jsx_attribute(b.jsx_id('children'), b.jsx_expression_container(thunk)));
			}
		}

		let opening_type, closing_type;

		if (type_is_expression) {
			// For dynamic/expression-based components (e.g., props.children),
			// use JSX expression instead of identifier
			opening_type = type_expression;
			closing_type = node.selfClosing ? undefined : type_expression;
		} else {
			opening_type = b.jsx_id(type_expression);
			// For tracked identifiers (dynamic components), adjust the loc to skip the '@' prefix
			// and add metadata for mapping
			if (node.id.tracked && node.id.loc) {
				// The original identifier loc includes the '@', so we need to skip it
				opening_type.loc = {
					start: {
						line: node.id.loc.start.line,
						column: node.id.loc.start.column + 1, // Skip '@'
					},
					end: node.id.loc.end,
				};
				// Add metadata if this was capitalized
				if (node.metadata?.ts_name && node.metadata?.original_name) {
					opening_type.metadata = {
						original_name: node.metadata.original_name,
						is_capitalized: true,
					};
				}
			} else {
				// Use node.id.loc if available, otherwise create a loc based on the element's position
				opening_type.loc = node.id.loc || {
					start: {
						line: node.loc.start.line,
						column: node.loc.start.column + 2, // After "<@"
					},
					end: {
						line: node.loc.start.line,
						column: node.loc.start.column + 2 + type_expression.length,
					},
				};
			}

			if (!node.selfClosing) {
				closing_type = b.jsx_id(type_expression);
				// For tracked identifiers, also adjust closing tag location
				if (node.id.tracked && node.id.loc) {
					// Calculate position relative to closing tag
					// Format: </@identifier>
					const closing_tag_start = node.loc.end.column - type_expression.length - 3; // </@
					closing_type.loc = {
						start: {
							line: node.loc.end.line,
							column: closing_tag_start + 3, // Skip '</@'
						},
						end: {
							line: node.loc.end.line,
							column:
								closing_tag_start +
								3 +
								(node.metadata?.original_name?.length || type_expression.length),
						},
					};
					// Add metadata if this was capitalized
					if (node.metadata?.ts_name && node.metadata?.original_name) {
						closing_type.metadata = {
							original_name: node.metadata.original_name,
							is_capitalized: true,
						};
					}
				} else {
					closing_type.loc = {
						start: {
							line: node.loc.end.line,
							column: node.loc.end.column - type_expression.length - 1,
						},
						end: {
							line: node.loc.end.line,
							column: node.loc.end.column - 1,
						},
					};
				}
			}
		}

		const jsxElement = b.jsx_element(
			opening_type,
			attributes,
			children,
			node.selfClosing,
			closing_type,
		);
		// Preserve metadata from Element node for mapping purposes
		if (node.metadata && (node.metadata.ts_name || node.metadata.original_name)) {
			jsxElement.metadata = {
				ts_name: node.metadata.ts_name,
				original_name: node.metadata.original_name,
			};
		}
		state.init.push(b.stmt(jsxElement));
	} else if (node.type === 'IfStatement') {
		const consequent_scope = context.state.scopes.get(node.consequent);
		const consequent = b.block(
			transform_body(node.consequent.body, {
				...context,
				state: { ...context.state, scope: consequent_scope },
			}),
		);

		let alternate;

		if (node.alternate !== null) {
			const alternate_scope = context.state.scopes.get(node.alternate) || context.state.scope;
			let alternate_body = node.alternate.body;
			if (node.alternate.type === 'IfStatement') {
				alternate_body = [node.alternate];
			}
			alternate = b.block(
				transform_body(alternate_body, {
					...context,
					state: { ...context.state, scope: alternate_scope },
				}),
			);
		}

		state.init.push(b.if(visit(node.test), consequent, alternate));
	} else if (node.type === 'SwitchStatement') {
		const cases = [];

		for (const switch_case of node.cases) {
			const consequent_scope =
				context.state.scopes.get(switch_case.consequent) || context.state.scope;
			const consequent_body = transform_body(switch_case.consequent, {
				...context,
				state: { ...context.state, scope: consequent_scope },
			});

			cases.push(
				b.switch_case(switch_case.test ? context.visit(switch_case.test) : null, consequent_body),
			);
		}

		context.state.init.push(b.switch(context.visit(node.discriminant), cases));
	} else if (node.type === 'ForOfStatement') {
		const body_scope = context.state.scopes.get(node.body);
		const block_body = transform_body(node.body.body, {
			...context,
			state: { ...context.state, scope: body_scope },
		});
		if (node.key) {
			block_body.unshift(b.stmt(visit(node.key)));
		}
		if (node.index) {
			block_body.unshift(b.let(visit(node.index), b.literal(0)));
		}
		const body = b.block(block_body);

		state.init.push(b.for_of(visit(node.left), visit(node.right), body, node.await));
	} else if (node.type === 'TryStatement') {
		const try_scope = context.state.scopes.get(node.block);
		const try_body = b.block(
			transform_body(node.block.body, {
				...context,
				state: { ...context.state, scope: try_scope },
			}),
		);

		let catch_handler = null;
		if (node.handler) {
			const catch_scope = context.state.scopes.get(node.handler.body);
			const catch_body = b.block(
				transform_body(node.handler.body.body, {
					...context,
					state: { ...context.state, scope: catch_scope },
				}),
			);
			catch_handler = b.catch_clause(node.handler.param || null, catch_body);
		}

		let finally_block = null;
		if (node.finalizer) {
			const finally_scope = context.state.scopes.get(node.finalizer);
			finally_block = b.block(
				transform_body(node.finalizer.body, {
					...context,
					state: { ...context.state, scope: finally_scope },
				}),
			);
		}

		state.init.push(b.try(try_body, catch_handler, finally_block));
	} else if (node.type === 'Component') {
		const component = visit(node, state);

		state.init.push(component);
	} else if (node.type === 'BreakStatement') {
		state.init.push(b.break);
	} else if (node.type === 'TsxCompat') {
		const children = node.children
			.map((child) => visit(child, state))
			.filter((child) => child.type !== 'JSXText' || child.value.trim() !== '');

		state.init.push(b.stmt(b.jsx_fragment(children)));
	} else {
		throw new Error('TODO');
	}
}

function transform_children(children, context) {
	const { visit, state, root } = context;
	const normalized = normalize_children(children, context);
	const head_elements = children.filter(
		(node) => node.type === 'Element' && node.id.type === 'Identifier' && node.id.name === 'head',
	);

	const is_fragment =
		normalized.some(
			(node) =>
				node.type === 'IfStatement' ||
				node.type === 'TryStatement' ||
				node.type === 'ForOfStatement' ||
				node.type === 'SwitchStatement' ||
				node.type === 'TsxCompat' ||
				node.type === 'Html' ||
				(node.type === 'Element' &&
					(node.id.type !== 'Identifier' || !is_element_dom_element(node))),
		) ||
		normalized.filter(
			(node) => node.type !== 'VariableDeclaration' && node.type !== 'EmptyStatement',
		).length > 1;
	let initial = null;
	let prev = null;
	let template_id = null;

	const get_id = (node) => {
		return b.id(
			node.type == 'Element' && is_element_dom_element(node)
				? state.scope.generate(node.id.name)
				: node.type == 'Text'
					? state.scope.generate('text')
					: state.scope.generate('node'),
		);
	};

	const create_initial = (node) => {
		const id = is_fragment ? b.id(state.scope.generate('fragment')) : get_id(node);
		initial = id;
		template_id = state.scope.generate('root');
		state.setup.push(b.var(id, b.call(template_id)));
	};

	for (const node of normalized) {
		if (
			node.type === 'VariableDeclaration' ||
			node.type === 'ExpressionStatement' ||
			node.type === 'ThrowStatement' ||
			node.type === 'FunctionDeclaration' ||
			node.type === 'DebuggerStatement' ||
			node.type === 'ClassDeclaration' ||
			node.type === 'TSTypeAliasDeclaration' ||
			node.type === 'TSInterfaceDeclaration' ||
			node.type === 'Component'
		) {
			const metadata = { await: false };
			state.init.push(visit(node, { ...state, metadata }));
			if (metadata.await) {
				state.init.push(b.if(b.call('_$_.aborted'), b.return(null)));
				if (state.metadata?.await === false) {
					state.metadata.await = true;
				}
			}
		} else if (state.to_ts) {
			transform_ts_child(node, { visit, state });
		} else {
			let metadata;
			let expression;
			let isCreateTextOnly = false;
			if (node.type === 'Text' || node.type === 'Html') {
				metadata = { tracking: false, await: false };
				expression = visit(node.expression, { ...state, metadata });
				isCreateTextOnly =
					node.type === 'Text' && normalized.length === 1 && expression.type === 'Literal';
			}

			if (initial === null && root && !isCreateTextOnly) {
				create_initial(node);
			}

			const current_prev = prev;
			let cached;
			const flush_node = (is_controlled) => {
				if (cached && !is_controlled) {
					return cached;
				} else if (current_prev !== null) {
					const id = get_id(node);
					state.setup.push(b.var(id, b.call('_$_.sibling', current_prev())));
					cached = id;
					return id;
				} else if (initial !== null) {
					if (is_fragment) {
						const id = get_id(node);
						state.setup.push(b.var(id, b.call('_$_.child_frag', initial)));
						cached = id;
						return id;
					}
					return initial;
				} else if (state.flush_node !== null) {
					if (is_controlled) {
						return state.flush_node();
					}

					const id = get_id(node);
					state.setup.push(b.var(id, b.call('_$_.child', state.flush_node())));
					cached = id;
					return id;
				} else {
					debugger;
				}
			};

			prev = flush_node;

			const is_controlled = normalized.length === 1 && !root;

			if (node.type === 'Element') {
				visit(node, { ...state, flush_node, namespace: state.namespace });
			} else if (node.type === 'HeadElement') {
				visit(node, { ...state, flush_node, namespace: state.namespace });
			} else if (node.type === 'TsxCompat') {
				visit(node, { ...state, flush_node, namespace: state.namespace });
			} else if (node.type === 'Html') {
				context.state.template.push('<!>');

				const id = flush_node();
				state.update.push({
					operation: b.stmt(
						b.call(
							'_$_.html',
							id,
							b.thunk(expression),
							state.namespace === 'svg' && b.true,
							state.namespace === 'mathml' && b.true,
						),
					),
				});
			} else if (node.type === 'Text') {
				if (metadata.tracking) {
					state.template.push(' ');
					const id = flush_node();
					state.update.push({
						operation: (key) => b.stmt(b.call('_$_.set_text', id, key)),
						expression,
						identity: node.expression,
						initial: b.literal(' '),
					});
					if (metadata.await) {
						state.update.async = true;
					}
				} else if (normalized.length === 1) {
					if (expression.type === 'Literal') {
						if (state.template.length > 0) {
							state.template.push(escape_html(expression.value));
						} else {
							const id = flush_node();
							state.init.push(b.var(id, b.call('_$_.create_text', expression)));
							state.final.push(b.stmt(b.call('_$_.append', b.id('__anchor'), id)));
						}
					} else {
						const id = flush_node();
						state.template.push(' ');
						// avoid set_text overhead for single text nodes
						state.init.push(b.stmt(b.assignment('=', b.member(id, b.id('nodeValue')), expression)));
					}
				} else {
					// Handle Text nodes in fragments
					state.template.push(' ');
					const id = flush_node();
					state.update.push({
						operation: (key) => b.stmt(b.call('_$_.set_text', id, key)),
						expression,
						identity: node.expression,
						initial: b.literal(' '),
					});
					if (metadata.await) {
						state.update.async = true;
					}
				}
			} else if (node.type === 'ForOfStatement') {
				node.is_controlled = is_controlled;
				visit(node, { ...state, flush_node, namespace: state.namespace });
			} else if (node.type === 'IfStatement') {
				node.is_controlled = is_controlled;
				visit(node, { ...state, flush_node, namespace: state.namespace });
			} else if (node.type === 'TryStatement') {
				node.is_controlled = is_controlled;
				visit(node, { ...state, flush_node, namespace: state.namespace });
			} else if (node.type === 'SwitchStatement') {
				node.is_controlled = is_controlled;
				visit(node, { ...state, flush_node, namespace: state.namespace });
			} else if (node.type === 'BreakStatement') {
				// do nothing
			} else {
				debugger;
			}
		}
	}

	for (const head_element of head_elements) {
		visit_head_element(head_element, context);
	}

	if (context.state.inside_head) {
		const title_element = children.find(
			(node) =>
				node.type === 'Element' && node.id.type === 'Identifier' && node.id.name === 'title',
		);

		if (title_element) {
			visit_title_element(title_element, context);
		}
	}

	const template_namespace = state.namespace || 'html';

	if (root && initial !== null && template_id !== null) {
		let flags = is_fragment ? TEMPLATE_FRAGMENT : 0;
		if (template_namespace === 'svg') {
			flags |= TEMPLATE_SVG_NAMESPACE;
		} else if (template_namespace === 'mathml') {
			flags |= TEMPLATE_MATHML_NAMESPACE;
		}
		state.final.push(b.stmt(b.call('_$_.append', b.id('__anchor'), initial)));
		state.hoisted.push(
			b.var(template_id, b.call('_$_.template', join_template(state.template), b.literal(flags))),
		);
	}
}

function transform_body(body, { visit, state }) {
	const body_state = {
		...state,
		template: [],
		setup: [],
		init: [],
		update: [],
		final: [],
		metadata: state.metadata,
		namespace: state.namespace || 'html', // Preserve namespace context
		inside_head: state.inside_head || false,
	};

	transform_children(body, { visit, state: body_state, root: true });

	if (body_state.update.length > 0) {
		if (state.to_ts) {
			// In TypeScript mode, just add the update statements directly
			body_state.init.push(...body_state.update);
		} else {
			apply_updates(body_state.init, body_state.update, state);
		}
	}

	return [...body_state.setup, ...body_state.init, ...body_state.final];
}

/**
 * Create a TSX language handler with enhanced TypeScript support
 * @returns {Object} TSX language handler with TypeScript return type support
 */
function create_tsx_with_typescript_support() {
	const base_tsx = tsx();

	// Add custom TypeScript node handlers that aren't in tsx

	// Shared handler for function-like nodes to support component->function mapping
	// Creates source maps for 'function' keyword by passing node to context.write()
	const handle_function = (node, context) => {
		if (node.async) {
			context.write('async ');
		}
		// Write 'function' keyword with node location for source mapping
		// This creates a mapping from the source position (which may have 'component')
		// to the generated 'function' keyword
		context.write('function', node);
		if (node.generator) {
			context.write('*');
		}
		// FunctionDeclaration always has a space before id, FunctionExpression only if id exists
		if (node.type === 'FunctionDeclaration' || node.id) {
			context.write(' ');
		}
		if (node.id) {
			context.visit(node.id);
		}
		if (node.typeParameters) {
			context.visit(node.typeParameters);
		}
		context.write('(');
		for (let i = 0; i < node.params.length; i++) {
			if (i > 0) context.write(', ');
			context.visit(node.params[i]);
		}
		context.write(')');
		if (node.returnType) {
			context.visit(node.returnType);
		}
		context.write(' ');
		if (node.body) {
			context.visit(node.body);
		}
	};

	return {
		...base_tsx,
		// Custom handler for Property nodes to prevent method shorthand for components
		// When a component is transformed to a FunctionExpression, we want to preserve
		// the explicit syntax (key: function name() {}) instead of method shorthand (key() {})
		// This ensures proper source mapping for the 'function'/'component' keyword
		Property(node, context) {
			// Check if the value is a function that was originally a component
			const isComponent =
				node.value?.type === 'FunctionExpression' && node.value.metadata?.was_component;

			if (isComponent) {
				// Manually print as non-method property to preserve 'function' keyword
				// This ensures esrap creates proper source map entries for the component->function transformation
				if (node.computed) {
					context.write('[');
					context.visit(node.key);
					context.write(']');
				} else {
					context.visit(node.key);
				}
				context.write(': ');
				context.visit(node.value);
			} else {
				// Use default handler for non-component properties
				base_tsx.Property(node, context);
			}
		},
		// Custom handler for ArrayPattern to ensure typeAnnotation is visited
		// esrap's TypeScript handler doesn't visit typeAnnotation for ArrayPattern (only for ObjectPattern)
		ArrayPattern(node, context) {
			context.write('[');
			for (let i = 0; i < node.elements.length; i++) {
				if (i > 0) context.write(', ');
				if (node.elements[i]) {
					context.visit(node.elements[i]);
				}
			}
			context.write(']');
			// Visit type annotation if present
			if (node.typeAnnotation) {
				context.visit(node.typeAnnotation);
			}
		},
		// Custom handler for FunctionDeclaration to support component->function mapping
		// Needed for volar mappings and intellisense on function or component keyword
		FunctionDeclaration(node, context) {
			handle_function(node, context);
		},
		// Custom handler for FunctionExpression to support component->function mapping
		// This is used for components transformed by the Component visitor
		FunctionExpression(node, context) {
			handle_function(node, context);
		},
		// Custom handler for TSParenthesizedType: (Type)
		TSParenthesizedType(node, context) {
			context.write('(');
			context.visit(node.typeAnnotation);
			context.write(')');
		},
		// Custom handler for TSMappedType: { [K in keyof T]: T[K] }
		TSMappedType(node, context) {
			context.write('{ ');
			if (node.readonly) {
				if (node.readonly === '+' || node.readonly === true) {
					context.write('readonly ');
				} else if (node.readonly === '-') {
					context.write('-readonly ');
				}
			}
			context.write('[');
			// Visit the entire type parameter (TSTypeParameter node)
			if (node.typeParameter) {
				context.visit(node.typeParameter);
			}
			context.write(']');
			if (node.optional) {
				if (node.optional === '+' || node.optional === true) {
					context.write('?');
				} else if (node.optional === '-') {
					context.write('-?');
				}
			}
			context.write(': ');
			// Visit the value type - could be either typeAnnotation or nameType
			if (node.typeAnnotation) {
				context.visit(node.typeAnnotation);
			} else if (node.nameType) {
				context.visit(node.nameType);
			}
			context.write(' }');
		},
		// Custom handler for TSTypeParameter: K in T (for mapped types)
		// acorn-ts has a bug where `in` is printed as `extends`, so we override it here
		TSTypeParameter(node, context) {
			// For mapped types, the name is just a string, not an Identifier node
			// Pass the node as second parameter to context.write() to create source map entry
			if (typeof node.name === 'string') {
				context.write(node.name, node);
			} else if (node.name && node.name.name) {
				context.write(node.name.name, node.name);
			}
			if (node.constraint) {
				context.write(' in ');
				context.visit(node.constraint);
			}
			if (node.default) {
				context.write(' = ');
				context.visit(node.default);
			}
		},
		// Override the ArrowFunctionExpression handler to support TypeScript return types
		ArrowFunctionExpression(node, context) {
			if (node.async) context.write('async ');

			context.write('(');
			// Visit each parameter
			for (let i = 0; i < node.params.length; i++) {
				if (i > 0) context.write(', ');
				context.visit(node.params[i]);
			}
			context.write(')');

			// Add TypeScript return type annotation if present
			if (node.returnType) {
				context.visit(node.returnType);
			}

			context.write(' => ');

			if (
				node.body.type === 'ObjectExpression' ||
				(node.body.type === 'AssignmentExpression' && node.body.left.type === 'ObjectPattern') ||
				(node.body.type === 'LogicalExpression' && node.body.left.type === 'ObjectExpression') ||
				(node.body.type === 'ConditionalExpression' && node.body.test.type === 'ObjectExpression')
			) {
				context.write('(');
				context.visit(node.body);
				context.write(')');
			} else {
				context.visit(node.body);
			}
		},
	};
}

/**
 * Transform Ripple AST to JavaScript/TypeScript
 * @param {string} filename - Source filename
 * @param {string} source - Original source code
 * @param {any} analysis - Analysis result
 * @param {boolean} to_ts - Whether to generate TypeScript output
 * @returns {{ ast: any, js: { code: string, map: any, post_processing_changes?: PostProcessingChanges, line_offsets?: LineOffsets }, css: any }}
 */
export function transform_client(filename, source, analysis, to_ts) {
	/**
	 * User's named imports from 'ripple' so we can reuse them in TS output
	 * when transforming shorthand syntax. E.g., if the user has already imported
	 * TrackedArray, we want to reuse that import instead of importing it again
	 * if we encounter `#[]`. It's a Map of export name to local name in case the
	 * user renamed something when importing.
	 * @type {Map<string, string>}
	 */
	const ripple_user_imports = new Map(); // exported -> local
	if (analysis && analysis.ast && Array.isArray(analysis.ast.body)) {
		for (const stmt of analysis.ast.body) {
			if (
				stmt &&
				stmt.type === 'ImportDeclaration' &&
				stmt.source &&
				stmt.source.value === 'ripple'
			) {
				for (const spec of stmt.specifiers || []) {
					if (spec.type === 'ImportSpecifier' && spec.imported && spec.local) {
						ripple_user_imports.set(spec.imported.name, spec.local.name);
					}
				}
			}
		}
	}

	const state = {
		imports: new Set(),
		ripple_user_imports,
		events: new Set(),
		template: null,
		hoisted: [],
		setup: null,
		init: null,
		update: null,
		final: null,
		flush_node: null,
		scope: analysis.scope,
		scopes: analysis.scopes,
		stylesheets: [],
		to_ts,
		filename,
	};

	const program = /** @type {Program} */ (
		walk(/** @type {Node} */ (analysis.ast), { ...state, namespace: 'html' }, visitors)
	);

	for (const hoisted of state.hoisted) {
		program.body.unshift(hoisted);
	}

	for (const import_node of state.imports) {
		program.body.unshift(b.stmt(b.id(import_node)));
	}

	if (state.events.size > 0) {
		program.body.push(
			b.stmt(
				b.call('_$_.delegate', b.array(Array.from(state.events).map((name) => b.literal(name)))),
			),
		);
	}

	const language_handler = to_ts ? create_tsx_with_typescript_support() : tsx();

	const js =
		/** @type {ReturnType<typeof print> & { post_processing_changes?: PostProcessingChanges, line_offsets?: number[] }} */ (
			print(program, language_handler, {
				sourceMapContent: source,
				sourceMapSource: path.basename(filename),
			})
		);

	// Post-process TypeScript output to remove 'declare' from function overload signatures
	// Function overload signatures in regular .ts files should not have 'declare' keyword
	// Track changes for source map adjustment - organize them for efficient lookup
	/** @type {PostProcessingChanges | null} */
	let post_processing_changes = null;
	/** @type {LineOffsets} */
	let line_offsets = [];

	if (to_ts) {
		// Build line offset map for converting byte offset to line:column
		line_offsets = [0];
		for (let i = 0; i < js.code.length; i++) {
			if (js.code[i] === '\n') {
				line_offsets.push(i + 1);
			}
		}

		/**
		 * Convert byte offset to line number (1-based)
		 * @param {number} offset
		 * @returns {number}
		 */
		const offset_to_line = (offset) => {
			for (let i = 0; i < line_offsets.length; i++) {
				if (
					offset >= line_offsets[i] &&
					(i === line_offsets.length - 1 || offset < line_offsets[i + 1])
				) {
					return i + 1;
				}
			}
			return 1;
		};

		/** @type {Map<number, {offset: number, delta: number}>} */
		const line_deltas = new Map(); // line -> {offset: first change offset, delta: total delta for line}

		// Remove 'export declare function' -> 'export function' (for overloads only, not implementations)
		// Match: export declare function name(...): type;
		// Don't match: export declare function name(...): type { (has body)
		js.code = js.code.replace(
			/^(export\s+)declare\s+(function\s+\w+[^{\n]*;)$/gm,
			(match, p1, p2, offset) => {
				const replacement = p1 + p2;
				const line = offset_to_line(offset);
				const delta = replacement.length - match.length; // negative (removing 'declare ')

				// Track first change offset and total delta per line
				if (!line_deltas.has(line)) {
					line_deltas.set(line, { offset, delta });
				} else {
					// Additional change on same line - accumulate delta
					// @ts-ignore
					line_deltas.get(line).delta += delta;
				}

				return replacement;
			},
		);

		post_processing_changes = line_deltas;
	}

	if (post_processing_changes) {
		js.post_processing_changes = post_processing_changes;
	}

	if (line_offsets.length > 0) {
		js.line_offsets = line_offsets;
	}

	const css = render_stylesheets(state.stylesheets);

	return {
		ast: program,
		js,
		css,
	};
}
