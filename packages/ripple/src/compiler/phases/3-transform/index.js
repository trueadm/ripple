import { walk } from 'zimmerframe';
import path from 'node:path';
import { print } from 'esrap';
import tsx from 'esrap/languages/tsx';
import * as b from '../../../utils/builders.js';
import { IS_CONTROLLED, TEMPLATE_FRAGMENT } from '../../../constants.js';
import { sanitize_template_string } from '../../../utils/sanitize_template_string.js';
import {
	build_hoisted_params,
	is_event_attribute,
	is_inside_component,
	is_tracked_name,
	is_passive_event,
	build_assignment,
	visit_assignment_expression,
	escape_html,
	is_boolean_attribute,
	is_dom_property,
	is_ripple_import,
	is_declared_function_within_component,
	is_inside_call_expression,
	is_tracked_computed_property,
	is_value_static,
	is_void_element,
	is_component_level_function,
} from '../../utils.js';
import is_reference from 'is-reference';
import { extract_paths, object } from '../../../utils/ast.js';
import { render_stylesheets } from './stylesheet.js';

function add_ripple_internal_import(context) {
	if (!context.state.to_ts) {
		if (!context.state.imports.has(`import * as $ from 'ripple/internal/client'`)) {
			context.state.imports.add(`import * as $ from 'ripple/internal/client'`);
		}
	}
}

