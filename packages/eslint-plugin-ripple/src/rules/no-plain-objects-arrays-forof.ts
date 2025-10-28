import type { Rule } from 'eslint';
import type { ForOfStatement } from 'estree';

// List of methods that stringify or transform data
const STRINGIFICATION_METHODS = new Set([
	'join',
	'toString',
	'toJSON',
	'toLocaleString',
	'map',
	'filter',
	'reduce',
	'flat',
	'flatMap',
	'split',
	'concat',
	'slice',
	'splice',
	'sort',
	'reverse',
	'fill',
	'entries',
	'keys',
	'values',
]);

function isStringificationCall(node: any): boolean {
	if (node.type === 'CallExpression') {
		const callee = node.callee;
		if (callee.type === 'MemberExpression' && callee.property.type === 'Identifier') {
			return STRINGIFICATION_METHODS.has(callee.property.name);
		}
	}

	// Recursively check if wrapped in another call
	if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression') {
		return isStringificationCall(node.callee.object);
	}

	return false;
}

const rule: Rule.RuleModule = {
	meta: {
		type: 'problem',
		docs: {
			description:
				'Disallow destructuring objects or arrays in for-of loops without stringification',
			category: 'Possible Errors',
			recommended: true,
		},
		messages: {
			objectDestructuring:
				"Object destructuring in for-of loops requires stringified iterables. Use methods like .join(), .map(), etc. on the iterable. Example: for (const key of [item.id, item.name].join(':')) { }",
			arrayDestructuring:
				"Array destructuring in for-of loops requires stringified iterables. Use methods like .join(), .map(), etc. on the iterable. Example: for (const [id, name] of items.map(i => `${i.id},${i.name}`.split(','))) { }",
		},
		schema: [],
	},
	create(context) {
		return {
			ForOfStatement(node: ForOfStatement) {
				const left = node.left;
				let pattern = left;

				if ((left as any).type === 'VariableDeclaration') {
					pattern = (left as any).declarations[0]?.id;
				}

				if (!pattern) {
					return;
				}

				const isObjectDestructure = (pattern as any).type === 'ObjectPattern';
				const isArrayDestructure = (pattern as any).type === 'ArrayPattern';

				if (!isObjectDestructure && !isArrayDestructure) {
					return;
				}

				const right = node.right;
				const isStringified = isStringificationCall(right);

				if (!isStringified) {
					const messageId = isObjectDestructure ? 'objectDestructuring' : 'arrayDestructuring';
					context.report({
						node,
						messageId,
					});
				}
			},
		};
	},
};

export default rule;
