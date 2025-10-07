import type { Rule } from 'eslint';
import type { CallExpression } from 'estree';

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow calling track() at module scope',
      category: 'Possible Errors',
      recommended: true,
    },
    messages: {
      moduleScope: 'track() cannot be called at module scope. It must be called within a component context.',
    },
    schema: [],
  },
  create(context) {
    let functionDepth = 0;

    const incrementDepth = () => functionDepth++;
    const decrementDepth = () => functionDepth--;

    return {
      // Track when we enter any function (including components)
      // Ripple's parser returns "Component" nodes for component declarations
      'FunctionDeclaration': incrementDepth,
      'FunctionExpression': incrementDepth,
      'ArrowFunctionExpression': incrementDepth,
      'Component': incrementDepth,

      'FunctionDeclaration:exit': decrementDepth,
      'FunctionExpression:exit': decrementDepth,
      'ArrowFunctionExpression:exit': decrementDepth,
      'Component:exit': decrementDepth,

      // Check track() calls
      CallExpression(node: CallExpression) {
        if (
          node.callee.type === 'Identifier' &&
          node.callee.name === 'track' &&
          functionDepth === 0
        ) {
          context.report({
            node,
            messageId: 'moduleScope',
          });
        }
      },
    };
  },
};

export default rule;
