import { parse } from 'ripple/compiler';
import { doc } from 'prettier';

const { concat, join, line, group, indent } = doc.builders;

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
			const parts = printRippleNode(node, path, options, print);
			// If printRippleNode returns doc parts, return them directly
			// If it returns a string, wrap it for consistency
			return typeof parts === 'string' ? parts : parts;
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
			// Return doc parts that Prettier can handle for cursor tracking
			return join(concat([line, line]), path.map(print, 'body'));

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

		case 'ArrayExpression': {
			// Use cursor-safe approach
			const parts = [];
			parts.push('[');
			parts.push(path.map(print, 'elements').join(', '));
			parts.push(']');
			return parts.join('');
		}

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

		case 'AssignmentExpression': {
			const parts = [];
			parts.push(path.call(print, 'left'));
			parts.push(' ');
			parts.push(node.operator);
			parts.push(' ');
			parts.push(path.call(print, 'right'));
			return parts.join('');
		}

		case 'MemberExpression':
			return printMemberExpression(node, path, options, print);

		case 'Super':
			return 'super';

		case 'ThisExpression':
			return 'this';

		case 'CallExpression': {
			const parts = [];
			parts.push(path.call(print, 'callee'));
			parts.push('(');
			parts.push(path.map(print, 'arguments').join(', '));
			parts.push(')');
			return parts.join('');
		}

		case 'AwaitExpression': {
			const parts = ['await ', path.call(print, 'argument')];
			return parts.join('');
		}

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

		case 'SpreadElement': {
			const parts = ['...', path.call(print, 'argument')];
			return parts.join('');
		}

		case 'EmptyStatement':
			return '';

		case 'VariableDeclaration':
			return printVariableDeclaration(node, path, options, print);

		case 'ExpressionStatement': {
			const parts = [path.call(print, 'expression'), ';'];
			return parts.join('');
		}

		case 'JSXElement':
			return printJSXElement(node, path, options, print);

		case 'JSXFragment':
			return printJSXFragment(node, path, options, print);

		case 'JSXText':
			return node.value;

		case 'JSXExpressionContainer': {
			const parts = ['{', path.call(print, 'expression'), '}'];
			return parts.join('');
		}

		case 'JSXAttribute':
			return printJSXAttribute(node, path, options, print);

		case 'UseAttribute':
			return '{@use ' + printJS(path, print, 'argument') + '}';

		case 'SpreadAttribute': {
			const parts = ['{...', path.call(print, 'argument'), '}'];
			return parts.join('');
		}

		case 'Identifier': {
			const parts = [node.name];
			if (node.typeAnnotation) {
				parts.push(path.call(print, 'typeAnnotation'));
			}
			return parts.join('');
		}

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

		case 'ReturnStatement': {
			const parts = ['return'];
			if (node.argument) {
				parts.push(' ');
				parts.push(path.call(print, 'argument'));
			}
			parts.push(';');
			return parts.join('');
		}

		case 'BinaryExpression': {
			const parts = [];
			parts.push(path.call(print, 'left'));
			parts.push(' ');
			parts.push(node.operator);
			parts.push(' ');
			parts.push(path.call(print, 'right'));
			return parts.join('');
		}

		case 'LogicalExpression': {
			const parts = [];
			parts.push(path.call(print, 'left'));
			parts.push(' ');
			parts.push(node.operator);
			parts.push(' ');
			parts.push(path.call(print, 'right'));
			return parts.join('');
		}

		case 'ConditionalExpression': {
			const parts = [];
			parts.push(path.call(print, 'test'));
			parts.push(' ? ');
			parts.push(path.call(print, 'consequent'));
			parts.push(' : ');
			parts.push(path.call(print, 'alternate'));
			return parts.join('');
		}

		case 'UpdateExpression': {
			const parts = [];
			if (node.prefix) {
				parts.push(node.operator);
				parts.push(path.call(print, 'argument'));
			} else {
				parts.push(path.call(print, 'argument'));
				parts.push(node.operator);
			}
			return parts.join('');
		}

		case 'TSArrayType': {
			const parts = ['Array<', path.call(print, 'elementType'), '>'];
			return parts.join('');
		}

		case 'TSNumberKeyword':
			return 'number';

		case 'MemberExpression':
			return printMemberExpression(node, path, options, print);

		case 'ObjectPattern':
			return printObjectPattern(node, path, options, print);

		case 'Property':
			return printProperty(node, path, options, print);

		case 'VariableDeclarator':
			return printVariableDeclarator(node, path, options, print);

		case 'TSTypeAnnotation': {
			const parts = [': ', path.call(print, 'typeAnnotation')];
			return parts.join('');
		}

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

		case 'Text': {
			const parts = ['{', path.call(print, 'expression'), '}'];
			return parts.join('');
		}

		default:
			// Fallback for unknown node types
			console.warn('Unknown node type:', node.type);
			return '/* Unknown: ' + node.type + ' */';
	}
}

