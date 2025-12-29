/**
@import * as AST from 'estree';
@import * as ESTreeJSX from 'estree-jsx';
@import { SourceMapMappings } from '@jridgewell/sourcemap-codec';
@import {
	AnalysisResult,
	TransformClientContext,
	VisitorClientContext,
	TransformClientState,
	ScopeInterface,
	Visitors
}	from '#compiler';
 */

/**
@typedef {Map<number, {offset: number, delta: number}>} PostProcessingChanges;
@typedef {number[]} LineOffsets;
*/

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
import {
	CSS_HASH_IDENTIFIER,
	STYLE_IDENTIFIER,
	SERVER_IDENTIFIER,
	obfuscate_identifier,
} from '../../../identifier-utils.js';
import is_reference from 'is-reference';
import { object } from '../../../../utils/ast.js';
import { render_stylesheets } from '../stylesheet.js';
import {
	get_original_event_name,
	is_event_attribute,
	normalize_event_name,
} from '../../../../utils/events.js';
import { createHash } from 'node:crypto';

/**
 *
 * @param {AST.FunctionDeclaration | AST.FunctionExpression | AST.ArrowFunctionExpression} node
 * @param {TransformClientContext} context
 */
function visit_function(node, context) {
	// Function overload signatures don't have a body - they're TypeScript-only
	// Remove them when compiling to JavaScript
	if (!context.state.to_ts && !node.body) {
		return b.empty;
	}

	const state = context.state;
	const metadata = /** @type {AST.FunctionExpression['metadata']} */ (node.metadata);

	if (context.state.to_ts) {
		return context.next(state);
	}

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
			new_body.push(b.var('__block', b.call('_$_.scope')));
		}
		if (body.type === 'BlockStatement') {
			new_body.push(...body.body);
		}

		return {
			...node,
			params: node.params.map((param) => context.visit(param, state)),
			body: body.type === 'BlockStatement' ? { ...body, body: new_body } : body,
		};
	}

	return context.next(state);
}

/**
 * @param {AST.Element} node
 * @param {TransformClientContext} context
 */
function visit_head_element(node, context) {
	const { state, visit } = context;

	/** @type {TransformClientState['init']} */
	const init = [];
	/** @type {TransformClientState['update']} */
	const update = [];
	/** @type {TransformClientState['final']} */
	const final = [];
	/** @type {TransformClientState['template']} */
	const template = [];

	transform_children(
		node.children,
		/** @type {VisitorClientContext} */ ({
			visit,
			state: { ...state, init, update, final, template, inside_head: true },
			root: true,
		}),
	);

	if (init.length > 0 || update.length > 0 || final.length > 0) {
		context.state.init?.push(
			b.stmt(
				b.call(
					'_$_.head',
					b.arrow(
						[b.id('__anchor')],
						b.block([
							...init,
							.../** @type {AST.Statement[]} */ (update.map((u) => u.operation())),
							...final,
						]),
					),
				),
			),
		);
	}
}

/**
 * @param {NonNullable<TransformClientState['init']>} init
 * @param {NonNullable<TransformClientState['update']>} update
 * @param {TransformClientState} state
 */
