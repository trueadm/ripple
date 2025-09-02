import { parse } from 'ripple/compiler';

export const languages = [
	{
		name: 'ripple',
		parsers: ['ripple'],
		extensions: ['.ripple'],
		vscodeLanguageIds: ['ripple'],
	},
];

export const parsers = {
	ripple: {
		astFormat: 'ripple-ast',
		parse(text, parsers, options) {
			const ast = parse(text);

			// Ensure the AST has the required properties for Prettier
			if (!ast.comments) {
				ast.comments = [];
			}

			return ast;
		},

		locStart(node) {
			return node.start || 0;
		},

		locEnd(node) {
			return node.end || 0;
		},
	},
};

export const printers = {
	'ripple-ast': {
		print(path, options, print) {
			const node = path.getValue();
			return printRippleNode(node, path, options, print);
		},
	},
};

// Helper function to format string literals according to Prettier options
function formatStringLiteral(value, options) {
	if (typeof value !== 'string') {
		return JSON.stringify(value);
	}

	const quote = options.singleQuote ? "'" : '"';
	const escapedValue = value
		.replace(/\\/g, '\\\\')
		.replace(new RegExp(quote, 'g'), '\\' + quote)
		.replace(/\n/g, '\\n')
		.replace(/\r/g, '\\r')
		.replace(/\t/g, '\\t');

	return quote + escapedValue + quote;
}

// Helper function to create indentation according to Prettier options
function createIndent(options, level = 1) {
	if (options.useTabs) {
		return '\t'.repeat(level);
	} else {
		return ' '.repeat((options.tabWidth || 2) * level);
	}
}

function printJS(path, print, name) {
	return path.call(print, name);
}