function printImportDeclaration(node, path, options, print) {
	// Use Prettier's doc builders for proper cursor tracking
	const parts = ['import'];

	// Handle type imports
	if (node.importKind === 'type') {
		parts.push(' type');
	}

	if (node.specifiers && node.specifiers.length > 0) {
		const defaultImports = [];
		const namedImports = [];
		const namespaceImports = [];
		
		node.specifiers.forEach((spec) => {
			if (spec.type === 'ImportDefaultSpecifier') {
				defaultImports.push(spec.local.name);
			} else if (spec.type === 'ImportSpecifier') {
				const importName = spec.imported.name === spec.local.name
					? spec.local.name
					: spec.imported.name + ' as ' + spec.local.name;
				namedImports.push(importName);
			} else if (spec.type === 'ImportNamespaceSpecifier') {
				namespaceImports.push('* as ' + spec.local.name);
			}
		});

		// Build import clause properly
		const importParts = [];
		if (defaultImports.length > 0) {
			importParts.push(defaultImports.join(', '));
		}
		if (namespaceImports.length > 0) {
			importParts.push(namespaceImports.join(', '));
		}
		if (namedImports.length > 0) {
			importParts.push('{ ' + namedImports.join(', ') + ' }');
		}
		
		parts.push(' ' + importParts.join(', ') + ' from');
	}

	parts.push(' ' + formatStringLiteral(node.source.value, options) + ';');
	
	// Return as single string for proper cursor tracking
	return parts.join('');
}

function printExportNamedDeclaration(node, path, options, print) {
	if (node.declaration) {
		// Use cursor-safe approach
		const parts = [];
		parts.push('export ');
		parts.push(path.call(print, 'declaration'));
		return parts.join('');
	} else if (node.specifiers && node.specifiers.length > 0) {
		const specifiers = node.specifiers.map((spec) => {
			if (spec.exported.name === spec.local.name) {
				return spec.local.name;
			} else {
				return spec.local.name + ' as ' + spec.exported.name;
			}
		});
		
		let result = 'export { ' + specifiers.join(', ') + ' }';
		if (node.source) {
			result += ' from ' + formatStringLiteral(node.source.value, options);
		}
		result += ';';
		
		return result;
	}

	return 'export';
}

function printComponent(node, path, options, print) {
	// Use Prettier doc builders properly - build complete strings first, then concat
	let signature = 'component ' + node.id.name;

	// Add TypeScript generics if present
	if (node.typeParameters) {
		signature += path.call(print, 'typeParameters');
	}

	// Always add parentheses, even if no parameters
	if (node.params && node.params.length > 0) {
		signature += '(';
		signature += path.map(print, 'params').join(', ');
		signature += ')';
	} else {
		signature += '()';
	}

	// Build body content as complete string
	const bodyStatements = [];
	for (let i = 0; i < node.body.length; i++) {
		const statement = path.call(print, 'body', i);
		bodyStatements.push(statement);
	}

	// Apply spacing logic
	const spacedStatements = [];
	for (let i = 0; i < bodyStatements.length; i++) {
		spacedStatements.push(bodyStatements[i]);

		if (i < bodyStatements.length - 1 && node.body && node.body[i] && node.body[i + 1]) {
			const currentStmt = node.body[i];
			const nextStmt = node.body[i + 1];

			const currentEndLine = currentStmt.loc?.end?.line;
			const nextStartLine = nextStmt.loc?.start?.line;
			const hasOriginalBlankLine =
				nextStartLine && currentEndLine && nextStartLine - currentEndLine > 1;

			if (hasOriginalBlankLine || shouldAddBlankLine(currentStmt, nextStmt)) {
				spacedStatements.push('');
			}
		}
	}

	const body = spacedStatements.join('\n');
	const indentedBody = body
		.split('\n')
		.map((line) => {
			if (line.trim() === '') return '';
			return createIndent(options) + line;
		})
		.join('\n');

	// Build CSS content as complete string  
	let cssContent = '';
	if (node.css && node.css.source) {
		cssContent += '\n\n  <style>';
		const css = node.css.source.trim();
		const cssLines = css.split('\n');
		let inRule = false;

		cssLines.forEach((line) => {
			const trimmedLine = line.trim();
			if (!trimmedLine) {
				cssContent += '\n';
				return;
			}

			if (trimmedLine.includes('{')) {
				inRule = true;
				cssContent += '\n    ' + trimmedLine;
			} else if (trimmedLine === '}') {
				inRule = false;
				cssContent += '\n    ' + trimmedLine;
			} else if (inRule) {
				cssContent += '\n      ' + trimmedLine;
			} else {
				cssContent += '\n    ' + trimmedLine;
			}
		});

		cssContent += '\n  </style>';
	}

	// Return string directly for now - will convert to docs later
	return signature + ' {\n' + indentedBody + cssContent + '\n}';
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

	// Use cursor-safe approach
	const parts = [kind, ' ', declarations];
	if (!hasForLoopParent) {
		parts.push(';');
	}
	return parts.join('');
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
	const params = path.map(print, 'params').join(', ');
	const body = path.call(print, 'body');

	// Handle single parameter without parentheses (if no parentheses needed)
	if (node.params.length === 1 && node.params[0].type === 'Identifier') {
		return params + ' => ' + body;
	} else {
		return '(' + params + ') => ' + body;
	}
}

