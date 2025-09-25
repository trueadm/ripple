import * as b from '../../../../utils/builders.js';
import { walk } from 'zimmerframe';
import ts from 'esrap/languages/ts';
import path from 'node:path';
import { print } from 'esrap';
import {
	build_getter,
	is_element_dom_element,
	is_inside_component,
	is_void_element,
	normalize_children,
} from '../../../utils.js';
import is_reference from 'is-reference';
import { escape } from '../../../../utils/escaping.js';

function add_ripple_internal_import(context) {
	if (!context.state.to_ts) {
		if (!context.state.imports.has(`import * as _$_ from 'ripple/internal/server'`)) {
			context.state.imports.add(`import * as _$_ from 'ripple/internal/server'`);
		}
	}
}

function transform_children(children, context) {
	const { visit, state, root } = context;
	const normalized = normalize_children(children);

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
		}

		return b.function(
			node.id,
			node.params.length > 0 ? [b.id('__output'), node.params[0]] : [b.id('__output')],
			b.block([
				...(metadata.await
					? [b.stmt(b.call('_$_.async', b.thunk(b.block(body_statements), true)))]
					: body_statements),
			]),
		);
	},

	Element(node, context) {
		const { state, visit } = context;

		const is_dom_element = is_element_dom_element(node);

		if (is_dom_element) {
			const is_void = is_void_element(node.id.name);

			state.init.push(
				b.stmt(b.call(b.member(b.id('__output'), b.id('push')), b.literal(`<${node.id.name}`))),
			);
			let class_attribute = null;

			for (const attr of node.attributes) {
			}

			if (class_attribute !== null) {
				debugger;
			} else if (node.metadata.scoped && state.component.css) {
				debugger;
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
			state.init.push(b.stmt(b.call(node.id.name, b.call('__output.component'), b.object(props))));
		}
	},

	ForOfStatement(node, context) {
		if (!is_inside_component(context)) {
			context.next();
			return;
		}
		const body_scope = context.state.scopes.get(node.body);

		context.state.init.push(
			b.for_of(
				context.visit(node.left),
				context.visit(node.right),
				b.block(
					transform_body(node.body.body, {
						...context,
						state: { ...context.state, scope: body_scope },
					}),
				),
			),
		);
	},

	IfStatement(node, context) {
		if (!is_inside_component(context)) {
			context.next();
			return;
		}

		// TODO: alternative (else if / else)
		context.state.init.push(
			b.if(
				context.visit(node.test),
				b.block(
					transform_body(node.consequent.body, {
						...context,
						state: { ...context.state, scope: context.state.scopes.get(node.consequent) },
					}),
				),
			),
		);
	},

	Identifier(node, context) {
		const parent = /** @type {Node} */ (context.path.at(-1));

		if (is_reference(node, parent) && node.tracked) {
      add_ripple_internal_import(context);
			return b.call('_$_.get', build_getter(node, context));
		}
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
};

export function transform_server(filename, source, analysis) {
	const state = {
		imports: new Set(),
		init: null,
		scope: analysis.scope,
		scopes: analysis.scopes,
		stylesheets: [],
	};

	const program = /** @type {ESTree.Program} */ (
		walk(analysis.ast, { ...state, namespace: 'html' }, visitors)
	);

	for (const import_node of state.imports) {
		program.body.unshift(b.stmt(b.id(import_node)));
	}

	const js = print(program, ts(), {
		sourceMapContent: source,
		sourceMapSource: path.basename(filename),
	});

	// TODO: extract css
	const css = '';

	return {
		ast: program,
		js,
		css,
	};
}
