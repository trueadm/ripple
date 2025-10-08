import type { Rule } from 'eslint';
import type { ForOfStatement, Node } from 'estree';

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require JSX in for...of loops within components, but disallow JSX in for...of loops within effects',
      category: 'Possible Errors',
      recommended: true,
    },
    messages: {
      requireJsxInLoop:
        'For...of loops in component bodies should contain JSX elements. Use JSX to render items.',
      noJsxInEffectLoop:
        'For...of loops inside effect() should not contain JSX. Effects are for side effects, not rendering.',
    },
    schema: [],
  },
  create(context) {
    let insideComponent = 0;
    let insideEffect = 0;

    function containsJSX(node: Node, visited: Set<Node> = new Set()): boolean {
      if (!node) return false;

      // Avoid infinite loops from circular references
      if (visited.has(node)) return false;
      visited.add(node);

      // Check if current node is JSX/Element (Ripple uses 'Element' type instead of 'JSXElement')
      if (node.type === 'JSXElement' as string || node.type === 'JSXFragment' as string || node.type === 'Element' as string) {
        return true;
      }

      const keys = Object.keys(node);
      for (const key of keys) {
        if (key === 'parent' || key === 'loc' || key === 'range') {
          continue;
        }

        const value = (node as any)[key];
        if (value && typeof value === 'object') {
          if (Array.isArray(value)) {
            for (const item of value) {
              if (item && typeof item === 'object' && containsJSX(item, visited)) {
                return true;
              }
            }
          } else if (value.type && containsJSX(value, visited)) {
            return true;
          }
        }
      }

      return false;
    }

    return {
      Component() {
        insideComponent++;
      },
      'Component:exit'() {
        insideComponent--;
      },

      "CallExpression[callee.name='effect']"() {
        insideEffect++;
      },
      "CallExpression[callee.name='effect']:exit"() {
        insideEffect--;
      },

      ForOfStatement(node: ForOfStatement) {
        if (insideComponent === 0) return;

        const hasJSX = containsJSX(node.body);

        if (insideEffect > 0) {
          if (hasJSX) {
            context.report({
              node,
              messageId: 'noJsxInEffectLoop',
            });
          }
        } else {
          if (!hasJSX) {
            context.report({
              node,
              messageId: 'requireJsxInLoop',
            });
          }
        }
      },
    };
  },
};

export default rule;