function printExportDefaultDeclaration(node, path, options, print) {
	// Use cursor-safe approach
	const parts = [];
	parts.push('export default ');
	parts.push(path.call(print, 'declaration'));
	return parts.join('');
}

function printFunctionDeclaration(node, path, options, print) {
	// Use cursor-safe approach
	const parts = [];

	// Handle async functions
	if (node.async) {
		parts.push('async ');
	}

	parts.push('function');

	// Handle generator functions
	if (node.generator) {
		parts.push('*');
	}

	parts.push(' ');
	parts.push(node.id.name);
	parts.push('(');

	if (node.params && node.params.length > 0) {
		parts.push(path.map(print, 'params').join(', '));
	}

	parts.push(') ');
	parts.push(path.call(print, 'body'));

	return parts.join('');
}

function printIfStatement(node, path, options, print) {
	// Use cursor-safe approach
	const parts = [];
	parts.push('if (');
	parts.push(path.call(print, 'test'));
	parts.push(') ');
	parts.push(path.call(print, 'consequent'));

	if (node.alternate) {
		parts.push(' else ');
		parts.push(path.call(print, 'alternate'));
	}

	return parts.join('');
}

function printForOfStatement(node, path, options, print) {
	// Use cursor-safe approach
	const parts = [];
	parts.push('for (');
	parts.push(path.call(print, 'left'));
	parts.push(' of ');
	parts.push(path.call(print, 'right'));
	parts.push(') ');
	parts.push(path.call(print, 'body'));

	return parts.join('');
}

function printForStatement(node, path, options, print) {
	// Use cursor-safe approach
	const parts = [];
	parts.push('for (');

	// Handle init part
	if (node.init) {
		parts.push(path.call(print, 'init'));
	}
	parts.push(';');

	// Handle test part
	if (node.test) {
		parts.push(' ');
		parts.push(path.call(print, 'test'));
	}
	parts.push(';');

	// Handle update part
	if (node.update) {
		parts.push(' ');
		parts.push(path.call(print, 'update'));
	}

	parts.push(') ');
	parts.push(path.call(print, 'body'));

	return parts.join('');
}

// Updated for-loop formatting
function printWhileStatement(node, path, options, print) {
	// Use cursor-safe approach
	const parts = [];
	parts.push('while (');
	parts.push(path.call(print, 'test'));
	parts.push(') ');
	parts.push(path.call(print, 'body'));

	return parts.join('');
}

function printDoWhileStatement(node, path, options, print) {
	// Use cursor-safe approach
	const parts = [];
	parts.push('do ');
	parts.push(path.call(print, 'body'));
	parts.push(' while (');
	parts.push(path.call(print, 'test'));
	parts.push(')');

	return parts.join('');
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
	// Use cursor-safe approach
	const parts = [];
	parts.push('class ');
	parts.push(node.id.name);

	if (node.superClass) {
		parts.push(' extends ');
		parts.push(path.call(print, 'superClass'));
	}

	parts.push(' ');
	parts.push(path.call(print, 'body'));

	return parts.join('');
}

