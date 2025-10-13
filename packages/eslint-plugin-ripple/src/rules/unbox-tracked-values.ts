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

    function isInJSXContext(node: any): boolean {
      let parent = node.parent;

      // Walk up the AST to find if we're inside JSX/Element
      while (parent) {
        const parentType = parent.type;
        // Check for JSX context
        if (
          parentType === 'JSXExpressionContainer' ||
          parentType === 'JSXElement' ||
          parentType === 'JSXFragment' ||
          // Check for Ripple Element context
          parentType === 'ExpressionContainer' ||
          parentType === 'Element'
        ) {
          return true;
        }
        parent = parent.parent;
      }

      return false;
    }

    function checkTrackedIdentifier(node: any) {
      if (trackedVariables.has(node.name) && isInJSXContext(node)) {
        // Check if it's not already unboxed (preceded by @)
        // The @ operator in Ripple creates a UnaryExpression node
        const parent = node.parent;
        let isUnboxed = parent &&
                       parent.type === 'UnaryExpression' &&
                       parent.operator === '@';

        // Fallback: check source code for @ character before the identifier
        if (!isUnboxed) {
          const sourceCode = context.getSourceCode();
          const textBefore = sourceCode.text.substring(
            Math.max(0, node.range![0] - 1),
            node.range![0]
          );
          isUnboxed = textBefore === '@';
        }

        if (!isUnboxed) {
          context.report({
            node,
            messageId: 'needsUnbox',
            data: { name: node.name },
          });
        }
      }
    }

    return {
      // Track variables that are assigned from track()
      'VariableDeclarator[init.callee.name="track"]'(node: any) {
        if (node.id.type === 'Identifier') {
          trackedVariables.add(node.id.name);
        }
      },
      // Check all identifiers
      Identifier(node: any) {
        checkTrackedIdentifier(node);
      },
    };
  },
};

export default rule;
