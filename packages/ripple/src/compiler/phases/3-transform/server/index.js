import * as b from '../../../../utils/builders.js';
import { walk } from 'zimmerframe';
import ts from 'esrap/languages/ts';
import path from 'node:path';
import { print } from 'esrap';
import {
	build_getter,
	determine_namespace_for_children,
	escape_html,
	is_boolean_attribute,
	is_element_dom_element,
	is_inside_component,
	is_void_element,
	normalize_children,
} from '../../../utils.js';
import is_reference from 'is-reference';
import { escape } from '../../../../utils/escaping.js';
import { is_event_attribute } from '../../../../utils/events.js';
import { render_stylesheets } from '../stylesheet.js';

function add_ripple_internal_import(context) {
	if (!context.state.to_ts) {
		if (!context.state.imports.has(`import * as _$_ from 'ripple/internal/server'`)) {
			context.state.imports.add(`import * as _$_ from 'ripple/internal/server'`);
		}
	}
}

function transform_children(children, context) {
	const { visit, state, root } = context;
	const normalized = normalize_children(children, context);

	for (const node of normalized) {
		if (node.type === 'BreakStatement') {
			state.init.push(b.break);
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
			state.init.push(visit(node, { ...state, metadata }));
			if (metadata.await) {
				state.init.push(b.if(b.call('_$_.aborted'), b.return(null)));
				if (state.metadata?.await === false) {
					state.metadata.await = true;
				}
			}
		} else {
			visit(node, { ...state, root: false });
		}
	}
}

