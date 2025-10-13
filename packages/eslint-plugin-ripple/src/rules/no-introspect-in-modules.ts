import type { Rule } from 'eslint';

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow @ introspection operator in TypeScript/JavaScript modules',
      category: 'Possible Errors',
      recommended: true,
    },
    messages: {
      noIntrospect: 'The @ operator cannot be used in TypeScript/JavaScript modules. Use get() to read tracked values and set() to update them instead.',
    },
    schema: [],
  },
  create(context) {
    const filename = context.filename || context.getFilename();
    
    // Skip .ripple files where @ operator is valid
    if (filename && filename.endsWith('.ripple')) {
      return {};
    }

    return {
      // Check for identifiers with the 'tracked' property
      // The @ operator is parsed by Ripple as an identifier with tracked=true
      Identifier(node: any) {
        if (node.tracked === true) {
          context.report({
            node,
            messageId: 'noIntrospect',
          });
        }
      },
    };
  },
};

export default rule;

