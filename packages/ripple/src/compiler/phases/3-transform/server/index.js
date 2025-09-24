import * as b from '../../../../utils/builders.js';
import { walk } from 'zimmerframe';
import ts from 'esrap/languages/ts';
import path from 'node:path';
import { print } from 'esrap';

function add_ripple_internal_import(context) {
  if (!context.state.to_ts) {
    if (!context.state.imports.has(`import * as _$_ from 'ripple/internal/server'`)) {
      context.state.imports.add(`import * as _$_ from 'ripple/internal/server'`);
    }
  }
}

function transform_body(body, { visit, state }) {
  const body_state = {
    ...state,
    init: [],
    metadata: state.metadata,
  };

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