function transform_body(body, { visit, state }) {
	const body_state = {
		...state,
		init: [],
		metadata: state.metadata,
	};

	transform_children(body, { visit, state: body_state, root: true });

	return body_state.init;
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

	Component(node, context) {
		add_ripple_internal_import(context);

		const metadata = { await: false };
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
			// Register CSS hash during rendering
			body_statements.unshift(
				b.stmt(b.call(b.member(b.id('__output'), b.id('register_css')), b.literal(node.css.hash))),
			);
		}

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

		return component_fn;
	},

	CallExpression(node, context) {
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

	TSAsExpression(node, context) {
		if (!context.state.to_ts) {
			return context.visit(node.expression);
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

	Element(node, context) {
		const { state, visit } = context;

		const is_dom_element = is_element_dom_element(node);
		const is_spreading = node.attributes.some((attr) => attr.type === 'SpreadAttribute');
		const spread_attributes = is_spreading ? [] : null;
		const child_namespace = is_dom_element
			? determine_namespace_for_children(node.id.name, state.namespace)
			: state.namespace;

		if (is_dom_element) {
			const is_void = is_void_element(node.id.name);

			state.init.push(
				b.stmt(b.call(b.member(b.id('__output'), b.id('push')), b.literal(`<${node.id.name}`))),
			);
			let class_attribute = null;

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
					spread_attributes.push(b.prop('init', b.literal(name), actual_value));
				} else {
					state.init.push(
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
						const expression = visit(attr.value, { ...state, metadata });

						state.init.push(
							b.stmt(
								b.call(
									b.member(b.id('__output'), b.id('push')),
									b.call('_$_.attr', b.literal(name), expression),
								),
							),
						);
					}
				} else if (attr.type === 'SpreadAttribute') {
					spread_attributes.push(b.spread(visit(attr.argument, state)));
				}
			}

			if (class_attribute !== null) {
				if (class_attribute.value.type === 'Literal') {
					let value = class_attribute.value.value;

					if (node.metadata.scoped && state.component.css) {
						value = `${state.component.css.hash} ${value}`;
					}

					handle_static_attr(class_attribute.name.name, value);
				} else {
					const metadata = { tracking: false, await: false };
					let expression = visit(class_attribute.value, { ...state, metadata });

					if (node.metadata.scoped && state.component.css) {
						// Pass array to clsx so it can handle objects properly
						expression = b.array([expression, b.literal(state.component.css.hash)]);
					}

					state.init.push(
						b.stmt(
							b.call(
								b.member(b.id('__output'), b.id('push')),
								b.call('_$_.attr', b.literal('class'), expression),
							),
						),
					);
				}
			} else if (node.metadata.scoped && state.component.css) {
				const value = state.component.css.hash;

				handle_static_attr('class', value);
			}

			if (spread_attributes !== null && spread_attributes.length > 0) {
				state.init.push(
					b.stmt(
						b.call(
							b.member(b.id('__output'), b.id('push')),
							b.call(
								'_$_.spread_attrs',
								b.object(spread_attributes),
								node.metadata.scoped && state.component.css
									? b.literal(state.component.css.hash)
									: undefined,
							),
						),
					),
				);
			}

			state.init.push(b.stmt(b.call(b.member(b.id('__output'), b.id('push')), b.literal(`>`))));

			if (!is_void) {
				transform_children(node.children, { visit, state: { ...state, root: false } });

				state.init.push(
					b.stmt(b.call(b.member(b.id('__output'), b.id('push')), b.literal(`</${node.id.name}>`))),
				);
			}
		} else {
			const props = [];
			let children_prop = null;

			for (const attr of node.attributes) {
				if (attr.type === 'Attribute') {
					if (attr.name.type === 'Identifier') {
						const metadata = { tracking: false, await: false };
						let property = visit(attr.value, { ...state, metadata });

						if (attr.name.name === 'children') {
							children_prop = b.thunk(property);
							continue;
						}

						props.push(b.prop('init', attr.name, property));
					} else if (attr.type === 'SpreadAttribute') {
						props.push(
							b.spread(
								visit(attr.argument, { ...state, metadata: { ...state.metadata, spread: true } }),
							),
						);
					}
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
				const children = visit(b.component(b.id('children'), [], children_filtered), {
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

			// For SSR, determine if we should await based on component metadata
			const component_call = b.call(visit(node.id, state), b.id('__output'), b.object(props));

			// Check if this is a locally defined component and if it's async
			const component_name = node.id.type === 'Identifier' ? node.id.name : null;
			const local_metadata = component_name
				? state.component_metadata.find((m) => m.id === component_name)
				: null;

			if (local_metadata) {
				// Component is defined locally - we know if it's async or not
				if (local_metadata.async) {
					state.init.push(b.stmt(b.await(component_call)));
				} else {
					state.init.push(b.stmt(component_call));
				}
			} else {
				// Component is imported or dynamic - check .async property at runtime
				const conditional_await = b.conditional(
					b.member(visit(node.id, state), b.id('async')),
					b.await(component_call),
					component_call,
				);
				state.init.push(b.stmt(conditional_await));
			}
		}
	},
	SwitchStatement(node, context) {
		if (!is_inside_component(context)) {
			return context.next();
		}
		const cases = [];
		for (const switch_case of node.cases) {
			const consequent_scope =
				context.state.scopes.get(switch_case.consequent) || context.state.scope;
			const consequent = b.block(
				transform_body(switch_case.consequent, {
					...context,
					state: { ...context.state, scope: consequent_scope },
				}),
			);
			cases.push(
				b.switch_case(switch_case.test ? context.visit(switch_case.test) : null, consequent.body),
			);
		}
		context.state.init.push(b.switch(context.visit(node.discriminant), cases));
	},

	ForOfStatement(node, context) {
		if (!is_inside_component(context)) {
			context.next();
			return;
		}
		const body_scope = context.state.scopes.get(node.body);

		const body = transform_body(node.body.body, {
			...context,
			state: { ...context.state, scope: body_scope },
		});

		if (node.index) {
			context.state.init.push(b.var(node.index, b.literal(0)));
			body.push(b.update('++', node.index));
		}

		context.state.init.push(
			b.for_of(context.visit(node.left), context.visit(node.right), b.block(body)),
		);
	},

	IfStatement(node, context) {
		if (!is_inside_component(context)) {
			context.next();
			return;
		}

		const consequent = b.block(
			transform_body(node.consequent.body, {
				...context,
				state: { ...context.state, scope: context.state.scopes.get(node.consequent) },
			}),
		);

		let alternate = null;
		if (node.alternate) {
			const alternate_scope = context.state.scopes.get(node.alternate) || context.state.scope;
			const alternate_body_nodes =
				node.alternate.type === 'IfStatement' ? [node.alternate] : node.alternate.body;

			alternate = b.block(
				transform_body(alternate_body_nodes, {
					...context,
					state: { ...context.state, scope: alternate_scope },
				}),
			);
		}

		context.state.init.push(b.if(context.visit(node.test), consequent, alternate));
	},

	Identifier(node, context) {
		const parent = /** @type {Node} */ (context.path.at(-1));

		if (is_reference(node, parent) && node.tracked) {
			add_ripple_internal_import(context);
			return b.call('_$_.get', build_getter(node, context));
		}
	},

	ImportDeclaration(node, context) {
		if (!context.state.to_ts && node.importKind === 'type') {
			return b.empty;
		}

		return {
			...node,
			specifiers: node.specifiers
				.filter((spec) => spec.importKind !== 'type')
				.map((spec) => context.visit(spec)),
		};
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

			// For SSR with pending block: render the resolved content wrapped in async
			// In a streaming SSR implementation, we'd render pending first, then stream resolved
			const try_statements =
				node.handler !== null
					? [
							b.try(
								b.block(body),
								b.catch_clause(
									node.handler.param || b.id('error'),
									b.block(
										transform_body(node.handler.body.body, {
											...context,
											state: {
												...context.state,
												scope: context.state.scopes.get(node.handler.body),
											},
										}),
									),
								),
							),
						]
					: body;

			context.state.init.push(
				b.stmt(b.await(b.call('_$_.async', b.thunk(b.block(try_statements), true)))),
			);
		} else {
			// No async, just regular try/catch
			if (node.handler !== null) {
				const handler_body = transform_body(node.handler.body.body, {
					...context,
					state: { ...context.state, scope: context.state.scopes.get(node.handler.body) },
				});

				context.state.init.push(
					b.try(
						b.block(body),
						b.catch_clause(node.handler.param || b.id('error'), b.block(handler_body)),
					),
				);
			} else {
				context.state.init.push(...body);
			}
		}
	},

	AwaitExpression(node, context) {
		if (context.state.to_ts) {
			return context.next();
		}

		if (context.state.metadata?.await === false) {
			context.state.metadata.await = true;
		}

		return b.await(context.visit(node.argument));
	},

	TrackedObjectExpression(node, context) {
		// For SSR, we just evaluate the object as-is since there's no reactivity
		return b.object(node.properties.map((prop) => context.visit(prop)));
	},

	TrackedArrayExpression(node, context) {
		// For SSR, we just evaluate the array as-is since there's no reactivity
		return b.array(node.elements.map((el) => context.visit(el)));
	},

	MemberExpression(node, context) {
		const parent = context.path.at(-1);

		if (node.tracked || (node.property.type === 'Identifier' && node.property.tracked)) {
			add_ripple_internal_import(context);

			return b.call(
				'_$_.get',
				b.member(
					context.visit(node.object),
					node.computed ? context.visit(node.property) : node.property,
					node.computed,
					node.optional,
				),
			);
		}

		return context.next();
	},

	Text(node, { visit, state }) {
		const metadata = { await: false };
		const expression = visit(node.expression, { ...state, metadata });

		if (expression.type === 'Literal') {
			state.init.push(
				b.stmt(
					b.call(b.member(b.id('__output'), b.id('push')), b.literal(escape(expression.value))),
				),
			);
		} else {
			state.init.push(
				b.stmt(b.call(b.member(b.id('__output'), b.id('push')), b.call('_$_.escape', expression))),
			);
		}
	},

	Html(node, { visit, state }) {
		const metadata = { await: false };
		const expression = visit(node.expression, { ...state, metadata });

		// For Html nodes, we render the content as-is without escaping
		if (expression.type === 'Literal') {
			state.init.push(
				b.stmt(b.call(b.member(b.id('__output'), b.id('push')), b.literal(expression.value))),
			);
		} else {
			// If it's dynamic, we need to evaluate it and push it directly (not escaped)
			state.init.push(b.stmt(b.call(b.member(b.id('__output'), b.id('push')), expression)));
		}
	},

	ServerBlock(node, context) {
		return context.visit(node.body);
	},
};

export function transform_server(filename, source, analysis) {
	// Use component metadata collected during the analyze phase
	const component_metadata = analysis.component_metadata || [];

	const state = {
		imports: new Set(),
		init: null,
		scope: analysis.scope,
		scopes: analysis.scopes,
		stylesheets: [],
		component_metadata,
	};

	const program = /** @type {ESTree.Program} */ (
		walk(analysis.ast, { ...state, namespace: 'html' }, visitors)
	);

	const css = render_stylesheets(state.stylesheets);

	// Add CSS registration if there are stylesheets
	if (state.stylesheets.length > 0 && css) {
		// Register each stylesheet's CSS
		for (const stylesheet of state.stylesheets) {
			const css_for_component = render_stylesheets([stylesheet]);
			program.body.push(
				b.stmt(
					b.call('_$_.register_css', b.literal(stylesheet.hash), b.literal(css_for_component)),
				),
			);
		}
	}

	// Add async property to component functions
	for (const metadata of state.component_metadata) {
		if (metadata.async) {
			program.body.push(
				b.stmt(b.assignment('=', b.member(b.id(metadata.id), b.id('async')), b.true)),
			);
		}
	}

	for (const import_node of state.imports) {
		program.body.unshift(b.stmt(b.id(import_node)));
	}

	const js = print(program, ts(), {
		sourceMapContent: source,
		sourceMapSource: path.basename(filename),
	});

	return {
		ast: program,
		js,
		css,
	};
}
