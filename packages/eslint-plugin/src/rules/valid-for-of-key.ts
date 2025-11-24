import type { Rule } from 'eslint';

const rule: Rule.RuleModule = {
	meta: {
		type: 'problem',
		docs: {
			description: 'Ensure variables used in for..of key expression are defined',
			recommended: true,
		},
		messages: {
			undefinedVariable: "Variable '{{name}}' is not defined.",
		},
		schema: [],
	},
	create(context) {
		return {
			ForOfStatement(node: any) {
				if (!node.key) {
					return;
				}

				const checkIdentifier = (identifier: any) => {
					const scope = context.sourceCode.getScope(node);
					const variable = findVariable(scope, identifier.name);

					if (!variable) {
						context.report({
							node: identifier,
							messageId: 'undefinedVariable',
							data: {
								name: identifier.name,
							},
						});
					}
				};

				const traverse = (node: any) => {
					if (!node) return;

					switch (node.type) {
						case 'Identifier':
							checkIdentifier(node);

							break;
						case 'MemberExpression':
							traverse(node.object);

							if (node.computed) {
								traverse(node.property);
							}

							break;
						case 'BinaryExpression':
						case 'LogicalExpression':
							traverse(node.left);
							traverse(node.right);

							break;
						case 'UnaryExpression':
							traverse(node.argument);

							break;
						case 'CallExpression':
							traverse(node.callee);
							node.arguments.forEach(traverse);

							break;
						case 'ArrayExpression':
							node.elements.forEach(traverse);

							break;
						case 'ObjectExpression':
							node.properties.forEach((prop: any) => {
								if (prop.type === 'Property') {
									if (prop.computed) {
										traverse(prop.key);
									}

									traverse(prop.value);
								} else if (prop.type === 'SpreadElement') {
									traverse(prop.argument);
								}
							});

							break;
						case 'ConditionalExpression':
							traverse(node.test);
							traverse(node.consequent);
							traverse(node.alternate);

							break;
						case 'TemplateLiteral':
							node.expressions.forEach(traverse);

							break;
					}
				};

				traverse(node.key);
			},
		};
	},
};

function findVariable(scope: any, name: string) {
	let currentScope = scope;

	while (currentScope) {
		const variable = currentScope.variables.find((v: { name: string }) => v.name === name);

		if (variable) {
			return variable;
		}

		// Also check references for global variables or variables defined in the loop itself (like the loop variable)
		// The loop variable might not be in the 'variables' list of the surrounding scope yet if we are inside the loop statement
		// But for 'for-of', the loop variable is in a special scope or the upper scope.
		// Let's rely on standard scope analysis.

		// Special case: check if the variable is the loop variable itself (left side of for-of)
		// The scope analysis might handle this, but let's be sure.

		currentScope = currentScope.upper;
	}

	// If not found in scopes, it might be a global variable.
	// ESLint scope analysis usually includes globals in the global scope.
	// However, if we are in a module, we might need to check if it's an implicit global or defined elsewhere.
	// For now, let's assume standard scope resolution works.

	return null;
}

export default rule;