function printRippleNode(node, path, options, print) {
	if (!node || typeof node !== 'object') {
		return String(node || '');
	}

	switch (node.type) {
		case 'Program':
			return path.map(print, 'body').join('\n\n');

		case 'ImportDeclaration':
			return printImportDeclaration(node, path, options, print);

		case 'Component':
			return printComponent(node, path, options, print);

		case 'ExportNamedDeclaration':
			return printExportNamedDeclaration(node, path, options, print);

		case 'ExportDefaultDeclaration':
			return printExportDefaultDeclaration(node, path, options, print);

		case 'FunctionDeclaration':
			return printFunctionDeclaration(node, path, options, print);

		case 'IfStatement':
			return printIfStatement(node, path, options, print);

		case 'ForOfStatement':
			return printForOfStatement(node, path, options, print);

		case 'ForStatement':
			return printForStatement(node, path, options, print);

		case 'WhileStatement':
			return printWhileStatement(node, path, options, print);

		case 'DoWhileStatement':
			return printDoWhileStatement(node, path, options, print);

		case 'ClassDeclaration':
			return printClassDeclaration(node, path, options, print);

		case 'TryStatement':
			return printTryStatement(node, path, options, print);

		case 'ArrayExpression':
			return '[' + path.map(print, 'elements').join(', ') + ']';

		case 'ObjectExpression':
			return printObjectExpression(node, path, options, print);

		case 'ClassBody':
			return printClassBody(node, path, options, print);

		case 'PropertyDefinition':
			return printPropertyDefinition(node, path, options, print);

		case 'MethodDefinition':
			return printMethodDefinition(node, path, options, print);

		case 'PrivateIdentifier':
			return '#' + node.name;

		case 'AssignmentExpression':
			return path.call(print, 'left') + ' ' + node.operator + ' ' + path.call(print, 'right');

		case 'MemberExpression':
			return printMemberExpression(node, path, options, print);

		case 'Super':
			return 'super';

		case 'ThisExpression':
			return 'this';

		case 'CallExpression':
			return path.call(print, 'callee') + '(' + path.map(print, 'arguments').join(', ') + ')';

		case 'AwaitExpression':
			return 'await ' + path.call(print, 'argument');

		case 'UnaryExpression':
			return printUnaryExpression(node, path, options, print);

		case 'YieldExpression':
			return printYieldExpression(node, path, options, print);

		case 'NewExpression':
			return printNewExpression(node, path, options, print);

		case 'TemplateLiteral':
			return printTemplateLiteral(node, path, options, print);

		case 'TaggedTemplateExpression':
			return printTaggedTemplateExpression(node, path, options, print);

		case 'ThrowStatement':
			return printThrowStatement(node, path, options, print);

		case 'TSInterfaceDeclaration':
			return printTSInterfaceDeclaration(node, path, options, print);

		case 'TSTypeAliasDeclaration':
			return printTSTypeAliasDeclaration(node, path, options, print);

		case 'TSTypeParameterDeclaration':
			return printTSTypeParameterDeclaration(node, path, options, print);

		case 'TSTypeParameter':
			return printTSTypeParameter(node, path, options, print);

		case 'TSNumberKeyword':
			return 'number';

		case 'TSBooleanKeyword':
			return 'boolean';

		case 'TSInterfaceBody':
			return printTSInterfaceBody(node, path, options, print);

		case 'SwitchStatement':
			return printSwitchStatement(node, path, options, print);

		case 'SwitchCase':
			return printSwitchCase(node, path, options, print);

		case 'BreakStatement':
			return printBreakStatement(node, path, options, print);

		case 'ContinueStatement':
			return printContinueStatement(node, path, options, print);

		case 'SequenceExpression':
			return printSequenceExpression(node, path, options, print);

		case 'SpreadElement':
			return '...' + path.call(print, 'argument');

		case 'EmptyStatement':
			return '';

		case 'VariableDeclaration':
			return printVariableDeclaration(node, path, options, print);

		case 'ExpressionStatement':
			return path.call(print, 'expression') + ';';

		case 'JSXElement':
			return printJSXElement(node, path, options, print);

		case 'JSXFragment':
			return printJSXFragment(node, path, options, print);

		case 'JSXText':
			return node.value;

		case 'JSXExpressionContainer':
			return '{' + path.call(print, 'expression') + '}';

		case 'JSXAttribute':
			return printJSXAttribute(node, path, options, print);

		case 'UseAttribute':
			return '{@use ' + printJS(path, print, 'argument') + '}';

		case 'SpreadAttribute':
			return '{...' + path.call(print, 'argument') + '}';

		case 'Identifier':
			let result = node.name;
			if (node.typeAnnotation) {
				result += path.call(print, 'typeAnnotation');
			}
			return result;

		case 'Literal':
			return formatStringLiteral(node.value, options);

		case 'ArrowFunctionExpression':
			return printArrowFunction(node, path, options, print);

		case 'BlockStatement':
			const statements = path.map(print, 'body');

			// Preserve existing blank lines by checking source line differences
			const spacedStatements = [];
			for (let i = 0; i < statements.length; i++) {
				spacedStatements.push(statements[i]);

				// Add blank lines between logical groups OR preserve existing ones
				if (i < statements.length - 1 && node.body && node.body[i] && node.body[i + 1]) {
					const currentStmt = node.body[i];
					const nextStmt = node.body[i + 1];

					// Check if there was originally a blank line between these statements
					const currentEndLine = currentStmt.loc?.end?.line;
					const nextStartLine = nextStmt.loc?.start?.line;
					const hasOriginalBlankLine =
						nextStartLine && currentEndLine && nextStartLine - currentEndLine > 1;

					// Preserve original blank lines OR add new ones based on logic
					if (hasOriginalBlankLine || shouldAddBlankLine(currentStmt, nextStmt)) {
						spacedStatements.push('');
					}
				}
			}

			const joinedStatements = spacedStatements.join('\n');
			const indentedStatements = joinedStatements
				.split('\n')
				.map((line) => {
					if (line.trim() === '') return '';
					return createIndent(options) + line;
				})
				.join('\n');
			return '{\n' + indentedStatements + '\n}';

		case 'ReturnStatement':
			return 'return ' + (node.argument ? path.call(print, 'argument') : '') + ';';

		case 'BinaryExpression':
			return path.call(print, 'left') + ' ' + node.operator + ' ' + path.call(print, 'right');

		case 'LogicalExpression':
			return path.call(print, 'left') + ' ' + node.operator + ' ' + path.call(print, 'right');

		case 'ConditionalExpression':
			return (
				path.call(print, 'test') +
				' ? ' +
				path.call(print, 'consequent') +
				' : ' +
				path.call(print, 'alternate')
			);

		case 'UpdateExpression':
			return node.prefix
				? node.operator + path.call(print, 'argument')
				: path.call(print, 'argument') + node.operator;

		case 'TSArrayType':
			return 'Array<' + path.call(print, 'elementType') + '>';

		case 'TSNumberKeyword':
			return 'number';

		case 'CallExpression':
			return path.call(print, 'callee') + '(' + path.map(print, 'arguments').join(', ') + ')';

		case 'MemberExpression':
			return (
				path.call(print, 'object') +
				(node.computed
					? '[' + path.call(print, 'property') + ']'
					: '.' + path.call(print, 'property'))
			);

		case 'ObjectPattern':
			return printObjectPattern(node, path, options, print);

		case 'Property':
			return printProperty(node, path, options, print);

		case 'VariableDeclarator':
			return printVariableDeclarator(node, path, options, print);

		case 'TSTypeAnnotation':
			return ': ' + path.call(print, 'typeAnnotation');

		case 'TSTypeLiteral':
			return printTSTypeLiteral(node, path, options, print);

		case 'TSPropertySignature':
			return printTSPropertySignature(node, path, options, print);

		case 'TSStringKeyword':
			return 'string';

		case 'TSTypeReference':
			return printTSTypeReference(node, path, options, print);

		case 'Element':
			return printElement(node, path, options, print);

		case 'Attribute':
			return printAttribute(node, path, options, print);

		case 'Text':
			return '{' + path.call(print, 'expression') + '}';

		default:
			// Fallback for unknown node types
			console.warn('Unknown node type:', node.type);
			return '/* Unknown: ' + node.type + ' */';
	}
}

