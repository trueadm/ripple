/** @import * as AST from 'estree'; */
/** @import { SourceMapMappings } from '@jridgewell/sourcemap-codec'; */
/** @import { TSESTree } from '@typescript-eslint/types'; */
/**
@import {
	TransformServerContext,
	TransformServerState,
	Visitors,
	AnalysisResult,
	ScopeInterface,
	Visitor
} from '#compiler' */

import * as b from '../../../../utils/builders.js';
import { walk } from 'zimmerframe';
import ts from 'esrap/languages/ts';
import path from 'node:path';
import { print } from 'esrap';
import is_reference from 'is-reference';
import {
	determine_namespace_for_children,
	escape_html,
	is_boolean_attribute,
	is_element_dom_element,
	is_inside_component,
	is_void_element,
	normalize_children,
} from '../../../utils.js';
import { escape } from '../../../../utils/escaping.js';
import { is_event_attribute } from '../../../../utils/events.js';
import { render_stylesheets } from '../stylesheet.js';
import { createHash } from 'node:crypto';
import { STYLE_IDENTIFIER, CSS_HASH_IDENTIFIER } from '../../../identifier-utils.js';

/**
 * @param {AST.Node[]} children
 * @param {TransformServerContext} context
 */
function transform_children(children, context) {
	const { visit, state } = context;
	const normalized = normalize_children(children, context);

	for (const node of normalized) {
		if (node.type === 'BreakStatement') {
			state.init?.push(b.break);
			continue;
		}
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
		} else {
			visit(node, { ...state });
		}
	}
}

/**
 * @param {AST.Node[]} body
 * @param {TransformServerContext} context
 * @returns {AST.Statement[]}
 */
function transform_body(body, context) {
	const { state } = context;
	/** @type {TransformServerState} */
	const body_state = {
		...state,
		init: [],
		metadata: state.metadata,
	};

	transform_children(body, { ...context, state: body_state });

	return /** @type {AST.Statement[]} */ (body_state.init);
}