function visit_function(node, context) {
	if (context.state.to_ts) {
		context.next(context.state);
		return;
	}
	const metadata = node.metadata;
	const state = context.state;

	delete node.returnType;

	for (const param of node.params) {
		delete param.typeAnnotation;
	}

	if (metadata?.hoisted === true) {
		const params = build_hoisted_params(node, context);

		return /** @type {FunctionExpression} */ ({
			...node,
			params,
			body: context.visit(node.body, state),
		});
	}

	let body = context.visit(node.body, state);

	if (metadata?.tracked === true) {
		const new_body = [];

		if (!is_inside_component(context, true) && is_component_level_function(context)) {
			add_ripple_internal_import(context);
			new_body.push(b.var('__block', b.call('$.scope')));
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

function build_getter(node, context) {
	const state = context.state;

	for (let i = context.path.length - 1; i >= 0; i -= 1) {
		const binding = state.scope.get(node.name);
		const transform = binding?.transform;

		// don't transform the declaration itself
		if (node !== binding?.node) {
			const read_fn = transform?.read || (node.tracked && transform?.read_tracked);

			if (read_fn) {
				add_ripple_internal_import(context);

				return read_fn(node, context.state?.metadata?.spread, context.visit);
			}
		}
	}

	return node;
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

		if (is_reference(node, parent) && !context.state.to_ts) {
			const binding = context.state.scope.get(node.name);
			if (
				context.state.metadata?.tracking === false &&
				(is_tracked_name(node.name) || node.tracked) &&
				binding?.node !== node
			) {
				context.state.metadata.tracking = true;
			}

			if (node.name === 'structuredClone' && binding === null) {
				return b.id('$.structured_clone');
			}

			return build_getter(node, context);
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

	CallExpression(node, context) {
		const callee = node.callee;
		const parent = context.path.at(-1);

		if (context.state.metadata?.tracking === false) {
			context.state.metadata.tracking = true;
		}

		if (
			!context.state.to_ts &&
			callee.type === 'Identifier' &&
			callee.name === 'tracked' &&
			is_ripple_import(callee, context)
		) {
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
			(is_ripple_import(callee, context) &&
				(callee.type !== 'Identifier' ||
					(callee.name !== 'array' && callee.name !== 'deferred'))) ||
			is_declared_function_within_component(callee, context)
		) {
			return context.next();
		}

		// Handle array methods that access the array
		if (callee.type === 'MemberExpression') {
			const property = callee.property;

			if (property.type === 'Identifier' && !callee.optional) {
				const name = property.name;
				if (
					// TODO support the missing array methods
					name === 'reduce' ||
					name === 'map' ||
					name === 'forEach' ||
					name === 'join' ||
					name === 'includes' ||
					name === 'indexOf' ||
					name === 'lastIndexOf' ||
					name === 'filter' ||
					name === 'every' ||
					name === 'some' ||
					name === 'toSpliced' ||
					name === 'toSorted' ||
					name === 'toString' ||
					name === 'values' ||
					name === 'entries'
				) {
					return b.call(
						'$.with_scope',
						b.id('__block'),
						b.thunk(
							b.call(
								'$.array_' + name,
								context.visit(callee.object),
								...node.arguments.map((arg) => context.visit(arg)),
							),
						),
					);
				}
			}

			if (callee.computed) {
				return b.call(
					'$.with_scope',
					b.id('__block'),
					b.thunk(
						b.call(
							'$.call_property',
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
			'$.with_scope',
			b.id('__block'),
			b.thunk({
				...node,
				callee: context.visit(callee),
				arguments: node.arguments.map((arg) => context.visit(arg)),
			}),
		);
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

	TSMappedType(_, context) {
		if (!context.state.to_ts) {
			return b.empty;
		}
		context.next();
	},

	NewExpression(node, context) {
		const callee = node.callee;
		const parent = context.path.at(-1);

		if (context.state.metadata?.tracking === false) {
			context.state.metadata.tracking = true;
		}

		if (!is_inside_component(context, true) || is_inside_call_expression(context)) {
			return context.next();
		}

		if (is_value_static(node)) {
			return context.next();
		}

		return b.call(
			'$.with_scope',
			b.id('__block'),
			b.thunk({
				...node,
				callee: context.visit(callee),
				arguments: node.arguments.map((arg) => context.visit(arg)),
			}),
		);
	},

	MemberExpression(node, context) {
		const parent = context.path.at(-1);

		if (node.property.type === 'Identifier' && node.property.tracked) {
			add_ripple_internal_import(context);

			context.state.metadata.tracking = true;
			return b.call(
				'$.get_property',
				context.visit(node.object),
				node.computed ? context.visit(node.property) : b.literal(node.property.name),
				node.optional ? b.true : undefined,
			);
		}

		if (parent.type !== 'AssignmentExpression') {
			const object = node.object;
			const property = node.property;
			const tracked_name =
				property.type === 'Identifier'
					? is_tracked_name(property.name)
					: property.type === 'Literal' && is_tracked_name(property.value);

			// TODO should we enforce that the identifier is tracked too?
			if (
				(node.computed && is_tracked_computed_property(node.object, node.property, context)) ||
				tracked_name
			) {
				if (context.state.metadata?.tracking === false) {
					context.state.metadata.tracking = true;
				}

				if (tracked_name) {
					return b.call(
						'$.old_get_property',
						context.visit(object),
						property.type === 'Identifier' ? b.literal(property.name) : property,
						node.optional ? b.true : undefined,
					);
				} else {
					return b.call(
						'$.old_get_property',
						context.visit(object),
						context.visit(property),
						node.optional ? b.true : undefined,
					);
				}
			}

			if (object.type === 'Identifier' && object.name === 'Object') {
				const binding = context.state.scope.get(object.name);

				if (binding === null) {
					if (property.type === 'Identifier' && property.name === 'values') {
						return b.id('$.object_values');
					} else if (property.type === 'Identifier' && property.name === 'entries') {
						return b.id('$.object_entries');
					} else if (property.type === 'Identifier' && property.name === 'keys') {
						return b.id('$.object_keys');
					}
				}
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
			context.next();
		}
	},

	SpreadElement(node, context) {
		const parent = context.path.at(-1);

		if (parent.type === 'ObjectExpression') {
			return b.spread(b.call('$.spread_object', context.visit(node.argument)));
		}

		context.next();
	},

	VariableDeclaration(node, context) {
		const declarations = [];

		for (const declarator of node.declarations) {
			const metadata = declarator.metadata;

			if (declarator.id.type === 'Identifier') {
				const binding = context.state.scope.get(declarator.id.name);

				if (!context.state.to_ts) {
					delete declarator.id.typeAnnotation;
				}

				if (binding !== null && binding.kind === 'tracked') {
					let expression;

					if (context.state.to_ts) {
						// TypeScript mode: lighter transformation
						if (metadata.tracking && !metadata.await) {
							expression = b.call(
								'$.derived',
								b.thunk(context.visit(declarator.init)),
								b.id('__block'),
							);
						} else {
							expression = b.call(
								'$.tracked',
								declarator.init === null ? undefined : context.visit(declarator.init),
								b.id('__block'),
							);
						}
					} else {
						// Runtime mode: full transformation
						if (metadata.tracking && metadata.await) {
							expression = b.call(
								b.await(
									b.call(
										'$.resume_context',
										b.call(
											'$.async_computed',
											b.thunk(context.visit(declarator.init), true),
											b.id('__block'),
										),
									),
								),
							);
						} else if (metadata.tracking && !metadata.await) {
							expression = b.call(
								'$.derived',
								b.thunk(context.visit(declarator.init)),
								b.id('__block'),
							);
						} else {
							expression = b.call(
								'$.tracked',
								declarator.init === null ? undefined : context.visit(declarator.init),
								b.id('__block'),
							);
						}
					}

					declarations.push(b.declarator(declarator.id, expression));
				} else {
					declarations.push(context.visit(declarator));
				}
			} else {
				const paths = extract_paths(declarator.id);
				const has_tracked = paths.some(
					(path) => path.node.type === 'Identifier' && is_tracked_name(path.node.name),
				);

				if (!context.state.to_ts) {
					delete declarator.id.typeAnnotation;
				}

				if (!has_tracked) {
					declarations.push(context.visit(declarator));
					continue;
				}

				// For TypeScript mode, we still need to transform tracked variables
				// but use a lighter approach that maintains type information
				if (context.state.to_ts) {
					const transformed = declarator.transformed || declarator.id;
					let expression;

					if (metadata.tracking && !metadata.await) {
						expression = b.call(
							'$.derived',
							b.thunk(context.visit(declarator.init)),
							b.id('__block'),
						);
					} else {
						// Simple tracked variable - always use $.derived for $ prefixed variables
						expression = b.call('$.tracked', context.visit(declarator.init), b.id('__block'));
					}

					declarations.push(b.declarator(transformed, expression));
					continue;
				}

				const transformed = declarator.transformed;
				let expression;

				if (metadata.tracking && metadata.await) {
					// TODO
					debugger;
				} else if (metadata.tracking && !metadata.await) {
					expression = b.call(
						'$.derived',
						b.thunk(context.visit(declarator.init)),
						b.id('__block'),
					);
				} else {
					expression = context.visit(declarator.init);
				}

				declarations.push(b.declarator(transformed, expression));
			}
		}

		return { ...node, declarations };
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

	Element(node, context) {
		const { state, visit } = context;

		const is_dom_element =
			node.id.type === 'Identifier' &&
			node.id.name[0].toLowerCase() === node.id.name[0] &&
			node.id.name[0] !== '$';
		const is_spreading = node.attributes.some((attr) => attr.type === 'SpreadAttribute');
		const spread_attributes = is_spreading ? [] : null;

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
			const local_updates = [];
			const is_void = is_void_element(node.id.name);

			state.template.push(`<${node.id.name}`);

			for (const attr of node.attributes) {
				if (attr.type === 'Attribute') {
					if (attr.name.type === 'Identifier') {
						const name = attr.name.name;

						if (attr.value.type === 'Literal' && name !== 'class') {
							handle_static_attr(name, attr.value.value);
							continue;
						}

						if (name === 'class' || name === '$class') {
							class_attribute = attr;

							continue;
						}

						if (name === 'value' || name === '$value') {
							const id = state.flush_node();
							const metadata = { tracking: false, await: false };
							const expression = visit(attr.value, { ...state, metadata });

							if (name === '$value' || metadata.tracking) {
								local_updates.push(b.stmt(b.call('$.set_value', id, expression)));
							} else {
								state.init.push(b.stmt(b.call('$.set_value', id, expression)));
							}

							continue;
						}

						if (name === 'checked' || name === '$checked') {
							const id = state.flush_node();
							const metadata = { tracking: false, await: false };
							const expression = visit(attr.value, { ...state, metadata });

							if (name === '$checked' || metadata.tracking) {
								local_updates.push(b.stmt(b.call('$.set_checked', id, expression)));
							} else {
								state.init.push(b.stmt(b.call('$.set_checked', id, expression)));
							}
							continue;
						}

						if (name === 'selected' || name === '$selected') {
							const id = state.flush_node();
							const metadata = { tracking: false, await: false };
							const expression = visit(attr.value, { ...state, metadata });

							if (name === '$selected' || metadata.tracking) {
								local_updates.push(b.stmt(b.call('$.set_selected', id, expression)));
							} else {
								state.init.push(b.stmt(b.call('$.set_selected', id, expression)));
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

								// Hoist function if we can, otherwise we leave the function as is
								if (attr.metadata.delegated.hoisted) {
									if (attr.metadata.delegated.function === attr.value) {
										const func_name = state.scope.root.unique('on_' + event_name);
										state.hoisted.push(b.var(func_name, handler));
										handler = func_name;
									}

									const hoisted_params = /** @type {Expression[]} */ (
										attr.metadata.delegated.function.metadata.hoisted_params
									);

									const args = [handler, b.id('__block'), ...hoisted_params];
									delegated_assignment = b.array(args);
								} else if (
									handler.type === 'Identifier' &&
									is_declared_function_within_component(handler, context)
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
											'$.event',
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
						if (is_tracked_name(name) || metadata.tracking) {
							const attribute = is_tracked_name(name) ? name.slice(1) : name;
							const id = state.flush_node();

							if (is_dom_property(attribute)) {
								local_updates.push(b.stmt(b.assignment('=', b.member(id, attribute), expression)));
							} else {
								local_updates.push(
									b.stmt(b.call('$.set_attribute', id, b.literal(attribute), expression)),
								);
							}
						} else {
							const id = state.flush_node();

							if (is_dom_property(name)) {
								state.init.push(b.stmt(b.assignment('=', b.member(id, name), expression)));
							} else {
								state.init.push(b.stmt(b.call('$.set_attribute', id, b.literal(name), expression)));
							}
						}
					}
				} else if (attr.type === 'SpreadAttribute') {
					spread_attributes.push(b.spread(b.call('$.spread_object', visit(attr.argument, state))));
				} else if (attr.type === 'RefAttribute') {
					const id = state.flush_node();
					state.init.push(b.stmt(b.call('$.ref', id, b.thunk(visit(attr.argument, state)))));
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
					const id = state.flush_node();
					const metadata = { tracking: false, await: false };
					let expression = visit(class_attribute.value, { ...state, metadata });

					if (node.metadata.scoped && state.component.css) {
						expression = b.binary('+', b.literal(state.component.css.hash + ' '), expression);
					}

					if (class_attribute.name.name === '$class' || metadata.tracking) {
						local_updates.push(b.stmt(b.call('$.set_class', id, expression)));
					} else {
						state.init.push(b.stmt(b.call('$.set_class', id, expression)));
					}
				}
			} else if (node.metadata.scoped && state.component.css) {
				const value = state.component.css.hash;

				handle_static_attr('class', value);
			}

			state.template.push('>');

			if (spread_attributes !== null && spread_attributes.length > 0) {
				const id = state.flush_node();
				state.init.push(
					b.stmt(b.call('$.render_spread', id, b.thunk(b.object(spread_attributes)))),
				);
			}

			const init = [];
			const update = [];

			if (!is_void) {
				transform_children(node.children, {
					visit,
					state: { ...state, init, update },
					root: false,
				});
				state.template.push(`</${node.id.name}>`);
			}

			update.push(...local_updates);

			if (init.length > 0) {
				state.init.push(b.block(init));
			}

			if (update.length > 0) {
				state.init.push(b.stmt(b.call('$.render', b.thunk(b.block(update)))));
			}
		} else {
			const id = state.flush_node();

			state.template.push('<!>');

			const is_spreading = node.attributes.some((attr) => attr.type === 'SpreadAttribute');
			const tracked = [];
			const props = [];
			let children_prop = null;

			for (const attr of node.attributes) {
				if (attr.type === 'Attribute') {
					if (attr.name.type === 'Identifier' && is_tracked_name(attr.name.name)) {
						const metadata = { tracking: false, await: false };
						let property = visit(attr.value, { ...state, metadata });

						tracked.push(b.literal(attr.name.name));

						if (metadata.tracking) {
							const thunk = b.thunk(property);
							property = b.call('$.computed_property', thunk, b.id('__block'));

							if (attr.name.name === '$children') {
								children_prop = thunk;
							}
						}

						props.push(b.prop('init', attr.name, property));
					} else {
						props.push(b.prop('init', attr.name, visit(attr.value, state)));
					}
				} else if (attr.type === 'SpreadAttribute') {
					props.push(
						b.spread(
							b.call(
								'$.spread_object',
								visit(attr.argument, { ...state, metadata: { ...state.metadata, spread: true } }),
							),
						),
					);
				} else if (attr.type === 'RefAttribute') {
					props.push(b.prop('init', b.call('$.ref_prop'), visit(attr.argument, state), true));
				} else if (attr.type === 'AccessorAttribute') {
					// # means it's an accessor to the runtime
					tracked.push(b.literal('#' + attr.name.name));
					let get_expr;

					if (
						attr.get.type === 'FunctionExpression' ||
						attr.get.type === 'ArrowFunctionExpression'
					) {
						get_expr = context.state.scope.generate(attr.name.name + '_get');

						state.init.push(b.const(get_expr, visit(attr.get, state)));
					} else {
						get_expr = visit(attr.get, state);
					}

					props.push(
						b.prop('get', attr.name, b.function(null, [], b.block([b.return(b.call(get_expr))]))),
					);

					if (attr.set) {
						let set_expr;

						if (
							attr.set.type === 'FunctionExpression' ||
							attr.set.type === 'ArrowFunctionExpression'
						) {
							set_expr = context.state.scope.generate(attr.name.name + '_set');

							state.init.push(b.const(set_expr, visit(attr.set, state)));
						} else {
							set_expr = visit(attr.set, state);
						}

						props.push(
							b.prop(
								'set',
								attr.name,
								b.function(
									null,
									[b.id('__value')],
									b.block([b.return(b.call(set_expr, b.id('__value')))]),
								),
							),
						);
					}
				} else {
					throw new Error('TODO');
				}
			}

			const children_filtered = [];

			for (const child of node.children) {
				if (child.type === 'Component') {
					const id = child.id;
					props.push(b.prop('init', id, visit(child, state)));
				} else {
					children_filtered.push(child);
				}
			}

			if (children_filtered.length > 0) {
				const component_scope = context.state.scopes.get(node);
				const children = visit(b.component(b.id('$children'), [], children_filtered), {
					...context.state,
					scope: component_scope,
				});

				if (children_prop) {
					children_prop.body = b.logical('??', children_prop.body, children);
				} else {
					props.push(b.prop('init', b.id('$children'), children));
				}
			}

			if (is_spreading) {
				state.init.push(
					b.stmt(
						b.call(
							node.id,
							id,
							b.call('$.tracked_spread_object', b.thunk(b.object(props))),
							b.id('$.active_block'),
						),
					),
				);
			} else if (tracked.length > 0) {
				state.init.push(
					b.stmt(
						b.call(
							node.id,
							id,
							b.call('$.tracked_object', b.object(props), b.array(tracked), b.id('__block')),
							b.id('$.active_block'),
						),
					),
				);
			} else {
				state.init.push(
					b.stmt(b.call(visit(node.id, state), id, b.object(props), b.id('$.active_block'))),
				);
			}
		}
	},

	Fragment(node, context) {
		if (!context.state.to_ts) {
			add_ripple_internal_import(context);
		}

		const metadata = { await: false };

		const body_statements = transform_body(node.body, {
			...context,
			state: { ...context.state, component: node, metadata },
		});

		return b.function(
			node.id,
			[b.id('__anchor'), ...node.params.map((param) => context.visit(param, context.state))],
			b.block(
				metadata.await
					? [b.stmt(b.call('$.async', b.thunk(b.block(body_statements), true)))]
					: body_statements,
			),
		);
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

			return b.function(node.id, node.params, b.block(body_statements));
		}

		let props = b.id('__props');

		if (node.params.length > 0) {
			let props_param = node.params[0];

			if (props_param.type === 'Identifier') {
				delete props_param.typeAnnotation;
				props = props_param;
			} else if (props_param.type === 'ObjectPattern') {
				const paths = extract_paths(props_param);

				for (const path of paths) {
					const name = path.node.name;
					const binding = context.state.scope.get(name);
					const key = b.key(name);

					if (binding !== null && !is_tracked_name(name)) {
						if (prop_statements === undefined) {
							prop_statements = [];
						}
						if (path.has_default_value) {
							const fallback = path.expression(b.id('__props'));

							prop_statements.push(b.var(name, context.visit(fallback)));
						} else {
							prop_statements.push(b.var(name, b.member(b.id('__props'), key)));
						}
					} else if (binding !== null && path.has_default_value) {
						if (prop_statements === undefined) {
							prop_statements = [];
						}
						const fallback = path.expression(b.id('__props'));

						prop_statements.push(
							b.var(name, b.call('$.derived', b.thunk(context.visit(fallback)), b.id('__block'))),
						);
					}
				}
			}
		}

		const body_statements = [
			b.stmt(b.call('$.push_component')),
			...transform_body(node.body, {
				...context,
				state: { ...context.state, component: node, metadata },
			}),
			b.stmt(b.call('$.pop_component')),
		];

		if (node.css !== null && node.css) {
			context.state.stylesheets.push(node.css);
		}

		return b.function(
			node.id,
			node.params.length > 0
				? [b.id('__anchor'), props, b.id('__block')]
				: [b.id('__anchor'), b.id('_'), b.id('__block')],
			b.block([
				...(prop_statements ?? []),
				...(metadata.await
					? [b.stmt(b.call('$.async', b.thunk(b.block(body_statements), true)))]
					: body_statements),
			]),
		);
	},

	AssignmentExpression(node, context) {
		if (context.state.to_ts) {
			return context.next();
		}

		const left = node.left;

		if (
			left.type === 'MemberExpression' &&
			left.property.type === 'Identifier' &&
			left.property.tracked
		) {
			add_ripple_internal_import(context);
			const operator = node.operator;
			const right = node.right;

			if (operator !== '=') {
				context.state.metadata.tracking = true;
			}

			return b.call(
				'$.set_property',
				context.visit(left.object),
				left.computed ? context.visit(left.property) : b.literal(left.property.name),
				operator === '='
					? context.visit(right)
					: b.binary(
							operator === '+=' ? '+' : operator === '-=' ? '-' : operator === '*=' ? '*' : '/',
							/** @type {Pattern} */ (context.visit(left)),
							/** @type {Expression} */ (context.visit(right)),
						),
				b.id('__block'),
			);
		}

		if (left.type === 'MemberExpression') {
			// need to capture setting length of array to throw a runtime error
			if (
				left.property.type === 'Identifier' &&
				(is_tracked_name(left.property.name) || left.property.name === 'length')
			) {
				if (left.property.name !== '$length') {
					return b.call(
						'$.old_set_property',
						context.visit(left.object),
						left.computed ? context.visit(left.property) : b.literal(left.property.name),
						visit_assignment_expression(node, context, build_assignment) ?? context.next(),
						b.id('__block'),
					);
				}
			} else if (!is_tracked_computed_property(left.object, left.property, context)) {
				return context.next();
			}
		}

		const visited = visit_assignment_expression(node, context, build_assignment) ?? context.next();

		if (
			left.type === 'MemberExpression' &&
			left.property.type === 'Identifier' &&
			left.property.name === '$length' &&
			!left.computed
		) {
			return b.call('$.with_scope', b.id('__block'), b.thunk(visited));
		}

		return visited;
	},

	UpdateExpression(node, context) {
		if (context.state.to_ts) {
			context.next();
			return;
		}
		const argument = node.argument;

		if (
			argument.type === 'MemberExpression' &&
			argument.property.type === 'Identifier' &&
			argument.property.tracked
		) {
			add_ripple_internal_import(context);
			context.state.metadata.tracking = true;

			return b.call(
				node.prefix ? '$.update_pre_property' : '$.update_property',
				context.visit(argument.object),
				argument.computed ? context.visit(argument.property) : b.literal(argument.property.name),
				b.id('__block'),
				node.operator === '--' ? b.literal(-1) : undefined,
			);
		}

		if (
			argument.type === 'MemberExpression' &&
			((argument.property.type === 'Identifier' && is_tracked_name(argument.property.name)) ||
				(argument.computed &&
					is_tracked_computed_property(argument.object, argument.property, context)))
		) {
			return b.call(
				node.prefix ? '$.old_update_pre_property' : '$.old_update_property',
				context.visit(argument.object),
				argument.computed ? context.visit(argument.property) : b.literal(argument.property.name),
				b.id('__block'),
				node.operator === '--' ? b.literal(-1) : undefined,
			);
		}

		const left = object(argument);
		const binding = context.state.scope.get(left.name);
		const transformers = left && binding?.transform;

		if (left === argument) {
			const update_fn = transformers?.update || transformers?.update_tracked;
			if (update_fn) {
				return update_fn(node);
			}
		}

		context.next();
	},

	ObjectExpression(node, context) {
		const properties = [];
		const tracked = [];

		for (const property of node.properties) {
			if (
				property.type === 'Property' &&
				!property.computed &&
				property.key.type === 'Identifier' &&
				property.kind === 'init' &&
				is_tracked_name(property.key.name)
			) {
				tracked.push(b.literal(property.key.name));
				const metadata = { tracking: false, await: false };
				const tracked_property = context.visit(property, { ...context.state, metadata });

				if (metadata.tracking) {
					properties.push({
						...tracked_property,
						value: b.call('$.computed_property', b.thunk(tracked_property.value), b.id('__block')),
					});
				} else {
					properties.push(tracked_property);
				}
			} else {
				properties.push(context.visit(property));
			}
		}

		if (tracked.length > 0) {
			return b.call('$.tracked_object', { ...node, properties }, b.array(tracked), b.id('__block'));
		}

		context.next();
	},

	ArrayExpression(node, context) {
		// TODO we can bail out of all of this if we know we're inside a computed fn expression
		// as the reactivity will hold from the reference of the $ binding itself
		const elements = [];
		const tracked = [];
		let i = 0;

		for (const element of node.elements) {
			if (element === null) {
				elements.push(null);
			} else if (element.type === 'Identifier' && is_tracked_name(element.name)) {
				const metadata = { tracking: false, await: false };
				const tracked_identifier = context.visit(element, { ...context.state, metadata });

				if (metadata.tracking) {
					tracked.push(b.literal(i));
					elements.push(
						b.call('$.computed_property', b.thunk(tracked_identifier), b.id('__block')),
					);
				} else {
					elements.push(tracked_identifier);
				}
			} else {
				const metadata = { tracking: false, await: false };
				elements.push(context.visit(element, { ...context.state, metadata }));
			}
			i++;
		}

		if (tracked.length > 0) {
			return b.call('$.tracked_object', { ...node, elements }, b.array(tracked), b.id('__block'));
		}

		context.next();
	},

	ForOfStatement(node, context) {
		if (!is_inside_component(context)) {
			context.next();
			return;
		}
		const is_controlled = node.is_controlled;

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
					'$.for',
					id,
					b.thunk(context.visit(node.right)),
					b.arrow(
						[b.id('__anchor'), pattern],
						b.block(
							transform_body(node.body.body, {
								...context,
								state: { ...context.state, scope: body_scope },
							}),
						),
					),
					b.literal(is_controlled ? IS_CONTROLLED : 0),
				),
			),
		);
	},

	IfStatement(node, context) {
		if (!is_inside_component(context)) {
			context.next();
			return;
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
					'$.if',
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

	TryStatement(node, context) {
		if (!is_inside_component(context)) {
			context.next();
			return;
		}
		context.state.template.push('<!>');

		const id = context.state.flush_node();
		const metadata = { await: false };
		let body = transform_body(node.block.body, {
			...context,
			state: { ...context.state, metadata },
		});

		if (metadata.await) {
			body = [b.stmt(b.call('$.async', b.thunk(b.block(body), true)))];
		}

		context.state.init.push(
			b.stmt(
				b.call(
					'$.try',
					id,
					b.arrow([b.id('__anchor')], b.block(body)),
					node.handler === null
						? b.literal(null)
						: b.arrow(
								[b.id('__anchor'), ...(node.handler.param ? [node.handler.param] : [])],
								b.block(transform_body(node.handler.body.body, context)),
							),
					node.async === null
						? undefined
						: b.arrow([b.id('__anchor')], b.block(transform_body(node.async.body, context))),
				),
			),
		);
	},

	AwaitExpression(node, context) {
		if (!is_inside_component(context)) {
			context.next();
		}

		if (context.state.metadata?.await === false) {
			context.state.metadata.await = true;
		}

		return b.call(b.await(b.call('$.resume_context', context.visit(node.argument))));
	},

	BinaryExpression(node, context) {
		return b.binary(node.operator, context.visit(node.left), context.visit(node.right));
	},

	TemplateLiteral(node, context) {
		if (node.expressions.length === 0) {
			return b.literal(node.quasis[0].value.cooked);
		}

		const expressions = node.expressions.map((expr) => context.visit(expr));
		return b.template(node.quasis, expressions);
	},

	RenderFragment(node, context) {
		const identifer = node.expression.callee;

		context.state.template.push('<!>');

		const id = context.state.flush_node();

		context.state.init.push(
			b.stmt(
				b.call(
					context.visit(identifer),
					id,
					...node.expression.arguments.map((arg) => context.visit(arg, context.state)),
				),
			),
		);
	},

	BlockStatement(node, context) {
		const statements = [];

		for (const statement of node.body) {
			statements.push(context.visit(statement));
		}

		return b.block(statements);
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

			const last = /** @type {TemplateElement} */ (expression.quasis.at(-1));
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

function normalize_child(node, normalized) {
	if (node.type === 'EmptyStatement') {
		return;
	} else if (node.type === 'Element' && node.id.type === 'Identifier' && node.id.name === 'style') {
		return;
	} else {
		normalized.push(node);
	}
}

function transform_ts_child(node, context) {
	const { state, visit } = context;

	if (node.type === 'Text') {
		state.init.push(b.stmt(visit(node.expression, { ...state })));
	} else if (node.type === 'Element') {
		const type = node.id.name;
		const children = [];
		let has_children_props = false;

		// Filter out RefAttributes and handle them separately
		const ref_attributes = [];
		const attributes = node.attributes
			.filter((attr) => {
				if (attr.type === 'RefAttribute') {
					ref_attributes.push(attr);
					return false;
				}
				return true;
			})
			.map((attr) => {
				if (attr.type === 'Attribute') {
					const metadata = { await: false };
					const name = visit(attr.name, { ...state, metadata });
					const value = visit(attr.value, { ...state, metadata });
					const jsx_name = b.jsx_id(name.name);
					if (name.name === '$children') {
						has_children_props = true;
					}
					jsx_name.loc = name.loc;

					return b.jsx_attribute(jsx_name, b.jsx_expression_container(value));
				} else if (attr.type === 'SpreadAttribute') {
					const metadata = { await: false };
					const argument = visit(attr.argument, { ...state, metadata });
					return b.jsx_spread_attribute(argument);
				}
			});

		// Add RefAttribute references separately for sourcemap purposes
		for (const ref_attr of ref_attributes) {
			const metadata = { await: false };
			const argument = visit(ref_attr.argument, { ...state, metadata });
			state.init.push(b.stmt(argument));
		}

		if (!node.selfClosing && !has_children_props && node.children.length > 0) {
			const is_dom_element = type[0].toLowerCase() === type[0] && type[0] !== '$';

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
				const children_name = context.state.scope.generate('component');
				const children_id = b.id(children_name);
				const jsx_id = b.jsx_id('$children');
				jsx_id.loc = node.id.loc;
				state.init.push(b.const(children_id, thunk));
				attributes.push(b.jsx_attribute(jsx_id, b.jsx_expression_container(children_id)));
			}
		}

		const opening_type = b.jsx_id(type);
		opening_type.loc = node.id.loc;

		let closing_type = undefined;

		if (!node.selfClosing) {
			closing_type = b.jsx_id(type);
			closing_type.loc = {
				start: {
					line: node.loc.end.line,
					column: node.loc.end.column - type.length - 1,
				},
				end: {
					line: node.loc.end.line,
					column: node.loc.end.column - 1,
				},
			};
		}

		state.init.push(
			b.stmt(b.jsx_element(opening_type, attributes, children, node.selfClosing, closing_type)),
		);
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
	} else if (node.type === 'ForOfStatement') {
		const body_scope = context.state.scopes.get(node.body);
		const body = b.block(
			transform_body(node.body.body, {
				...context,
				state: { ...context.state, scope: body_scope },
			}),
		);

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
	} else if (node.type === 'RenderFragment') {
		const identifer = node.expression.callee;

		state.init.push(
			b.stmt(
				b.call(
					context.visit(identifer),
					...node.expression.arguments.map((arg) => context.visit(arg, context.state)),
				),
			),
		);
	} else if (node.type === 'Component') {
		const component = visit(node, context.state);

		state.init.push(component);
	} else {
		debugger;
		throw new Error('TODO');
	}
}

function transform_children(children, { visit, state, root }) {
	const normalized = [];

	for (const node of children) {
		normalize_child(node, normalized);
	}

	const is_fragment =
		normalized.some(
			(node) =>
				node.type === 'IfStatement' ||
				node.type === 'TryStatement' ||
				node.type === 'ForOfStatement' ||
				node.type === 'RenderFragment' ||
				(node.type === 'Element' &&
					(node.id.type !== 'Identifier' ||
						node.id.name[0].toLowerCase() !== node.id.name[0] ||
						node.id.name[0] === '$')),
		) ||
		normalized.filter(
			(node) => node.type !== 'VariableDeclaration' && node.type !== 'EmptyStatement',
		).length > 1;
	let initial = null;
	let prev = null;
	let template_id = null;

	const get_id = (node) => {
		return b.id(
			node.type == 'Element' &&
				node.id.type === 'Identifier' &&
				node.id.name[0].toLowerCase() === node.id.name[0] &&
				node.id.name[0] !== '$'
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

	for (let i = normalized.length - 1; i >= 0; i--) {
		const child = normalized[i];
		const prev_child = normalized[i - 1];

		if (child.type === 'Text' && prev_child?.type === 'Text') {
			if (child.expression.type === 'Literal' && prev_child.expression.type === 'Literal') {
				prev_child.expression = b.literal(prev_child.expression.value + child.expression.value);
			} else {
				prev_child.expression = b.binary('+', prev_child.expression, child.expression);
			}
			normalized.splice(i, 1);
		}
	}

	for (const node of normalized) {
		if (
			node.type === 'VariableDeclaration' ||
			node.type === 'ExpressionStatement' ||
			node.type === 'FunctionDeclaration' ||
			node.type === 'DebuggerStatement' ||
			node.type === 'ClassDeclaration'
		) {
			const metadata = { await: false };
			state.init.push(visit(node, { ...state, metadata }));
			if (metadata.await) {
				state.init.push(b.if(b.call('$.aborted'), b.return(null)));
				if (state.metadata?.await === false) {
					state.metadata.await = true;
				}
			}
		} else if (state.to_ts) {
			transform_ts_child(node, { visit, state });
		} else {
			if (initial === null && root) {
				create_initial(node);
			}

			const current_prev = prev;
			let cached;
			const flush_node = (is_controlled) => {
				if (cached && !is_controlled) {
					return cached;
				} else if (current_prev !== null) {
					const id = get_id(node);
					state.setup.push(b.var(id, b.call('$.sibling', current_prev())));
					cached = id;
					return id;
				} else if (initial !== null) {
					if (is_fragment) {
						const id = get_id(node);
						state.setup.push(b.var(id, b.call('$.child_frag', initial)));
						cached = id;
						return id;
					}
					return initial;
				} else if (state.flush_node !== null) {
					if (is_controlled) {
						return state.flush_node();
					}

					const id = get_id(node);
					state.setup.push(b.var(id, b.call('$.child', state.flush_node())));
					cached = id;
					return id;
				} else {
					debugger;
				}
			};

			prev = flush_node;

			if (node.type === 'Element') {
				visit(node, { ...state, flush_node });
			} else if (node.type === 'Text') {
				const metadata = { tracking: false, await: false };
				const expression = visit(node.expression, { ...state, metadata });

				if (metadata.tracking) {
					state.template.push(' ');
					const id = flush_node();
					state.update.push(b.stmt(b.call('$.set_text', id, expression)));
				} else if (normalized.length === 1) {
					if (expression.type === 'Literal') {
						state.template.push(escape_html(expression.value));
					} else {
						const id = state.flush_node();
						state.template.push(' ');
						state.init.push(
							b.stmt(b.assignment('=', b.member(id, b.id('textContent')), expression)),
						);
					}
				} else {
					// Handle Text nodes in fragments
					state.template.push(' ');
					const id = flush_node();
					state.update.push(b.stmt(b.call('$.set_text', id, expression)));
				}
			} else if (node.type === 'ForOfStatement') {
				const is_controlled = normalized.length === 1;
				node.is_controlled = is_controlled;
				visit(node, { ...state, flush_node });
			} else if (node.type === 'IfStatement') {
				const is_controlled = normalized.length === 1;
				node.is_controlled = is_controlled;
				visit(node, { ...state, flush_node });
			} else if (node.type === 'TryStatement') {
				const is_controlled = normalized.length === 1;
				node.is_controlled = is_controlled;
				visit(node, { ...state, flush_node });
			} else if (node.type === 'RenderFragment') {
				const is_controlled = normalized.length === 1;
				node.is_controlled = is_controlled;
				visit(node, { ...state, flush_node });
			} else {
				debugger;
			}
		}
	}

	if (root && initial !== null && template_id !== null) {
		const flags = is_fragment ? b.literal(TEMPLATE_FRAGMENT) : b.literal(0);
		state.final.push(b.stmt(b.call('$.append', b.id('__anchor'), initial)));
		state.hoisted.push(
			b.var(template_id, b.call('$.template', join_template(state.template), flags)),
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
	};

	transform_children(body, { visit, state: body_state, root: true });

	if (body_state.update.length > 0) {
		body_state.init.push(b.stmt(b.call('$.render', b.thunk(b.block(body_state.update)))));
	}

	return [...body_state.setup, ...body_state.init, ...body_state.final];
}

export function transform(filename, source, analysis, to_ts) {
	const state = {
		imports: new Set(),
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
	};

	const program = /** @type {ESTree.Program} */ (walk(analysis.ast, state, visitors));

	for (const hoisted of state.hoisted) {
		program.body.unshift(hoisted);
	}

	for (const import_node of state.imports) {
		program.body.unshift(b.stmt(b.id(import_node)));
	}

	if (state.events.size > 0) {
		program.body.push(
			b.stmt(
				b.call('$.delegate', b.array(Array.from(state.events).map((name) => b.literal(name)))),
			),
		);
	}

	const js = print(
		program,
		tsx({
			comments: analysis.ast.comments || [],
		}),
		{
			sourceMapContent: source,
			sourceMapSource: path.basename(filename),
		},
	);

	const css = render_stylesheets(state.stylesheets);

	return {
		ast: program,
		js,
		css,
	};
}