function printImportDeclaration(node, path, options, print) {
	let result = 'import ';

	// Handle type imports
	if (node.importKind === 'type') {
		result += 'type ';
	}

	if (node.specifiers && node.specifiers.length > 0) {
		const specifiers = node.specifiers.map((spec) => {
			if (spec.type === 'ImportDefaultSpecifier') {
				return spec.local.name;
			} else if (spec.type === 'ImportSpecifier') {
				return spec.imported.name === spec.local.name
					? spec.local.name
					: spec.imported.name + ' as ' + spec.local.name;
			}
			return spec.local.name;
		});

		if (specifiers.length === 1 && node.specifiers[0].type === 'ImportDefaultSpecifier') {
			result += specifiers[0];
		} else {
			result += '{ ' + specifiers.join(', ') + ' }';
		}

		result += ' from ';
	}

	result += formatStringLiteral(node.source.value, options) + ';';
	return result;
}

function printExportNamedDeclaration(node, path, options, print) {
	let result = 'export ';

	if (node.declaration) {
		result += path.call(print, 'declaration');
	} else if (node.specifiers && node.specifiers.length > 0) {
		const specifiers = node.specifiers.map((spec) => {
			if (spec.exported.name === spec.local.name) {
				return spec.local.name;
			} else {
				return spec.local.name + ' as ' + spec.exported.name;
			}
		});
		result += '{ ' + specifiers.join(', ') + ' }';

		if (node.source) {
			result += ' from ' + formatStringLiteral(node.source.value, options);
		}
		result += ';';
	}

	return result;
}

