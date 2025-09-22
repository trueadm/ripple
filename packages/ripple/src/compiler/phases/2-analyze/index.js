import * as b from '../../../utils/builders.js';
import { walk } from 'zimmerframe';
import { create_scopes, ScopeRoot } from '../../scope.js';
import {
  get_delegated_event,
  is_element_dom_element,
  is_inside_component,
  is_ripple_import,
  is_void_element,
} from '../../utils.js';
import { extract_paths } from '../../../utils/ast.js';
import is_reference from 'is-reference';
import { prune_css } from './prune.js';
import { error } from '../../errors.js';
import { is_event_attribute } from '../../../utils/events.js';

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
      node.type === 'IfStatement'
    ) {
      node.metadata.has_template = true;
    }
  }
}

function visit_function(node, context) {
  node.metadata = {
    hoisted: false,
    hoisted_params: [],
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

  Identifier(node, context) {
    const binding = context.state.scope.get(node.name);
    const parent = context.path.at(-1);

    if (binding?.kind === 'prop' || binding?.kind === 'prop_fallback') {
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

    context.next();
  },

  CallExpression(node, context) {
    if (context.state.metadata?.tracking === false) {
      context.state.metadata.tracking = true;
    }

    if (!is_inside_component(context, true)) {
      mark_as_tracked(context.path);
    }

    context.next();
  },

  VariableDeclaration(node, context) {
    const { state, visit, path } = context;

    for (const declarator of node.declarations) {
      if (is_inside_component(context) && node.kind === 'var') {
        error(
          'var declarations are not allowed in components, use let or const instead',
          state.analysis.module.filename,
          declarator,
        );
      }
      const metadata = { tracking: false, await: false };
      const parent = path.at(-1);
      const init_is_untracked =
        declarator.init !== null &&
        declarator.init.type === 'CallExpression' &&
        is_ripple_import(declarator.init.callee, context) &&
        declarator.init.callee.type === 'Identifier' &&
        (declarator.init.callee.name === 'untrack' || declarator.init.callee.name === 'deferred');

      if (declarator.id.type === 'Identifier') {
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

  ForOfStatement(node, context) {
    if (!is_inside_component(context)) {
      return context.next();
    }

    node.metadata = {
      has_template: false,
    };
    context.next();

    if (!node.metadata.has_template) {
      error(
        'Component for...of loops must contain a template in their body. Move the for loop into an effect if it does not render anything.',
        context.state.analysis.module.filename,
        node,
      );
    }
  },

  IfStatement(node, context) {
    if (!is_inside_component(context)) {
      return context.next();
    }

    node.metadata = {
      has_template: false,
    };

    context.visit(node.consequent, context.state);

    if (!node.metadata.has_template) {
      error(
        'Component if statements must contain a template in their "then" body. Move the if statement into an effect if it does not render anything.',
        context.state.analysis.module.filename,
        node,
      );
    }

    if (node.alternate) {
      node.metadata = {
        has_template: false,
      };
      context.visit(node.alternate, context.state);

      if (!node.metadata.has_template) {
        error(
          'Component if statements must contain a template in their "else" body. Move the if statement into an effect if it does not render anything.',
          context.state.analysis.module.filename,
          node,
        );
      }
    }
  },

  TryStatement(node, context) {
    if (!is_inside_component(context)) {
      return context.next();
    }

    if (node.pending) {
      node.metadata = {
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
    {
      error(
        'Elements cannot be used as generic expressions, only as statements within a component',
        context.state.analysis.module.filename,
        node,
      );
    }
  },

  Element(node, context) {
    const { state, visit, path } = context;
    const is_dom_element = is_element_dom_element(node);
    const attribute_names = new Set();

    mark_control_flow_has_template(path);

    if (is_dom_element) {
      const is_void = is_void_element(node.id.name);

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
            } else if (attr.value !== null) {
              visit(attr.value, state);
            }
          }
        } else if (attr.type === 'AccessorAttribute') {
          error(
            'Accessor props are not supported on DOM elements',
            state.analysis.module.filename,
            attr,
          );
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
          visit(attr.value, state);
        } else if (attr.type === 'AccessorAttribute') {
          attribute_names.add(attr.name);
          visit(attr.get, state);
          if (attr.set) {
            visit(attr.set, state);
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
        } else {
          error(
            'Cannot have a `children` prop on a component, did you mean `$children`?',
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
