import type { Rule } from 'eslint';
import type { ExportNamedDeclaration, ExportDefaultDeclaration } from 'estree';

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Require Ripple components to be exported',
      category: 'Best Practices',
      recommended: true,
    },
    messages: {
      notExported: 'Component "{{name}}" should be exported to be usable in other modules.',
    },
    schema: [],
  },
  create(context) {
    const components = new Set<string>();
    const exports = new Set<string>();

    return {
      // Track component definitions
      'ExpressionStatement > CallExpression[callee.name="component"]'(node: any) {
        // component Name() { ... } style
        if (node.arguments.length > 0 && node.arguments[0].type === 'Identifier') {
          components.add(node.arguments[0].name);
        }
      },
      // Track variable declarations with component
      'VariableDeclarator[init.callee.name="component"]'(node: any) {
        if (node.id.type === 'Identifier') {
          components.add(node.id.name);
        }
      },
      // Track exports
      ExportNamedDeclaration(node: ExportNamedDeclaration) {
        if (node.declaration) {
          if (node.declaration.type === 'VariableDeclaration') {
            node.declaration.declarations.forEach((decl) => {
              if (decl.id.type === 'Identifier') {
                exports.add(decl.id.name);
              }
            });
          } else if (node.declaration.type === 'FunctionDeclaration' && node.declaration.id) {
            exports.add(node.declaration.id.name);
          }
        }
        node.specifiers?.forEach((spec) => {
          if (spec.type === 'ExportSpecifier') {
            exports.add(spec.local.name);
          }
        });
      },
      ExportDefaultDeclaration(node: ExportDefaultDeclaration) {
        if (node.declaration.type === 'Identifier') {
          exports.add(node.declaration.name);
        }
      },
      // Check at end of program
      'Program:exit'() {
        components.forEach((name) => {
          if (!exports.has(name)) {
            // Only warn for components that look like they should be exported
            // (capitalized names, which is the convention)
            if (name[0] === name[0].toUpperCase()) {
              context.report({
                messageId: 'notExported',
                data: { name },
                loc: { line: 1, column: 0 },
              });
            }
          }
        });
      },
    };
  },
};

export default rule;