function printComponent(node, path, options, print) {
	let result = 'component ' + node.id.name;

	// Add TypeScript generics if present
	if (node.typeParameters) {
		result += path.call(print, 'typeParameters');
	}

	// Always add parentheses, even if no parameters
	if (node.params && node.params.length > 0) {
		result += '(' + path.map(print, 'params').join(', ') + ')';
	} else {
		result += '()';
	}

	result += ' {\n';

	// Print body statements with proper spacing (same logic as BlockStatement)
	const bodyStatements = [];
	for (let i = 0; i < node.body.length; i++) {
		const statement = path.call(print, 'body', i);
		bodyStatements.push(statement);
	}

	// Apply the same spacing logic as BlockStatement
	const spacedStatements = [];
	for (let i = 0; i < bodyStatements.length; i++) {
		spacedStatements.push(bodyStatements[i]);

		// Add blank lines between logical groups OR preserve existing ones
		if (i < bodyStatements.length - 1 && node.body && node.body[i] && node.body[i + 1]) {
			const currentStmt = node.body[i];
			const nextStmt = node.body[i + 1];

			// Check if there was originally a blank line between these statements
			const currentEndLine = currentStmt.loc?.end?.line;
			const nextStartLine = nextStmt.loc?.start?.line;
			const hasOriginalBlankLine =
				nextStartLine && currentEndLine && nextStartLine - currentEndLine > 1;

			// Preserve original blank lines OR add new ones based on logic
			if (hasOriginalBlankLine || shouldAddBlankLine(currentStmt, nextStmt)) {
				spacedStatements.push('');
			}
		}
	}

	const body = spacedStatements.join('\n');
	// Properly indent each line of the body content
	const indentedBody = body
		.split('\n')
		.map((line) => {
			if (line.trim() === '') return '';
			return createIndent(options) + line;
		})
		.join('\n');
	result += indentedBody;

	// Add CSS if present
	if (node.css && node.css.source) {
		result += '\n\n  <style>';
		// Format the CSS content with proper CSS indentation
		const cssContent = node.css.source.trim();
		// Split into lines and format each line
		const cssLines = cssContent.split('\n');
		let inRule = false;

		cssLines.forEach((line) => {
			const trimmedLine = line.trim();
			if (!trimmedLine) {
				result += '\n';
				return;
			}

			// Check if this line starts a CSS rule (selector)
			if (trimmedLine.includes('{')) {
				inRule = true;
				result += '\n    ' + trimmedLine; // 4 spaces for selectors
			}
			// Check if this line ends a CSS rule
			else if (trimmedLine === '}') {
				inRule = false;
				result += '\n    ' + trimmedLine; // 4 spaces for closing brace
			}
			// CSS properties inside rules
			else if (inRule) {
				result += '\n      ' + trimmedLine; // 6 spaces for properties
			}
			// Other CSS content (shouldn't happen in normal CSS)
			else {
				result += '\n    ' + trimmedLine; // 4 spaces default
			}
		});

		result += '\n  </style>';
	}

	result += '\n}';

	return result;
}

function printVariableDeclaration(node, path, options, print) {
	const kind = node.kind || 'let';
	const declarations = path.map(print, 'declarations').join(', ');

	// Don't add semicolon if this is inside a for-loop (ForStatement or ForOfStatement)
	// We can detect this by checking if there's a parent ForStatement or ForOfStatement
	const hasForLoopParent =
		path.stack &&
		path.stack.some(
			(item) =>
				item &&
				typeof item === 'object' &&
				(item.type === 'ForStatement' || item.type === 'ForOfStatement'),
		);

	if (hasForLoopParent) {
		return kind + ' ' + declarations;
	} else {
		return kind + ' ' + declarations + ';';
	}
}

function printJSXElement(node, path, options, print) {
	const openingElement = printJSXOpeningElement(node.openingElement, path, options, print);

	if (node.selfClosing || (node.children && node.children.length === 0)) {
		return openingElement.replace('>', ' />');
	}

	const children = node.children
		.map((child, i) => {
			if (child.type === 'JSXText') {
				return child.value.trim();
			}
			return path.call(print, 'children', i);
		})
		.filter((child) => child !== '');

	const closingElement = '</' + node.openingElement.name.name + '>';

	if (children.length === 0) {
		return openingElement.replace('>', ' />');
	}

	if (children.length === 1 && typeof children[0] === 'string' && children[0].length < 20) {
		return openingElement + children[0] + closingElement;
	}

	return (
		openingElement +
		'\n' +
		children.map((child) => createIndent(options) + child).join('\n') +
		'\n' +
		closingElement
	);
}

function printJSXOpeningElement(node, path, options, print) {
	let result = '<' + node.name.name;

	if (node.attributes && node.attributes.length > 0) {
		const attrs = node.attributes
			.map((attr) => {
				if (attr.type === 'UseAttribute') {
					// Create a mock path for the UseAttribute
					const mockPath = {
						call: (printFn, key) => {
							if (key === 'argument') {
								return printRippleNode(attr.argument, null, options, print);
							}
							return '';
						}
					};
					return '{@use ' + printJS(mockPath, print, 'argument') + '}';
				} else if (attr.type === 'SpreadAttribute') {
					// Format spread attribute using generic node printing
					let argResult;
					if (attr.argument.type === 'Identifier') {
						argResult = attr.argument.name;
					} else {
						argResult = printRippleNode(attr.argument, null, options, print);
					}
					return '{...' + argResult + '}';
				} else if (attr.type === 'JSXAttribute') {
					return printJSXAttribute(attr, null, options, print);
				}
				return '';
			})
			.filter((attr) => attr !== '');

		// Check if the line would be too long and needs wrapping
		const singleLineResult = result + ' ' + attrs.join(' ') + '>';
		if (singleLineResult.length <= (options.printWidth || 80)) {
			return singleLineResult;
		}

		// Multi-line formatting
		return result + '\n' + attrs.map((attr) => createIndent(options) + attr).join('\n') + '\n>';
	}

	return result + '>';
}