function apply_updates(init, update, state) {
	if (update?.length === 1 && !update[0].needsPrevTracking) {
		init?.push(
			b.stmt(
				b.call(
					'_$_.render',
					b.thunk(
						b.block(
							update.map((u) => {
								if (u.initial) {
									return u.operation(u.expression);
								}
								return u.operation();
							}),
						),
						!!update.async,
					),
				),
			),
		);
	} else {
		const initial = [];
		const render_statements = [];
		let index = 0;

		const grouped_updates = new Map();

		for (const u of update) {
			if (u.initial) {
				const id =
					u.identity?.type === 'Identifier'
						? state.scope.get(u.identity.name)?.initial
						: u.identity;
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
				initial.push(b.prop('init', b.id(key), u.initial));
				render_statements.push(
					b.var('__' + key, u.expression),
					b.if(
						b.binary('!==', b.member(b.id('__prev'), b.id(key)), b.id('__' + key)),
						b.block(
							u.needsPrevTracking
								? [
										u.operation(b.id('__' + key), b.member(b.id('__prev'), b.id(key))),
										b.stmt(
											b.assignment('=', b.member(b.id('__prev'), b.id(key)), b.id('__' + key)),
										),
									]
								: [
										u.operation(
											b.assignment('=', b.member(b.id('__prev'), b.id(key)), b.id('__' + key)),
										),
									],
						),
					),
				);
				index++;
			} else {
				const key = index_to_key(index);
				/** @type {Array<AST.Statement>} */
				const if_body = [];
				initial.push(b.prop('init', b.id(key), updates[0].initial));
				render_statements.push(
					b.var('__' + key, updates[0].expression),
					b.if(
						b.binary('!==', b.member(b.id('__prev'), b.id(key)), b.id('__' + key)),
						b.block(if_body),
					),
				);
				for (const u of updates) {
					if_body.push(
						u.needsPrevTracking
							? u.operation(b.id('__' + key), b.member(b.id('__prev'), b.id(key)))
							: u.operation(b.id('__' + key)),
					);
					index++;
				}
				// Update prev after all operations
				if_body.push(
					b.stmt(b.assignment('=', b.member(b.id('__prev'), b.id(key)), b.id('__' + key))),
				);
			}
		}

		for (const u of update) {
			if (!u.initial && !u.needsPrevTracking) {
				render_statements.push(u.operation());
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

/**
 * @param {AST.Element} node
 * @param {TransformClientContext} context
 */
function visit_title_element(node, context) {
	const normalized = normalize_children(node.children, context);
	const content = normalized[0];

	const metadata = { tracking: false, await: false };
	const visited = context.visit(content, { ...context.state, metadata });
	const result = /** @type {AST.Expression} */ (
		/** @type {{expression?: AST.Expression}} */ (visited).expression
	);

	if (metadata.tracking) {
		context.state.init?.push(
			b.stmt(
				b.call(
					'_$_.render',
					b.thunk(b.block([b.stmt(b.assignment('=', b.id('_$_.document.title'), result))])),
				),
			),
		);
	} else {
		context.state.init?.push(b.stmt(b.assignment('=', b.id('_$_.document.title'), result)));
	}
}

/**
 * @param {string} name
 * @param {TransformClientContext} context
 * @returns {string}
 */
function set_hidden_import_from_ripple(name, context) {
	name = obfuscate_identifier(name);
	if (!context.state.imports.has(`import { ${name} } from 'ripple/compiler/internal/import'`)) {
		context.state.imports.add(`import { ${name} } from 'ripple/compiler/internal/import'`);
	}

	return name;
}

/** @type {Visitors<AST.Node, TransformClientState>} */
const visitors = {
	_(node, { next, state, path }) {
		if (!node.metadata) {
			node.metadata = { path: [...path] };
		} else {
			node.metadata.path = [...path];
		}

		const scope = state.scopes.get(node);

		if (scope && scope !== state.scope) {
			return next({ ...state, scope });
		} else {
			return next();
		}
	},

	Identifier(node, context) {
		const parent = /** @type {AST.Node} */ (context.path.at(-1));

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
								source_name: node.name,
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
						return b.call('_$_.get', build_getter(node, context));
					}
				}
				return build_getter(node, context);
			}
		}
	},

	ServerIdentifier(node, context) {
		const id = b.id(SERVER_IDENTIFIER);
		id.metadata.source_name = '#server';
		id.loc = node.loc;
		return id;
	},

	StyleIdentifier(node, context) {
		const id = b.id(STYLE_IDENTIFIER);
		id.metadata.source_name = '#style';
		id.loc = node.loc;
		return id;
	},

	ImportDeclaration(node, context) {
		const { state } = context;

		if (!state.to_ts && node.importKind === 'type') {
			return b.empty;
		}

		if (state.to_ts && state.inside_server_block) {
			/** @type {AST.VariableDeclaration[]} */
			const locals = state.server_block_locals;
			for (const spec of node.specifiers) {
				const original_name = spec.local.name;
				const name = obfuscate_identifier(original_name);
				if (
					spec.type !== 'ImportSpecifier' ||
					(spec.imported && /** @type {AST.Identifier} */ (spec.imported).name !== spec.local.name)
				) {
					spec.local.name = name;
				} else {
					spec.local = b.id(name);
				}
				spec.local.metadata.source_name = original_name;
				locals.push(b.const(original_name, b.id(name)));
			}
			state.imports.add(node);
			return b.empty;
		}

		return /** @type {AST.ImportDeclaration} */ ({
			...node,
			specifiers: node.specifiers
				.filter(
					(spec) => state.to_ts || /** @type {AST.ImportSpecifier} */ (spec).importKind !== 'type',
				)
				.map((spec) => context.visit(spec)),
		});
	},

	TSNonNullExpression(node, context) {
		if (context.state.to_ts) {
			return context.next();
		}
		return context.visit(/** @type {AST.Expression} */ (node.expression));
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
			if (callee.type === 'Identifier' && callee.name === 'track') {
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
				arguments: /** @type {(AST.Expression | AST.SpreadElement)[]} */ ([
					...node.arguments.map((arg) => context.visit(arg)),
					b.id('__block'),
				]),
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
							/** @type {AST.Expression} */ (context.visit(callee.object)),
							/** @type {AST.Expression} */ (context.visit(property)),
							callee.optional ? b.true : undefined,
							/** @type {AST.SimpleCallExpression} */ (node).optional ? b.true : undefined,
							.../** @type {AST.Expression[]} */ (node.arguments.map((arg) => context.visit(arg))),
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
					callee: /** @type {AST.Expression} */ (context.visit(callee)),
					arguments: /** @type {(AST.Expression | AST.SpreadElement)[]} */ (
						node.arguments.map((arg) => context.visit(arg))
					),
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
		// When source is "new #Map(...)" or "new #Map<K,V>(...)", the callee is TrackedMapExpression
		// with empty arguments and the actual arguments are in NewExpression.arguments
		if (callee.type === 'TrackedMapExpression' || callee.type === 'TrackedSetExpression') {
			// Use NewExpression's arguments (the callee has empty arguments from parser)
			const argsToUse = node.arguments.length > 0 ? node.arguments : callee.arguments;

			if (context.state.to_ts) {
				const className = callee.type === 'TrackedMapExpression' ? 'TrackedMap' : 'TrackedSet';
				const alias = set_hidden_import_from_ripple(className, context);
				const calleeId = b.id(alias);
				calleeId.loc = callee.loc;
				calleeId.metadata = {
					source_name: callee.type === 'TrackedMapExpression' ? '#Map' : '#Set',
					path: [...context.path],
				};
				/** @type {AST.NewExpression} */
				const newExpr = b.new(
					calleeId,
					.../** @type {AST.Expression[]} */ (argsToUse.map((arg) => context.visit(arg))),
				);
				// Preserve typeArguments for generics syntax like new #Map<string, number>()
				if (node.typeArguments) {
					newExpr.typeArguments = node.typeArguments;
				}
				return newExpr;
			}

			const helperName = callee.type === 'TrackedMapExpression' ? 'tracked_map' : 'tracked_set';
			return b.call(
				`_$_.${helperName}`,
				b.id('__block'),
				.../** @type {AST.Expression[]} */ (argsToUse.map((arg) => context.visit(arg))),
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

		/** @type {AST.NewExpression} */
		const new_node = {
			...node,
			callee: /** @type {AST.Expression} */ (context.visit(callee)),
			arguments: /** @type {(AST.Expression | AST.SpreadElement)[]} */ (
				node.arguments.map((arg) => context.visit(arg))
			),
		};
		if (!context.state.to_ts) {
			delete new_node.typeArguments;
		}

		return b.call('_$_.with_scope', b.id('__block'), b.thunk(new_node));
	},

	TrackedArrayExpression(node, context) {
		if (context.state.to_ts) {
			const arrayAlias = set_hidden_import_from_ripple('TrackedArray', context);

			return b.call(
				b.member(b.id(arrayAlias), b.id('from')),
				b.array(
					/** @type {(AST.Expression | AST.SpreadElement)[]} */ (
						node.elements.map((el) => context.visit(/** @type {AST.Node} */ (el)))
					),
				),
			);
		}

		return b.call(
			'_$_.tracked_array',
			b.array(
				/** @type {(AST.Expression | AST.SpreadElement)[]} */ (
					node.elements.map((el) => context.visit(/** @type {AST.Node} */ (el)))
				),
			),
			b.id('__block'),
		);
	},

	TrackedObjectExpression(node, context) {
		if (context.state.to_ts) {
			const objectAlias = set_hidden_import_from_ripple('TrackedObject', context);

			return b.new(
				b.id(objectAlias),
				b.object(
					/** @type {(AST.Property | AST.SpreadElement)[]} */ (
						node.properties.map((prop) => context.visit(prop))
					),
				),
			);
		}

		return b.call(
			'_$_.tracked_object',
			b.object(
				/** @type {(AST.Property | AST.SpreadElement)[]} */ (
					node.properties.map((prop) => context.visit(prop))
				),
			),
			b.id('__block'),
		);
	},

	TrackedExpression(node, context) {
		return b.call('_$_.get', /** @type {AST.Expression} */ (context.visit(node.argument)));
	},

	MemberExpression(node, context) {
		if (context.state.metadata?.tracking === false) {
			context.state.metadata.tracking = true;
		}

		if (node.tracked || (node.property.type === 'Identifier' && node.property.tracked)) {
			// In TypeScript mode, skip the transformation and let transform_ts_child handle it
			if (!context.state.to_ts) {
				return b.call(
					'_$_.get_property',
					/** @type {AST.Expression} */ (context.visit(node.object)),
					node.computed
						? /** @type {AST.Expression} */ (context.visit(node.property))
						: b.literal(/** @type {AST.Identifier} */ (node.property).name),
					node.optional ? b.true : undefined,
				);
			}
		}

		if (node.object.type === 'MemberExpression' && node.object.optional) {
			const metadata = { tracking: false, await: false };

			const object = context.visit(node.object, { ...context.state, metadata });

			if (metadata.tracking) {
				if (/** @type {boolean | undefined} */ (context.state.metadata?.tracking) === false) {
					context.state.metadata.tracking = true;
				}

				return {
					...node,
					optional: true,
					object: /** @type {AST.Expression} */ (object),
					property: /** @type {AST.Expression} */ (context.visit(node.property)),
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
			 * @param {AST.Pattern} pattern - The pattern node to process
			 * @returns {AST.Pattern} The transformed pattern
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
								source_name: pattern.name,
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
						right: /** @type {AST.Expression} */ (context.visit(pattern.right)),
					};
				}
				return pattern;
			};

			const transformed_id = capitalize_pattern(node.id);
			if (transformed_id !== node.id) {
				return {
					...node,
					id: transformed_id,
					init: node.init ? /** @type {AST.Expression} */ (context.visit(node.init)) : null,
				};
			}
		}
		return context.next();
	},

	FunctionDeclaration(node, context) {
		return /** @type AST.FunctionDeclaration | AST.EmptyStatement */ (
			visit_function(node, context)
		);
	},

	ArrowFunctionExpression(node, context) {
		return /** @type AST.ArrowFunctionExpression | AST.EmptyStatement */ (
			visit_function(node, context)
		);
	},

	FunctionExpression(node, context) {
		return /** @type AST.FunctionExpression | AST.EmptyStatement */ (visit_function(node, context));
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

	JSXEmptyExpression(node, context) {
		// JSX comments like {/* ... */} are represented as JSXEmptyExpression
		// In TypeScript mode, preserve them as-is for prettier
		// In JavaScript mode, they're removed (which is correct since they're comments)
		if (context.state.to_ts) {
			return context.next();
		}
		// In JS mode, return empty - comments are stripped
		return b.empty;
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
					return b.prop(
						'init',
						/** @type {AST.Expression} */ (context.visit(attr.name)),
						attr.value
							? /** @type {AST.Expression} */ (context.visit(attr.value))
							: b.literal(true),
					);
				} else {
					// attr.type === 'JSXSpreadAttribute'
					return b.spread(/** @type {AST.Expression} */ (context.visit(attr.argument)));
				}
			}),
		);

		if (normalized_children.length > 0) {
			props.properties.push(
				b.prop(
					'init',
					b.id('children'),
					normalized_children.length === 1
						? /** @type {AST.Expression} */ (
								context.visit(/** @type {AST.Node} */ (normalized_children[0]))
							)
						: b.array(
								normalized_children.map(
									(child) =>
										/** @type {AST.Expression} */ (context.visit(/** @type {AST.Node} */ (child))),
								),
							),
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
					return b.prop(
						'init',
						/** @type {AST.Expression} */ (context.visit(attr.name)),
						attr.value
							? /** @type {AST.Expression} */ (context.visit(attr.value))
							: b.literal(true),
					);
				} else {
					// attr.type === 'JSXSpreadAttribute'
					return b.spread(/** @type {AST.Expression} */ (context.visit(attr.argument)));
				}
			}),
		);

		if (normalized_children.length > 0) {
			props.properties.push(
				b.prop(
					'init',
					b.id('children'),
					normalized_children.length === 1
						? /** @type {AST.Expression} */ (
								context.visit(/** @type {AST.Node} */ (normalized_children[0]))
							)
						: b.array(
								normalized_children.map(
									(child) =>
										/** @type {AST.Expression} */ (context.visit(/** @type {AST.Node} */ (child))),
								),
							),
				),
			);
		}

		return b.call(
			normalized_children.length > 1 ? '__compat.jsxs' : '__compat.jsx',
			name.type === 'JSXIdentifier' && name.name[0].toLowerCase() === name.name[0]
				? b.literal(name.name)
				: /** @type {AST.Expression} */ (context.visit(name)),
			props,
		);
	},

	TsxCompat(node, context) {
		const { state, visit } = context;

		state.template?.push('<!>');

		const normalized_children = node.children.filter((child) => {
			return child.type !== 'JSXText' || child.value.trim() !== '';
		});
		const needs_fragment = normalized_children.length !== 1;
		const id = state.flush_node?.();
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
								b.array(
									/** @type {(AST.Expression | AST.SpreadElement | null)[]} */ (
										normalized_children.map((child) =>
											visit(/** @type {AST.Node} */ (child), state),
										)
									),
								),
							),
						]),
					)
				: /** @type {AST.Expression} */ (
						visit(/** @type {AST.Node} */ (normalized_children[0]), state)
					),
		);

		context.state.init?.push(
			b.stmt(b.call('_$_.tsx_compat', b.literal(node.kind), id, children_fn)),
		);
	},

	Element(node, context) {
		const { state, visit } = context;

		if (context.state.inside_head) {
			if (node.id.type === 'Identifier' && node.id.name === 'style') {
				state.template?.push(`<style>${sanitize_template_string(node.css)}</style>`);
				return;
			}
			if (node.id.type === 'Identifier' && node.id.name === 'script') {
				const id = state.flush_node?.();
				state.template?.push('<!>');
				context.state.init?.push(
					b.stmt(b.call('_$_.script', id, b.literal(sanitize_template_string(node.content)))),
				);
				return;
			}
		}

		const is_dom_element = is_element_dom_element(node);
		const is_spreading = node.attributes.some((attr) => attr.type === 'SpreadAttribute');
		/** @type {(AST.Property | AST.SpreadElement)[] | null} */
		const spread_attributes = is_spreading ? [] : null;
		const child_namespace = is_dom_element
			? determine_namespace_for_children(node.id.name, state.namespace)
			: state.namespace;

		/**
		 * @param {string} name
		 *  @param {string | number | bigint | boolean | RegExp | null | undefined} value
		 */
		const handle_static_attr = (name, value) => {
			const attr_value = b.literal(
				` ${name}${
					is_boolean_attribute(name) && value === true
						? ''
						: `="${value === true ? '' : escape_html(/** @type {string} */ (value), true)}"`
				}`,
			);

			if (is_spreading) {
				// For spread attributes, store just the actual value, not the full attribute string
				const actual_value =
					is_boolean_attribute(name) && value === true
						? b.literal(true)
						: b.literal(value === true ? '' : value);
				spread_attributes?.push(b.prop('init', b.literal(name), actual_value));
			} else {
				state.template?.push(attr_value);
			}
		};

		if (is_dom_element) {
			let class_attribute = null;
			let style_attribute = null;
			const component = /** @type {AST.Component} */ (state.component);
			/** @type {TransformClientState['update']} */
			const local_updates = [];
			const is_void = is_void_element(node.id.name);

			let scoping_hash = null;
			if (node.metadata?.scoped && component.css) {
				scoping_hash = component.css.hash;
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

			state.template?.push(`<${node.id.name}`);

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
							const id = state.flush_node?.();
							const metadata = { tracking: false, await: false };
							const expression = /** @type {AST.Expression} */ (
								visit(attr.value, { ...state, metadata })
							);

							if (metadata.tracking) {
								local_updates.push({
									operation: (key) => b.stmt(b.call('_$_.set_value', id, key)),
									expression,
									identity: attr.value,
									initial: b.void0,
								});
							} else {
								state.init?.push(b.stmt(b.call('_$_.set_value', id, expression)));
							}

							continue;
						}

						if (name === 'checked') {
							const id = state.flush_node?.();
							const metadata = { tracking: false, await: false };
							const expression = /** @type {AST.Expression} */ (
								visit(attr.value, { ...state, metadata })
							);

							if (metadata.tracking) {
								local_updates.push({
									operation: (key) => b.stmt(b.call('_$_.set_checked', id, key)),
									expression,
									identity: attr.value,
									initial: b.void0,
								});
							} else {
								state.init?.push(b.stmt(b.call('_$_.set_checked', id, expression)));
							}
							continue;
						}

						if (name === 'selected') {
							const id = state.flush_node?.();
							const metadata = { tracking: false, await: false };
							const expression = /** @type {AST.Expression} */ (
								visit(attr.value, { ...state, metadata })
							);

							if (metadata.tracking) {
								local_updates.push({
									operation: (key) => b.stmt(b.call('_$_.set_selected', id, key)),
									expression,
									identity: attr.value,
									initial: b.void0,
								});
							} else {
								state.init?.push(b.stmt(b.call('_$_.set_selected', id, expression)));
							}
							continue;
						}

						if (is_event_attribute(name)) {
							const metadata = { tracking: false, await: false };
							let handler = /** @type {AST.Expression} */ (
								visit(attr.value, { ...state, metadata })
							);
							const id = state.flush_node?.();

							if (attr.metadata?.delegated) {
								const event_name = normalize_event_name(name);

								if (!state.events.has(event_name)) {
									state.events.add(event_name);
								}

								state.init?.push(
									b.stmt(
										b.assignment(
											'=',
											b.member(/** @type {AST.Identifier} */ (id), '__' + event_name),
											handler,
										),
									),
								);
							} else {
								const event_name = get_original_event_name(name);
								// Check if handler is reactive (contains tracking)
								if (metadata.tracking) {
									// Use reactive_event with a thunk to re-evaluate when dependencies change
									state.init?.push(
										b.stmt(b.call('_$_.render_event', b.literal(event_name), id, b.thunk(handler))),
									);
								} else {
									state.init?.push(b.stmt(b.call('_$_.event', b.literal(event_name), id, handler)));
								}
							}

							continue;
						}
						const metadata = { tracking: false, await: false };
						const expression = /** @type {AST.Expression} */ (
							visit(attr.value, { ...state, metadata })
						);
						// All other attributes
						if (metadata.tracking) {
							const attribute = name;
							const id = state.flush_node?.();

							if (is_dom_property(attribute)) {
								local_updates.push({
									operation: () =>
										b.stmt(
											b.assignment(
												'=',
												b.member(/** @type {AST.Identifier} */ (id), attribute),
												expression,
											),
										),
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
							const id = state.flush_node?.();

							if (is_dom_property(name)) {
								state.init?.push(
									b.stmt(
										b.assignment(
											'=',
											b.member(/** @type {AST.Identifier} */ (id), name),
											expression,
										),
									),
								);
							} else {
								state.init?.push(
									b.stmt(b.call('_$_.set_attribute', id, b.literal(name), expression)),
								);
							}
						}
					}
				} else if (attr.type === 'SpreadAttribute') {
					spread_attributes?.push(
						b.spread(/** @type {AST.Expression} */ (visit(attr.argument, state))),
					);
				} else if (attr.type === 'RefAttribute') {
					const id = state.flush_node?.();
					state.init?.push(
						b.stmt(
							b.call(
								'_$_.ref',
								id,
								b.thunk(/** @type {AST.Expression} */ (visit(attr.argument, state))),
							),
						),
					);
				}
			}

			if (class_attribute !== null) {
				const attr_value = /** @type {AST.Expression} */ (class_attribute.value);
				if (attr_value.type === 'Literal') {
					let value = attr_value.value;

					if (scoping_hash) {
						value = `${scoping_hash} ${value}`;
					}

					handle_static_attr(class_attribute.name.name, value);
				} else {
					const id = state.flush_node?.();
					const metadata = { tracking: false, await: false };
					const expression = /** @type {AST.Expression} */ (
						visit(attr_value, { ...state, metadata })
					);

					const hash_arg = scoping_hash ? b.literal(scoping_hash) : undefined;
					const is_html = context.state.namespace === 'html' && node.id.name !== 'svg';

					if (metadata.tracking) {
						local_updates.push({
							operation: (key) =>
								b.stmt(b.call('_$_.set_class', id, key, hash_arg, b.literal(is_html))),
							expression,
							identity: attr_value,
							initial: b.call(b.id('Symbol')),
						});
					} else {
						state.init?.push(
							b.stmt(b.call('_$_.set_class', id, expression, hash_arg, b.literal(is_html))),
						);
					}
				}
			} else if (scoping_hash) {
				handle_static_attr(is_spreading ? '#class' : 'class', scoping_hash);
			}

			if (style_attribute !== null) {
				const attr_value = /** @type {AST.Expression} */ (style_attribute.value);
				if (attr_value.type === 'Literal') {
					handle_static_attr(style_attribute.name.name, attr_value.value);
				} else {
					const id = state.flush_node?.();
					const metadata = { tracking: false, await: false };
					const expression = /** @type {AST.Expression} */ (
						visit(attr_value, { ...state, metadata })
					);

					if (metadata.tracking) {
						if (attr_value.type === 'TemplateLiteral') {
							// Doesn't need prev tracking
							local_updates.push({
								operation: () => b.stmt(b.call('_$_.set_style', id, expression, b.void0)),
							});
						} else {
							// Object or unknown - needs prev tracking
							local_updates.push({
								operation: (new_value, prev_value) =>
									b.stmt(b.call('_$_.set_style', id, new_value, prev_value)),
								identity: attr_value,
								expression,
								initial: b.void0,
								needsPrevTracking: true,
							});
						}
					} else {
						state.init?.push(b.stmt(b.call('_$_.set_style', id, expression, b.void0)));
					}
				}
			}

			state.template?.push('>');

			if (spread_attributes !== null && spread_attributes.length > 0) {
				const id = state.flush_node?.();
				state.init?.push(
					b.stmt(b.call('_$_.render_spread', id, b.thunk(b.object(spread_attributes)))),
				);
			}

			/** @type {TransformClientState['init']} */
			const init = [];
			/** @type {TransformClientState['update']} */
			const update = [];

			if (!is_void) {
				transform_children(
					node.children,
					/** @type {VisitorClientContext} */ ({
						visit,
						state: { ...state, init, update, namespace: child_namespace },
						root: false,
					}),
				);
				state.template?.push(`</${node.id.name}>`);
			}

			update.push(...local_updates);

			if (update.length > 0) {
				if (state.scope.declarations.size > 0) {
					apply_updates(init, update, state);
				} else {
					state.update?.push(...update);
				}
			}

			if (init.length > 0) {
				state.init?.push(b.block(init));
			}
		} else {
			const id = state.flush_node?.();

			state.template?.push('<!>');

			const is_spreading = node.attributes.some((attr) => attr.type === 'SpreadAttribute');
			/** @type {(AST.Property | AST.SpreadElement)[]} */
			const props = [];
			/** @type {AST.Expression | AST.BlockStatement | null} */
			let children_prop = null;

			for (const attr of node.attributes) {
				if (attr.type === 'Attribute') {
					if (attr.name.type === 'Identifier') {
						const metadata = { tracking: false, await: false };
						let property =
							attr.value === null
								? b.literal(true)
								: /** @type {AST.Expression} */ (visit(attr.value, { ...state, metadata }));

						if (attr.name.name === 'class' && node.metadata?.scoped && state.component?.css) {
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
						props.push(
							b.prop(
								'init',
								b.key(attr.name.name),
								/** @type {AST.Expression} */ (visit(/** @type {AST.Node} */ (attr.value), state)),
							),
						);
					}
				} else if (attr.type === 'SpreadAttribute') {
					props.push(
						b.spread(
							/** @type {AST.Expression} */
							(visit(attr.argument, { ...state, metadata: { ...state.metadata } })),
						),
					);
				} else if (attr.type === 'RefAttribute') {
					const ref_id = state.scope.generate('ref');
					state.setup?.push(b.var(ref_id, b.call('_$_.ref_prop')));
					props.push(
						b.prop(
							'init',
							b.id(ref_id),
							/** @type {AST.Expression} */ (visit(attr.argument, state)),
							true,
						),
					);
				} else {
					throw new Error('TODO');
				}
			}

			if (node.metadata?.scoped && state.component?.css) {
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
					// in this case, id cannot be null
					// as these are direct children of the component
					const id = /** @type {AST.Identifier} */ (child.id);
					props.push(
						b.prop(
							'init',
							id,
							/** @type {AST.Expression} */ (
								visit(child, { ...state, namespace: child_namespace })
							),
						),
					);
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

				const children = /** @type {AST.Expression} */ (
					visit(children_component, {
						...context.state,
						scope: /** @type {ScopeInterface} */ (component_scope),
						namespace: child_namespace,
					})
				);

				if (children_prop) {
					/** @type {AST.ArrowFunctionExpression} */ (children_prop).body = b.logical(
						'??',
						/** @type {AST.Expression} */ (
							/** @type {AST.ArrowFunctionExpression} */ (children_prop).body
						),
						children,
					);
				} else {
					props.push(b.prop('init', b.id('children'), children));
				}
			}

			const metadata = { tracking: false, await: false };
			// We visit, but only to gather metadata
			b.call(/** @type {AST.Expression} */ (visit(node.id, { ...state, metadata })));

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
				const shared = b.call(
					'_$_.composite',
					b.thunk(/** @type {AST.Expression} */ (visit(node.id, state))),
					id,
					object_props,
				);
				state.init?.push(
					is_with_ns
						? b.stmt(b.call('_$_.with_ns', b.literal(state.namespace), b.thunk(shared)))
						: b.stmt(shared),
				);
			} else {
				const shared = b.call(
					/** @type {AST.Expression} */ (visit(node.id, state)),
					id,
					object_props,
					b.id('_$_.active_block'),
				);
				state.init?.push(
					is_with_ns
						? b.stmt(b.call('_$_.with_ns', b.literal(state.namespace), b.thunk(shared)))
						: b.stmt(shared),
				);
			}
		}
	},

	Component(node, context) {
		let prop_statements;
		const metadata = { await: false };

		/** @type {AST.Statement[]} */
		const style_statements = [];

		/** @type {'const' | 'var'} */
		let var_method_type = 'var';
		if (context.state.to_ts) {
			var_method_type = 'const';
		}

		if (node.css !== null && node.metadata.styleIdentifierPresent) {
			/** @type {AST.Property[]} */
			const properties = [];
			if (node.metadata.topScopedClasses && node.metadata.topScopedClasses.size > 0) {
				const hash = b[var_method_type](b.id(CSS_HASH_IDENTIFIER), b.literal(node.css.hash));
				style_statements.push(hash);
				for (const [className] of node.metadata.topScopedClasses) {
					properties.push(
						b.prop(
							'init',
							b.key(className),
							b.template(
								[b.quasi('', false), b.quasi(` ${className}`, true)],
								[b.id(CSS_HASH_IDENTIFIER)],
							),
						),
					);
				}
			}
			style_statements.push(b[var_method_type](b.id(STYLE_IDENTIFIER), b.object(properties)));
		}

		if (context.state.to_ts) {
			const body_statements = [
				...transform_body(node.body, {
					...context,
					state: { ...context.state, component: node, metadata },
				}),
			];

			const func = b.function(
				node.id,
				node.params.map(
					(param) =>
						/** @type {AST.Pattern} */ (context.visit(param, { ...context.state, metadata })),
				),
				b.block([...style_statements, ...body_statements]),
			);
			// Mark that this function was originally a component
			func.metadata = /** @type {AST.FunctionExpression['metadata']} */ ({
				...func.metadata,
				was_component: true,
			});
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
				...style_statements,
				...(prop_statements ?? []),
				...(metadata.await
					? [b.stmt(b.call('_$_.async', b.thunk(b.block(body_statements), true)))]
					: body_statements),
			]),
		);
		// Mark that this function was originally a component
		func.metadata = /** @type {AST.FunctionExpression['metadata']} */ ({
			...func.metadata,
			was_component: true,
		});
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
			const operator = node.operator;
			const right = node.right;

			if (operator !== '=' && context.state.metadata?.tracking === false) {
				context.state.metadata.tracking = true;
			}

			return b.call(
				'_$_.set_property',
				/** @type {AST.Expression} */ (
					context.visit(left.object, { ...context.state, metadata: { tracking: false } })
				),
				left.computed
					? /** @type {AST.Expression} */ (context.visit(left.property))
					: b.literal(/** @type {AST.Identifier} */ (left.property).name),
				operator === '='
					? /** @type {AST.Expression} */ (context.visit(right))
					: b.binary(
							operator === '+=' ? '+' : operator === '-=' ? '-' : operator === '*=' ? '*' : '/',
							/** @type {AST.Expression} */ (context.visit(left)),
							/** @type {AST.Expression} */ (context.visit(right)),
						),
			);
		}

		if (left.type === 'Identifier' && left.tracked) {
			const operator = node.operator;
			const right = node.right;

			return b.call(
				'_$_.set',
				/** @type {AST.Expression} */ (
					context.visit(left, { ...context.state, metadata: { tracking: null } })
				),
				operator === '='
					? /** @type {AST.Expression} */ (context.visit(right))
					: b.binary(
							operator === '+=' ? '+' : operator === '-=' ? '-' : operator === '*=' ? '*' : '/',
							/** @type {AST.Expression} */ (
								context.visit(left, { ...context.state, metadata: { tracking: false } })
							),
							/** @type {AST.Expression} */ (context.visit(right)),
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
			if (context.state.metadata?.tracking === false) {
				context.state.metadata.tracking = true;
			}

			return b.call(
				node.prefix ? '_$_.update_pre_property' : '_$_.update_property',
				/** @type {AST.Expression} */
				(context.visit(argument.object, { ...context.state, metadata: { tracking: false } })),
				argument.computed
					? /** @type {AST.Expression} */ (context.visit(argument.property))
					: b.literal(/** @type {AST.Identifier} */ (argument.property).name),
				node.operator === '--' ? b.literal(-1) : undefined,
			);
		}

		if (argument.type === 'Identifier' && argument.tracked) {
			return b.call(
				node.prefix ? '_$_.update_pre' : '_$_.update',
				/** @type {AST.Expression} */
				(context.visit(argument, { ...context.state, metadata: { tracking: null } })),
				node.operator === '--' ? b.literal(-1) : undefined,
			);
		}

		if (argument.type === 'TrackedExpression') {
			return b.call(
				node.prefix ? '_$_.update_pre' : '_$_.update',
				/** @type {AST.Expression} */
				(context.visit(argument.argument, { ...context.state, metadata: { tracking: null } })),
				node.operator === '--' ? b.literal(-1) : undefined,
			);
		}

		const left = object(/** @type {AST.MemberExpression | AST.Identifier} */ (argument));
		const binding = left && context.state.scope.get(left.name);
		const transformers = left && binding?.transform;

		if (left === argument) {
			const update_fn = transformers?.update;
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
			context.state.template?.push('<!>');
		}

		const id = context.state.flush_node?.(is_controlled);
		const pattern = /** @type {AST.VariableDeclaration} */ (node.left).declarations[0].id;
		const body_scope = /** @type {ScopeInterface} */ (context.state.scopes.get(node.body));

		context.state.init?.push(
			b.stmt(
				b.call(
					key != null ? '_$_.for_keyed' : '_$_.for',
					id,
					b.thunk(/** @type {AST.Expression} */ (context.visit(node.right))),
					b.arrow(
						index ? [b.id('__anchor'), pattern, index] : [b.id('__anchor'), pattern],
						b.block(
							transform_body(/** @type {AST.BlockStatement} */ (node.body).body, {
								...context,
								state: { ...context.state, scope: body_scope, namespace: context.state.namespace },
							}),
						),
					),
					b.literal(flags),
					key != null
						? b.arrow(
								index ? [pattern, index] : [pattern],
								/** @type {AST.Expression} */ (context.visit(key)),
							)
						: undefined,
				),
			),
		);
	},

	SwitchStatement(node, context) {
		if (!is_inside_component(context)) {
			return context.next();
		}
		context.state.template?.push('<!>');

		const id = context.state.flush_node?.();
		const statements = [];
		const cases = [];

		let id_gen = 0;
		let counter = 0;
		for (const switch_case of node.cases) {
			const case_body = [];
			const consequent = switch_case.consequent;

			if (consequent.length !== 0) {
				const consequent_scope = context.state.scopes.get(consequent) || context.state.scope;

				const block = transform_body(consequent, {
					...context,
					state: { ...context.state, scope: consequent_scope },
				});
				const has_break = consequent.some((stmt) => stmt.type === 'BreakStatement');
				const is_last = counter === node.cases.length - 1;
				const is_default = switch_case.test == null;
				const consequent_id = context.state.scope.generate(
					'switch_case_' + (is_default ? 'default' : id_gen),
				);

				statements.push(b.var(b.id(consequent_id), b.arrow([b.id('__anchor')], b.block(block))));
				case_body.push(
					b.stmt(b.call(b.member(b.id('result'), b.id('push'), false), b.id(consequent_id))),
				);

				// in js, `default:` can be in the middle without a break
				// so we only add return for the last case or cases with a break
				if (has_break || is_last) {
					case_body.push(b.return(b.id('result')));
				}
				id_gen++;
			}

			counter++;

			cases.push(
				b.switch_case(
					switch_case.test ? /** @type {AST.Expression} */ (context.visit(switch_case.test)) : null,
					case_body,
				),
			);
		}

		statements.push(
			b.stmt(
				b.call(
					'_$_.switch',
					id,
					b.thunk(
						b.block([
							b.var(b.id('result'), b.array([])),
							b.switch(/** @type {AST.Expression} */ (context.visit(node.discriminant)), cases),
						]),
					),
				),
			),
		);

		context.state.init?.push(b.block(statements));
	},

	IfStatement(node, context) {
		if (!is_inside_component(context)) {
			return context.next();
		}
		context.state.template?.push('<!>');

		const id = context.state.flush_node?.();
		const statements = [];

		const consequent_scope = /** @type {ScopeInterface} */ (
			context.state.scopes.get(node.consequent)
		);
		const consequent = b.block(
			transform_body(/** @type {AST.BlockStatement} */ (node.consequent).body, {
				...context,
				state: { ...context.state, scope: consequent_scope },
			}),
		);
		const consequent_id = context.state.scope.generate('consequent');

		statements.push(b.var(b.id(consequent_id), b.arrow([b.id('__anchor')], consequent)));

		let alternate_id;

		if (node.alternate !== null) {
			const alternate = /** @type {AST.BlockStatement | AST.IfStatement} */ (node.alternate);
			const alternate_scope = context.state.scopes.get(alternate) || context.state.scope;
			/** @type {AST.Node[]} */
			let alternate_body = alternate.type === 'IfStatement' ? [alternate] : alternate.body;
			const alternate_block = b.block(
				transform_body(alternate_body, {
					...context,
					state: { ...context.state, scope: alternate_scope },
				}),
			);
			alternate_id = context.state.scope.generate('alternate');
			statements.push(b.var(b.id(alternate_id), b.arrow([b.id('__anchor')], alternate_block)));
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
								/** @type {AST.Expression} */ (context.visit(node.test)),
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

		context.state.init?.push(b.block(statements));
	},

	TSAsExpression(node, context) {
		if (!context.state.to_ts) {
			return context.visit(/** @type {AST.Expression} */ (node.expression));
		}
		return context.next();
	},

	TSInstantiationExpression(node, context) {
		if (!context.state.to_ts) {
			// In JavaScript, just return the expression wrapped in parentheses
			return b.sequence([
				/** @type {AST.Expression} */ (
					context.visit(/** @type {AST.Expression} */ (node.expression))
				),
			]);
		}
		return context.next();
	},

	ExportNamedDeclaration(node, context) {
		if (!context.state.to_ts && node.exportKind === 'type') {
			return b.empty;
		}

		// Remove TSDeclareFunction nodes (function overload signatures) in JavaScript mode
		if (
			!context.state.to_ts &&
			/** @type {AST.RippleDeclaration} */ (node.declaration)?.type === 'TSDeclareFunction'
		) {
			return b.empty;
		}

		if (context.state.to_ts && context.state.inside_server_block) {
			const declaration = node.declaration;

			if (declaration && declaration.type === 'FunctionDeclaration') {
				return context.visit(declaration);
			} else {
				// TODO
				throw new Error('Not implemented');
			}
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
		context.state.template?.push('<!>');

		const id = context.state.flush_node?.();
		const metadata = { await: false };
		let body = transform_body(node.block.body, {
			...context,
			state: { ...context.state, metadata },
		});

		if (node.pending) {
			body = [b.stmt(b.call('_$_.async', b.thunk(b.block(body), true)))];
		}

		const handler = /** @type {AST.CatchClause | null} */ (node.handler);
		const pending = /** @type {AST.BlockStatement | null} */ (node.pending);

		context.state.init?.push(
			b.stmt(
				b.call(
					'_$_.try',
					id,
					b.arrow([b.id('__anchor')], b.block(body)),
					handler === null
						? b.literal(null)
						: b.arrow(
								[b.id('__anchor'), ...(handler.param ? [handler.param] : [])],
								b.block(transform_body(handler.body.body, context)),
							),
					pending === null
						? undefined
						: b.arrow([b.id('__anchor')], b.block(transform_body(pending.body, context))),
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

		return b.call(
			b.await(
				b.call('_$_.maybe_tracked', /** @type {AST.Expression} */ (context.visit(node.argument))),
			),
		);
	},

	BinaryExpression(node, context) {
		return b.binary(
			node.operator,
			/** @type {AST.Expression} */ (context.visit(node.left)),
			/** @type {AST.Expression} */ (context.visit(node.right)),
		);
	},

	TemplateLiteral(node, context) {
		const parent = context.path.at(-1);

		if (node.expressions.length === 0 && parent?.type !== 'TaggedTemplateExpression') {
			return b.literal(node.quasis[0].value.cooked);
		}

		const expressions = /** @type {AST.Expression[]} */ (
			node.expressions.map((expr) => context.visit(expr))
		);
		return b.template(node.quasis, expressions);
	},

	BlockStatement(node, context) {
		/** @type {AST.Statement[]} */
		const statements = [];

		for (const statement of node.body) {
			statements.push(/** @type {AST.Statement} */ (context.visit(statement)));
		}

		return b.block(statements);
	},

	ServerBlock(node, context) {
		if (context.state.to_ts) {
			// Convert Imports inside ServerBlock to local variables
			// ImportDeclaration() visitor will add imports to the top of the module
			/** @type {AST.VariableDeclaration[]} */
			const server_block_locals = [];

			const block = /** @type {AST.BlockStatement} */ (
				context.visit(node.body, {
					...context.state,
					inside_server_block: true,
					server_block_locals,
				})
			);

			/** @type {AST.Property[]} */
			const properties = [];

			// Extract and preserve original function declarations
			for (const stmt of node.body.body) {
				if (
					stmt.type === 'ExportNamedDeclaration' &&
					stmt.declaration?.type === 'FunctionDeclaration' &&
					stmt.declaration.id
				) {
					// create new nodes to avoid same node.loc issue
					// that would result in double definitions
					const id = b.id(stmt.declaration.id.name);
					properties.push(b.prop('init', id, id, false, true));
				}
			}

			const value = b.call(
				b.thunk(b.block([...server_block_locals, ...block.body, b.return(b.object(properties))])),
			);
			value.loc = node.loc;

			const server_identifier = b.id(SERVER_IDENTIFIER);
			server_identifier.loc = node.loc;
			// Add source_name to properly map longer generated back to '#server'
			server_identifier.metadata.source_name = '#server';

			const server_const = b.const(server_identifier, value);
			server_const.loc = node.loc;

			return server_const;
		}

		const exports = node.metadata.exports;

		if (!context.state.serverIdentifierPresent) {
			// no point printing the client-side block if #server.func is not used
			return b.empty;
		}

		const file_path = context.state.filename;

		return b.var(
			SERVER_IDENTIFIER,
			b.object(
				/** @type {AST.ServerBlock['metadata']['exports']} */ (exports).map((name) => {
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
		/** @type {Array<AST.Statement | AST.Directive | AST.ModuleDeclaration>} */
		const statements = [];

		for (const statement of node.body) {
			statements.push(
				/** @type {AST.Statement | AST.Directive | AST.ModuleDeclaration} */ (
					context.visit(statement)
				),
			);
		}

		return { ...node, body: statements };
	},
};

/**
 * @param {Array<string | AST.Expression>} items
 */
function join_template(items) {
	let quasi = b.quasi('');
	const template = b.template([quasi], []);

	/**
	 * @param {AST.Expression} expression
	 */
	function push(expression) {
		if (expression.type === 'TemplateLiteral') {
			for (let i = 0; i < expression.expressions.length; i += 1) {
				const q = expression.quasis[i];
				const e = expression.expressions[i];

				quasi.value.cooked += /** @type {string} */ (q.value.cooked);
				push(e);
			}

			const last = expression.quasis.at(-1);
			quasi.value.cooked += /** @type {string} */ (last?.value.cooked);
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

/**
 * @param {AST.Node} node
 * @param {TransformClientContext} context
 */
function transform_ts_child(node, context) {
	const { state, visit } = context;

	if (node.type === 'Text') {
		state.init?.push(b.stmt(/** @type {AST.Expression} */ (visit(node.expression, { ...state }))));
	} else if (node.type === 'Html') {
		// Do we need to do something special here?
		state.init?.push(b.stmt(/** @type {AST.Expression} */ (visit(node.expression, { ...state }))));
	} else if (node.type === 'Element') {
		// Use capitalized name for dynamic components/elements in TypeScript output
		// If node.id is not an Identifier (e.g., MemberExpression like props.children),
		// we need to visit it to get the proper expression
		/** @type {string | AST.Node} */
		let type_expression;
		let type_is_expression = false;
		if (/** @type {AST.Node} */ (node.id).type === 'MemberExpression') {
			// For MemberExpressions, we need to create a JSXExpression, not a JSXIdentifier
			type_expression = visit(node.id, state);
			type_is_expression = true;
		} else {
			type_expression = node.metadata?.ts_name || node.id.name;
		}
		/** @type {ESTreeJSX.JSXElement['children']} */
		const children = [];
		let has_children_props = false;

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

				const jsx_attr = b.jsx_attribute(
					jsx_name,
					b.jsx_expression_container(/** @type {AST.Expression} */ (value)),
				);
				// Preserve shorthand flag from parser (set for {identifier} syntax)
				jsx_attr.shorthand = attr.shorthand ?? false;
				return jsx_attr;
			} else if (attr.type === 'SpreadAttribute') {
				const metadata = { await: false };
				const argument = visit(attr.argument, { ...state, metadata });
				return b.jsx_spread_attribute(/** @type {AST.Expression} */ (argument));
			} else if (attr.type === 'RefAttribute') {
				const createRefKeyAlias = set_hidden_import_from_ripple('createRefKey', context);
				const metadata = { await: false };
				const argument = visit(attr.argument, { ...state, metadata });
				const wrapper = b.object([
					b.prop('init', b.call(createRefKeyAlias), /** @type {AST.Expression} */ (argument), true),
				]);
				return b.jsx_spread_attribute(wrapper);
			} else {
				// Should not happen
				throw new Error(`Unexpected attribute type: ${/** @type {AST.Attribute} */ (attr).type}`);
			}
		});

		if (!node.selfClosing && !node.unclosed && !has_children_props && node.children.length > 0) {
			const is_dom_element = is_element_dom_element(node);

			const component_scope = /** @type {ScopeInterface} */ (context.state.scopes.get(node));
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

		/** @type {ESTreeJSX.JSXIdentifier | AST.Node | undefined} */
		let opening_name_element;
		/** @type {AST.Node | ESTreeJSX.JSXClosingElement['name'] | undefined} */
		let closing_name_element;

		if (type_is_expression) {
			// For dynamic/expression-based components (e.g., props.children),
			// use JSX expression instead of identifier
			opening_name_element = /** @type {AST.Node} */ (type_expression);
			closing_name_element =
				node.selfClosing || node.unclosed ? undefined : /** @type {AST.Node} */ (type_expression);
		} else {
			opening_name_element = b.jsx_id(/** @type {string} */ (type_expression));
			// For tracked identifiers (dynamic components), adjust the loc to skip the '@' prefix
			// and add metadata for mapping
			if (node.id.tracked && node.id.loc) {
				// The original identifier loc includes the '@', so we need to skip it
				opening_name_element.loc = {
					start: {
						line: node.id.loc.start.line,
						column: node.id.loc.start.column + 1, // Skip '@'
					},
					end: node.id.loc.end,
				};
				// Add metadata if this was capitalized
				if (node.metadata?.ts_name && node.metadata?.source_name) {
					opening_name_element.metadata = {
						source_name: node.metadata.source_name,
						is_capitalized: true,
						path: [...node.metadata.path],
					};
				}
			} else {
				// Use node.id.loc if available, otherwise create a loc based on the element's position
				opening_name_element.loc = node.id.loc || {
					start: {
						line: node.loc.start.line,
						column: node.loc.start.column + 2, // After "<@"
					},
					end: {
						line: node.loc.start.line,
						column: node.loc.start.column + 2 + /** @type {string} */ (type_expression).length,
					},
				};
			}

			if (!node.selfClosing && !node.unclosed) {
				closing_name_element = b.jsx_id(/** @type {string} */ (type_expression));
				// For tracked identifiers, also adjust closing tag location
				if (node.id.tracked && node.id.loc) {
					// Calculate position relative to closing tag
					// Format: </@identifier>
					const closing_tag_start =
						node.loc.end.column - /** @type {string} */ (type_expression).length - 3; // </@
					closing_name_element.loc = {
						start: {
							line: node.loc.end.line,
							column: closing_tag_start + 3, // Skip '</@'
						},
						end: {
							line: node.loc.end.line,
							column:
								closing_tag_start +
								3 +
								(node.metadata?.source_name?.length ||
									/** @type {string} */ (type_expression).length),
						},
					};
					// Add metadata if this was capitalized
					if (node.metadata?.ts_name && node.metadata?.source_name) {
						closing_name_element.metadata = {
							source_name: node.metadata.source_name,
							is_capitalized: true,
							path: [...node.metadata.path],
						};
					}
				} else {
					closing_name_element.loc = {
						start: {
							line: node.loc.end.line,
							column: node.loc.end.column - /** @type {string} */ (type_expression).length - 1,
						},
						end: {
							line: node.loc.end.line,
							column: node.loc.end.column - 1,
						},
					};
				}
			}
		}

		let jsxElement = b.jsx_element(
			/** @type {ESTreeJSX.JSXIdentifier} */ (opening_name_element),
			node,
			attributes,
			children,
			/** @type {ESTreeJSX.JSXClosingElement['name'] | undefined} */ (closing_name_element),
		);

		// Calculate the location for the entire JSXClosingElement (including </ and >)
		if (jsxElement.closingElement && !node.selfClosing && !node.unclosed) {
			// The closing element starts with '</' and ends with '>'
			// For a tag like </div>, if node.loc.end is right after '>', then:
			// - '<' is at node.loc.end.column - type_expression.length - 3
			// - '>' is at node.loc.end.column - 1
			const tag_name_length = node.id.tracked
				? (node.metadata?.source_name?.length || /** @type {string} */ (type_expression).length) + 1 // +1 for '@'
				: /** @type {string} */ (type_expression).length;

			jsxElement.closingElement.loc = {
				start: {
					line: node.loc.end.line,
					column: node.loc.end.column - tag_name_length - 2, // at '</'
				},
				end: {
					line: node.loc.end.line,
					column: node.loc.end.column, // at '>'
				},
			};
		}

		// Preserve metadata from Element node for mapping purposes
		if (node.metadata && (node.metadata.ts_name || node.metadata.source_name)) {
			jsxElement.metadata = {
				ts_name: node.metadata.ts_name,
				source_name: node.metadata.source_name,
				path: [...node.metadata.path],
			};
		}
		// For unclosed elements, push the JSXElement directly without wrapping in ExpressionStatement
		// This keeps it in the AST for mappings but avoids adding a semicolon
		if (node.unclosed) {
			state.init?.push(/** @type {AST.Statement} */ (/** @type {unknown} */ (jsxElement)));
		} else {
			state.init?.push(b.stmt(jsxElement));
		}
	} else if (node.type === 'IfStatement') {
		const consequent_scope = /** @type {ScopeInterface} */ (
			context.state.scopes.get(node.consequent)
		);
		const consequent = b.block(
			transform_body(/** @type {AST.BlockStatement} */ (node.consequent).body, {
				...context,
				state: { ...context.state, scope: consequent_scope },
			}),
		);

		let alternate;

		if (node.alternate !== null) {
			const alternate_node = /** @type {AST.BlockStatement | AST.IfStatement} */ (node.alternate);
			const alternate_scope = context.state.scopes.get(alternate_node) || context.state.scope;
			const alternate_body =
				alternate_node.type === 'IfStatement' ? [alternate_node] : alternate_node.body;
			alternate = b.block(
				transform_body(alternate_body, {
					...context,
					state: { ...context.state, scope: alternate_scope },
				}),
			);
		}

		state.init?.push(b.if(/** @type {AST.Expression} */ (visit(node.test)), consequent, alternate));
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
				b.switch_case(
					switch_case.test ? /** @type {AST.Expression} */ (context.visit(switch_case.test)) : null,
					consequent_body,
				),
			);
		}

		context.state.init?.push(
			b.switch(/** @type {AST.Expression} */ (context.visit(node.discriminant)), cases),
		);
	} else if (node.type === 'ForOfStatement') {
		const body_scope = /** @type {ScopeInterface} */ (context.state.scopes.get(node.body));
		const block_body = transform_body(/** @type {AST.BlockStatement} */ (node.body).body, {
			...context,
			state: { ...context.state, scope: body_scope },
		});
		if (node.key) {
			block_body.unshift(b.stmt(/** @type {AST.Expression} */ (visit(node.key))));
		}
		if (node.index) {
			block_body.unshift(b.let(/** @type {AST.Identifier} */ (visit(node.index)), b.literal(0)));
		}
		const body = b.block(block_body);

		state.init?.push(
			b.for_of(
				/** @type {AST.Pattern} */ (visit(node.left)),
				/** @type {AST.Expression} */ (visit(node.right)),
				body,
				node.await,
			),
		);
	} else if (node.type === 'TryStatement') {
		const try_scope = /** @type {ScopeInterface} */ (context.state.scopes.get(node.block));
		const try_body = b.block(
			transform_body(node.block.body, {
				...context,
				state: { ...context.state, scope: try_scope },
			}),
		);

		let catch_handler = null;
		if (node.handler) {
			const catch_scope = /** @type {ScopeInterface} */ (
				context.state.scopes.get(node.handler.body)
			);
			const catch_body = b.block(
				transform_body(node.handler.body.body, {
					...context,
					state: { ...context.state, scope: catch_scope },
				}),
			);
			catch_handler = b.catch_clause(node.handler.param || null, catch_body);
		}

		let pending_block = null;
		if (node.pending) {
			const pending_scope = /** @type {ScopeInterface} */ (context.state.scopes.get(node.pending));
			pending_block = b.try_item_block(
				transform_body(node.pending.body, {
					...context,
					state: { ...context.state, scope: pending_scope },
				}),
				node.pending.loc,
			);
		}

		let finally_block = null;
		if (node.finalizer) {
			const finally_scope = /** @type {ScopeInterface} */ (
				context.state.scopes.get(node.finalizer)
			);
			finally_block = b.block(
				transform_body(node.finalizer.body, {
					...context,
					state: { ...context.state, scope: finally_scope },
				}),
			);
		}

		state.init?.push(b.try(try_body, catch_handler, finally_block, pending_block));
	} else if (node.type === 'Component') {
		const component = visit(node, state);

		state.init?.push(/** @type {AST.Statement} */ (component));
	} else if (node.type === 'BreakStatement') {
		state.init?.push(/** @type {AST.Statement} */ (b.break));
	} else if (node.type === 'TsxCompat') {
		const children = /** @type {AST.TsxCompat['children']} */ (
			node.children
				.map((child) => visit(/** @type {AST.Node} */ (child), state))
				.filter((child) => child.type !== 'JSXText' || child.value.trim() !== '')
		);

		state.init?.push(b.stmt(b.jsx_fragment(children)));
	} else if (node.type === 'JSXExpressionContainer') {
		// JSX comments {/* ... */} are JSXExpressionContainer with JSXEmptyExpression
		// These should be preserved in the output as-is for prettier to handle
		const jsx_container = b.jsx_expression_container(
			/** @type {AST.Expression} */ (visit(node.expression, state)),
		);
		state.init?.push(/** @type {AST.Statement} */ (/** @type {unknown} */ (jsx_container)));
	} else {
		throw new Error('TODO');
	}
}

/**
 *
 * @param {AST.Node[]} children
 * @param {VisitorClientContext} context
 */
function transform_children(children, context) {
	const { visit, state, root } = context;
	const normalized = normalize_children(children, context);

	const head_elements = /** @type {AST.Element[]} */ (
		children.filter(
			(node) => node.type === 'Element' && node.id.type === 'Identifier' && node.id.name === 'head',
		)
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
	/** @type {AST.Identifier | null} */
	let initial = null;
	let prev = null;
	let template_id = null;

	/** @param {AST.Node} node */
	const get_id = (node) => {
		return b.id(
			node.type == 'Element' && is_element_dom_element(node)
				? state.scope.generate(node.id.name)
				: node.type == 'Text'
					? state.scope.generate('text')
					: state.scope.generate('node'),
		);
	};

	/** @param {AST.Node} node */
	const create_initial = (node) => {
		const id = is_fragment ? b.id(state.scope.generate('fragment')) : get_id(node);
		initial = id;
		template_id = state.scope.generate('root');
		state.setup?.push(b.var(id, b.call(template_id)));
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
			state.init?.push(/** @type {AST.Statement} */ (visit(node, { ...state, metadata })));
			if (metadata.await) {
				state.init?.push(b.if(b.call('_$_.aborted'), b.return(null)));
				if (state.metadata?.await === false) {
					state.metadata.await = true;
				}
			}
		} else if (state.to_ts) {
			transform_ts_child(node, /** @type {VisitorClientContext} */ ({ visit, state }));
		} else {
			let metadata;
			/** @type {AST.Expression | undefined} */
			let expression = undefined;
			let isCreateTextOnly = false;
			if (node.type === 'Text' || node.type === 'Html') {
				metadata = { tracking: false, await: false };
				expression = /** @type {AST.Expression} */ (visit(node.expression, { ...state, metadata }));
				isCreateTextOnly =
					node.type === 'Text' && normalized.length === 1 && expression.type === 'Literal';
			}

			if (initial === null && root && !isCreateTextOnly) {
				create_initial(node);
			}

			const current_prev = prev;
			/** @type {AST.Identifier | null} */
			let cached;
			/** @param {boolean} [is_controlled] */
			const flush_node = (is_controlled) => {
				if (cached && !is_controlled) {
					return cached;
				} else if (current_prev !== null) {
					const id = get_id(node);
					state.setup?.push(b.var(id, b.call('_$_.sibling', current_prev())));
					cached = id;
					return id;
				} else if (initial !== null) {
					if (is_fragment) {
						const id = get_id(node);
						state.setup?.push(b.var(id, b.call('_$_.child_frag', initial)));
						cached = id;
						return id;
					}
					return initial;
				} else if (state.flush_node !== null) {
					if (is_controlled) {
						return state.flush_node?.();
					}

					const id = get_id(node);
					state.setup?.push(b.var(id, b.call('_$_.child', state.flush_node?.())));
					cached = id;
					return id;
				} else {
					debugger;
				}
			};

			prev = flush_node;

			const is_controlled = normalized.length === 1 && !root;

			if (node.type === 'Element') {
				visit(node, {
					...state,
					flush_node: /** @type {TransformClientState['flush_node']} */ (flush_node),
					namespace: state.namespace,
				});
			} else if (node.type === 'TsxCompat') {
				visit(node, {
					...state,
					flush_node: /** @type {TransformClientState['flush_node']} */ (flush_node),
					namespace: state.namespace,
				});
			} else if (node.type === 'Html') {
				context.state.template?.push('<!>');

				const id = flush_node();
				state.update?.push({
					operation: () =>
						b.stmt(
							b.call(
								'_$_.html',
								id,
								b.thunk(/** @type {AST.Expression} */ (expression)),
								state.namespace === 'svg' && b.true,
								state.namespace === 'mathml' && b.true,
							),
						),
				});
			} else if (node.type === 'Text') {
				if (metadata?.tracking) {
					state.template?.push(' ');
					const id = flush_node();
					state.update?.push({
						operation: (key) => b.stmt(b.call('_$_.set_text', id, key)),
						expression: /** @type {AST.Expression} */ (expression),
						identity: node.expression,
						initial: b.literal(' '),
					});
					if (metadata.await) {
						/** @type {NonNullable<TransformClientState['update']>} */ (state.update).async = true;
					}
				} else if (normalized.length === 1) {
					const expr = /** @type {AST.Expression} */ (expression);
					if (expr.type === 'Literal') {
						if (
							/** @type {NonNullable<TransformClientState['template']>} */ (state.template).length >
							0
						) {
							state.template?.push(escape_html(expr.value));
						} else {
							const id = flush_node();
							state.init?.push(
								b.var(/** @type {AST.Identifier} */ (id), b.call('_$_.create_text', expr)),
							);
							state.final?.push(b.stmt(b.call('_$_.append', b.id('__anchor'), id)));
						}
					} else {
						const id = flush_node();
						state.template?.push(' ');
						// avoid set_text overhead for single text nodes
						state.init?.push(
							b.stmt(
								b.assignment(
									'=',
									b.member(/** @type {AST.Identifier} */ (id), b.id('nodeValue')),
									expr,
								),
							),
						);
					}
				} else {
					// Handle Text nodes in fragments
					state.template?.push(' ');
					const id = flush_node();
					state.update?.push({
						operation: (key) => b.stmt(b.call('_$_.set_text', id, key)),
						expression: /** @type {AST.Expression} */ (expression),
						identity: node.expression,
						initial: b.literal(' '),
					});
					if (metadata?.await) {
						/** @type {NonNullable<TransformClientState['update']>} */ (state.update).async = true;
					}
				}
			} else if (node.type === 'ForOfStatement') {
				node.is_controlled = is_controlled;
				visit(node, {
					...state,
					flush_node: /** @type {TransformClientState['flush_node']} */ (flush_node),
					namespace: state.namespace,
				});
			} else if (node.type === 'IfStatement') {
				node.is_controlled = is_controlled;
				visit(node, {
					...state,
					flush_node: /** @type {TransformClientState['flush_node']} */ (flush_node),
					namespace: state.namespace,
				});
			} else if (node.type === 'TryStatement') {
				node.is_controlled = is_controlled;
				visit(node, {
					...state,
					flush_node: /** @type {TransformClientState['flush_node']} */ (flush_node),
					namespace: state.namespace,
				});
			} else if (node.type === 'SwitchStatement') {
				node.is_controlled = is_controlled;
				visit(node, {
					...state,
					flush_node: /** @type {TransformClientState['flush_node']} */ (flush_node),
					namespace: state.namespace,
				});
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
		const title_element = /** @type {AST.Element} */ (
			children.find(
				(node) =>
					node.type === 'Element' && node.id.type === 'Identifier' && node.id.name === 'title',
			)
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
		state.final?.push(b.stmt(b.call('_$_.append', b.id('__anchor'), initial)));
		state.hoisted.push(
			b.var(
				template_id,
				b.call(
					'_$_.template',
					join_template(
						/** @type {NonNullable<TransformClientState['template']>} */ (state.template),
					),
					b.literal(flags),
				),
			),
		);
	}
}

/**
 * @param {AST.Node[]} body
 * @param {TransformClientContext} context
 * @returns {AST.Statement[]}
 */
function transform_body(body, { visit, state }) {
	/** @type {TransformClientState} */
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

	transform_children(
		body,
		/** @type {VisitorClientContext} */ ({ visit, state: body_state, root: true }),
	);

	if (/** @type {NonNullable<TransformClientState['update']>} */ (body_state.update).length > 0) {
		if (!state.to_ts) {
			apply_updates(
				/** @type {NonNullable<TransformClientState['init']>} */ (body_state.init),
				/** @type {NonNullable<TransformClientState['update']>} */ (body_state.update),
				state,
			);
		}

		// NOTE: transform_children in `to_ts` mode does NOT add to body_state.update
		// So, we skip adding doing any actions with body_state.update
	}

	return [
		.../** @type {NonNullable<TransformClientState['setup']>} */ (body_state.setup),
		.../** @type {AST.Statement[]} */ (body_state.init),
		.../** @type {NonNullable<TransformClientState['final']>} */ (body_state.final),
	];
}

/**
 * Create a TSX language handler with enhanced TypeScript support
 * @returns {Visitors<AST.Node, TransformClientState>} TSX language handler with TypeScript return type support
 */
function create_tsx_with_typescript_support() {
	const base_tsx = /** @type {Visitors<AST.Node, TransformClientState>} */ (tsx());

	// Add custom TypeScript node handlers that aren't in tsx

	/**
	 * Shared handler for function-like nodes to support component->function mapping
	 * Creates source maps for 'function' keyword by passing node to context.write()
	 * @param {AST.Function} node
	 * @param {TransformClientContext} context
	 */
	const handle_function = (node, context) => {
		const loc = /** @type {AST.SourceLocation} */ (node.loc);

		if (node.async) {
			context.location(loc.start.line, loc.start.column);
			context.write('async ');
			context.location(loc.start.line, loc.start.column + 6);
			context.write('function');
		} else {
			context.write('function', node);
		}

		if (node.generator) {
			context.write('*');
		}

		const id = /** @type {AST.FunctionExpression | AST.FunctionDeclaration} */ (node).id;

		// FunctionDeclaration always has a space before id, FunctionExpression only if id exists
		if (node.type === 'FunctionDeclaration' || id) {
			context.write(' ');
		}
		if (id) {
			context.visit(id);
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

	return /** @type {Visitors<AST.Node, TransformClientState>} */ ({
		...base_tsx,
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
			} else if (!node.shorthand) {
				// If property is already longhand in source, keep it longhand
				// to prevent source map issues when parts of the syntax disappear in shorthand conversion
				// This applies to:
				// - { media: media } -> would become { media } (value identifier disappears)
				// - { fn: function() {} } -> would become { fn() {} } ('function' keyword disappears)
				const value = node.value.type === 'AssignmentPattern' ? node.value.left : node.value;

				// Check if esrap would convert this to shorthand property or method
				const wouldBeShorthand =
					!node.computed &&
					node.kind === 'init' &&
					node.key.type === 'Identifier' &&
					value.type === 'Identifier' &&
					node.key.name === value.name;

				const wouldBeMethodShorthand =
					!node.computed &&
					node.value.type === 'FunctionExpression' &&
					node.kind !== 'get' &&
					node.kind !== 'set';

				if (wouldBeShorthand || wouldBeMethodShorthand) {
					// Force longhand: write key: value explicitly to preserve source positions
					if (node.computed) context.write('[');
					context.visit(node.key);
					context.write(node.computed ? ']: ' : ': ');
					context.visit(node.value);
				} else {
					base_tsx.Property?.(node, context);
				}
			} else {
				// Use default handler for non-component properties
				base_tsx.Property?.(node, context);
			}
		},
		JSXClosingElement(node, context) {
			// Set location for '<' then write '</'
			if (node.loc) {
				context.location(node.loc.start.line, node.loc.start.column);
				context.write('</');
			} else {
				context.write('</');
			}

			context.visit(node.name);

			// Set location for '>' then write it
			if (node.loc) {
				context.location(node.loc.end.line, node.loc.end.column - 1);
				context.write('>');
			} else {
				context.write('>');
			}
		},
		MethodDefinition(node, context) {
			// Check if there are type parameters to handle
			// @ts-ignore - typeParameters may exist on node
			const hasTypeParams = node.typeParameters || node.value?.typeParameters;

			if (!hasTypeParams) {
				// No type parameters, use default handler
				return base_tsx.MethodDefinition?.(node, context);
			}

			// Has type parameters - we need to manually handle to ensure they're visited
			// Write modifiers (static, async, etc.)
			if (node.static) {
				context.write('static ');
			}

			// Handle getters/setters
			if (node.kind === 'get') {
				context.write('get ');
			} else if (node.kind === 'set') {
				context.write('set ');
			}

			// Write * for generator methods
			if (node.value?.generator) {
				context.write('*');
			}

			// Write async keyword
			if (node.value?.async) {
				context.write('async ');
			}

			// Write the method key
			if (node.computed) {
				context.write('[');
				context.visit(node.key);
				context.write(']');
			} else {
				context.visit(node.key);
			}

			// Visit typeParameters if present (THIS IS THE FIX)
			// TypeParameters can be on either the MethodDefinition or its value (FunctionExpression)
			if (node.typeParameters) {
				context.visit(node.typeParameters);
			} else if (node.value?.typeParameters) {
				context.visit(node.value.typeParameters);
			}

			// Write parameters - set location for opening '('
			if (node.value?.loc) {
				context.location(node.value.loc.start.line, node.value.loc.start.column);
			}
			context.write('(');
			if (node.value?.params) {
				for (let i = 0; i < node.value.params.length; i++) {
					if (i > 0) context.write(', ');
					context.visit(node.value.params[i]);
				}
			}
			context.write(')');

			// Write return type if present
			if (node.value?.returnType) {
				context.visit(node.value.returnType);
			}

			// Write method body
			if (node.value?.body) {
				context.write(' ');
				context.visit(node.value.body);
			}
		},
		TSTypeParameter(node, context) {
			// Set location for the type parameter name
			if (node.loc) {
				context.location(node.loc.start.line, node.loc.start.column);
			}
			if (typeof node.name === 'string') {
				context.write(node.name);
			} else if (node.name && node.name.name) {
				context.write(node.name.name);
			}
			if (node.constraint) {
				context.write(' extends ');
				context.visit(node.constraint);
			}
			if (node.default) {
				context.write(' = ');
				context.visit(node.default);
			}
		},
		ArrayPattern(node, context) {
			context.write('[');
			for (let i = 0; i < node.elements.length; i++) {
				if (i > 0) context.write(', ');
				if (node.elements[i]) {
					context.visit(/** @type {AST.Pattern} */ (node.elements[i]));
				}
			}
			context.write(']');
			// Visit type annotation if present
			if (node.typeAnnotation) {
				context.visit(node.typeAnnotation);
			}
		},
		FunctionDeclaration(node, context) {
			handle_function(node, context);
		},
		FunctionExpression(node, context) {
			handle_function(node, context);
		},
		ImportDeclaration(node, context) {
			const loc = /** @type {AST.SourceLocation} */ (node.loc);
			// Write 'import' keyword with source location
			// to mark the beginning of the import statement for a full import mapping
			// The semicolon at the end with location will mark the end of the import statement
			context.location(loc.start.line, loc.start.column);
			context.write('import');

			// Handle 'import type' syntax (importKind on the declaration itself)
			if (node.importKind === 'type') {
				context.write(' type');
			}

			context.write(' ');

			// Write specifiers - handle default, namespace, and named imports
			if (node.specifiers && node.specifiers.length > 0) {
				let default_specifier = null;
				let namespace_specifier = null;
				const named_specifiers = [];

				for (const spec of node.specifiers) {
					if (spec.type === 'ImportDefaultSpecifier') {
						default_specifier = spec;
					} else if (spec.type === 'ImportNamespaceSpecifier') {
						namespace_specifier = spec;
					} else if (spec.type === 'ImportSpecifier') {
						named_specifiers.push(spec);
					}
				}

				// Write default import
				if (default_specifier) {
					context.visit(default_specifier);
					if (namespace_specifier || named_specifiers.length > 0) {
						context.write(', ');
					}
				}

				// Write namespace import
				if (namespace_specifier) {
					context.visit(namespace_specifier);
					if (named_specifiers.length > 0) {
						context.write(', ');
					}
				}

				// Write named imports
				if (named_specifiers.length > 0) {
					context.write('{ ');
					for (let i = 0; i < named_specifiers.length; i++) {
						if (i > 0) context.write(', ');
						context.visit(named_specifiers[i]);
					}
					context.write(' }');
				}

				context.write(' from ');
			}

			// Write source
			context.visit(node.source);
			// Write semicolon at the end
			// and record its position to mark the end of the import statement
			// This should work regardless of whether the source has a semi or not
			context.location(loc.end.line, loc.end.column - 1);
			context.write(';');
		},
		ImportDefaultSpecifier(node, context) {
			context.visit(node.local);
		},
		ImportNamespaceSpecifier(node, context) {
			context.write('* as ');
			context.visit(node.local);
		},
		ImportSpecifier(node, context) {
			if (node.importKind === 'type') {
				context.write('type ');
			}
			context.visit(node.imported);
			// Only write 'as local' if imported !== local
			if (/** @type {AST.Identifier} */ (node.imported).name !== node.local.name) {
				context.write(' as ');
				context.visit(node.local);
			}
		},
		JSXOpeningElement(node, context) {
			// Set location for '<'
			if (node.loc) {
				context.location(node.loc.start.line, node.loc.start.column);
			}
			context.write('<');

			context.visit(node.name);

			// Write attributes
			for (const attr of node.attributes || []) {
				context.write(' ');
				context.visit(attr);
			}

			if (node.selfClosing) {
				context.write(' />');
			} else {
				// Set the source location for the '>'
				// node.loc.end points AFTER the '>', so subtract 1 to get the position OF the '>'
				if (node.loc) {
					// TODO: why do we need to subtract 1 from column here?
					context.location(node.loc.end.line, node.loc.end.column - 1);
				}
				context.write('>');
			}
		},
		TSParenthesizedType(node, context) {
			context.write('(');
			context.visit(/** @type {AST.TSTypeAnnotation} */ (node.typeAnnotation));
			context.write(')');
		},
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
			// Handle TSTypeParameter inline - mapped types use 'in' not 'extends'
			if (node.typeParameter) {
				const tp = node.typeParameter;
				if (tp.loc) {
					context.location(tp.loc.start.line, tp.loc.start.column);
				}
				// Write the parameter name
				if (typeof tp.name === 'string') {
					context.write(tp.name);
				} else if (tp.name && tp.name.name) {
					context.write(tp.name.name);
				}
				// In mapped types, constraint uses 'in' instead of 'extends'
				if (tp.constraint) {
					context.write(' in ');
					context.visit(tp.constraint);
				}
				// Handle 'as' clause for key remapping (e.g., { [K in Keys as NewKey]: V })
				if (node.nameType) {
					context.write(' as ');
					context.visit(node.nameType);
				}
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
			// Visit the value type
			if (node.typeAnnotation) {
				context.visit(node.typeAnnotation);
			}
			context.write(' }');
		},
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
		ClassDeclaration(node, context) {
			context.write('class ');
			if (node.id) {
				context.visit(node.id);
			}
			if (node.typeParameters) {
				context.visit(node.typeParameters);
			}
			if (node.superClass) {
				context.write(' extends ');
				context.visit(node.superClass);
				if (node.superTypeArguments) {
					context.visit(node.superTypeArguments);
				}
			}
			if (node.implements && node.implements.length > 0) {
				context.write(' implements ');
				for (let i = 0; i < node.implements.length; i++) {
					if (i > 0) context.write(', ');
					context.visit(node.implements[i]);
				}
			}
			context.write(' ');
			context.visit(node.body);
		},
		ClassExpression(node, context) {
			context.write('class');
			if (node.id) {
				context.write(' ');
				context.visit(node.id);
			}
			if (node.typeParameters) {
				context.visit(node.typeParameters);
			}
			if (node.superClass) {
				context.write(' extends ');
				context.visit(node.superClass);
				if (node.superTypeArguments) {
					context.visit(node.superTypeArguments);
				}
			}
			if (node.implements && node.implements.length > 0) {
				context.write(' implements ');
				for (let i = 0; i < node.implements.length; i++) {
					if (i > 0) context.write(', ');
					context.visit(node.implements[i]);
				}
			}
			context.write(' ');
			context.visit(node.body);
		},
		TryStatement(node, context) {
			context.write('try ');
			context.visit(node.block);

			if (node.pending) {
				// Output the pending block with source mapping for the 'pending' keyword
				context.write(' ');
				context.location(
					/** @type {AST.SourceLocation} */
					(node.pending.loc).start.line,
					/** @type {AST.SourceLocation} */
					(node.pending.loc).start.column - 'pending '.length,
				);
				context.write('pending ');
				context.visit(node.pending);
			}

			if (node.handler) {
				context.write(' catch');
				if (node.handler.param) {
					context.write(' (');
					context.visit(node.handler.param);
					context.write(')');
				}
				context.write(' ');
				context.visit(node.handler.body);
			}

			if (node.finalizer) {
				context.write(' finally ');
				context.visit(node.finalizer);
			}
		},
	});
}

/**
 * Transform Ripple AST to JavaScript/TypeScript
 * @param {string} filename - Source filename
 * @param {string} source - Original source code
 * @param {AnalysisResult} analysis - Analysis result
 * @param {boolean} to_ts - Whether to generate TypeScript output
 * @param {boolean} minify_css - Whether to minify CSS output
 * @returns {{ ast: AST.Program, js: { code: string, map: SourceMapMappings, post_processing_changes?: PostProcessingChanges, line_offsets?: LineOffsets }, css: string }}
 */
export function transform_client(filename, source, analysis, to_ts, minify_css) {
	/** @type {TransformClientState} */
	const state = {
		imports: new Set(),
		events: new Set(),
		template: null,
		hoisted: [],
		setup: null,
		init: null,
		inside_head: false,
		update: null,
		final: null,
		flush_node: null,
		scope: analysis.scope,
		scopes: analysis.scopes,
		inside_server_block: false,
		serverIdentifierPresent: analysis.metadata.serverIdentifierPresent,
		server_block_locals: [],
		stylesheets: [],
		to_ts,
		filename,
		namespace: 'html',
		metadata: {},
	};

	// Add ripple internal import once for the entire module
	// Whatever is unused will be tree-shaken later, including a rare case
	// where nothing from ripple/internal/client is used
	if (!to_ts) {
		state.imports.add(`import * as _$_ from 'ripple/internal/client'`);
	}

	const program = /** @type {AST.Program} */ (walk(analysis.ast, { ...state }, visitors));

	for (const hoisted of state.hoisted) {
		program.body.unshift(hoisted);
	}

	for (const import_node of state.imports) {
		if (typeof import_node === 'string') {
			program.body.unshift(b.stmt(b.id(import_node)));
		} else {
			program.body.unshift(import_node);
		}
	}

	if (state.events.size > 0) {
		program.body.push(
			b.stmt(
				b.call('_$_.delegate', b.array(Array.from(state.events).map((name) => b.literal(name)))),
			),
		);
	}

	const language_handler = to_ts
		? create_tsx_with_typescript_support()
		: /** @type {Visitors<AST.Node, TransformClientState>} */ (tsx());

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

	const css = render_stylesheets(state.stylesheets, minify_css);

	return {
		ast: program,
		js,
		css,
	};
}
