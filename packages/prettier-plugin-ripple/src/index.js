import { parse } from 'ripple/compiler';
import { doc } from 'prettier';

const { concat, join, line, hardline, group, indent } = doc.builders;

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
		print(path, options, print, args) {
			const node = path.getValue();
			const parts = printRippleNode(node, path, options, print, args);
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

function printRippleNode(node, path, options, print, args) {
	if (!node || typeof node !== 'object') {
		return String(node || '');
	}

	switch (node.type) {
		case 'Program': {
			// Handle the body statements properly - each statement returns an array
			const statements = [];
			for (let i = 0; i < node.body.length; i++) {
				const statement = path.call(print, 'body', i);
				// If statement is an array, flatten it
				if (Array.isArray(statement)) {
					statements.push(concat(statement));
				} else {
					statements.push(statement);
				}
			}
			return join(concat([line, line]), statements);
		}

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
			if (!node.elements || node.elements.length === 0) {
				return '[]';
			}

			const elements = path.map(print, 'elements');
			const shouldUseTrailingComma = options.trailingComma !== 'none' && elements.length > 0;

			// Simple single-line for short arrays
			if (elements.length <= 3) {
				const parts = ['['];
				for (let i = 0; i < elements.length; i++) {
					if (i > 0) parts.push(', ');
					parts.push(elements[i]);
				}
				if (shouldUseTrailingComma && options.trailingComma === 'all') {
					parts.push(',');
				}
				parts.push(']');
				return parts;
			}

			// Multi-line for longer arrays
			const parts = ['['];
			parts.push(line);
			for (let i = 0; i < elements.length; i++) {
				if (i > 0) {
					parts.push(',');
					parts.push(line);
				}
				parts.push(indent(elements[i]));
			}
			if (shouldUseTrailingComma) {
				parts.push(',');
			}
			parts.push(line);
			parts.push(']');
			return parts;
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

		case 'AssignmentExpression':
			return concat([path.call(print, 'left'), ' ', node.operator, ' ', path.call(print, 'right')]);

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
			const args = path.map(print, 'arguments');
			for (let i = 0; i < args.length; i++) {
				if (i > 0) parts.push(', ');
				parts.push(args[i]);
			}
			parts.push(')');
			return parts;
		}

		case 'AwaitExpression': {
			const parts = ['await ', path.call(print, 'argument')];
			return parts;
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
			return parts;
		}

		case 'EmptyStatement':
			return '';

		case 'VariableDeclaration':
			return printVariableDeclaration(node, path, options, print);

		case 'ExpressionStatement':
			return concat([path.call(print, 'expression'), ';']);

		case 'JSXExpressionContainer': {
			const parts = ['{', path.call(print, 'expression'), '}'];
			return parts;
		}

		case 'UseAttribute':
			return concat(['{@use ', path.call(print, 'argument'), '}']);

		case 'SpreadAttribute': {
			const parts = ['{...', path.call(print, 'argument'), '}'];
			return parts;
		}

		case 'Identifier':
			// Simple case - just return the name directly like Prettier core
			if (node.typeAnnotation) {
				return concat([node.name, path.call(print, 'typeAnnotation')]);
			}
			return node.name;

		case 'Literal':
			return formatStringLiteral(node.value, options);

		case 'ArrowFunctionExpression':
			return printArrowFunction(node, path, options, print);

		case 'FunctionExpression':
			return printFunctionExpression(node, path, options, print);

		case 'BlockStatement': {
			// Apply the same block formatting pattern as component bodies
			if (!node.body || node.body.length === 0) {
				return '{}';
			}

			// Process statements and handle spacing
			const statements = [];
			for (let i = 0; i < node.body.length; i++) {
				const statement = path.call(print, 'body', i);
				statements.push(statement);

				// Handle blank lines between statements
				if (i < node.body.length - 1) {
					const currentStmt = node.body[i];
					const nextStmt = node.body[i + 1];

					const currentEndLine = currentStmt.loc?.end?.line;
					const nextStartLine = nextStmt.loc?.start?.line;
					const hasOriginalBlankLine =
						nextStartLine && currentEndLine && nextStartLine - currentEndLine > 1;

					if (hasOriginalBlankLine || shouldAddBlankLine(currentStmt, nextStmt)) {
						statements.push(hardline); // Extra line for spacing
					}
				}
			}

			// Use proper block statement pattern
			return group([
				'{',
				indent([hardline, join(hardline, statements)]),
				hardline,
				'}'
			]);
		}

		case 'ReturnStatement': {
			const parts = ['return'];
			if (node.argument) {
				parts.push(' ');
				parts.push(path.call(print, 'argument'));
			}
			parts.push(';');
			return parts;
		}

		case 'BinaryExpression':
			return concat([path.call(print, 'left'), ' ', node.operator, ' ', path.call(print, 'right')]);

		case 'LogicalExpression':
			return concat([path.call(print, 'left'), ' ', node.operator, ' ', path.call(print, 'right')]);

		case 'ConditionalExpression':
			return concat([
				path.call(print, 'test'),
				' ? ',
				path.call(print, 'consequent'),
				' : ',
				path.call(print, 'alternate'),
			]);

		case 'UpdateExpression':
			if (node.prefix) {
				return concat([node.operator, path.call(print, 'argument')]);
			} else {
				return concat([path.call(print, 'argument'), node.operator]);
			}

		case 'TSArrayType': {
			const parts = ['Array<', path.call(print, 'elementType'), '>'];
			return parts;
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

		case 'AssignmentPattern':
			return printAssignmentPattern(node, path, options, print);

		case 'TSTypeAnnotation': {
			const parts = [': ', path.call(print, 'typeAnnotation')];
			return parts;
		}

		case 'TSTypeLiteral':
			return printTSTypeLiteral(node, path, options, print);

		case 'TSPropertySignature':
			return printTSPropertySignature(node, path, options, print);

		case 'TSStringKeyword':
			return 'string';

		case 'TSNumberKeyword':
			return 'number';

		case 'TSNullKeyword':
			return 'null';

		case 'TSLiteralType':
			return path.call(print, 'literal');

		case 'TSUnionType': {
			const types = path.map(print, 'types');
			return join(' | ', types);
		}

		case 'TSTypeReference':
			return printTSTypeReference(node, path, options, print);

		case 'Element':
			return printElement(node, path, options, print);

		case 'Attribute':
			return printAttribute(node, path, options, print);

		case 'Text': {
			const parts = ['{', path.call(print, 'expression'), '}'];
			return parts;
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
				const importName =
					spec.imported.name === spec.local.name
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
	return parts;
}

function printExportNamedDeclaration(node, path, options, print) {
	if (node.declaration) {
		const parts = [];
		parts.push('export ');
		parts.push(path.call(print, 'declaration'));
		return parts;
	} else if (node.specifiers && node.specifiers.length > 0) {
		const specifiers = node.specifiers.map((spec) => {
			if (spec.exported.name === spec.local.name) {
				return spec.local.name;
			} else {
				return spec.local.name + ' as ' + spec.exported.name;
			}
		});

		const parts = ['export { '];
		for (let i = 0; i < specifiers.length; i++) {
			if (i > 0) parts.push(', ');
			parts.push(specifiers[i]);
		}
		parts.push(' }');

		if (node.source) {
			parts.push(' from ');
			parts.push(formatStringLiteral(node.source.value, options));
		}
		parts.push(';');

		return parts;
	}

	return 'export';
}

function printComponent(node, path, options, print) {
	// Use arrays instead of string concatenation
	const signatureParts = ['component ', node.id.name];

	// Add TypeScript generics if present
	if (node.typeParameters) {
		const typeParams = path.call(print, 'typeParameters');
		if (Array.isArray(typeParams)) {
			signatureParts.push(...typeParams);
		} else {
			signatureParts.push(typeParams);
		}
	}

	// Always add parentheses, even if no parameters
	if (node.params && node.params.length > 0) {
		signatureParts.push('(');
		const paramList = path.map(print, 'params');
		for (let i = 0; i < paramList.length; i++) {
			if (i > 0) signatureParts.push(', ');
			if (Array.isArray(paramList[i])) {
				signatureParts.push(...paramList[i]);
			} else {
				signatureParts.push(paramList[i]);
			}
		}
		signatureParts.push(')');
	} else {
		signatureParts.push('()');
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

	// Follow Prettier's block statement pattern
	const statements = [];
	for (let i = 0; i < spacedStatements.length; i++) {
		if (spacedStatements[i] !== '') {
			statements.push(spacedStatements[i]);
		}
		// Handle blank lines between statements
		if (i < spacedStatements.length - 1 && spacedStatements[i + 1] === '') {
			statements.push(hardline); // Extra line for spacing
		}
	}

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

	// Use Prettier's standard block statement pattern
	const parts = [concat(signatureParts)];

	if (statements.length > 0 || cssContent) {
		// Standard block formatting like Prettier core
		const blockContent = [];

		if (statements.length > 0) {
			blockContent.push(join(hardline, statements));
		}

		// Add CSS content inside the component body if it exists
		if (cssContent) {
			if (statements.length > 0) {
				blockContent.push(hardline); // Add spacing between statements and CSS
			}
			blockContent.push(cssContent);
		}

		parts.push(
			group([
				' {',
				indent([hardline, ...blockContent]),
				hardline,
				'}'
			])
		);
	} else {
		parts.push(' {}');
	}

	return concat(parts);
}

function printVariableDeclaration(node, path, options, print) {
	const kind = node.kind || 'let';

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

	const declarations = path.map(print, 'declarations');

	if (!hasForLoopParent) {
		return concat([kind, ' ', declarations, ';']);
	}

	return concat([kind, ' ', declarations]);
}

function printJSXElement(node, path, options, print) {
	const openingElement = printJSXOpeningElement(node.openingElement, path, options, print);

	if (node.selfClosing || (node.children && node.children.length === 0)) {
		// Convert to self-closing tag - create new opening with ' />' instead of '>'
		const parts = ['<', node.openingElement.name.name];
		if (node.openingElement.attributes && node.openingElement.attributes.length > 0) {
			for (let i = 0; i < node.openingElement.attributes.length; i++) {
				parts.push(' ');
				parts.push(path.call(print, 'openingElement', 'attributes', i));
			}
		}
		parts.push(' />');
		return concat(parts);
	}

	const children = node.children
		.map((child, i) => {
			if (child.type === 'JSXText') {
				return child.value.trim();
			}
			return path.call(print, 'children', i);
		})
		.filter((child) => child !== '');

	const closingTag = concat(['</', node.openingElement.name.name, '>']);

	if (children.length === 0) {
		// Self-closing version
		const parts = ['<', node.openingElement.name.name];
		if (node.openingElement.attributes && node.openingElement.attributes.length > 0) {
			for (let i = 0; i < node.openingElement.attributes.length; i++) {
				parts.push(' ');
				parts.push(path.call(print, 'openingElement', 'attributes', i));
			}
		}
		parts.push(' />');
		return concat(parts);
	}

	if (children.length === 1 && typeof children[0] === 'string' && children[0].length < 20) {
		// Single line
		return concat([openingElement, children[0], closingTag]);
	}

	// Multi-line
	const parts = [openingElement];
	parts.push(line);
	for (let i = 0; i < children.length; i++) {
		if (i > 0) parts.push(line);
		parts.push(indent(children[i]));
	}
	parts.push(line);
	parts.push(closingTag);

	return concat(parts);
}

function printJSXOpeningElement(node, path, options, print) {
	const tag = node.name.name;

	if (!node.attributes || node.attributes.length === 0) {
		return group(['<', tag, '>']);
	}

	const openingTag = group([
		'<',
		tag,
		indent(
			group([
				...path.map((attrPath) => {
					return concat([' ', print(attrPath)]);
				}, 'attributes'),
			]),
		),
		'>',
	]);

	return openingTag;
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

	// Return as simple string since this is a complete atomic unit
	return result;
}

function printJSXFragment(node, path, options, print) {
	const children = path.map(print, 'children').join('\n');
	return '<>\n' + children + '\n</>';
}

function printFunctionExpression(node, path, options, print) {
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

	// Function name (if any)
	if (node.id) {
		parts.push(' ');
		parts.push(node.id.name);
	}

	parts.push('(');

	if (node.params && node.params.length > 0) {
		const paramList = path.map(print, 'params');
		for (let i = 0; i < paramList.length; i++) {
			if (i > 0) parts.push(', ');
			parts.push(paramList[i]);
		}
	}

	parts.push(')');

	// Handle return type annotation
	if (node.returnType) {
		parts.push(path.call(print, 'returnType'));
	}

	parts.push(' ');
	parts.push(path.call(print, 'body'));

	return concat(parts);
}

function printArrowFunction(node, path, options, print) {
	// Build params array properly
	const paramParts = [];
	const paramList = path.map(print, 'params');
	for (let i = 0; i < paramList.length; i++) {
		if (i > 0) paramParts.push(', ');
		paramParts.push(paramList[i]);
	}
	const body = path.call(print, 'body');

	// Return array of parts
	const parts = [];

	// Handle single parameter without parentheses (only for simple identifiers without types)
	if (
		node.params.length === 1 &&
		node.params[0].type === 'Identifier' &&
		!node.params[0].typeAnnotation
	) {
		parts.push(...paramParts);
		parts.push(' => ');
		parts.push(body);
	} else {
		parts.push('(');
		parts.push(...paramParts);
		parts.push(') => ');
		parts.push(body);
	}

	return concat(parts);
}

function printExportDefaultDeclaration(node, path, options, print) {
	const parts = [];
	parts.push('export default ');
	parts.push(path.call(print, 'declaration'));
	return parts;
}

function printFunctionDeclaration(node, path, options, print) {
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
		const paramList = path.map(print, 'params');
		for (let i = 0; i < paramList.length; i++) {
			if (i > 0) parts.push(', ');
			parts.push(paramList[i]);
		}
	}

	parts.push(')');

	// Handle return type annotation
	if (node.returnType) {
		parts.push(path.call(print, 'returnType'));
	}

	parts.push(' ');
	parts.push(path.call(print, 'body'));

	return parts;
}

function printIfStatement(node, path, options, print) {
	const parts = [];
	parts.push('if (');
	parts.push(path.call(print, 'test'));
	parts.push(') ');
	parts.push(path.call(print, 'consequent'));

	if (node.alternate) {
		parts.push(' else ');
		parts.push(path.call(print, 'alternate'));
	}

	return parts;
}

function printForOfStatement(node, path, options, print) {
	const parts = [];
	parts.push('for (');
	parts.push(path.call(print, 'left'));
	parts.push(' of ');
	parts.push(path.call(print, 'right'));
	parts.push(') ');
	parts.push(path.call(print, 'body'));

	return parts;
}

function printForStatement(node, path, options, print) {
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

	return parts;
}

// Updated for-loop formatting
function printWhileStatement(node, path, options, print) {
	const parts = [];
	parts.push('while (');
	parts.push(path.call(print, 'test'));
	parts.push(') ');
	parts.push(path.call(print, 'body'));

	return parts;
}

function printDoWhileStatement(node, path, options, print) {
	const parts = [];
	parts.push('do ');
	parts.push(path.call(print, 'body'));
	parts.push(' while (');
	parts.push(path.call(print, 'test'));
	parts.push(')');

	return parts;
}

function printObjectExpression(node, path, options, print) {
	if (!node.properties || node.properties.length === 0) {
		return '{}';
	}

	// Use AST builders and respect trailing commas
	const properties = path.map(print, 'properties');
	const shouldUseTrailingComma = options.trailingComma !== 'none' && properties.length > 0;
	const parts = ['{'];

	if (properties.length > 0) {
		parts.push(line);
		for (let i = 0; i < properties.length; i++) {
			if (i > 0) {
				parts.push(',');
				parts.push(line);
			}
			parts.push(indent(properties[i]));
		}

		// Add trailing comma if configured
		if (shouldUseTrailingComma) {
			parts.push(',');
		}

		parts.push(line);
	}

	parts.push('}');
	return parts;
}

function printClassDeclaration(node, path, options, print) {
	const parts = [];
	parts.push('class ');
	parts.push(node.id.name);

	if (node.superClass) {
		parts.push(' extends ');
		parts.push(path.call(print, 'superClass'));
	}

	parts.push(' ');
	parts.push(path.call(print, 'body'));

	return parts;
}

function printTryStatement(node, path, options, print) {
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

	return parts;
}

function printClassBody(node, path, options, print) {
	if (!node.body || node.body.length === 0) {
		return '{}';
	}

	const members = path.map(print, 'body');

	// Use AST builders for proper formatting
	return group(['{', indent(concat([line, join(concat([line, line]), members)])), line, '}']);
}

function printPropertyDefinition(node, path, options, print) {
	const parts = [];

	// Access modifiers (public, private, protected)
	if (node.accessibility) {
		parts.push(node.accessibility);
		parts.push(' ');
	}

	// Static keyword
	if (node.static) {
		parts.push('static ');
	}

	// Readonly keyword
	if (node.readonly) {
		parts.push('readonly ');
	}

	// Property name
	parts.push(path.call(print, 'key'));

	// Optional marker
	if (node.optional) {
		parts.push('?');
	}

	// Type annotation
	if (node.typeAnnotation) {
		parts.push(path.call(print, 'typeAnnotation'));
	}

	// Initializer
	if (node.value) {
		parts.push(' = ');
		parts.push(path.call(print, 'value'));
	}

	parts.push(';');

	return concat(parts);
}

function printMethodDefinition(node, path, options, print) {
	const parts = [];

	// Access modifiers (public, private, protected)
	if (node.accessibility) {
		parts.push(node.accessibility);
		parts.push(' ');
	}

	// Static keyword
	if (node.static) {
		parts.push('static ');
	}

	// Async keyword
	if (node.value && node.value.async) {
		parts.push('async ');
	}

	// Method kind and name
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

	// Parameters - use proper path.map for TypeScript support
	parts.push('(');
	if (node.value && node.value.params && node.value.params.length > 0) {
		const params = path.map(print, 'value', 'params');
		for (let i = 0; i < params.length; i++) {
			if (i > 0) parts.push(', ');
			parts.push(params[i]);
		}
	}
	parts.push(')');

	// Return type
	if (node.value && node.value.returnType) {
		parts.push(path.call(print, 'value', 'returnType'));
	}

	// Method body
	parts.push(' ');
	if (node.value && node.value.body) {
		parts.push(path.call(print, 'value', 'body'));
	} else {
		parts.push('{}');
	}

	return concat(parts);
}

function printMemberExpression(node, path, options, print) {
	const objectPart = path.call(print, 'object');
	const propertyPart = path.call(print, 'property');

	if (node.computed) {
		return objectPart + '[' + propertyPart + ']';
	} else {
		return objectPart + '.' + propertyPart;
	}
}

function printUnaryExpression(node, path, options, print) {
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

	return parts;
}

function printYieldExpression(node, path, options, print) {
	const parts = [];
	parts.push('yield');

	if (node.delegate) {
		parts.push('*');
	}

	if (node.argument) {
		parts.push(' ');
		parts.push(path.call(print, 'argument'));
	}

	return parts;
}

function printNewExpression(node, path, options, print) {
	const parts = [];
	parts.push('new ');
	parts.push(path.call(print, 'callee'));

	if (node.arguments && node.arguments.length > 0) {
		parts.push('(');
		const argList = path.map(print, 'arguments');
		for (let i = 0; i < argList.length; i++) {
			if (i > 0) parts.push(', ');
			parts.push(argList[i]);
		}
		parts.push(')');
	} else {
		parts.push('()');
	}

	return parts;
}

function printTemplateLiteral(node, path, options, print) {
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
	return parts;
}

function printTaggedTemplateExpression(node, path, options, print) {
	const parts = [];
	parts.push(path.call(print, 'tag'));
	parts.push(path.call(print, 'quasi'));
	return parts;
}

function printThrowStatement(node, path, options, print) {
	const parts = [];
	parts.push('throw ');
	parts.push(path.call(print, 'argument'));
	parts.push(';');
	return parts;
}

function printTSInterfaceDeclaration(node, path, options, print) {
	const parts = [];
	parts.push('interface ');
	parts.push(node.id.name);

	if (node.typeParameters) {
		parts.push(path.call(print, 'typeParameters'));
	}

	parts.push(' ');
	parts.push(path.call(print, 'body'));

	return parts;
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
	const parts = [];
	parts.push('type ');
	parts.push(node.id.name);

	if (node.typeParameters) {
		parts.push(path.call(print, 'typeParameters'));
	}

	parts.push(' = ');
	parts.push(path.call(print, 'typeAnnotation'));
	parts.push(';');

	return parts;
}

function printTSTypeParameterDeclaration(node, path, options, print) {
	if (!node.params || node.params.length === 0) {
		return '';
	}

	const parts = [];
	parts.push('<');
	const paramList = path.map(print, 'params');
	for (let i = 0; i < paramList.length; i++) {
		if (i > 0) parts.push(', ');
		parts.push(paramList[i]);
	}
	parts.push('>');
	return parts;
}

function printTSTypeParameter(node, path, options, print) {
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

	return parts;
}

function printSwitchStatement(node, path, options, print) {
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
	return parts;
}

function printSwitchCase(node, path, options, print) {
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

	return parts;
}

function printBreakStatement(node, path, options, print) {
	const parts = [];
	parts.push('break');
	if (node.label) {
		parts.push(' ');
		parts.push(path.call(print, 'label'));
	}
	parts.push(';');
	return parts;
}

function printContinueStatement(node, path, options, print) {
	const parts = [];
	parts.push('continue');
	if (node.label) {
		parts.push(' ');
		parts.push(path.call(print, 'label'));
	}
	parts.push(';');
	return parts;
}

function printSequenceExpression(node, path, options, print) {
	const parts = [];
	parts.push('(');
	const exprList = path.map(print, 'expressions');
	for (let i = 0; i < exprList.length; i++) {
		if (i > 0) parts.push(', ');
		parts.push(exprList[i]);
	}
	parts.push(')');
	return parts;
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
	const parts = [];
	parts.push('{ ');
	const propList = path.map(print, 'properties');
	for (let i = 0; i < propList.length; i++) {
		if (i > 0) parts.push(', ');
		parts.push(propList[i]);
	}
	parts.push(' }');

	if (node.typeAnnotation) {
		parts.push(path.call(print, 'typeAnnotation'));
	}

	return parts;
}

function printProperty(node, path, options, print) {
	if (node.shorthand) {
		return path.call(print, 'key');
	}

	const parts = [];
	parts.push(path.call(print, 'key'));
	parts.push(': ');
	parts.push(path.call(print, 'value'));
	return parts;
}

function printVariableDeclarator(node, path, options, print) {
	// Follow Prettier core pattern - simple concatenation for basic cases
	if (node.init) {
		return [path.call(print, 'id'), ' = ', path.call(print, 'init')];
	}

	return path.call(print, 'id');
}

function printAssignmentPattern(node, path, options, print) {
	// Handle default parameters like: count: number = 0
	return [path.call(print, 'left'), ' = ', path.call(print, 'right')];
}

function printTSTypeLiteral(node, path, options, print) {
	if (!node.members || node.members.length === 0) {
		return '{}';
	}

	const members = path.map(print, 'members');

	// Use AST builders for proper formatting
	return group(['{', indent(concat([line, join(concat([';', line]), members), ';'])), line, '}']);
}

function printTSPropertySignature(node, path, options, print) {
	const parts = [];
	parts.push(path.call(print, 'key'));

	if (node.optional) {
		parts.push('?');
	}

	if (node.typeAnnotation) {
		parts.push(path.call(print, 'typeAnnotation'));
	}

	return concat(parts);
}

function printTSTypeReference(node, path, options, print) {
	const parts = [path.call(print, 'typeName')];

	if (node.typeParameters) {
		parts.push('<');
		const typeArgs = path.map(print, 'typeParameters', 'params');
		for (let i = 0; i < typeArgs.length; i++) {
			if (i > 0) parts.push(', ');
			parts.push(typeArgs[i]);
		}
		parts.push('>');
	}

	return concat(parts);
}

function printElement(node, path, options, print) {
	const tagName = node.id.name;

	if (!node.attributes || node.attributes.length === 0) {
		if (node.selfClosing || !node.children || node.children.length === 0) {
			return group(['<', tagName, ' />']);
		}

		// No attributes, but has children
		const children = path.map(print, 'children');
		if (children.length === 1 && typeof children[0] === 'string' && children[0].length < 20) {
			// Single line with short content
			return group(['<', tagName, '>', children[0], '</', tagName, '>']);
		}

		// Multi-line
		return group([
			'<',
			tagName,
			'>',
			indent(concat([line, join(line, children)])),
			line,
			'</',
			tagName,
			'>',
		]);
	}

	const openingTag = group([
		'<',
		tagName,
		indent(
			group([
				...path.map((attrPath) => {
					return concat([' ', print(attrPath)]);
				}, 'attributes'),
			]),
		),
		node.selfClosing || !node.children || node.children.length === 0 ? ' />' : '>',
	]);

	if (node.selfClosing || !node.children || node.children.length === 0) {
		return openingTag;
	}

	// Has children
	const children = path.map(print, 'children');
	const closingTag = concat(['</', tagName, '>']);

	if (children.length === 1 && typeof children[0] === 'string' && children[0].length < 20) {
		// Single line
		return group([openingTag, children[0], closingTag]);
	}

	// Multi-line
	return group([openingTag, indent(concat([line, join(line, children)])), line, closingTag]);
}

function printAttribute(node, path, options, print) {
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

	return parts;
}