function printJSXAttribute(node, path, options, print) {
	let result = node.name.name;

	if (node.value) {
		if (node.value.type === 'Literal') {
			result += '=' + formatStringLiteral(node.value.value, options);
		} else if (node.value.type === 'JSXExpressionContainer') {
			result += '={' + node.value.expression.name + '}';
		}
	}

	return result;
}

function printJSXFragment(node, path, options, print) {
	const children = path.map(print, 'children').join('\n');
	return '<>\n' + children + '\n</>';
}

function printArrowFunction(node, path, options, print) {
	let params;
	let body;

	// Handle case where path might be a mock object (from UseAttribute processing)
	if (path && typeof path.map === 'function') {
		params = path.map(print, 'params').join(', ');
		body = path.call(print, 'body');
	} else {
		// Fallback: process the node directly
		params = node.params.map((param) => printRippleNode(param, null, options, print)).join(', ');
		body = printRippleNode(node.body, null, options, print);
	}

	// Handle single parameter without parentheses (if no parentheses needed)
	if (node.params.length === 1 && node.params[0].type === 'Identifier') {
		return params + ' => ' + body;
	} else {
		return '(' + params + ') => ' + body;
	}
}

function printExportDefaultDeclaration(node, path, options, print) {
	return 'export default ' + path.call(print, 'declaration');
}

function printFunctionDeclaration(node, path, options, print) {
	let result = '';

	// Handle async functions
	if (node.async) {
		result += 'async ';
	}

	result += 'function';

	// Handle generator functions
	if (node.generator) {
		result += '*';
	}

	result += ' ' + node.id.name + '(';

	if (node.params && node.params.length > 0) {
		result += path.map(print, 'params').join(', ');
	}

	result += ') ';
	result += path.call(print, 'body');

	return result;
}

function printIfStatement(node, path, options, print) {
	let result = 'if (' + path.call(print, 'test') + ') ';
	result += path.call(print, 'consequent');

	if (node.alternate) {
		result += ' else ';
		result += path.call(print, 'alternate');
	}

	return result;
}

function printForOfStatement(node, path, options, print) {
	let result = 'for (';
	result += path.call(print, 'left');
	result += ' of ';
	result += path.call(print, 'right');
	result += ') ';
	result += path.call(print, 'body');

	return result;
}

function printForStatement(node, path, options, print) {
	let result = 'for (';

	// Handle init part
	if (node.init) {
		result += path.call(print, 'init');
	}
	result += ';';

	// Handle test part
	if (node.test) {
		result += ' ' + path.call(print, 'test');
	}
	result += ';';

	// Handle update part
	if (node.update) {
		result += ' ' + path.call(print, 'update');
	}

	result += ') ';
	result += path.call(print, 'body');

	return result;
}

// Updated for-loop formatting
function printWhileStatement(node, path, options, print) {
	let result = 'while (';
	result += path.call(print, 'test');
	result += ') ';
	result += path.call(print, 'body');

	return result;
}

function printDoWhileStatement(node, path, options, print) {
	let result = 'do ';
	result += path.call(print, 'body');
	result += ' while (';
	result += path.call(print, 'test');
	result += ')';

	return result;
}

function printObjectExpression(node, path, options, print) {
	if (!node.properties || node.properties.length === 0) {
		return '{}';
	}

	const properties = path.map(print, 'properties').join(',\n');
	const indentedProperties = properties
		.split('\n')
		.map((line) => {
			if (line.trim() === '') return '';
			return createIndent(options) + line;
		})
		.join('\n');

	return '{\n' + indentedProperties + '\n}';
}

function printClassDeclaration(node, path, options, print) {
	let result = 'class ' + node.id.name;

	if (node.superClass) {
		result += ' extends ' + path.call(print, 'superClass');
	}

	result += ' ';
	result += path.call(print, 'body');

	return result;
}

function printTryStatement(node, path, options, print) {
	let result = 'try ';
	result += path.call(print, 'block');

	if (node.handler) {
		result += ' catch';
		if (node.handler.param) {
			result += ' (' + path.call(print, 'handler', 'param') + ')';
		}
		result += ' ' + path.call(print, 'handler', 'body');
	}

	if (node.finalizer) {
		result += ' finally ';
		result += path.call(print, 'finalizer');
	}

	return result;
}

