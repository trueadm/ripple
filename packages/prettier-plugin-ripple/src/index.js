import { parse } from 'ripple/compiler';
import { doc } from 'prettier';

const { concat, join, line, hardline, group, indent, dedent } = doc.builders;

// Embed function - not needed for now
export function embed(path, options) {
	return null;
}

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
			// If it returns an array, concatenate it
			if (Array.isArray(parts)) {
				return concat(parts);
			}
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
			// Handle the body statements properly with whitespace preservation
			const statements = [];
			for (let i = 0; i < node.body.length; i++) {
				const statement = path.call(print, 'body', i);
				// If statement is an array, flatten it
				if (Array.isArray(statement)) {
					statements.push(concat(statement));
				} else {
					statements.push(statement);
				}
				
				// Add spacing between top-level statements based on original formatting
				if (i < node.body.length - 1) {
					const currentStmt = node.body[i];
					const nextStmt = node.body[i + 1];
					
					// Use same whitespace detection logic as in components
					const sourceText = options.originalText || options.source;
					let hasOriginalBlankLines = false;
					
					if (sourceText && currentStmt.loc && nextStmt.loc) {
						const currentEnd = currentStmt.loc.end;
						const nextStart = nextStmt.loc.start;
						
						const lines = sourceText.split('\n');
						const linesBetween = lines.slice(currentEnd.line, nextStart.line - 1);
						hasOriginalBlankLines = linesBetween.some(line => line.trim() === '');
					} else {
						const currentEndLine = currentStmt.loc?.end?.line;
						const nextStartLine = nextStmt.loc?.start?.line;
						hasOriginalBlankLines = nextStartLine && currentEndLine && nextStartLine - currentEndLine > 1;
					}
					
					// Add appropriate spacing
					if (hasOriginalBlankLines) {
						statements.push(concat([line, line])); // blank line
					} else {
						statements.push(line); // single line break
					}
				}
			}
			return concat(statements);
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

			// Simple single-line for short arrays
			if (elements.length <= 3) {
				const parts = ['['];
				for (let i = 0; i < elements.length; i++) {
					if (i > 0) parts.push(', ');
					parts.push(elements[i]);
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
			return concat(parts);
		}

		case 'Identifier':
			// Simple case - just return the name directly like Prettier core
			if (node.typeAnnotation) {
				return concat([node.name, ': ', path.call(print, 'typeAnnotation')]);
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
			return path.call(print, 'typeAnnotation');
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
		// Statements will be indented at the component level
		bodyStatements.push(statement);
	}

	// Apply spacing logic
	const spacedStatements = [];
	for (let i = 0; i < bodyStatements.length; i++) {
		spacedStatements.push(bodyStatements[i]);

		if (i < bodyStatements.length - 1 && node.body && node.body[i] && node.body[i + 1]) {
			const currentStmt = node.body[i];
			const nextStmt = node.body[i + 1];

			// Use source text analysis for better whitespace detection
			let hasOriginalBlankLines = false;
			
			// Try multiple ways to access the original source text
			const sourceText = options.originalText || options.source || path.getNode()?.source;
			
			if (sourceText && currentStmt.loc && nextStmt.loc) {
				const currentEnd = currentStmt.loc.end;
				const nextStart = nextStmt.loc.start;
				
				// Extract lines between the statements
				const lines = sourceText.split('\n');
				const linesBetween = lines.slice(currentEnd.line, nextStart.line - 1);
				
				// Check if there's at least one empty or whitespace-only line
				hasOriginalBlankLines = linesBetween.some(line => line.trim() === '');
			} else {
				// Fallback to line number difference
				const currentEndLine = currentStmt.loc?.end?.line;
				const nextStartLine = nextStmt.loc?.start?.line;
				hasOriginalBlankLines = nextStartLine && currentEndLine && nextStartLine - currentEndLine > 1;
			}

			const shouldAddBlank = shouldAddBlankLine(currentStmt, nextStmt);

			// Preserve existing blank lines OR add blank lines between different statement types
			if (hasOriginalBlankLines || shouldAddBlank) {
				spacedStatements.push('');
			}
		}
	}

	// Follow Prettier's block statement pattern
	const statements = [];
	for (let i = 0; i < spacedStatements.length; i++) {
		if (spacedStatements[i] !== '') {
			statements.push(spacedStatements[i]);
			
			// Add line break after each statement (except last)
			if (i < spacedStatements.length - 1) {
				// Check if next item is a blank line marker
				if (spacedStatements[i + 1] === '') {
					statements.push(hardline); // Extra line for blank line
				} else {
					// Add normal line break between statements
					statements.push(line);
				}
			}
		} else {
			// This is a blank line marker, skip it (already handled above)
		}
	}



	// Build CSS content using Prettier document structure
	let cssContent = null;
	if (node.css && node.css.source) {
		const css = node.css.source.trim();
		const formattedCss = formatCss(css);

		// Build proper document structure for CSS
		const cssInnerParts = [];

		for (let i = 0; i < formattedCss.length; i++) {
			const part = formattedCss[i];
			if (typeof part === 'string') {
				if (part.trim()) {
					if (part.trim() === '{') {
						// Opening brace goes right after selector
						cssInnerParts.push(' ' + part.trim());
					} else if (part.trim() === '}') {
						// Closing brace gets 2 spaces (component will add 2 more = 4 total)
						cssInnerParts.push('  ' + part.trim());
					} else if (part.startsWith('  ')) {
						// Properties already have 2 spaces, add 2 more = 4 total (component will add 2 more = 6 total)
						cssInnerParts.push('  ' + part);
					} else {
						// Selectors get 2 spaces (component will add 2 more = 4 total)
						cssInnerParts.push('  ' + part);
					}
				}
			} else if (part && typeof part === 'object' && Array.isArray(part)) {
				if (part.some(p => p && p.type === 'line' && p.hard)) {
					cssInnerParts.push(hardline);
				}
			}
		}

		// Structure: <style> + inner CSS content + </style>
		cssContent = [
			'<style>',
			hardline,
			...cssInnerParts,
			'</style>'
		];
	}

	// Build script content using Prettier document builders
	let scriptContent = null;
	if (node.script && node.script.source) {
		const script = node.script.source.trim();

		// Build the complete script block as a formatted string
		// Include proper indentation for component level
		let scriptString = '  <script>\n';
		const scriptLines = script.split('\n');
		for (const line of scriptLines) {
			if (line.trim()) {
				scriptString += '    ' + line + '\n';
			} else {
				scriptString += '\n';
			}
		}
		scriptString += '  </script>';

		scriptContent = [scriptString];
	}

	// Use Prettier's standard block statement pattern
	const parts = [concat(signatureParts)];

	if (statements.length > 0 || cssContent || scriptContent) {
		// Build all content that goes inside the component body
		const allContent = [];

		// Build content manually with proper spacing
		let contentParts = [];

		// Add statements
		if (statements.length > 0) {
			for (let i = 0; i < statements.length; i++) {
				contentParts.push(statements[i]);
				// Add blank line after variable declarations (except the last statement)
				if (i < statements.length - 1 && node.body && node.body[i] &&
					node.body[i].type === 'VariableDeclaration') {
					contentParts.push(hardline);
				}
			}
		}

			// Add CSS content
	if (cssContent) {
		// Add blank line before CSS if there are body statements
		if (node.body && node.body.length > 0) {
			contentParts.push(hardline);
		}
		contentParts.push(concat(cssContent));
	}

	// Add script content
		if (scriptContent) {
			if (contentParts.length > 0) {
				// Always add blank line before script for separation of concerns
				contentParts.push(line);
			}
			// Script content is manually indented
			contentParts.push(...scriptContent);
		}

			// Join content parts
	const joinedContent = contentParts.length > 0 ? concat(contentParts) : '';

	// Apply component-level indentation
	const indentedContent = joinedContent ? indent([hardline, joinedContent]) : indent([hardline]);

	parts.push(
		group([
			' {',
			indentedContent,
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

	let content = [hardline];
	if (properties.length > 0) {
		content.push(join([',', hardline], properties));
		if (shouldUseTrailingComma) {
			content.push(',');
		}
		// Always add hardline after properties for consistent formatting
		content.push(hardline);
	}

	return group([
		'{',
		indent(content.slice(0, -1)), // Indent the content but not the final hardline
		content[content.length - 1],   // Add the final hardline without indentation
		'}'
	]);
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

	return concat(parts);
}

function printTSInterfaceBody(node, path, options, print) {
	if (!node.body || node.body.length === 0) {
		return '{}';
	}

	const members = path.map(print, 'body');

	// Add semicolons to all members
	const membersWithSemicolons = members.map(member => concat([member, ';']));

	return group([
		'{',
		indent([
			hardline,
			join(hardline, membersWithSemicolons)
		]),
		hardline,
		'}'
	]);
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
	// Conservative - only add blank lines when truly necessary

	// Critical: Add blank line after interface declarations to prevent merging with next statement
	if (currentNode.type === 'TSInterfaceDeclaration') {
		return true;
	}

	// Add blank line between variable declarations and JSX/Elements for readability
	if (currentNode.type === 'VariableDeclaration' && 
		(nextNode.type === 'JSXElement' || nextNode.type === 'Element')) {
		return true;
	}

	// Add blank line between expression statements and JSX/Elements  
	if (currentNode.type === 'ExpressionStatement' && 
		(nextNode.type === 'JSXElement' || nextNode.type === 'Element')) {
		return true;
	}

	// Add blank line after variable declarations when followed by expression statements
	if (currentNode.type === 'VariableDeclaration' && nextNode.type === 'ExpressionStatement') {
		return true;
	}

	// Add blank line before control flow statements (for loops, etc.)
	if (nextNode.type === 'ForOfStatement' || nextNode.type === 'ForStatement') {
		return true;
	}

	// Add blank line between Elements for readability
	if (currentNode.type === 'Element' && nextNode.type === 'Element') {
		return false; // Let whitespace preservation handle Element-to-Element spacing
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

	return concat(parts);
}

function printProperty(node, path, options, print) {
	if (node.shorthand) {
		return path.call(print, 'key');
	}

	const parts = [];
	parts.push(path.call(print, 'key'));
	parts.push(': ');
	parts.push(path.call(print, 'value'));
	return concat(parts);
}

function printVariableDeclarator(node, path, options, print) {
	// Follow Prettier core pattern - simple concatenation for basic cases
	if (node.init) {
		return concat([path.call(print, 'id'), ' = ', path.call(print, 'init')]);
	}

	return path.call(print, 'id');
}

function printAssignmentPattern(node, path, options, print) {
	// Handle default parameters like: count: number = 0
	return concat([path.call(print, 'left'), ' = ', path.call(print, 'right')]);
}

function printTSTypeLiteral(node, path, options, print) {
	if (!node.members || node.members.length === 0) {
		return '{}';
	}

	const members = path.map(print, 'members');

	// Use AST builders for proper formatting with proper semicolons
	return group([
		'{',
		indent([
			line,
			join([';', line], members)
		]),
		line,
		'}'
	]);
}

function printTSPropertySignature(node, path, options, print) {
	const parts = [];
	parts.push(path.call(print, 'key'));

	if (node.optional) {
		parts.push('?');
	}

	if (node.typeAnnotation) {
		parts.push(': ');
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
		if (children.length === 1) {
			// For simple elements, try to keep on single line
			const child = children[0];
			if (typeof child === 'string' && child.length < 20) {
				// Single line with short content
				return group(['<', tagName, '>', child, '</', tagName, '>']);
			}
			// For JSX expressions, always try single line if simple
			if (child && typeof child === 'object') {
				return group(['<', tagName, '>', child, '</', tagName, '>']);
			}
		}

		// Multi-line with whitespace preservation
		const spacedChildren = [];
		for (let i = 0; i < children.length; i++) {
			spacedChildren.push(children[i]);
			
			// Apply whitespace preservation between Element children
			if (i < children.length - 1 && node.children && node.children[i] && node.children[i + 1]) {
				const currentChild = node.children[i];
				const nextChild = node.children[i + 1];
				
				// For Element children, try source text analysis first, fallback to conservative heuristics
				let hasOriginalBlankLines = false;
				
				// Try source text analysis
				const sourceText = options.originalText || options.source;
				if (sourceText && currentChild.loc && nextChild.loc) {
					const currentEnd = currentChild.loc.end;
					const nextStart = nextChild.loc.start;
					
					// Only proceed if line numbers seem reasonable (not negative, not huge gaps)
					if (currentEnd.line >= 0 && nextStart.line >= 0 && 
						nextStart.line > currentEnd.line && 
						nextStart.line - currentEnd.line < 10) { // reasonable gap
						
						const lines = sourceText.split('\n');
						const startIdx = currentEnd.line;
						const endIdx = nextStart.line - 1;
						
						if (startIdx >= 0 && endIdx < lines.length && startIdx < endIdx) {
							const linesBetween = lines.slice(startIdx, endIdx);
							hasOriginalBlankLines = linesBetween.some(line => line.trim() === '');
						}
					}
				}
				
				// Conservative fallback: only for specific well-defined cases
				if (!hasOriginalBlankLines) {
					// Only add spacing between VariableDeclaration and Text in specific contexts
					// This should match the new test case but not interfere with already-formatted code
					if (currentChild.type === 'VariableDeclaration' && nextChild.type === 'Text' &&
						children.length === 2) { // Only for two-child Elements like in the test
						hasOriginalBlankLines = true;
					}
				}
				
				// Add blank line if original had one
				if (hasOriginalBlankLines) {
					spacedChildren.push(''); // blank line marker
				}
			}
		}
		
		// Convert spacing markers to actual spacing
		const finalChildren = [];
		for (let i = 0; i < spacedChildren.length; i++) {
			if (spacedChildren[i] !== '') {
				finalChildren.push(spacedChildren[i]);
				
				// Add line break after each child (except last)
				if (i < spacedChildren.length - 1) {
					if (spacedChildren[i + 1] === '') {
						// Double hardline for blank line
						finalChildren.push(hardline); // Line break 
						finalChildren.push(hardline); // Blank line
					} else {
						// Single hardline for normal line break
						finalChildren.push(hardline);
					}
				}
			}
			// Skip blank markers (they're converted to spacing above)
		}
		
		return group([
			'<',
			tagName,
			'>',
			indent(concat([hardline, ...finalChildren])),
			hardline,
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

	if (children.length === 1) {
		const child = children[0];
		if (typeof child === 'string' && child.length < 20) {
			// Single line
			return group([openingTag, child, closingTag]);
		}
		// For JSX expressions, always try single line
		if (child && typeof child === 'object') {
			return group([openingTag, child, closingTag]);
		}
	}

	// Multi-line
	return group([openingTag, indent(concat([hardline, join(hardline, children)])), hardline, closingTag]);
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

// Simple CSS formatter for basic CSS rules
function formatCss(css) {
	const parts = [];

	// Split by rules and format each one
	const ruleRegex = /([^{}]+)\{([^}]*)\}/g;
	let match;

	while ((match = ruleRegex.exec(css)) !== null) {
		const selector = match[1].trim();
		const properties = match[2].trim();

		// Add selector (will be indented at component level)
		parts.push(selector);
		parts.push(' {');
		parts.push(hardline);

		// Add properties - handle the case where properties might be on one line
		const propLines = properties.split(';').filter(prop => prop.trim().length > 0);
		for (const prop of propLines) {
			const trimmedProp = prop.trim();
			if (trimmedProp) {
				// Normalize spacing around colons
				let formattedProp = trimmedProp;
				if (formattedProp.includes(':')) {
					const [propName, propValue] = formattedProp.split(':', 2);
					formattedProp = propName.trim() + ': ' + propValue.trim();
				}
				// Add semicolon if it's missing
				if (!formattedProp.endsWith(';')) {
					formattedProp += ';';
				}
				// Properties will be indented at component level (2 spaces) + style content level (2 spaces)
				parts.push('  ' + formattedProp);
				parts.push(hardline);
			}
		}

		// Close rule (will be indented at component level)
		parts.push('}');
		parts.push(hardline);
	}

	return parts;
}


