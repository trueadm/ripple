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
    let componentDepth = 0;
    let functionDepth = 0;

    const incrementComponentDepth = () => componentDepth++;
    const decrementComponentDepth = () => componentDepth--;
    const incrementFunctionDepth = () => functionDepth++;
    const decrementFunctionDepth = () => functionDepth--;

    return {
      // Only track when we enter a Ripple component
      // Ripple's parser returns "Component" nodes for component declarations
      'Component': incrementComponentDepth,
      'Component:exit': decrementComponentDepth,

      // Track regular functions and arrow functions
      'FunctionDeclaration': incrementFunctionDepth,
      'FunctionDeclaration:exit': decrementFunctionDepth,
      'FunctionExpression': incrementFunctionDepth,
      'FunctionExpression:exit': decrementFunctionDepth,
      'ArrowFunctionExpression': incrementFunctionDepth,
      'ArrowFunctionExpression:exit': decrementFunctionDepth,

      // Check track() calls
      CallExpression(node: CallExpression) {
        if (
          node.callee.type === 'Identifier' &&
          node.callee.name === 'track' &&
          componentDepth === 0 &&
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