function printClassBody(node, path, options, print) {
	if (!node.body || node.body.length === 0) {
		return '{}';
	}

	const body = path.map(print, 'body').join('\n');
	const indentedBody = body
		.split('\n')
		.map((line) => {
			if (line.trim() === '') return '';
			return createIndent(options) + line;
		})
		.join('\n');

	return '{\n' + indentedBody + '\n}';
}

function printPropertyDefinition(node, path, options, print) {
	let result = '';

	if (node.static) {
		result += 'static ';
	}

	result += path.call(print, 'key');

	if (node.typeAnnotation) {
		result += path.call(print, 'typeAnnotation');
	}

	if (node.value) {
		result += ' = ' + path.call(print, 'value');
	}

	result += ';';

	return result;
}

function printMethodDefinition(node, path, options, print) {
	let result = '';

	if (node.static) {
		result += 'static ';
	}

	if (node.kind === 'constructor') {
		result += 'constructor';
	} else if (node.kind === 'get') {
		result += 'get ' + path.call(print, 'key');
	} else if (node.kind === 'set') {
		result += 'set ' + path.call(print, 'key');
	} else {
		result += path.call(print, 'key');
	}

	result += '(';
	if (node.value && node.value.params) {
		result += node.value.params.map((param) => param.name).join(', ');
	}
	result += ') ';

	if (node.value && node.value.body) {
		result += path.call(print, 'value', 'body');
	} else {
		result += '{}';
	}

	return result;
}

function printMemberExpression(node, path, options, print) {
	let result = path.call(print, 'object');
	if (node.computed) {
		result += '[' + path.call(print, 'property') + ']';
	} else {
		result += '.' + path.call(print, 'property');
	}
	return result;
}

// printCallExpression function removed - now using generic path.call approach

function printUnaryExpression(node, path, options, print) {
	if (node.prefix) {
		// Add space for word operators like 'void', 'typeof', 'delete'
		const needsSpace = /^[a-z]/.test(node.operator);
		return node.operator + (needsSpace ? ' ' : '') + path.call(print, 'argument');
	} else {
		return path.call(print, 'argument') + node.operator;
	}
}

function printYieldExpression(node, path, options, print) {
	let result = 'yield';

	if (node.delegate) {
		result += '*';
	}

	if (node.argument) {
		result += ' ' + path.call(print, 'argument');
	}

	return result;
}

function printNewExpression(node, path, options, print) {
	let result = 'new ' + path.call(print, 'callee');

	if (node.arguments && node.arguments.length > 0) {
		result += '(' + path.map(print, 'arguments').join(', ') + ')';
	} else {
		result += '()';
	}

	return result;
}

function printTemplateLiteral(node, path, options, print) {
	let result = '`';

	for (let i = 0; i < node.quasis.length; i++) {
		result += node.quasis[i].value.raw;

		if (i < node.expressions.length) {
			result += '${' + path.call(print, 'expressions', i) + '}';
		}
	}

	result += '`';
	return result;
}

function printTaggedTemplateExpression(node, path, options, print) {
	return path.call(print, 'tag') + path.call(print, 'quasi');
}

function printThrowStatement(node, path, options, print) {
	return 'throw ' + path.call(print, 'argument') + ';';
}

function printTSInterfaceDeclaration(node, path, options, print) {
	let result = 'interface ' + node.id.name;

	if (node.typeParameters) {
		result += path.call(print, 'typeParameters');
	}

	result += ' ';
	result += path.call(print, 'body');

	return result;
}

function printTSInterfaceBody(node, path, options, print) {
	if (!node.body || node.body.length === 0) {
		return '{}';
	}

	const members = path.map(print, 'body');
	const joinedMembers = members.join(';\n');
	const indentedMembers = joinedMembers
		.split('\n')
		.map((line) => {
			if (line.trim() === '') return '';
			return createIndent(options) + line;
		})
		.join('\n');

	return '{\n' + indentedMembers + ';\n}';
}

function printTSTypeAliasDeclaration(node, path, options, print) {
	let result = 'type ' + node.id.name;

	if (node.typeParameters) {
		result += path.call(print, 'typeParameters');
	}

	result += ' = ';
	result += path.call(print, 'typeAnnotation');
	result += ';';

	return result;
}

