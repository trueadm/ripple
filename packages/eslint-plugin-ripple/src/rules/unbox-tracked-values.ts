import type { Rule } from 'eslint';

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Ensure tracked values are unboxed with @ operator',
      category: 'Possible Errors',
      recommended: true,
    },
    messages: {
      needsUnbox: 'Tracked value should be unboxed with @ operator. Did you mean "@{{name}}"?',
    },
    schema: [],
  },
  create(context) {
    const trackedVariables = new Set<string>();

    return {
      // Track variables that are assigned from track()
      'VariableDeclarator[init.callee.name="track"]'(node: any) {
        if (node.id.type === 'Identifier') {
          trackedVariables.add(node.id.name);
        }
      },
      // Check usages
      'JSXExpressionContainer > Identifier'(node: any) {
        if (trackedVariables.has(node.name)) {
          // Check if it's not already unboxed (preceded by @)
          const sourceCode = context.getSourceCode();
          const tokenBefore = sourceCode.getTokenBefore(node);

          if (!tokenBefore || tokenBefore.value !== '@') {
            context.report({
              node,
              messageId: 'needsUnbox',
              data: { name: node.name },
            });
          }
        }
      },
    };
  },
};

export default rule;