function printTryStatement(node, path, options, print) {
	// Use cursor-safe approach
	const parts = [];
	parts.push('try ');
	parts.push(path.call(print, 'block'));

	if (node.handler) {
		parts.push(' catch');
		if (node.handler.param) {
			parts.push(' (');
			parts.push(path.call(print, 'handler', 'param'));
			parts.push(')');
		}
		parts.push(' ');
		parts.push(path.call(print, 'handler', 'body'));
	}

	if (node.finalizer) {
		parts.push(' finally ');
		parts.push(path.call(print, 'finalizer'));
	}

	return parts.join('');
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
	// Use cursor-safe approach
	const parts = [];

	if (node.static) {
		parts.push('static ');
	}

	parts.push(path.call(print, 'key'));

	if (node.typeAnnotation) {
		parts.push(path.call(print, 'typeAnnotation'));
	}

	if (node.value) {
		parts.push(' = ');
		parts.push(path.call(print, 'value'));
	}

	parts.push(';');

	return parts.join('');
}

function printMethodDefinition(node, path, options, print) {
	// Use cursor-safe approach
	const parts = [];

	if (node.static) {
		parts.push('static ');
	}

	if (node.kind === 'constructor') {
		parts.push('constructor');
	} else if (node.kind === 'get') {
		parts.push('get ');
		parts.push(path.call(print, 'key'));
	} else if (node.kind === 'set') {
		parts.push('set ');
		parts.push(path.call(print, 'key'));
	} else {
		parts.push(path.call(print, 'key'));
	}

	parts.push('(');
	if (node.value && node.value.params) {
		parts.push(node.value.params.map((param) => param.name).join(', '));
	}
	parts.push(') ');

	if (node.value && node.value.body) {
		parts.push(path.call(print, 'value', 'body'));
	} else {
		parts.push('{}');
	}

	return parts.join('');
}

function printMemberExpression(node, path, options, print) {
	// Use cursor-safe approach by building parts and joining them
	const objectPart = path.call(print, 'object');
	const propertyPart = path.call(print, 'property');
	
	if (node.computed) {
		return objectPart + '[' + propertyPart + ']';
	} else {
		return objectPart + '.' + propertyPart;
	}
}

// printCallExpression function removed - now using generic path.call approach

function printUnaryExpression(node, path, options, print) {
	// Use cursor-safe approach
	const parts = [];
	
	if (node.prefix) {
		parts.push(node.operator);
		// Add space for word operators like 'void', 'typeof', 'delete'
		const needsSpace = /^[a-z]/.test(node.operator);
		if (needsSpace) {
			parts.push(' ');
		}
		parts.push(path.call(print, 'argument'));
	} else {
		parts.push(path.call(print, 'argument'));
		parts.push(node.operator);
	}
	
	return parts.join('');
}

function printYieldExpression(node, path, options, print) {
	// Use cursor-safe approach
	const parts = [];
	parts.push('yield');

	if (node.delegate) {
		parts.push('*');
	}

	if (node.argument) {
		parts.push(' ');
		parts.push(path.call(print, 'argument'));
	}

	return parts.join('');
}

function printNewExpression(node, path, options, print) {
	// Use cursor-safe approach
	const parts = [];
	parts.push('new ');
	parts.push(path.call(print, 'callee'));

	if (node.arguments && node.arguments.length > 0) {
		parts.push('(');
		parts.push(path.map(print, 'arguments').join(', '));
		parts.push(')');
	} else {
		parts.push('()');
	}

	return parts.join('');
}

function printTemplateLiteral(node, path, options, print) {
	// Use cursor-safe approach
	const parts = [];
	parts.push('`');

	for (let i = 0; i < node.quasis.length; i++) {
		parts.push(node.quasis[i].value.raw);

		if (i < node.expressions.length) {
			parts.push('${');
			parts.push(path.call(print, 'expressions', i));
			parts.push('}');
		}
	}

	parts.push('`');
	return parts.join('');
}

function printTaggedTemplateExpression(node, path, options, print) {
	// Use cursor-safe approach
	const parts = [];
	parts.push(path.call(print, 'tag'));
	parts.push(path.call(print, 'quasi'));
	return parts.join('');
}

function printThrowStatement(node, path, options, print) {
	// Use cursor-safe approach
	const parts = [];
	parts.push('throw ');
	parts.push(path.call(print, 'argument'));
	parts.push(';');
	return parts.join('');
}

function printTSInterfaceDeclaration(node, path, options, print) {
	// Use cursor-safe approach
	const parts = [];
	parts.push('interface ');
	parts.push(node.id.name);

	if (node.typeParameters) {
		parts.push(path.call(print, 'typeParameters'));
	}

	parts.push(' ');
	parts.push(path.call(print, 'body'));

	return parts.join('');
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
	// Use cursor-safe approach
	const parts = [];
	parts.push('type ');
	parts.push(node.id.name);

	if (node.typeParameters) {
		parts.push(path.call(print, 'typeParameters'));
	}

	parts.push(' = ');
	parts.push(path.call(print, 'typeAnnotation'));
	parts.push(';');

	return parts.join('');
}