function printTSTypeParameterDeclaration(node, path, options, print) {
	if (!node.params || node.params.length === 0) {
		return '';
	}

	return '<' + path.map(print, 'params').join(', ') + '>';
}

function printTSTypeParameter(node, path, options, print) {
	let result = node.name;

	if (node.constraint) {
		result += ' extends ' + path.call(print, 'constraint');
	}

	if (node.default) {
		result += ' = ' + path.call(print, 'default');
	}

	return result;
}

function printSwitchStatement(node, path, options, print) {
	let result = 'switch (' + path.call(print, 'discriminant') + ') {\n';

	for (let i = 0; i < node.cases.length; i++) {
		result += path.call(print, 'cases', i);
		if (i < node.cases.length - 1) {
			result += '\n';
		}
	}

	result += '\n}';
	return result;
}

function printSwitchCase(node, path, options, print) {
	let result = '';

	if (node.test) {
		result += 'case ' + path.call(print, 'test') + ':';
	} else {
		result += 'default:';
	}

	if (node.consequent && node.consequent.length > 0) {
		result += '\n';
		for (let i = 0; i < node.consequent.length; i++) {
			result += createIndent(options) + path.call(print, 'consequent', i);
			if (i < node.consequent.length - 1) {
				result += '\n';
			}
		}
	}

	return result;
}

function printBreakStatement(node, path, options, print) {
	if (node.label) {
		return 'break ' + path.call(print, 'label') + ';';
	}
	return 'break;';
}

function printContinueStatement(node, path, options, print) {
	if (node.label) {
		return 'continue ' + path.call(print, 'label') + ';';
	}
	return 'continue;';
}

function printSequenceExpression(node, path, options, print) {
	return '(' + path.map(print, 'expressions').join(', ') + ')';
}

function shouldAddBlankLine(currentNode, nextNode) {
	// Add blank line after variable declarations when followed by different statement types
	if (currentNode.type === 'VariableDeclaration' && nextNode.type !== 'VariableDeclaration') {
		return true;
	}

	// Add blank line after expression statements when followed by different statement types
	if (
		currentNode.type === 'ExpressionStatement' &&
		nextNode.type !== 'ExpressionStatement' &&
		nextNode.type !== 'JSXElement'
	) {
		return true;
	}

	// Add blank line after if statements
	if (currentNode.type === 'IfStatement') {
		return true;
	}

	// Add blank line after for loops
	if (currentNode.type === 'ForOfStatement' || currentNode.type === 'ForStatement') {
		return true;
	}

	// Add blank line after while loops
	if (currentNode.type === 'WhileStatement' || currentNode.type === 'DoWhileStatement') {
		return true;
	}

	// Add blank line after try statements
	if (currentNode.type === 'TryStatement') {
		return true;
	}

	// Add blank line before try statements
	if (nextNode.type === 'TryStatement') {
		return true;
	}

	// Add blank line before for loops
	if (nextNode.type === 'ForOfStatement' || nextNode.type === 'ForStatement') {
		return true;
	}

	// Add blank line before while loops
	if (nextNode.type === 'WhileStatement' || nextNode.type === 'DoWhileStatement') {
		return true;
	}

	// Add blank line before function declarations/expressions
	if (
		nextNode.type === 'FunctionDeclaration' ||
		(nextNode.type === 'VariableDeclaration' &&
			nextNode.declarations &&
			nextNode.declarations[0] &&
			nextNode.declarations[0].init &&
			nextNode.declarations[0].init.type === 'ArrowFunctionExpression')
	) {
		return true;
	}

	// Add blank line before JSX elements when preceded by statements
	if (currentNode.type !== 'JSXElement' && nextNode.type === 'JSXElement') {
		return true;
	}

	// Add spacing between function declarations and other statements
	if (currentNode.type === 'FunctionDeclaration') {
		return true;
	}

	// Add spacing between different top-level statement types, but not within function bodies
	if (currentNode.type === 'ExpressionStatement' && nextNode.type === 'ExpressionStatement') {
		// Only add spacing if these are likely top-level statements (like beforeEach, afterEach, it)
		// We can detect this by checking if the expressions are function calls with test-related names
		if (
			currentNode.expression?.type === 'CallExpression' &&
			nextNode.expression?.type === 'CallExpression'
		) {
			const currentCallee = currentNode.expression.callee?.name;
			const nextCallee = nextNode.expression.callee?.name;

			// Only add spacing between test framework calls, not regular function calls
			const testFrameworkFunctions = [
				'beforeEach',
				'afterEach',
				'beforeAll',
				'afterAll',
				'it',
				'test',
				'describe',
			];

			if (
				testFrameworkFunctions.includes(currentCallee) ||
				testFrameworkFunctions.includes(nextCallee)
			) {
				return true;
			}
		}
	}

	return false;
}

