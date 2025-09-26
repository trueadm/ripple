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
			return parse(text);
		},

		locStart(node) {
			return node.loc.start.index;
		},

		locEnd(node) {
			return node.loc.end.index;
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
		getVisitorKeys(node) {
			const keys = Object.keys(node).filter((key) => {
				return key === 'start' || key === 'end' || key === 'loc' || key === 'metadata' || 'css'
					? false
					: typeof node[key] === 'object' && node[key] !== null;
			});

			return keys;
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

function printRippleNode(node, path, options, print, args) {
	if (!node || typeof node !== 'object') {
		return String(node || '');
	}

	const parts = [];

	const isInlineContext = args && args.isInlineContext;

	// Handle leading comments
	if (node.leadingComments) {
		for (const comment of node.leadingComments) {
			if (comment.type === 'Line') {
				parts.push('//' + comment.value);
				parts.push(hardline);
			} else if (comment.type === 'Block') {
				parts.push('/*' + comment.value + '*/');
				if (!isInlineContext) {
					parts.push(hardline);
				} else {
					parts.push(' ');
				}
			}
		}
	}

	// Handle inner comments (for nodes with no children to attach to)
	const innerCommentParts = [];
	if (node.innerComments) {
		for (const comment of node.innerComments) {
			if (comment.type === 'Line') {
				innerCommentParts.push('//' + comment.value);
			} else if (comment.type === 'Block') {
				innerCommentParts.push('/*' + comment.value + '*/');
			}
		}
	}

	let nodeContent;

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
						hasOriginalBlankLines = linesBetween.some((line) => line.trim() === '');
					} else {
						const currentEndLine = currentStmt.loc?.end?.line;
						const nextStartLine = nextStmt.loc?.start?.line;
						hasOriginalBlankLines =
							nextStartLine && currentEndLine && nextStartLine - currentEndLine > 1;
					}

					// Only add spacing when explicitly needed
					if (shouldAddBlankLine(currentStmt, nextStmt)) {
						statements.push(concat([line, line])); // blank line
					} else {
						statements.push(line); // single line break
					}
				}
			}
			nodeContent = concat(statements);
			break;
		}

		case 'ImportDeclaration':
			nodeContent = printImportDeclaration(node, path, options, print);
			break;

		case 'Component':
			nodeContent = printComponent(node, path, options, print);
			break;

		case 'ExportNamedDeclaration':
			nodeContent = printExportNamedDeclaration(node, path, options, print);
			break;

		case 'ExportDefaultDeclaration':
			nodeContent = printExportDefaultDeclaration(node, path, options, print);
			break;

		case 'FunctionDeclaration':
			nodeContent = printFunctionDeclaration(node, path, options, print);
			break;

		case 'IfStatement':
			nodeContent = printIfStatement(node, path, options, print);
			break;

		case 'ForOfStatement':
			nodeContent = printForOfStatement(node, path, options, print);
			break;

		case 'ForStatement':
			nodeContent = printForStatement(node, path, options, print);
			break;

		case 'WhileStatement':
			nodeContent = printWhileStatement(node, path, options, print);
			break;

		case 'DoWhileStatement':
			nodeContent = printDoWhileStatement(node, path, options, print);
			break;

		case 'ClassDeclaration':
			nodeContent = printClassDeclaration(node, path, options, print);
			break;

		case 'TryStatement':
			nodeContent = printTryStatement(node, path, options, print);
			break;

		case 'ArrayExpression': {
			if (!node.elements || node.elements.length === 0) {
				nodeContent = '[]';
				break;
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
				nodeContent = parts;
				break;
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
			nodeContent = parts;
			break;
		}

		case 'ObjectExpression':
			nodeContent = printObjectExpression(node, path, options, print);
			break;

		case 'ClassBody':
			nodeContent = printClassBody(node, path, options, print);
			break;

		case 'PropertyDefinition':
			nodeContent = printPropertyDefinition(node, path, options, print);
			break;

		case 'MethodDefinition':
			nodeContent = printMethodDefinition(node, path, options, print);
			break;

		case 'PrivateIdentifier':
			nodeContent = '#' + node.name;
			break;

		case 'AssignmentExpression':
			nodeContent = concat([path.call(print, 'left'), ' ', node.operator, ' ', path.call(print, 'right')]);
			break;

		case 'MemberExpression':
			nodeContent = printMemberExpression(node, path, options, print);
			break;

		case 'Super':
			nodeContent = 'super';
			break;

		case 'ThisExpression':
			nodeContent = 'this';
			break;

		case 'CallExpression': {
			const parts = [];
			parts.push(path.call(print, 'callee'));
			
			// Add TypeScript generics if present
			if (node.typeParameters) {
				parts.push(path.call(print, 'typeParameters'));
			}
			
			if (node.arguments && node.arguments.length > 0) {
				parts.push('(');

				const args = path.map((argPath) => {
					return print(argPath, { isInlineContext: true });
				}, 'arguments');

				for (let i = 0; i < args.length; i++) {
					if (i > 0) parts.push(', ');
					parts.push(args[i]);
				}
				parts.push(')');
			} else {
				parts.push('()');
			}
			
			nodeContent = concat(parts);
			break;
		}

		case 'AwaitExpression': {
			const parts = ['await ', path.call(print, 'argument')];
			nodeContent = concat(parts);
			break;
		}

		case 'UnaryExpression':
			nodeContent = printUnaryExpression(node, path, options, print);
			break;

		case 'YieldExpression':
			nodeContent = printYieldExpression(node, path, options, print);
			break;

		case 'TSAsExpression': {
			nodeContent = concat([
				path.call(print, 'expression'),
				' as ',
				path.call(print, 'typeAnnotation')
			]);
			break;
		}

		case 'NewExpression':
			nodeContent = printNewExpression(node, path, options, print);
			break;

		case 'TemplateLiteral':
			nodeContent = printTemplateLiteral(node, path, options, print);
			break;

		case 'TaggedTemplateExpression':
			nodeContent = printTaggedTemplateExpression(node, path, options, print);
			break;

		case 'ThrowStatement':
			nodeContent = printThrowStatement(node, path, options, print);
			break;

		case 'TSInterfaceDeclaration':
			nodeContent = printTSInterfaceDeclaration(node, path, options, print);
			break;

		case 'TSTypeAliasDeclaration':
			nodeContent = printTSTypeAliasDeclaration(node, path, options, print);
			break;

		case 'TSTypeParameterDeclaration':
			nodeContent = printTSTypeParameterDeclaration(node, path, options, print);
			break;

		case 'TSTypeParameter':
			nodeContent = printTSTypeParameter(node, path, options, print);
			break;

		case 'TSTypeParameterInstantiation':
			nodeContent = printTSTypeParameterInstantiation(node, path, options, print);
			break;

		case 'TSNumberKeyword':
			nodeContent = 'number';
			break;

		case 'TSBooleanKeyword':
			nodeContent = 'boolean';
			break;

		case 'TSInterfaceBody':
			nodeContent = printTSInterfaceBody(node, path, options, print);
			break;

		case 'SwitchStatement':
			nodeContent = printSwitchStatement(node, path, options, print);
			break;

		case 'SwitchCase':
			nodeContent = printSwitchCase(node, path, options, print);
			break;

		case 'BreakStatement':
			nodeContent = printBreakStatement(node, path, options, print);
			break;

		case 'ContinueStatement':
			nodeContent = printContinueStatement(node, path, options, print);
			break;

		case 'DebuggerStatement':
			nodeContent = printDebuggerStatement(node, path, options, print);
			break;

		case 'SequenceExpression':
			nodeContent = printSequenceExpression(node, path, options, print);
			break;

		case 'SpreadElement': {
			const parts = ['...', path.call(print, 'argument')];
			nodeContent = concat(parts);
			break;
		}

		case 'EmptyStatement':
			nodeContent = '';
			break;

		case 'VariableDeclaration':
			nodeContent = printVariableDeclaration(node, path, options, print);
			break;

		case 'ExpressionStatement':
			nodeContent = concat([path.call(print, 'expression'), ';']);
			break;

		case 'RefAttribute':
			nodeContent = concat(['{ref ', path.call(print, 'argument'), '}']);
			break;

		case 'SpreadAttribute': {
			const parts = ['{...', path.call(print, 'argument'), '}'];
			nodeContent = concat(parts);
			break;
		}

		case 'Identifier': {
			// Simple case - just return the name directly like Prettier core
			const trackedPrefix  = node.tracked ? "@" : "";
			if (node.typeAnnotation) {
				nodeContent = concat([trackedPrefix + node.name, ': ', path.call(print, 'typeAnnotation')]);
			} else {
				nodeContent = trackedPrefix + node.name;
			}
			break;
		}

		case 'Literal':
			nodeContent = formatStringLiteral(node.value, options);
			break;

		case 'ArrowFunctionExpression':
			nodeContent = printArrowFunction(node, path, options, print);
			break;

		case 'FunctionExpression':
			nodeContent = printFunctionExpression(node, path, options, print);
			break;

		case 'BlockStatement': {
			// Apply the same block formatting pattern as component bodies
			if (!node.body || node.body.length === 0) {
				// Handle innerComments for empty blocks
				if (innerCommentParts.length > 0) {
					nodeContent = group([
						'{',
						indent([hardline, join(hardline, innerCommentParts)]),
						hardline,
						'}',
					]);
					break;
				}
				nodeContent = '{}';
				break;
			}

			// Process statements and handle spacing using shouldAddBlankLine
			const statements = [];
			for (let i = 0; i < node.body.length; i++) {
				const statement = path.call(print, 'body', i);
				statements.push(statement);

				// Handle blank lines between statements
				if (i < node.body.length - 1) {
					const currentStmt = node.body[i];
					const nextStmt = node.body[i + 1];

					// Use shouldAddBlankLine to determine spacing
					// The nextStmt is at index i+1. It's the first statement if i+1 === 0 (impossible)
					// So in this context, nextStmt is never the first statement
					// But the rule might apply at a different level
					const isNextStatementFirst = i + 1 === 0; // This will always be false
					if (shouldAddBlankLine(currentStmt, nextStmt, isNextStatementFirst)) {
						statements.push(concat([hardline, hardline])); // Blank line = two hardlines
					} else {
						statements.push(hardline); // Normal line break
					}
				}
			}

			// Use proper block statement pattern
			nodeContent = group(['{', indent([hardline, concat(statements)]), hardline, '}']);
			break;
		}

		case 'ReturnStatement': {
			const parts = ['return'];
			if (node.argument) {
				parts.push(' ');
				parts.push(path.call(print, 'argument'));
			}
			parts.push(';');
			nodeContent = concat(parts);
			break;
		}

		case 'BinaryExpression':
			nodeContent = concat([path.call(print, 'left'), ' ', node.operator, ' ', path.call(print, 'right')]);
			break;

		case 'LogicalExpression':
			nodeContent = concat([path.call(print, 'left'), ' ', node.operator, ' ', path.call(print, 'right')]);
			break;

		case 'ConditionalExpression':
			nodeContent = concat([
				path.call(print, 'test'),
				' ? ',
				path.call(print, 'consequent'),
				' : ',
				path.call(print, 'alternate'),
			]);
			break;

		case 'UpdateExpression':
			if (node.prefix) {
				nodeContent = concat([node.operator, path.call(print, 'argument')]);
			} else {
				nodeContent = concat([path.call(print, 'argument'), node.operator]);
			}
			break;

		case 'TSArrayType': {
			const parts = [path.call(print, 'elementType'), '[]'];
			nodeContent = concat(parts);
			break;
		}

		case 'TSNumberKeyword':
			nodeContent = 'number';
			break;

		case 'MemberExpression':
			nodeContent = printMemberExpression(node, path, options, print);
			break;

		case 'ObjectPattern':
			nodeContent = printObjectPattern(node, path, options, print);
			break;

		case 'ArrayPattern':
			nodeContent = printArrayPattern(node, path, options, print);
			break;

		case 'Property':
			nodeContent = printProperty(node, path, options, print);
			break;

		case 'VariableDeclarator':
			nodeContent = printVariableDeclarator(node, path, options, print);
			break;

		case 'AssignmentPattern':
			nodeContent = printAssignmentPattern(node, path, options, print);
			break;

		case 'TSTypeAnnotation': {
			nodeContent = path.call(print, 'typeAnnotation');
			break;
		}

		case 'TSTypeLiteral':
			nodeContent = printTSTypeLiteral(node, path, options, print);
			break;

		case 'TSPropertySignature':
			nodeContent = printTSPropertySignature(node, path, options, print);
			break;

		case 'TSStringKeyword':
			nodeContent = 'string';
			break;

		case 'TSNumberKeyword':
			nodeContent = 'number';
			break;

		case 'TSNullKeyword':
			nodeContent = 'null';
			break;

		case 'TSUnknownKeyword':
			nodeContent = 'unknown';
			break;

		case 'TSLiteralType':
			nodeContent = path.call(print, 'literal');
			break;

		case 'TSUnionType': {
			const types = path.map(print, 'types');
			nodeContent = join(' | ', types);
			break;
		}

		case 'TSTypeReference':
			nodeContent = printTSTypeReference(node, path, options, print);
			break;

		case 'Element':
			nodeContent = printElement(node, path, options, print);
			break;

		case 'StyleSheet':
			nodeContent = printStyleSheet(node, path, options, print);
			break;

		case 'Rule':
			nodeContent = printCSSRule(node, path, options, print);
			break;

		case 'Declaration':
			nodeContent = printCSSDeclaration(node, path, options, print);
			break;

		case 'Atrule':
			nodeContent = printCSSAtrule(node, path, options, print);
			break;

		case 'SelectorList':
			nodeContent = printCSSSelectorList(node, path, options, print);
			break;

		case 'ComplexSelector':
			nodeContent = printCSSComplexSelector(node, path, options, print);
			break;

		case 'RelativeSelector':
			nodeContent = printCSSRelativeSelector(node, path, options, print);
			break;

		case 'TypeSelector':
			nodeContent = printCSSTypeSelector(node, path, options, print);
			break;

		case 'IdSelector':
			nodeContent = printCSSIdSelector(node, path, options, print);
			break;

		case 'ClassSelector':
			nodeContent = printCSSClassSelector(node, path, options, print);
			break;

		case 'Block':
			nodeContent = printCSSBlock(node, path, options, print);
			break;

		case 'Attribute':
			nodeContent = printAttribute(node, path, options, print);
			break;

		case 'Text': {
			const parts = ['{', path.call(print, 'expression'), '}'];
			nodeContent = concat(parts);
			break;
		}

		default:
			// Fallback for unknown node types
			console.warn('Unknown node type:', node.type);
			nodeContent = '/* Unknown: ' + node.type + ' */';
			break;
	}

	// Handle trailing comments
	if (node.trailingComments) {
		const trailingParts = [];
		for (const comment of node.trailingComments) {
			if (comment.type === 'Line') {
				trailingParts.push(' //' + comment.value);
			} else if (comment.type === 'Block') {
				trailingParts.push(' /*' + comment.value + '*/');
			}
		}
		if (trailingParts.length > 0) {
			parts.push(nodeContent);
			parts.push(...trailingParts);
			return concat(parts);
		}
	}

	// Return with or without leading comments
	if (parts.length > 0) {
		parts.push(nodeContent);
		return concat(parts);
	}

	return nodeContent;
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

	// Build body content using the same pattern as BlockStatement
	const statements = [];
	for (let i = 0; i < node.body.length; i++) {
		const statement = path.call(print, 'body', i);
		statements.push(statement);

		// Handle blank lines between statements
		if (i < node.body.length - 1) {
			const currentStmt = node.body[i];
			const nextStmt = node.body[i + 1];

			// Use shouldAddBlankLine to determine spacing
			if (shouldAddBlankLine(currentStmt, nextStmt, false)) {
				statements.push(concat([hardline, hardline])); // Blank line = two hardlines
			} else {
				statements.push(hardline); // Normal line break
			}
		}
	}

	// Process statements to add them to contentParts
	const contentParts = [];
	if (statements.length > 0) {
		contentParts.push(concat(statements));
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

	if (statements.length > 0 || scriptContent) {
		// Build all content that goes inside the component body
		const allContent = [];

		// Build content manually with proper spacing
		let contentParts = [];

		// Add statements
		if (statements.length > 0) {
			// The statements array contains statements separated by line breaks
			// We need to use join to properly handle the line breaks
			contentParts.push(concat(statements));
		}

		// Add script content
		if (scriptContent) {
			if (contentParts.length > 0) {
				// Always add blank line before script for separation of concerns
				contentParts.push(hardline);
			}
			// Script content is manually indented
			contentParts.push(...scriptContent);
		}

		// Join content parts
		const joinedContent = contentParts.length > 0 ? concat(contentParts) : '';

		// Apply component-level indentation
		const indentedContent = joinedContent ? indent([hardline, joinedContent]) : indent([hardline]);

		parts.push(group([' {', indentedContent, hardline, '}']));
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
	const declarationParts = join(', ', declarations);

	if (!hasForLoopParent) {
		return concat([kind, ' ', declarationParts, ';']);
	}

	return concat([kind, ' ', declarationParts]);
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
		parts.push(': ', path.call(print, 'returnType'));
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

	// Return array of parts
	const parts = [];

	// Handle single parameter without parentheses (only for simple identifiers without types)
	if (
		node.params.length === 1 &&
		node.params[0].type === 'Identifier' &&
		!node.params[0].typeAnnotation
	) {
		parts.push(...paramParts);
	} else {
		parts.push('(');
		parts.push(...paramParts);
		parts.push(')');
	}

	parts.push(' => ');

	// For block statements, print the body directly to get proper formatting
	if (node.body.type === 'BlockStatement') {
		parts.push(path.call(print, 'body'));
	} else {
		// For expression bodies, print normally
		parts.push(path.call(print, 'body'));
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
		parts.push(': ', path.call(print, 'returnType'));
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
	
	// Handle Ripple-specific index syntax
	if (node.index) {
		parts.push('; index ');
		parts.push(path.call(print, 'index'));
	}
	
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
		content[content.length - 1], // Add the final hardline without indentation
		'}',
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

	if (node.async) {
		parts.push(' async ');
		parts.push(path.call(print, 'async'));
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
		parts.push(': ');
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
		parts.push(': ', path.call(print, 'value', 'returnType'));
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
		return concat([objectPart, '[', propertyPart, ']']);
	} else {
		return concat([objectPart, '.', propertyPart]);
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

	return concat(parts);
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
	const membersWithSemicolons = members.map((member) => concat([member, ';']));

	return group(['{', indent([hardline, join(hardline, membersWithSemicolons)]), hardline, '}']);
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

function printTSTypeParameterInstantiation(node, path, options, print) {
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
	return concat(parts);
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

function printDebuggerStatement(node, path, options, print) {
	return 'debugger;';
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

function getWhitespaceLinesBetween(currentNode, nextNode) {
	// Return the number of blank lines between two nodes based on their location
	if (
		currentNode.loc &&
		nextNode?.loc &&
		typeof currentNode.loc.end?.line === 'number' &&
		typeof nextNode.loc.start?.line === 'number'
	) {
		const lineGap = nextNode.loc.start.line - currentNode.loc.end.line;
		const blankLines = Math.max(0, lineGap - 1);
		// lineGap = 1 means adjacent lines (no blank lines)
		// lineGap = 2 means one blank line between them
		// lineGap = 3 means two blank lines between them, etc.
		return blankLines;
	}

	// If no location info, assume no whitespace
	return 0;
}

function shouldAddBlankLine(currentNode, nextNode, isFirstStatement = false) {
	// First check if there was original whitespace between the nodes
	const originalBlankLines = getWhitespaceLinesBetween(currentNode, nextNode);

	// If there were any blank lines in the original, preserve one blank line
	if (originalBlankLines > 0) {
		return true;
	}

	// If there were no blank lines originally (originalBlankLines === 0),
	// then apply our formatting rules to decide whether to add one

	// Always add blank line before return statements (unless it's the first statement in a block)
	if (nextNode.type === 'ReturnStatement' && !isFirstStatement) {
		return true;
	}

	// Add blank line before style elements
	if (nextNode.type === 'Element') {
		if (nextNode.id && nextNode.id.type === 'Identifier' && nextNode.id.name === 'style') {
			return true;
		}
	}

	// Add blank line after variable declarations when followed by elements or control flow statements
	if (currentNode.type === 'VariableDeclaration') {
		if (
			nextNode.type === 'Element' ||
			nextNode.type === 'IfStatement' ||
			nextNode.type === 'TryStatement' ||
			nextNode.type === 'ForStatement' ||
			nextNode.type === 'ForOfStatement' ||
			nextNode.type === 'WhileStatement'
		) {
			return true;
		}
	}

	// Add blank line after TypeScript declarations when followed by other statements (not just elements)
	if (
		currentNode.type === 'TSInterfaceDeclaration' ||
		currentNode.type === 'TSTypeAliasDeclaration'
	) {
		// Add blank line before elements, control flow, variable declarations, and expression statements
		if (
			nextNode.type === 'Element' ||
			nextNode.type === 'IfStatement' ||
			nextNode.type === 'TryStatement' ||
			nextNode.type === 'ForStatement' ||
			nextNode.type === 'ForOfStatement' ||
			nextNode.type === 'WhileStatement' ||
			nextNode.type === 'VariableDeclaration' ||
			nextNode.type === 'ExpressionStatement'
		) {
			return true;
		}
	}

	// Add blank line after if/for/try statements if next is an element
	if (
		currentNode.type === 'IfStatement' ||
		currentNode.type === 'ForStatement' ||
		currentNode.type === 'ForOfStatement' ||
		currentNode.type === 'TryStatement' ||
		currentNode.type === 'WhileStatement'
	) {
		if (nextNode.type === 'Element') {
			return true;
		}
	}

	// Add blank line before elements when preceded by non-element statements
	if (nextNode.type === 'Element') {
		if (
			currentNode.type === 'VariableDeclaration' ||
			currentNode.type === 'ExpressionStatement' ||
			currentNode.type === 'TSInterfaceDeclaration' ||
			currentNode.type === 'TSTypeAliasDeclaration'
		) {
			return true;
		}
	}

	// Fallback: don't add blank lines by default
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
		parts.push(': ');
		parts.push(path.call(print, 'typeAnnotation'));
	}

	return concat(parts);
}

function printArrayPattern(node, path, options, print) {
	const parts = [];
	parts.push('[ ');
	const elementList = path.map(print, 'elements');
	for (let i = 0; i < elementList.length; i++) {
		if (i > 0) parts.push(', ');
		parts.push(elementList[i]);
	}
	parts.push(' ]');

	if (node.typeAnnotation) {
		parts.push(': ');
		parts.push(path.call(print, 'typeAnnotation'));
	}

	return concat(parts);
}

function printProperty(node, path, options, print) {
	if (node.shorthand) {
		// For shorthand properties, if value is AssignmentPattern, print the value (which includes the default)
		// Otherwise just print the key
		if (node.value.type === 'AssignmentPattern') {
			return path.call(print, 'value');
		}
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
	return group(['{', indent([line, join([';', line], members)]), line, '}']);
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

function printStyleSheet(node, path, options, print) {
	// StyleSheet contains CSS rules in the 'body' property
	if (node.body && node.body.length > 0) {
		const cssItems = [];

		// Process each item in the stylesheet body
		for (let i = 0; i < node.body.length; i++) {
			const item = path.call(print, 'body', i);
			if (item) {
				cssItems.push(item);
			}
		}

		// Structure the CSS with proper indentation and spacing
		// CSS rules need exactly 3 more spaces beyond the <style> element's indentation
		return concat([
			hardline,
			indent([
				'  ', // 2 spaces (indent gives 3, we need 5 total = +2)
				join(concat([hardline, '  ']), cssItems), // 2 spaces for all CSS lines
			]),
			hardline,
		]);
	}

	// If no body, return empty string
	return '';
}

function printCSSRule(node, path, options, print) {
	// CSS Rule has prelude (selector) and block (declarations)
	const selector = path.call(print, 'prelude');
	const block = path.call(print, 'block');

	return group([selector, ' {', indent([hardline, block]), hardline, '}']);
}

function printCSSDeclaration(node, path, options, print) {
	// CSS Declaration has property and value
	const parts = [node.property];

	if (node.value) {
		parts.push(': ');
		const value = path.call(print, 'value');
		parts.push(value);
	}

	parts.push(';');
	return concat(parts);
}

function printCSSAtrule(node, path, options, print) {
	// CSS At-rule like @media, @keyframes, etc.
	const parts = ['@', node.name];

	if (node.prelude) {
		parts.push(' ');
		const prelude = path.call(print, 'prelude');
		parts.push(prelude);
	}

	if (node.block) {
		const block = path.call(print, 'block');
		parts.push(' {');
		parts.push(indent([hardline, block]));
		parts.push(hardline, '}');
	} else {
		parts.push(';');
	}

	return group(parts);
}

function printCSSSelectorList(node, path, options, print) {
	// SelectorList contains multiple selectors
	if (node.children && node.children.length > 0) {
		const selectors = [];
		for (let i = 0; i < node.children.length; i++) {
			const selector = path.call(print, 'children', i);
			selectors.push(selector);
		}
		return join(', ', selectors);
	}
	return '';
}

function printCSSComplexSelector(node, path, options, print) {
	// ComplexSelector contains selector components
	if (node.children && node.children.length > 0) {
		const selectorParts = [];
		for (let i = 0; i < node.children.length; i++) {
			const part = path.call(print, 'children', i);
			selectorParts.push(part);
		}
		return concat(selectorParts);
	}
	return '';
}

function printCSSRelativeSelector(node, path, options, print) {
	// RelativeSelector contains selector components in the 'selectors' property
	if (node.selectors && node.selectors.length > 0) {
		const selectorParts = [];
		for (let i = 0; i < node.selectors.length; i++) {
			const part = path.call(print, 'selectors', i);
			selectorParts.push(part);
		}
		return concat(selectorParts);
	}
	return '';
}

function printCSSTypeSelector(node, path, options, print) {
	// TypeSelector for element names like 'div', 'body', 'p', etc.
	return node.name || '';
}

function printCSSIdSelector(node, path, options, print) {
	// IdSelector for #id
	return concat(['#', node.name || '']);
}

function printCSSClassSelector(node, path, options, print) {
	// ClassSelector for .class
	return concat(['.', node.name || '']);
}

function printCSSBlock(node, path, options, print) {
	// CSS Block contains declarations
	if (node.children && node.children.length > 0) {
		const declarations = [];
		for (let i = 0; i < node.children.length; i++) {
			const decl = path.call(print, 'children', i);
			if (decl) {
				declarations.push(decl);
			}
		}
		return join(hardline, declarations);
	}
	return '';
}

function printElement(node, path, options, print) {
	const tagName = node.id.name;

	if (!node.attributes || node.attributes.length === 0) {
		if (node.selfClosing || !node.children || node.children.length === 0) {
			return group(['<', tagName, ' />']);
		}

		// No attributes, but has children - use unified children processing
		// Build children with whitespace preservation
		const finalChildren = [];

		// Iterate over the original AST children to analyze whitespace
		for (let i = 0; i < node.children.length; i++) {
			const currentChild = node.children[i];
			const nextChild = node.children[i + 1]; // Can be undefined for last child

			// Print the current child
			const printedChild = path.call(print, 'children', i);
			finalChildren.push(printedChild);

			// Only add spacing if this is not the last child
			if (nextChild) {
				const whitespaceLinesCount = getWhitespaceLinesBetween(currentChild, nextChild);

				// Add blank line if there was original whitespace (> 0 lines) or if formatting rules require it
				if (whitespaceLinesCount > 0 || shouldAddBlankLine(currentChild, nextChild, false)) {
					// Double hardline for blank line
					finalChildren.push(hardline); // Line break
					finalChildren.push(hardline); // Blank line
				} else {
					// Single hardline for normal line break
					finalChildren.push(hardline);
				}
			}
		}

		// For single simple children, try to keep on one line
		if (finalChildren.length === 1) {
			const child = finalChildren[0];
			if (typeof child === 'string' && child.length < 20) {
				// Single line with short content
				return group(['<', tagName, '>', child, '</', tagName, '>']);
			}
			// For JSX expressions, always try single line if simple
			if (child && typeof child === 'object') {
				return group(['<', tagName, '>', child, '</', tagName, '>']);
			}
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

	// Has children - use unified children processing
	// Build children with whitespace preservation
	const finalChildren = [];

	// Iterate over the original AST children to analyze whitespace
	for (let i = 0; i < node.children.length; i++) {
		const currentChild = node.children[i];
		const nextChild = node.children[i + 1]; // Can be undefined for last child

		// Print the current child
		const printedChild = path.call(print, 'children', i);
		finalChildren.push(printedChild);

		// Only add spacing if this is not the last child
		if (nextChild) {
			const whitespaceLinesCount = getWhitespaceLinesBetween(currentChild, nextChild);

			// Add blank line if there was original whitespace (> 0 lines) or if formatting rules require it
			if (whitespaceLinesCount > 0 || shouldAddBlankLine(currentChild, nextChild, false)) {
				// Double hardline for blank line
				finalChildren.push(hardline); // Line break
				finalChildren.push(hardline); // Blank line
			} else {
				// Single hardline for normal line break
				finalChildren.push(hardline);
			}
		}
	}

	const closingTag = concat(['</', tagName, '>']);

	// For single simple children, try to keep on one line
	if (finalChildren.length === 1) {
		const child = finalChildren[0];
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
	return group([openingTag, indent(concat([hardline, ...finalChildren])), hardline, closingTag]);
}

function printAttribute(node, path, options, print) {
	const parts = [];
	parts.push(node.name.name);

	if (node.value) {
		if (node.value.type === 'Literal' && typeof node.value.value === 'string') {
			// String literals don't need curly braces
			parts.push('=');
			parts.push(formatStringLiteral(node.value.value, options));
		} else {
			// All other values need curly braces: numbers, booleans, null, expressions, etc.
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
		const propLines = properties.split(';').filter((prop) => prop.trim().length > 0);
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