function printTSTypeParameterDeclaration(node, path, options, print) {
	// Use cursor-safe approach
	if (!node.params || node.params.length === 0) {
		return '';
	}

	const parts = [];
	parts.push('<');
	parts.push(path.map(print, 'params').join(', '));
	parts.push('>');
	return parts.join('');
}

function printTSTypeParameter(node, path, options, print) {
	// Use cursor-safe approach
	const parts = [];
	parts.push(node.name);

	if (node.constraint) {
		parts.push(' extends ');
		parts.push(path.call(print, 'constraint'));
	}

	if (node.default) {
		parts.push(' = ');
		parts.push(path.call(print, 'default'));
	}

	return parts.join('');
}

function printSwitchStatement(node, path, options, print) {
	// Use cursor-safe approach
	const parts = [];
	parts.push('switch (');
	parts.push(path.call(print, 'discriminant'));
	parts.push(') {\n');

	for (let i = 0; i < node.cases.length; i++) {
		parts.push(path.call(print, 'cases', i));
		if (i < node.cases.length - 1) {
			parts.push('\n');
		}
	}

	parts.push('\n}');
	return parts.join('');
}

function printSwitchCase(node, path, options, print) {
	// Use cursor-safe approach
	const parts = [];

	if (node.test) {
		parts.push('case ');
		parts.push(path.call(print, 'test'));
		parts.push(':');
	} else {
		parts.push('default:');
	}

	if (node.consequent && node.consequent.length > 0) {
		parts.push('\n');
		for (let i = 0; i < node.consequent.length; i++) {
			parts.push(createIndent(options));
			parts.push(path.call(print, 'consequent', i));
			if (i < node.consequent.length - 1) {
				parts.push('\n');
			}
		}
	}

	return parts.join('');
}

function printBreakStatement(node, path, options, print) {
	// Use cursor-safe approach
	const parts = [];
	parts.push('break');
	if (node.label) {
		parts.push(' ');
		parts.push(path.call(print, 'label'));
	}
	parts.push(';');
	return parts.join('');
}

function printContinueStatement(node, path, options, print) {
	// Use cursor-safe approach
	const parts = [];
	parts.push('continue');
	if (node.label) {
		parts.push(' ');
		parts.push(path.call(print, 'label'));
	}
	parts.push(';');
	return parts.join('');
}

function printSequenceExpression(node, path, options, print) {
	// Use cursor-safe approach
	const parts = [];
	parts.push('(');
	parts.push(path.map(print, 'expressions').join(', '));
	parts.push(')');
	return parts.join('');
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
	// Use cursor-safe approach
	const parts = [];
	parts.push('{ ');
	parts.push(path.map(print, 'properties').join(', '));
	parts.push(' }');

	if (node.typeAnnotation) {
		parts.push(path.call(print, 'typeAnnotation'));
	}

	return parts.join('');
}

function printProperty(node, path, options, print) {
	// Use cursor-safe approach
	if (node.shorthand) {
		return path.call(print, 'key');
	}

	const parts = [];
	parts.push(path.call(print, 'key'));
	parts.push(': ');
	parts.push(path.call(print, 'value'));
	return parts.join('');
}

function printVariableDeclarator(node, path, options, print) {
	// Use cursor-safe approach
	const parts = [];
	parts.push(path.call(print, 'id'));

	if (node.init) {
		parts.push(' = ');
		parts.push(path.call(print, 'init'));
	}

	return parts.join('');
}

function printTSTypeLiteral(node, path, options, print) {
	const members = path.map(print, 'members').join('; ');
	return '{ ' + members + ' }';
}

function printTSPropertySignature(node, path, options, print) {
	// Use cursor-safe approach
	const parts = [];
	parts.push(path.call(print, 'key'));

	if (node.typeAnnotation) {
		parts.push(path.call(print, 'typeAnnotation'));
	}

	return parts.join('');
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
	// Use cursor-safe approach
	const parts = [];
	parts.push(node.name.name);

	if (node.value) {
		if (node.value.type === 'Literal') {
			parts.push('=');
			parts.push(formatStringLiteral(node.value.value, options));
		} else {
			parts.push('={');
			parts.push(path.call(print, 'value'));
			parts.push('}');
		}
	}

	return parts.join('');
}