function printObjectPattern(node, path, options, print) {
	const properties = path.map(print, 'properties').join(', ');
	let result = '{ ' + properties + ' }';

	if (node.typeAnnotation) {
		result += path.call(print, 'typeAnnotation');
	}

	return result;
}

function printProperty(node, path, options, print) {
	if (node.shorthand) {
		return path.call(print, 'key');
	}

	return path.call(print, 'key') + ': ' + path.call(print, 'value');
}

function printVariableDeclarator(node, path, options, print) {
	let result = path.call(print, 'id');

	if (node.init) {
		result += ' = ' + path.call(print, 'init');
	}

	return result;
}

function printTSTypeLiteral(node, path, options, print) {
	const members = path.map(print, 'members').join('; ');
	return '{ ' + members + ' }';
}

function printTSPropertySignature(node, path, options, print) {
	let result = path.call(print, 'key');

	if (node.typeAnnotation) {
		result += path.call(print, 'typeAnnotation');
	}

	return result;
}

function printTSTypeReference(node, path, options, print) {
	return path.call(print, 'typeName');
}

function printElement(node, path, options, print) {
	const tagName = node.id.name;
	let result = '<' + tagName;

	if (node.attributes && node.attributes.length > 0) {
		const attrs = path.map((attrPath, index) => {
			const attr = node.attributes[index];
			if (attr.type === 'UseAttribute') {
				return '{@use ' + printJS(attrPath, print, 'argument') + '}';
			} else if (attr.type === 'SpreadAttribute') {
				// Format spread attribute argument directly
				let argResult;
				if (attr.argument.type === 'Identifier') {
					argResult = attr.argument.name;
				} else {
					argResult = printRippleNode(attr.argument, null, options, print);
				}
				return '{...' + argResult + '}';
			} else {
				return attrPath.call(print);
			}
		}, 'attributes');

		// Check if the line would be too long and needs wrapping
		const singleLineResult =
			result +
			' ' +
			attrs.join(' ') +
			(node.selfClosing || !node.children || node.children.length === 0 ? ' />' : '>');

		if (singleLineResult.length <= options.printWidth) {
			// Single line fits within print width
			result += ' ' + attrs.join(' ');
		} else {
			// Multi-line: each attribute on its own line
			result += '\n' + attrs.map((attr) => createIndent(options) + attr).join('\n');
			if (!options.bracketSameLine) {
				result += '\n';
			}
		}
	}

	if (node.selfClosing || !node.children || node.children.length === 0) {
		result += ' />';
		return result;
	}

	result += '>';

	const children = path.map(print, 'children');
	const hasComplexChildren = children.some(
		(child) => typeof child === 'string' && (child.includes('\n') || child.length > 50),
	);

	if (hasComplexChildren || children.length > 1) {
		result += '\n';

		// Add intelligent spacing between children
		const spacedChildren = [];
		for (let i = 0; i < children.length; i++) {
			const child = children[i];
			spacedChildren.push(
				typeof child === 'string'
					? child
							.split('\n')
							.map((line) => (line ? createIndent(options) + line : line))
							.join('\n')
					: createIndent(options) + child,
			);

			// Add blank lines between logical groups
			if (i < children.length - 1 && node.children && node.children[i] && node.children[i + 1]) {
				const currentChild = node.children[i];
				const nextChild = node.children[i + 1];

				if (shouldAddBlankLine(currentChild, nextChild)) {
					spacedChildren.push('');
				}
			}
		}

		result += spacedChildren.join('\n');
		result += '\n';
	} else if (children.length === 1) {
		result += children[0];
	}

	result += '</' + tagName + '>';
	return result;
}

function printAttribute(node, path, options, print) {
	let result = node.name.name;

	if (node.value) {
		if (node.value.type === 'Literal') {
			result += '=' + formatStringLiteral(node.value.value, options);
		} else {
			result += '={' + path.call(print, 'value') + '}';
		}
	}

	return result;
}