/** @type {Visitors<AST.Node, TransformServerState>} */
const visitors = {
	_: (node, { next, state }) => {
		const scope = state.scopes.get(node);

		if (scope && scope !== state.scope) {
			return next({ ...state, scope });
		} else {
			return next();
		}
	},

	Identifier(node, context) {
		const parent = /** @type {AST.Node} */ (context.path.at(-1));

		if (is_reference(node, parent) && node.tracked) {
			const is_right_side_of_assignment =
				parent.type === 'AssignmentExpression' && parent.right === node;
			if (
				(parent.type !== 'AssignmentExpression' && parent.type !== 'UpdateExpression') ||
				is_right_side_of_assignment
			) {
				return b.call('_$_.get', node);
			}
		}
	},

	Component(node, context) {
		if (node.params.length > 0) {
			let props_param = node.params[0];

			if (props_param.type === 'Identifier') {
				delete props_param.typeAnnotation;
			} else if (props_param.type === 'ObjectPattern') {
				delete props_param.typeAnnotation;
			}
		}

		const metadata = { await: false };

		/** @type {AST.Statement[]} */
		const body_statements = [];

		if (node.css !== null) {
			const hash_id = b.id(CSS_HASH_IDENTIFIER);
			const hash = b.var(hash_id, b.literal(node.css.hash));
			context.state.stylesheets.push(node.css);

			// Register CSS hash during rendering
			body_statements.push(
				hash,
				b.stmt(b.call(b.member(b.id('__output'), b.id('register_css')), hash_id)),
			);

			if (node.metadata.styleIdentifierPresent) {
				/** @type {AST.Property[]} */
				const properties = [];
				if (node.metadata.topScopedClasses && node.metadata.topScopedClasses.size > 0) {
					for (const [className] of node.metadata.topScopedClasses) {
						properties.push(
							b.prop(
								'init',
								b.key(className),
								b.template([b.quasi('', false), b.quasi(` ${className}`, true)], [hash_id]),
							),
						);
					}
				}
				body_statements.push(b.var(b.id(STYLE_IDENTIFIER), b.object(properties)));
			}
		}

		body_statements.push(
			b.stmt(b.call('_$_.push_component')),
			...transform_body(node.body, {
				...context,
				state: { ...context.state, component: node, metadata },
			}),
			b.stmt(b.call('_$_.pop_component')),
		);

		let component_fn = b.function(
			node.id,
			node.params.length > 0 ? [b.id('__output'), node.params[0]] : [b.id('__output')],
			b.block([
				...(metadata.await
					? [b.return(b.call('_$_.async', b.thunk(b.block(body_statements), true)))]
					: body_statements),
			]),
		);

		// Mark function as async if needed
		if (metadata.await) {
			component_fn = b.async(component_fn);
		}

		// Anonymous components return a FunctionExpression
		if (!node.id) {
			// For async anonymous components, we need to set .async on the function
			if (metadata.await) {
				// Use IIFE pattern: (fn => (fn.async = true, fn))(function() { ... })
				return b.call(
					b.arrow(
						[b.id('fn')],
						b.sequence([
							b.assignment('=', b.member(b.id('fn'), b.id('async')), b.true),
							b.id('fn'),
						]),
					),
					component_fn,
				);
			}
			return component_fn;
		}

		// Named components return a FunctionDeclaration
		const declaration = b.function_declaration(
			node.id,
			component_fn.params,
			component_fn.body,
			component_fn.async,
		);

		if (metadata.await) {
			const parent = context.path.at(-1);
			if (parent?.type === 'Program' || parent?.type === 'BlockStatement') {
				const body = /** @type {AST.RippleProgram} */ (parent).body;
				const index = body.indexOf(node);
				body.splice(
					index + 1,
					0,
					b.stmt(b.assignment('=', b.member(node.id, b.id('async')), b.true)),
				);
			}
		}

		return declaration;
	},

	CallExpression(node, context) {
		if (!context.state.to_ts) {
			delete node.typeArguments;
		}
		return context.next();
	},

	NewExpression(node, context) {
		// Special handling for TrackedMapExpression and TrackedSetExpression
		// When source is "new #Map(...)", the callee is TrackedMapExpression with empty arguments
		// and the actual arguments are in NewExpression.arguments
		const callee = node.callee;
		if (callee.type === 'TrackedMapExpression' || callee.type === 'TrackedSetExpression') {
			// Use NewExpression's arguments (the callee has empty arguments from parser)
			const argsToUse = node.arguments.length > 0 ? node.arguments : callee.arguments;
			// For SSR, use regular Map/Set
			const constructorName = callee.type === 'TrackedMapExpression' ? 'Map' : 'Set';
			return b.new(
				b.id(constructorName),
				.../** @type {AST.Expression[]} */ (argsToUse.map((arg) => context.visit(arg))),
			);
		}

		if (!context.state.to_ts) {
			delete node.typeArguments;
		}
		return context.next();
	},

	PropertyDefinition(node, context) {
		if (!context.state.to_ts) {
			delete node.typeAnnotation;
		}
		return context.next();
	},

	FunctionDeclaration(node, context) {
		if (!context.state.to_ts) {
			delete node.returnType;
			delete node.typeParameters;
			for (const param of node.params) {
				delete param.typeAnnotation;
				// Handle AssignmentPattern (parameters with default values)
				if (param.type === 'AssignmentPattern' && param.left) {
					delete param.left.typeAnnotation;
				}
			}
		}
		return context.next();
	},

	FunctionExpression(node, context) {
		if (!context.state.to_ts) {
			delete node.returnType;
			delete node.typeParameters;
			for (const param of node.params) {
				delete param.typeAnnotation;
				// Handle AssignmentPattern (parameters with default values)
				if (param.type === 'AssignmentPattern' && param.left) {
					delete param.left.typeAnnotation;
				}
			}
		}
		return context.next();
	},

	ArrowFunctionExpression(node, context) {
		if (!context.state.to_ts) {
			delete node.returnType;
			delete node.typeParameters;
			for (const param of node.params) {
				delete param.typeAnnotation;
				// Handle AssignmentPattern (parameters with default values)
				if (param.type === 'AssignmentPattern' && param.left) {
					delete param.left.typeAnnotation;
				}
			}
		}
		return context.next();
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
			return b.sequence(/** @type {AST.Expression[]} */ ([context.visit(node.expression)]));
		}
		return context.next();
	},

	TSTypeAliasDeclaration(_, context) {
		if (!context.state.to_ts) {
			return b.empty;
		}
		context.next();
	},

	TSInterfaceDeclaration(_, context) {
		if (!context.state.to_ts) {
			return b.empty;
		}
		context.next();
	},

	ExportNamedDeclaration(node, context) {
		if (!context.state.to_ts && node.exportKind === 'type') {
			return b.empty;
		}
		if (!context.state.inside_server_block) {
			return context.next();
		}
		const declaration = node.declaration;

		if (declaration && declaration.type === 'FunctionDeclaration') {
			return b.stmt(
				b.assignment(
					'=',
					b.member(b.id('_$_server_$_'), b.id(declaration.id.name)),
					/** @type {AST.Expression} */
					(context.visit(declaration)),
				),
			);
		} else {
			// TODO
			throw new Error('Not implemented');
		}
	},

	VariableDeclaration(node, context) {
		for (const declarator of node.declarations) {
			if (!context.state.to_ts) {
				delete declarator.id.typeAnnotation;
			}
		}

		return context.next();
	},

	Element(node, context) {
		const { state, visit } = context;

		const is_dom_element = is_element_dom_element(node);
		const is_spreading = node.attributes.some((attr) => attr.type === 'SpreadAttribute');
		/** @type {(AST.Property | AST.SpreadElement)[] | null} */
		const spread_attributes = is_spreading ? [] : null;
		const child_namespace = is_dom_element
			? determine_namespace_for_children(node.id.name, state.namespace)
			: state.namespace;

		if (is_dom_element) {
			const is_void = is_void_element(node.id.name);

			state.init?.push(
				b.stmt(b.call(b.member(b.id('__output'), b.id('push')), b.literal(`<${node.id.name}`))),
			);
			let class_attribute = null;

			/**
			 * @param {string} name
			 *  @param {string | number | bigint | boolean | RegExp | null | undefined} value
			 */
			const handle_static_attr = (name, value) => {
				const attr_str = ` ${name}${
					is_boolean_attribute(name) && value === true
						? ''
						: `="${value === true ? '' : escape_html(value, true)}"`
				}`;

				if (is_spreading) {
					// For spread attributes, store just the actual value, not the full attribute string
					const actual_value =
						is_boolean_attribute(name) && value === true
							? b.literal(true)
							: b.literal(value === true ? '' : value);
					spread_attributes?.push(b.prop('init', b.literal(name), actual_value));
				} else {
					state.init?.push(
						b.stmt(b.call(b.member(b.id('__output'), b.id('push')), b.literal(attr_str))),
					);
				}
			};

			for (const attr of node.attributes) {
				if (attr.type === 'Attribute') {
					if (attr.name.type === 'Identifier') {
						const name = attr.name.name;

						if (attr.value === null) {
							handle_static_attr(name, true);
							continue;
						}

						if (attr.value.type === 'Literal' && name !== 'class') {
							handle_static_attr(name, attr.value.value);
							continue;
						}

						if (name === 'class') {
							class_attribute = attr;

							continue;
						}

						if (is_event_attribute(name)) {
							continue;
						}
						const metadata = { tracking: false, await: false };
						const expression = /** @type {AST.Expression} */ (
							visit(attr.value, { ...state, metadata })
						);

						state.init?.push(
							b.stmt(
								b.call(
									b.member(b.id('__output'), b.id('push')),
									b.call('_$_.attr', b.literal(name), expression),
								),
							),
						);
					}
				} else if (attr.type === 'SpreadAttribute') {
					spread_attributes?.push(
						b.spread(/** @type {AST.Expression} */ (visit(attr.argument, state))),
					);
				}
			}

			if (class_attribute !== null) {
				const attr_value = /** @type {AST.Expression} */ (class_attribute.value);
				if (attr_value.type === 'Literal') {
					let value = attr_value.value;

					if (node.metadata.scoped && state.component?.css) {
						value = `${state.component.css.hash} ${value}`;
					}

					handle_static_attr(class_attribute.name.name, value);
				} else {
					const metadata = { tracking: false, await: false };
					let expression = /** @type {AST.Expression} */ (
						visit(attr_value, { ...state, metadata })
					);

					if (node.metadata.scoped && state.component?.css) {
						// Pass array to clsx so it can handle objects properly
						expression = b.array([expression, b.literal(state.component.css.hash)]);
					}

					state.init?.push(
						b.stmt(
							b.call(
								b.member(b.id('__output'), b.id('push')),
								b.call('_$_.attr', b.literal('class'), expression),
							),
						),
					);
				}
			} else if (node.metadata.scoped && state.component?.css) {
				const value = state.component.css.hash;

				handle_static_attr('class', value);
			}

			if (spread_attributes !== null && spread_attributes.length > 0) {
				state.init?.push(
					b.stmt(
						b.call(
							b.member(b.id('__output'), b.id('push')),
							b.call(
								'_$_.spread_attrs',
								b.object(spread_attributes),
								node.metadata.scoped && state.component?.css
									? b.literal(state.component.css.hash)
									: undefined,
							),
						),
					),
				);
			}

			state.init?.push(b.stmt(b.call(b.member(b.id('__output'), b.id('push')), b.literal(`>`))));

			if (!is_void) {
				transform_children(
					node.children,
					/** @type {TransformServerContext} */ ({ visit, state: { ...state } }),
				);

				state.init?.push(
					b.stmt(b.call(b.member(b.id('__output'), b.id('push')), b.literal(`</${node.id.name}>`))),
				);
			}
		} else {
			/** @type {(AST.Property | AST.SpreadElement)[]} */
			const props = [];
			/** @type {AST.Expression | null} */
			let children_prop = null;

			for (const attr of node.attributes) {
				if (attr.type === 'Attribute') {
					if (attr.name.type === 'Identifier') {
						const metadata = { tracking: false, await: false };
						let property = /** @type {AST.Expression} */ (
							visit(/** @type {AST.Expression} */ (attr.value), {
								...state,
								metadata,
							})
						);

						if (attr.name.name === 'children') {
							children_prop = b.thunk(property);
							continue;
						}

						props.push(b.prop('init', attr.name, property));
					}
				} else if (attr.type === 'SpreadAttribute') {
					props.push(
						b.spread(
							/** @type {AST.Expression} */ (
								visit(attr.argument, { ...state, metadata: { ...state.metadata } })
							),
						),
					);
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
				const component_scope = /** @type {ScopeInterface} */ (context.state.scopes.get(node));
				const children = /** @type {AST.Expression} */ (
					visit(b.component(b.id('children'), [], children_filtered), {
						...context.state,
						scope: component_scope,
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

			// For SSR, determine if we should await based on component metadata
			const component_call = b.call(
				/** @type {AST.Expression} */ (visit(node.id, state)),
				b.id('__output'),
				b.object(props),
			);

			// Check if this is a locally defined component and if it's async
			const component_name = node.id.type === 'Identifier' ? node.id.name : null;
			const local_metadata = component_name
				? state.component_metadata.find((m) => m.id === component_name)
				: null;

			if (local_metadata) {
				// Component is defined locally - we know if it's async or not
				if (local_metadata.async) {
					state.init?.push(b.stmt(b.await(component_call)));
				} else {
					state.init?.push(b.stmt(component_call));
				}
			} else {
				// Component is imported or dynamic - check .async property at runtime
				// Use if-statement instead of ternary to avoid parser issues with await in conditionals
				state.init?.push(
					b.if(
						b.member(/** @type {AST.Expression} */ (visit(node.id, state)), b.id('async')),
						b.block([b.stmt(b.await(component_call))]),
						b.block([b.stmt(component_call)]),
					),
				);

				// Mark parent component as async since we're using await
				if (state.metadata?.await === false) {
					state.metadata.await = true;
				}
			}
		}
	},

	SwitchStatement(node, context) {
		if (!is_inside_component(context)) {
			return context.next();
		}

		const cases = [];

		for (const switch_case of node.cases) {
			const case_body = [];

			if (switch_case.consequent.length !== 0) {
				const consequent_scope =
					context.state.scopes.get(switch_case.consequent) || context.state.scope;
				const consequent = b.block(
					transform_body(switch_case.consequent, {
						...context,
						state: { ...context.state, scope: consequent_scope },
					}),
				);
				case_body.push(...consequent.body);
			}

			cases.push(
				b.switch_case(
					switch_case.test ? /** @type {AST.Expression} */ (context.visit(switch_case.test)) : null,
					case_body,
				),
			);
		}

		context.state.init?.push(
			b.switch(/** @type {AST.Expression} */ (context.visit(node.discriminant)), cases),
		);
	},

	ForOfStatement(node, context) {
		if (!is_inside_component(context)) {
			context.next();
			return;
		}
		const body_scope = context.state.scopes.get(node.body);

		const body = transform_body(/** @type {AST.BlockStatement} */ (node.body).body, {
			...context,
			state: { ...context.state, scope: /** @type {ScopeInterface} */ (body_scope) },
		});

		if (node.index) {
			context.state.init?.push(b.var(node.index, b.literal(0)));
			body.push(b.stmt(b.update('++', node.index)));
		}

		context.state.init?.push(
			b.for_of(
				/** @type {AST.VariableDeclaration} */ (context.visit(node.left)),
				/** @type {AST.Expression} */
				(context.visit(node.right)),
				b.block(body),
			),
		);
	},

	IfStatement(node, context) {
		if (!is_inside_component(context)) {
			context.next();
			return;
		}

		const consequent = b.block(
			transform_body(/** @type {AST.BlockStatement} */ (node.consequent).body, {
				...context,
				state: {
					...context.state,
					scope: /** @type {ScopeInterface} */ (context.state.scopes.get(node.consequent)),
				},
			}),
		);

		/** @type {AST.BlockStatement | AST.IfStatement | null} */
		let alternate = null;
		if (node.alternate) {
			const alternate_scope = context.state.scopes.get(node.alternate) || context.state.scope;
			const alternate_body_nodes =
				node.alternate.type === 'IfStatement'
					? [node.alternate]
					: /** @type {AST.BlockStatement} */ (node.alternate).body;

			alternate = b.block(
				transform_body(alternate_body_nodes, {
					...context,
					state: { ...context.state, scope: alternate_scope },
				}),
			);
		}

		context.state.init?.push(
			b.if(/** @type {AST.Expression} */ (context.visit(node.test)), consequent, alternate),
		);
	},

	AssignmentExpression(node, context) {
		const left = node.left;

		if (
			left.type === 'MemberExpression' &&
			(left.tracked || (left.property.type === 'Identifier' && left.property.tracked))
		) {
			const operator = node.operator;
			const right = node.right;

			return b.call(
				'_$_.set_property',
				/** @type {AST.Expression} */ (context.visit(left.object)),
				left.computed
					? /** @type {AST.Expression} */ (context.visit(left.property))
					: b.literal(/** @type {AST.Identifier} */ (left.property).name),
				operator === '='
					? /** @type {AST.Expression} */ (context.visit(right))
					: b.binary(
							operator === '+=' ? '+' : operator === '-=' ? '-' : operator === '*=' ? '*' : '/',
							b.call(
								'_$_.get_property',
								/** @type {AST.Expression} */ (context.visit(left.object)),
								left.computed
									? /** @type {AST.Expression} */ (context.visit(left.property))
									: b.literal(/** @type {AST.Identifier} */ (left.property).name),
								undefined,
							),
							/** @type {AST.Expression} */ (context.visit(right)),
						),
			);
		}

		if (left.type === 'Identifier' && left.tracked) {
			const operator = node.operator;
			const right = node.right;

			return b.call(
				'_$_.set',
				/** @type {AST.Expression} */ (context.visit(left)),
				operator === '='
					? /** @type {AST.Expression} */ (context.visit(right))
					: b.binary(
							operator === '+=' ? '+' : operator === '-=' ? '-' : operator === '*=' ? '*' : '/',
							b.call('_$_.get', left),
							/** @type {AST.Expression} */ (context.visit(right)),
						),
			);
		}

		return context.next();
	},

	UpdateExpression(node, context) {
		const argument = node.argument;

		if (
			argument.type === 'MemberExpression' &&
			(argument.tracked || (argument.property.type === 'Identifier' && argument.property.tracked))
		) {
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
				(context.visit(argument)),
				node.operator === '--' ? b.literal(-1) : undefined,
			);
		}

		if (argument.type === 'TrackedExpression') {
			return b.call(
				node.prefix ? '_$_.update_pre' : '_$_.update',
				/** @type {AST.Expression} */
				(context.visit(argument.argument)),
				node.operator === '--' ? b.literal(-1) : undefined,
			);
		}
	},

	ServerIdentifier(node, context) {
		return b.id('_$_server_$_');
	},

	StyleIdentifier(node, context) {
		return b.id(STYLE_IDENTIFIER);
	},

	ImportDeclaration(node, context) {
		const { state } = context;

		if (!state.to_ts && node.importKind === 'type') {
			return b.empty;
		}

		if (state.inside_server_block) {
			if (!node.specifiers.length) {
				return b.empty;
			}

			/** @type {AST.VariableDeclaration[]} */
			const locals = state.server_block_locals;
			for (const spec of node.specifiers) {
				state.server_import_counter++;
				const name = `_$_import_${state.server_import_counter}`;
				const original_name = spec.local.name;

				spec.local = b.id(name);

				locals.push(b.const(original_name, b.id(name)));
			}
			state.imports.add(node);
			return b.empty;
		}

		return /** @type {AST.ImportDeclaration} */ ({
			...node,
			specifiers: node.specifiers
				.filter((spec) => /** @type {AST.ImportSpecifier} */ (spec).importKind !== 'type')
				.map((spec) => context.visit(spec)),
		});
	},

	TryStatement(node, context) {
		if (!is_inside_component(context)) {
			return context.next();
		}

		// If there's a pending block, this is an async operation
		const has_pending = node.pending !== null;
		if (has_pending && context.state.metadata?.await === false) {
			context.state.metadata.await = true;
		}

		const metadata = { await: false };
		const body = transform_body(node.block.body, {
			...context,
			state: { ...context.state, metadata },
		});

		// Check if the try block itself contains async operations
		const is_async = metadata.await || has_pending;

		if (is_async) {
			if (context.state.metadata?.await === false) {
				context.state.metadata.await = true;
			}

			// Render pending block first
			if (node.pending) {
				const pending_body = transform_body(node.pending.body, {
					...context,
					state: {
						...context.state,
						scope: /** @type {ScopeInterface} */ (context.state.scopes.get(node.pending)),
					},
				});
				context.state.init?.push(...pending_body);
			}

			// For SSR with pending block: render the resolved content wrapped in async
			// In a streaming SSR implementation, we'd render pending first, then stream resolved
			const handler = node.handler;
			/** @type {AST.Statement[]} */
			let try_statements = body;
			if (handler != null) {
				try_statements = [
					b.try(
						b.block(body),
						b.catch_clause(
							handler.param || b.id('error'),
							b.block(
								transform_body(handler.body.body, {
									...context,
									state: {
										...context.state,
										scope: /** @type {ScopeInterface} */ (context.state.scopes.get(handler.body)),
									},
								}),
							),
						),
					),
				];
			}

			context.state.init?.push(
				b.stmt(b.await(b.call('_$_.async', b.thunk(b.block(try_statements), true)))),
			);
		} else {
			// No async, just regular try/catch
			if (node.handler != null) {
				const handler_body = transform_body(node.handler.body.body, {
					...context,
					state: {
						...context.state,
						scope: /** @type {ScopeInterface} */ (context.state.scopes.get(node.handler.body)),
					},
				});

				context.state.init?.push(
					b.try(
						b.block(body),
						b.catch_clause(node.handler.param || b.id('error'), b.block(handler_body)),
					),
				);
			} else {
				context.state.init?.push(...body);
			}
		}
	},

	AwaitExpression(node, context) {
		const { state } = context;

		if (state.to_ts) {
			return context.next();
		}

		if (state.metadata?.await === false) {
			state.metadata.await = true;
		}

		return b.await(/** @type {AST.AwaitExpression} */ (context.visit(node.argument)));
	},

	TrackedExpression(node, context) {
		return b.call('_$_.get', /** @type {AST.Expression} */ (context.visit(node.argument)));
	},

	TrackedObjectExpression(node, context) {
		// For SSR, we just evaluate the object as-is since there's no reactivity
		return b.object(
			/** @type {(AST.Property | AST.SpreadElement)[]} */
			(node.properties.map((prop) => context.visit(prop))),
		);
	},

	TrackedArrayExpression(node, context) {
		// For SSR, we just evaluate the array as-is since there's no reactivity
		return b.array(
			/** @type {(AST.Expression | AST.SpreadElement)[]} */
			(
				/** @param {AST.Node} el */
				node.elements.map((el) => context.visit(/** @type {AST.Node} */ (el)))
			),
		);
	},

	MemberExpression(node, context) {
		if (node.tracked || (node.property.type === 'Identifier' && node.property.tracked)) {
			return b.call(
				'_$_.get_property',
				/** @type {AST.Expression} */ (context.visit(node.object)),
				node.computed
					? /** @type {AST.Expression} */ (context.visit(node.property))
					: b.literal(/** @type {AST.Identifier} */ (node.property).name),
				node.optional ? b.true : undefined,
			);
		}

		return context.next();
	},

	Text(node, { visit, state }) {
		const metadata = { await: false };
		let expression = /** @type {AST.Expression} */ (visit(node.expression, { ...state, metadata }));

		if (expression.type === 'Identifier' && expression.tracked) {
			expression = b.call('_$_.get', expression);
		}

		if (expression.type === 'Literal') {
			state.init?.push(
				b.stmt(
					b.call(b.member(b.id('__output'), b.id('push')), b.literal(escape(expression.value))),
				),
			);
		} else {
			state.init?.push(
				b.stmt(b.call(b.member(b.id('__output'), b.id('push')), b.call('_$_.escape', expression))),
			);
		}
	},

	Html(node, { visit, state }) {
		const metadata = { await: false };
		const expression = /** @type {AST.Expression} */ (
			visit(node.expression, { ...state, metadata })
		);

		// For Html nodes, we render the content as-is without escaping
		if (expression.type === 'Literal') {
			state.init?.push(
				b.stmt(b.call(b.member(b.id('__output'), b.id('push')), b.literal(expression.value))),
			);
		} else {
			// If it's dynamic, we need to evaluate it and push it directly (not escaped)
			state.init?.push(b.stmt(b.call(b.member(b.id('__output'), b.id('push')), expression)));
		}
	},

	ServerBlock(node, context) {
		const exports = node.metadata.exports;

		// Convert Imports inside ServerBlock to local variables
		// ImportDeclaration() visitor will add imports to the top of the module
		/** @type {AST.VariableDeclaration[]} */
		const server_block_locals = [];

		const block = /** @type {AST.BlockStatement} */ (
			context.visit(node.body, {
				...context.state,
				inside_server_block: true,
				server_block_locals,
				server_import_counter: 0,
			})
		);

		if (exports.length === 0) {
			return {
				...block,
				body: [...server_block_locals, ...block.body],
			};
		}

		const file_path = context.state.filename;
		const rpc_modules = globalThis.rpc_modules;

		if (rpc_modules) {
			for (const name of exports) {
				const func_path = file_path + '#' + name;
				// needs to be a sha256 hash of func_path, to avoid leaking file structure
				const hash = createHash('sha256').update(func_path).digest('hex').slice(0, 8);
				rpc_modules.set(hash, [file_path, name]);
			}
		}

		return b.export(
			b.const(
				'_$_server_$_',
				b.call(
					b.thunk(
						b.block([
							b.var('_$_server_$_', b.object([])),
							...server_block_locals,
							...block.body,
							b.return(b.id('_$_server_$_')),
						]),
					),
				),
			),
		);
	},
};

/**
 * @param {string} filename
 * @param {string} source
 * @param {AnalysisResult} analysis
 * @param {boolean} minify_css
 * @returns {{ ast: AST.Program; js: { code: string; map: SourceMapMappings | null }; css: string; }}
 */
export function transform_server(filename, source, analysis, minify_css) {
	// Use component metadata collected during the analyze phase
	const component_metadata = analysis.component_metadata || [];

	/** @type {TransformServerState} */
	const state = {
		imports: new Set(),
		init: null,
		scope: analysis.scope,
		scopes: analysis.scopes,
		serverIdentifierPresent: analysis.metadata.serverIdentifierPresent,
		stylesheets: [],
		component_metadata,
		inside_server_block: false,
		server_block_locals: [],
		server_import_counter: 0,
		filename,
		namespace: 'html',
		// TODO: should we remove all `to_ts` usages we use the client rendering for that?
		to_ts: false,
		metadata: {},
	};

	state.imports.add(`import * as _$_ from 'ripple/internal/server'`);

	const program = /** @type {AST.Program} */ (walk(analysis.ast, { ...state }, visitors));

	const css = render_stylesheets(state.stylesheets, minify_css);

	// Add CSS registration if there are stylesheets
	if (state.stylesheets.length > 0 && css) {
		// Register each stylesheet's CSS
		for (const stylesheet of state.stylesheets) {
			const css_for_component = render_stylesheets([stylesheet]);
			/** @type {AST.Program} */ (program).body.push(
				b.stmt(
					b.call('_$_.register_css', b.literal(stylesheet.hash), b.literal(css_for_component)),
				),
			);
		}
	}

	// Add async property to component functions
	for (const import_node of state.imports) {
		if (typeof import_node === 'string') {
			program.body.unshift(b.stmt(b.id(import_node)));
		} else {
			program.body.unshift(import_node);
		}
	}

	const js = print(program, /** @type {Visitors<AST.Node, TransformServerState>} */ (ts()), {
		sourceMapContent: source,
		sourceMapSource: path.basename(filename),
	});

	return {
		ast: /** @type {AST.Program} */ (program),
		js,
		css,
	};
}
