import { parse } from 'ripple/compiler';
import { doc } from 'prettier';

const { concat, join, line, softline, hardline, group, indent, dedent, ifBreak } = doc.builders;

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
			return ast;
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

// Helper function to add semicolons based on options.semi setting
function semi(options) {
	return options.semi !== false ? ';' : '';
}

function hasBlankLineBeforeComment(comment, options) {
	if (!comment || !options || typeof comment.start !== 'number' || !options.originalText) {
		return false;
	}

	const text = options.originalText;
	let index = comment.start - 1;
	let newlineCount = 0;

	while (index >= 0) {
		const char = text[index];
		if (char === '\n') {
			newlineCount++;
			if (newlineCount >= 2) {
				return true;
			}
		} else if (char === '\r') {
			// Ignore carriage returns, handle \r\n gracefully
		} else if (char === ' ' || char === '\t') {
			// continue scanning backwards through whitespace
		} else {
			break;
		}

		index--;
	}

	return false;
}

function wasOriginallySingleLine(node, options) {
	if (!node || !node.loc || !node.loc.start || !node.loc.end) {
		return false;
	}

	if (node.loc.start.line !== node.loc.end.line) {
		return false;
	}

	if (
		options &&
		options.originalText &&
		typeof node.loc.start.index === 'number' &&
		typeof node.loc.end.index === 'number'
	) {
		const snippet = options.originalText.slice(node.loc.start.index, node.loc.end.index);
		if (/\n/.test(snippet)) {
			return false;
		}
	}

	return true;
}

function isSingleLineObjectExpression(node, options) {
	if (!node || node.type !== 'ObjectExpression') {
		return false;
	}

	return wasOriginallySingleLine(node, options);
}

function printRippleNode(node, path, options, print, args) {
	if (!node || typeof node !== 'object') {
		return String(node || '');
	}

	const parts = [];

	const isInlineContext = args && args.isInlineContext;

	// Handle leading comments
	if (node.leadingComments) {
		for (let i = 0; i < node.leadingComments.length; i++) {
			const comment = node.leadingComments[i];
			const nextComment = node.leadingComments[i + 1];
			const isLastComment = i === node.leadingComments.length - 1;

			if (comment.type === 'Line') {
				parts.push('//' + comment.value);
				parts.push(hardline);

				// Check if there should be blank lines between this comment and the next
				if (nextComment) {
					const blankLinesBetween = getWhitespaceLinesBetween(comment, nextComment);
					if (blankLinesBetween > 0) {
						parts.push(hardline);
					}
				} else if (isLastComment) {
					// Preserve a blank line between the last comment and the node when it existed in source,
					// unless the comment was already visually separated from previous code by a blank line.
					const blankLinesBetween = getWhitespaceLinesBetween(comment, node);
					if (blankLinesBetween > 0 && !hasBlankLineBeforeComment(comment, options)) {
						parts.push(hardline);
					}
				}
			} else if (comment.type === 'Block') {
				parts.push('/*' + comment.value + '*/');
				if (!isInlineContext) {
					parts.push(hardline);

					// Check if there should be blank lines between this comment and the next
					if (nextComment) {
						const blankLinesBetween = getWhitespaceLinesBetween(comment, nextComment);
						if (blankLinesBetween > 0) {
							parts.push(hardline);
						}
					} else if (isLastComment) {
						// Preserve a blank line between the last comment and the node when it existed in source,
						// unless the comment was already visually separated from previous code by a blank line.
						const blankLinesBetween = getWhitespaceLinesBetween(comment, node);
						if (blankLinesBetween > 0 && !hasBlankLineBeforeComment(comment, options)) {
							parts.push(hardline);
						}
					}
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

					// Only add spacing when explicitly needed
					if (shouldAddBlankLine(currentStmt, nextStmt)) {
						statements.push(concat([line, line])); // blank line
					} else {
						statements.push(line); // single line break
					}
				}
			}

			// Prettier always adds a trailing newline to files
			// Add it unless the code is completely empty
			if (statements.length > 0) {
				nodeContent = concat([...statements, hardline]);
			} else {
				nodeContent = concat(statements);
			}
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

		case 'ArrayExpression':
		case 'TrackedArrayExpression': {
			const prefix = node.type === 'TrackedArrayExpression' ? '#' : '';

			if (!node.elements || node.elements.length === 0) {
				nodeContent = prefix + '[]';
				break;
			}

			// Check if any element is an object expression
			let hasObjectElements = false;
			for (let i = 0; i < node.elements.length; i++) {
				const element = node.elements[i];
				if (element && element.type === 'ObjectExpression') {
					hasObjectElements = true;
					break;
				}
			}
			let shouldInlineObjects = false;

			// Check if this array is inside an attribute
			const isInAttribute = args && args.isInAttribute;

			// For arrays of simple objects with only a few properties, try to keep compact
			if (hasObjectElements) {
				shouldInlineObjects = true;
				for (let i = 0; i < node.elements.length; i++) {
					const element = node.elements[i];
					if (element && element.type === 'ObjectExpression') {
						if (!isSingleLineObjectExpression(element, options)) {
							shouldInlineObjects = false;
							break;
						}
					}
				}
			}

			// Default printing - pass isInArray or isInAttribute context
			const arrayWasSingleLine = wasOriginallySingleLine(node, options);
			const shouldUseTrailingComma = options.trailingComma !== 'none';
			const elements = path.map(
				/**
				 * @param {any} elPath
				 * @param {number} index
				 */
				(elPath, index) => {
					const childNode = node.elements[index];
					if (isInAttribute) {
						return print(elPath, { isInAttribute: true });
					}

					if (
						hasObjectElements &&
						childNode &&
						childNode.type === 'ObjectExpression' &&
						shouldInlineObjects
					) {
						return print(elPath, { isInArray: true, allowInlineObject: true });
					}

					return print(elPath, { isInArray: hasObjectElements });
				}
			, 'elements');

			if (hasObjectElements && shouldInlineObjects && arrayWasSingleLine) {
				const separator = concat([',', line]);
				const trailing = shouldUseTrailingComma ? ifBreak(',', '') : '';
				nodeContent = group(concat([
					prefix + '[',
					indent(concat([softline, join(separator, elements), trailing])),
					softline,
					']',
				]));
				break;
			}

			// Simple single-line for short arrays without object elements
			if (elements.length <= 3 && !hasObjectElements) {
				const parts = [prefix + '['];
				for (let i = 0; i < elements.length; i++) {
					if (i > 0) parts.push(', ');
					parts.push(elements[i]);
				}
				parts.push(']');
				nodeContent = parts;
				break;
			}

			// Multi-line for longer arrays or complex arrays with objects
			const parts = [prefix + '['];
			const contentParts = [];

			for (let i = 0; i < elements.length; i++) {
				if (i > 0) {
					contentParts.push(',');
					contentParts.push(hardline);
				}
				contentParts.push(elements[i]);
			}

			if (shouldUseTrailingComma) {
				contentParts.push(',');
			}

			parts.push(indent([hardline, concat(contentParts)]));
			parts.push(hardline);
			parts.push(']');
			nodeContent = group(parts);
			break;
		}

		case 'ObjectExpression':
			nodeContent = printObjectExpression(node, path, options, print, args);
			break;

		case 'TrackedObjectExpression':
			nodeContent = printTrackedObjectExpression(node, path, options, print, args);
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

		case 'ChainExpression':
			nodeContent = path.call(print, 'expression');
			break;

		case 'CallExpression': {
			const parts = [];
			parts.push(path.call(print, 'callee'));

			if (node.optional) {
				parts.push('?.');
			}

			// Add TypeScript generics if present
			if (node.typeArguments) {
				parts.push(path.call(print, 'typeArguments'));
			} else if (node.typeParameters) {
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

		case 'TrackedExpression': {
			const parts = ['@(', path.call(print, 'argument'), ')'];
			nodeContent = concat(parts);
			break;
		}

		case 'TrackedMapExpression': {
			// Format: #Map(arg1, arg2, ...)
			if (!node.arguments || node.arguments.length === 0) {
				nodeContent = '#Map()';
			} else {
				const args = path.map(print, 'arguments');
				nodeContent = concat(['#Map(', join(concat([',', line]), args), ')']);
			}
			break;
		}

		case 'TrackedSetExpression': {
			// Format: #Set(arg1, arg2, ...)
			if (!node.arguments || node.arguments.length === 0) {
				nodeContent = '#Set()';
			} else {
				const args = path.map(print, 'arguments');
				nodeContent = concat(['#Set(', join(concat([',', line]), args), ')']);
			}
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

		case 'TSSymbolKeyword':
			nodeContent = 'symbol';
			break;

		case 'TSAnyKeyword':
			nodeContent = 'any';
			break;

		case 'TSUnknownKeyword':
			nodeContent = 'unknown';
			break;

		case 'TSNeverKeyword':
			nodeContent = 'never';
			break;

		case 'TSVoidKeyword':
			nodeContent = 'void';
			break;

		case 'TSUndefinedKeyword':
			nodeContent = 'undefined';
			break;

		case 'TSNullKeyword':
			nodeContent = 'null';
			break;

		case 'TSNumberKeyword':
			nodeContent = 'number';
			break;

		case 'TSBigIntKeyword':
			nodeContent = 'bigint';
			break;

		case 'TSObjectKeyword':
			nodeContent = 'object';
			break

		case 'TSBooleanKeyword':
			nodeContent = 'boolean';
			break;

		case 'TSStringKeyword':
			nodeContent = 'string';
			break;

		case 'EmptyStatement':
			nodeContent = '';
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
		case 'RestElement': {
			const parts = ['...', path.call(print, 'argument')];
			nodeContent = concat(parts);
			break;
		}
		case 'VariableDeclaration':
			nodeContent = printVariableDeclaration(node, path, options, print);
			break;

	case 'ExpressionStatement':
		nodeContent = concat([path.call(print, 'expression'), semi(options)]);
		break;		case 'RefAttribute':
			nodeContent = concat(['{ref ', path.call(print, 'argument'), '}']);
			break;

		case 'SpreadAttribute': {
			const parts = ['{...', path.call(print, 'argument'), '}'];
			nodeContent = concat(parts);
			break;
		}

		case 'Identifier': {
			// Simple case - just return the name directly like Prettier core
			const trackedPrefix = node.tracked ? "@" : "";
			if (node.typeAnnotation) {
				nodeContent = concat([trackedPrefix + node.name, ': ', path.call(print, 'typeAnnotation')]);
			} else {
				nodeContent = trackedPrefix + node.name;
			}
			break;
		}

		case 'Literal':
			// Handle regex literals specially
			if (node.regex) {
				// Regex literal: use the raw representation
				nodeContent = node.raw || `/${node.regex.pattern}/${node.regex.flags}`;
			} else {
				// String, number, boolean, or null literal
				nodeContent = formatStringLiteral(node.value, options);
			}
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

					if (shouldAddBlankLine(currentStmt, nextStmt)) {
						statements.push(hardline, hardline); // Blank line = two hardlines
					} else {
						statements.push(hardline); // Normal line break
					}
				}
			}

			// Use proper block statement pattern
			nodeContent = group(['{', indent([hardline, concat(statements)]), hardline, '}']);
			break;
		}

		case 'ServerBlock': {
			const blockContent = path.call(print, 'body');
			nodeContent = concat(['#server ', blockContent]);
			break;
		}

		case 'ReturnStatement': {
			const parts = ['return'];
			if (node.argument) {
				parts.push(' ');
				parts.push(path.call(print, 'argument'));
			}
			parts.push(semi(options));
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

		case 'TSLiteralType':
			nodeContent = path.call(print, 'literal');
			break;

		case 'TSUnionType': {
			const types = path.map(print, 'types');
			nodeContent = join(' | ', types);
			break;
		}

		case 'TSIntersectionType': {
			const types = path.map(print, 'types');
			nodeContent = join(' & ', types);
			break;
		}

		case 'TSTypeReference':
			nodeContent = printTSTypeReference(node, path, options, print);
			break;

		case 'TSTypeOperator': {
			const operator = node.operator;
			const type = path.call(print, 'typeAnnotation');
			nodeContent = `${operator} ${type}`;
			break;
		}

		case 'TSTypeQuery': {
			const expr = path.call(print, 'exprName');
			nodeContent = concat(['typeof ', expr]);
			break;
		}

		case 'TSFunctionType': {
			const parts = [];

			// Handle parameters
			parts.push('(');
			if (node.parameters && node.parameters.length > 0) {
				const params = path.map(print, 'parameters');
				for (let i = 0; i < params.length; i++) {
					if (i > 0) parts.push(', ');
					parts.push(params[i]);
				}
			}
			parts.push(')');

			// Handle return type
			parts.push(' => ');
			if (node.returnType) {
				parts.push(path.call(print, 'returnType'));
			} else if (node.typeAnnotation) {
				parts.push(path.call(print, 'typeAnnotation'));
			}

			nodeContent = concat(parts);
			break;
		}

		case 'TSTupleType':
			nodeContent = printTSTupleType(node, path, options, print);
			break;

		case 'TSIndexSignature':
			nodeContent = printTSIndexSignature(node, path, options, print);
			break;

		case 'TSConstructorType':
			nodeContent = printTSConstructorType(node, path, options, print);
			break;

		case 'TSConditionalType':
			nodeContent = printTSConditionalType(node, path, options, print);
			break;

		case 'TSMappedType':
			nodeContent = printTSMappedType(node, path, options, print);
			break;

		case 'TSQualifiedName':
			nodeContent = printTSQualifiedName(node, path, options, print);
			break;

		case 'TSIndexedAccessType':
			nodeContent = printTSIndexedAccessType(node, path, options, print);
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

		case 'Html': {
			const parts = ['{html ', path.call(print, 'expression'), '}'];
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
		for (let i = 0; i < node.trailingComments.length; i++) {
			const comment = node.trailingComments[i];
			const nextComment = node.trailingComments[i + 1];

			// Check if this is an inline comment (on the same line as the node)
			// Use loc information to determine if comment is on same line
			let isInlineComment = false;
			if (node.loc && comment.loc) {
				isInlineComment = node.loc.end.line === comment.loc.start.line;
			} if (comment.type === 'Line') {
				if (isInlineComment) {
					// Inline comment - keep on same line with space
					trailingParts.push(' //' + comment.value);
				} else {
					// Block comment - put on new line
					trailingParts.push(hardline);

					// Check if there should be a blank line between the node and the first comment
					if (i === 0) {
						const blankLinesBetween = getWhitespaceLinesBetween(node, comment);
						if (blankLinesBetween > 0) {
							trailingParts.push(hardline);
						}
					}

					trailingParts.push('//' + comment.value);

					// Check if there should be blank lines between this comment and the next
					if (nextComment) {
						const blankLinesBetween = getWhitespaceLinesBetween(comment, nextComment);
						if (blankLinesBetween > 0) {
							trailingParts.push(hardline);
						}
					}
				}
			} else if (comment.type === 'Block') {
				if (isInlineComment) {
					// Inline comment - keep on same line with space
					trailingParts.push(' /*' + comment.value + '*/');
				} else {
					// Block comment - put on new line
					trailingParts.push(hardline);

					// Check if there should be a blank line between the node and the first comment
					if (i === 0) {
						const blankLinesBetween = getWhitespaceLinesBetween(node, comment);
						if (blankLinesBetween > 0) {
							trailingParts.push(hardline);
						}
					}

					trailingParts.push('/*' + comment.value + '*/');

					// Check if there should be blank lines between this comment and the next
					if (nextComment) {
						const blankLinesBetween = getWhitespaceLinesBetween(comment, nextComment);
						if (blankLinesBetween > 0) {
							trailingParts.push(hardline);
						}
					}
				}
			}
		}
		if (trailingParts.length > 0) {
			parts.push(nodeContent);
			parts.push(...trailingParts);
			return concat(parts);
		}
	}	// Return with or without leading comments
	if (parts.length > 0) {
		// Don't add blank line between leading comments and node
		// because they're meant to be attached together
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
				// Handle inline type imports: import { type Component } from 'ripple'
				const typePrefix = spec.importKind === 'type' ? 'type ' : '';
				const importName =
					spec.imported.name === spec.local.name
						? typePrefix + spec.local.name
						: typePrefix + spec.imported.name + ' as ' + spec.local.name;
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

	parts.push(' ' + formatStringLiteral(node.source.value, options) + semi(options));

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
		parts.push(semi(options));

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
		const paramList = path.map(print, 'params');

		// Use Prettier doc builders to allow proper line breaking based on printWidth
		const params = [];
		for (let i = 0; i < paramList.length; i++) {
			if (i > 0) {
				params.push(',');
				params.push(line);
			}
			if (Array.isArray(paramList[i])) {
				params.push(...paramList[i]);
			} else {
				params.push(paramList[i]);
			}
		}

		// Use group to allow Prettier to decide whether to break or not
		// For ObjectPattern, the opening ( goes before the {
		signatureParts.push('(');
		signatureParts.push(group(concat(params)));
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
			if (shouldAddBlankLine(currentStmt, nextStmt)) {
				statements.push(hardline, hardline); // Blank line = two hardlines
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
		return concat([kind, ' ', declarationParts, semi(options)]);
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

	if (
		options.arrowParens !== 'always' &&
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
		// For expression bodies, check if we need to wrap in parens
		// Wrap ObjectExpression in parens to avoid ambiguity with block statements
		if (node.body.type === 'ObjectExpression') {
			parts.push('(');
			parts.push(path.call(print, 'body'));
			parts.push(')');
		} else {
			parts.push(path.call(print, 'body'));
		}
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

	if (node.key) {
		parts.push('; key ');
		parts.push(path.call(print, 'key'));
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

function printObjectExpression(node, path, options, print, args) {
	if (!node.properties || node.properties.length === 0) {
		return '{}';
	}

	// Check if we should try to format inline
	const isInArray = args && args.isInArray;
	const isInAttribute = args && args.isInAttribute;
	const isSimple = node.properties.length <= 2;
	// Only 1-property objects are considered very simple for compact formatting
	const isVerySimple = node.properties.length === 1;

	// Use AST builders and respect trailing commas
	const properties = path.map(print, 'properties');
	const shouldUseTrailingComma = options.trailingComma !== 'none' && properties.length > 0;

	// For arrays: very simple (1-prop) objects can be inline, 2-prop objects always multiline
	// For attributes: force inline for simple objects
	if (isSimple && (isInArray || isInAttribute)) {
		if (isInArray) {
			if (isVerySimple) {
				// 1-property objects: force inline with spaces
				return concat(['{', ' ', properties[0], ' ', '}']);
			}
			// 2-property objects: let normal formatting handle it (will be multiline)
			// Fall through to default multiline formatting below
		} else {
			// For attributes, force inline without spaces
			const parts = ['{'];
			for (let i = 0; i < properties.length; i++) {
				if (i > 0) parts.push(', ');
				parts.push(properties[i]);
			}
			parts.push('}');
			return concat(parts);
		}
	}

	if (args && args.allowInlineObject) {
		const separator = concat([',', line]);
		const propertyDoc = join(separator, properties);
		const spacing = options.bracketSpacing === false ? softline : line;
		const trailingDoc = shouldUseTrailingComma ? ifBreak(',', '') : '';

		return group(concat([
			'{',
			indent(concat([spacing, propertyDoc, trailingDoc])),
			spacing,
			'}',
		]));
	}

	let content = [hardline];
	if (properties.length > 0) {
		content.push(join([',', hardline], properties));
		if (shouldUseTrailingComma) {
			content.push(',');
		}
		content.push(hardline);
	}

	return group([
		'{',
		indent(content.slice(0, -1)),
		content[content.length - 1],
		'}',
	]);
}

function printTrackedObjectExpression(node, path, options, print, args) {
	if (!node.properties || node.properties.length === 0) {
		return '#{}';
	}

	// Use AST builders and respect trailing commas
	const properties = path.map(print, 'properties');
	const shouldUseTrailingComma = options.trailingComma !== 'none' && properties.length > 0;

	// Build properties with proper separators
	const propertyParts = [];
	for (let i = 0; i < properties.length; i++) {
		if (i > 0) {
			propertyParts.push(',');
			propertyParts.push(line);
		}
		propertyParts.push(properties[i]);
	}

	// Add trailing comma only when breaking to multiline
	if (shouldUseTrailingComma) {
		propertyParts.push(ifBreak(',', ''));
	}

	// Use group with proper breaking behavior
	// When inline: #{ prop1, prop2 }
	// When multiline: #{\n  prop1,\n  prop2,\n}
	return group(concat([
		'#{',
		indent(concat([line, concat(propertyParts)])),
		line,
		'}',
	]));
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

	if (node.pending) {
		parts.push(' pending ');
		parts.push(path.call(print, 'pending'));
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

	parts.push(semi(options));

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
		const openBracket = node.optional ? '?.[' : '[';
		return concat([objectPart, openBracket, propertyPart, ']']);
	} else {
		const separator = node.optional ? '?.' : '.';
		return concat([objectPart, separator, propertyPart]);
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

	// Handle TypeScript type parameters/arguments
	if (node.typeArguments) {
		parts.push(path.call(print, 'typeArguments'));
	} else if (node.typeParameters) {
		parts.push(path.call(print, 'typeParameters'));
	}

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
	parts.push(semi(options));
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
	const membersWithSemicolons = members.map((member) => concat([member, semi(options)]));

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
	parts.push(semi(options));

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
	parts.push(semi(options));
	return parts;
}

function printContinueStatement(node, path, options, print) {
	const parts = [];
	parts.push('continue');
	if (node.label) {
		parts.push(' ');
		parts.push(path.call(print, 'label'));
	}
	parts.push(semi(options));
	return parts;
}

function printDebuggerStatement(node, path, options, print) {
	return 'debugger' + semi(options);
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

function shouldAddBlankLine(currentNode, nextNode) {
	// If nextNode has leading comments, check whitespace between current node and first comment
	// Otherwise check whitespace between current node and next node
	let targetNode = nextNode;
	if (nextNode.leadingComments && nextNode.leadingComments.length > 0) {
		targetNode = nextNode.leadingComments[0];
	}

	// Check if there was original whitespace between the nodes
	const originalBlankLines = getWhitespaceLinesBetween(currentNode, targetNode);

	// If nextNode has leading comments, only add blank line if there was one originally
	if (nextNode.leadingComments && nextNode.leadingComments.length > 0) {
		if (originalBlankLines > 0) {
			return true;
		}
		return false;
	}

	// Ripple-specific formatting rules for when to add blank lines

	// Add blank line before style elements
	if (nextNode.type === 'Element') {
		if (nextNode.id && nextNode.id.type === 'Identifier' && nextNode.id.name === 'style') {
			return true;
		}
	}

	// Add blank line after variable declarations when followed by elements or control flow statements
	// Only if there was originally a blank line
	if (originalBlankLines > 0 && currentNode.type === 'VariableDeclaration') {
		if (
			nextNode.type === 'Element' ||
			nextNode.type === 'IfStatement' ||
			nextNode.type === 'TryStatement' ||
			nextNode.type === 'ForStatement' ||
			nextNode.type === 'ForOfStatement' ||
			nextNode.type === 'WhileStatement' ||
			nextNode.type === 'DoWhileStatement'
		) {
			return true;
		}
	}

	// Add blank line after TypeScript declarations when followed by other statements (not just elements)
	if (
		currentNode.type === 'TSInterfaceDeclaration' ||
		currentNode.type === 'TSTypeAliasDeclaration'
	) {
		if (
			nextNode.type === 'VariableDeclaration' ||
			nextNode.type === 'Element' ||
			nextNode.type === 'IfStatement' ||
			nextNode.type === 'ForStatement' ||
			nextNode.type === 'ForOfStatement' ||
			nextNode.type === 'TryStatement' ||
			nextNode.type === 'WhileStatement' ||
			nextNode.type === 'DoWhileStatement' ||
			nextNode.type === 'ExpressionStatement' ||
			nextNode.type === 'ExportDefaultDeclaration' ||
			nextNode.type === 'ExportNamedDeclaration' ||
			nextNode.type === 'Component'
		) {
			return true;
		}
	}

	// Add blank line after import declarations when followed by code (not just other imports)
	if (currentNode.type === 'ImportDeclaration' && nextNode.type !== 'ImportDeclaration') {
		return true;
	}

	// Add blank line between Component declarations at top level
	if (currentNode.type === 'Component' || currentNode.type === 'ExportNamedDeclaration' || currentNode.type === 'ExportDefaultDeclaration') {
		if (nextNode.type === 'Component' || nextNode.type === 'ExportNamedDeclaration' || nextNode.type === 'ExportDefaultDeclaration') {
			return true;
		}
	}

	// Add blank line after if/for/try statements if next is an element
	// Only if there was originally a blank line
	if (
		originalBlankLines > 0 &&
		(currentNode.type === 'IfStatement' ||
			currentNode.type === 'ForStatement' ||
			currentNode.type === 'ForOfStatement' ||
			currentNode.type === 'TryStatement' ||
			currentNode.type === 'WhileStatement')
	) {
		if (nextNode.type === 'Element') {
			return true;
		}
	}

	// Add blank line before elements when preceded by non-element statements
	// Only if there was originally a blank line
	if (originalBlankLines > 0 && nextNode.type === 'Element') {
		if (
			currentNode.type !== 'Element' &&
			currentNode.type !== 'VariableDeclaration' &&
			currentNode.type !== 'TSInterfaceDeclaration' &&
			currentNode.type !== 'TSTypeAliasDeclaration'
		) {
			return true;
		}
	}

	// Standard Prettier behavior: preserve blank lines between different statement types
	// This helps maintain logical groupings in the code
	// Also add blank lines in certain contexts even if they didn't exist originally
	// Common patterns where blank lines are meaningful:
	// - Before/after control flow (if/for/while/try)
	// - Before return statements
	// - Between variable declarations and other code
	// - Before/after function declarations

	const hadOriginalBlankLines = originalBlankLines > 0;

	// Add blank line before control flow statements (only if originally present)
	if (
		hadOriginalBlankLines &&
		(nextNode.type === 'IfStatement' ||
			nextNode.type === 'ForStatement' ||
			nextNode.type === 'ForOfStatement' ||
			nextNode.type === 'WhileStatement' ||
			nextNode.type === 'DoWhileStatement' ||
			nextNode.type === 'TryStatement' ||
			nextNode.type === 'SwitchStatement')
	) {
		return true;
	}

	// Always add blank line before return statements (unless it's the only/first statement)
	if (nextNode.type === 'ReturnStatement' && currentNode.type !== 'VariableDeclaration') {
		return true;
	}

	// Add blank line after control flow statements (only if originally present)
	if (
		hadOriginalBlankLines &&
		(currentNode.type === 'IfStatement' ||
			currentNode.type === 'ForStatement' ||
			currentNode.type === 'ForOfStatement' ||
			currentNode.type === 'WhileStatement' ||
			currentNode.type === 'DoWhileStatement' ||
			currentNode.type === 'TryStatement' ||
			currentNode.type === 'SwitchStatement')
	) {
		return true;
	}

	// Add blank line after return/throw/break/continue (only if originally present)
	if (
		hadOriginalBlankLines &&
		(currentNode.type === 'ReturnStatement' ||
			currentNode.type === 'ThrowStatement' ||
			currentNode.type === 'BreakStatement' ||
			currentNode.type === 'ContinueStatement')
	) {
		return true;
	}

	// Add blank line between variable declarations and other code (only if originally present)
	if (hadOriginalBlankLines && currentNode.type === 'VariableDeclaration' && nextNode.type !== 'VariableDeclaration') {
		return true;
	}

	// Add blank line before variable declarations (only if originally present, except after other variable declarations)
	if (hadOriginalBlankLines && nextNode.type === 'VariableDeclaration' && currentNode.type !== 'VariableDeclaration') {
		return true;
	}

	// Also add blank line between variable declarations if they were originally separated
	if (hadOriginalBlankLines && currentNode.type === 'VariableDeclaration' && nextNode.type === 'VariableDeclaration') {
		return true;
	}

	// Add blank line before/after function declarations (only if originally present)
	if (hadOriginalBlankLines && (currentNode.type === 'FunctionDeclaration' || nextNode.type === 'FunctionDeclaration')) {
		return true;
	}

	// Fallback: don't add blank lines by default
	return false;
}

function printObjectPattern(node, path, options, print) {
	const propList = path.map(print, 'properties');
	const allowTrailingComma =
		node.properties &&
		node.properties.length > 0 &&
		node.properties[node.properties.length - 1].type !== 'RestElement';

	const content = group(
		concat([
			'{',
			indent(
				concat([
					line,
					join(concat([',', line]), propList),
					allowTrailingComma && options.trailingComma !== 'none' ? ifBreak(',', '') : '',
				]),
			),
			line,
			'}',
		]),
	);

	if (node.typeAnnotation) {
		return concat([content, ': ', path.call(print, 'typeAnnotation')]);
	}

	return content;
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

	// Handle property key - if it's a Literal (quoted string in source),
	// check if it needs quotes or can be unquoted
	if (node.key.type === 'Literal' && typeof node.key.value === 'string') {
		// Check if the key is a valid identifier that doesn't need quotes
		const key = node.key.value;
		const isValidIdentifier = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key);

		if (isValidIdentifier) {
			// Don't quote valid identifiers
			parts.push(key);
		} else {
			// Quote keys that need it (e.g., contain special characters)
			parts.push(formatStringLiteral(key, options));
		}
	} else {
		// For computed properties or non-literal keys, print normally
		parts.push(path.call(print, 'key'));
	}

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

	// Handle both typeArguments and typeParameters (different AST variations)
	if (node.typeArguments) {
		parts.push('<');
		const typeArgs = path.map(print, 'typeArguments', 'params');
		for (let i = 0; i < typeArgs.length; i++) {
			if (i > 0) parts.push(', ');
			parts.push(typeArgs[i]);
		}
		parts.push('>');
	} else if (node.typeParameters) {
		parts.push('<');
		const typeParams = path.map(print, 'typeParameters', 'params');
		for (let i = 0; i < typeParams.length; i++) {
			if (i > 0) parts.push(', ');
			parts.push(typeParams[i]);
		}
		parts.push('>');
	}

	return concat(parts);
}

function printTSTupleType(node, path, options, print) {
	const parts = ['['];
	const elements = node.elementTypes ? path.map(print, 'elementTypes') : [];
	for (let i = 0; i < elements.length; i++) {
		if (i > 0) parts.push(', ');
		parts.push(elements[i]);
	}
	parts.push(']');
	return concat(parts);
}

function printTSIndexSignature(node, path, options, print) {
	const parts = [];
	if (node.readonly === true || node.readonly === 'plus' || node.readonly === '+') {
		parts.push('readonly ');
	} else if (node.readonly === 'minus' || node.readonly === '-') {
		parts.push('-readonly ');
	}

	parts.push('[');
	const params = node.parameters ? path.map(print, 'parameters') : [];
	for (let i = 0; i < params.length; i++) {
		if (i > 0) parts.push(', ');
		parts.push(params[i]);
	}
	parts.push(']');

	if (node.typeAnnotation) {
		parts.push(': ');
		parts.push(path.call(print, 'typeAnnotation'));
	}

	return concat(parts);
}

function printTSConstructorType(node, path, options, print) {
	const parts = [];
	parts.push('new ');
	parts.push('(');
	const hasParams = Array.isArray(node.params) && node.params.length > 0;
	const hasParameters = Array.isArray(node.parameters) && node.parameters.length > 0;
	if (hasParams || hasParameters) {
		const params = hasParams ? path.map(print, 'params') : path.map(print, 'parameters');
		for (let i = 0; i < params.length; i++) {
			if (i > 0) parts.push(', ');
			parts.push(params[i]);
		}
	}
	parts.push(')');
	parts.push(' => ');
	if (node.returnType) {
		parts.push(path.call(print, 'returnType'));
	} else if (node.typeAnnotation) {
		parts.push(path.call(print, 'typeAnnotation'));
	}
	return concat(parts);
}

function printTSConditionalType(node, path, options, print) {
	const parts = [];
	parts.push(path.call(print, 'checkType'));
	parts.push(' extends ');
	parts.push(path.call(print, 'extendsType'));
	parts.push(' ? ');
	parts.push(path.call(print, 'trueType'));
	parts.push(' : ');
	parts.push(path.call(print, 'falseType'));
	return concat(parts);
}

function printTSMappedType(node, path, options, print) {
	const readonlyMod = node.readonly === true || node.readonly === 'plus' || node.readonly === '+'
		? 'readonly '
		: (node.readonly === 'minus' || node.readonly === '-') ? '-readonly ' : '';

	let optionalMod = '';
	if (node.optional === true || node.optional === 'plus' || node.optional === '+') {
		optionalMod = '?';
	} else if (node.optional === 'minus' || node.optional === '-') {
		optionalMod = '-?';
	}

	const innerParts = [];
	const typeParam = node.typeParameter;
	innerParts.push('[');
	if (typeParam) {
		// name
		innerParts.push(typeParam.name);
		innerParts.push(' in ');
		if (typeParam.constraint) {
			innerParts.push(path.call(print, 'typeParameter', 'constraint'));
		} else {
			innerParts.push(path.call(print, 'typeParameter'));
		}
		if (node.nameType) {
			innerParts.push(' as ');
			innerParts.push(path.call(print, 'nameType'));
		}
	}
	innerParts.push(']');
	innerParts.push(optionalMod);
	if (node.typeAnnotation) {
		innerParts.push(': ');
		innerParts.push(path.call(print, 'typeAnnotation'));
	}

	return group(['{ ', readonlyMod, concat(innerParts), ' }']);
}

function printTSQualifiedName(node, path, options, print) {
	return concat([path.call(print, 'left'), '.', path.call(print, 'right')]);
}

function printTSIndexedAccessType(node, path, options, print) {
	return concat([path.call(print, 'objectType'), '[', path.call(print, 'indexType'), ']']);
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
	const tagName = (node.id.tracked ? '@' : '') + node.id.name;

	// Check if any children have leading comments that are actually at the element's level
	// (i.e., comments that appear before the element in the source code)
	const elementLevelCommentParts = [];
	let originalLeadingComments = null;

	if (node.children && node.children.length > 0 && node.children[0].leadingComments) {
		const firstChild = node.children[0];
		if (firstChild.leadingComments) {
			const elementLevelComments = [];
			for (let i = 0; i < firstChild.leadingComments.length; i++) {
				const comment = firstChild.leadingComments[i];
				// For elements, all leading comments on the first child that appear before
				// the element's opening tag should be treated as element-level comments.
				// This is because comments truly inside an element would be after the opening tag.
				let isBeforeElement = true; // Default to true for safety

				// Only set to false if we can confirm the comment is AFTER the element starts
				if (typeof comment.start === 'number' && typeof node.start === 'number') {
					isBeforeElement = comment.start < node.start;
				} else if (comment.loc && node.loc) {
					isBeforeElement = comment.loc.start.line <= node.loc.start.line;
				}

				if (isBeforeElement) {
					elementLevelComments.push(comment);

					// Manually format the comment for printing
					if (comment.type === 'Line') {
						elementLevelCommentParts.push('//' + comment.value);
						elementLevelCommentParts.push(hardline);
					} else if (comment.type === 'Block') {
						elementLevelCommentParts.push('/*' + comment.value + '*/');
						elementLevelCommentParts.push(hardline);
					}
				}
			}

			// If we found element-level comments, temporarily remove them from the child
			if (elementLevelComments.length > 0) {
				originalLeadingComments = firstChild.leadingComments;
				firstChild.leadingComments = originalLeadingComments.filter(
					c => !elementLevelComments.includes(c)
				);
				if (firstChild.leadingComments.length === 0) {
					firstChild.leadingComments = undefined;
				}
			}
		}
	}

	if (!node.attributes || node.attributes.length === 0) {
		if (node.selfClosing || !node.children || node.children.length === 0) {
			// Restore original comments before returning
			if (originalLeadingComments && node.children && node.children[0]) {
				node.children[0].leadingComments = originalLeadingComments;
			}
			// Prepend element-level comments if any
			if (elementLevelCommentParts.length > 0) {
				return concat([...elementLevelCommentParts, group(['<', tagName, ' />'])]);
			}
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

				// For element children, ONLY preserve original whitespace
				// Don't apply any formatting rules
				if (whitespaceLinesCount > 0) {
					// Double hardline for blank line
					finalChildren.push(hardline); // Line break
					finalChildren.push(hardline); // Blank line
				} else {
					// Single hardline for normal line break
					finalChildren.push(hardline);
				}
			}
		}

		// Restore original comments after printing
		if (originalLeadingComments && node.children && node.children[0]) {
			node.children[0].leadingComments = originalLeadingComments;
		}

		// Build the element output
		let elementOutput;

		// For single simple children, try to keep on one line
		// But never if the child is a non-self-closing Component node
		const hasComponentChild = node.children && node.children.some(ch => ch.type === 'Component' && !ch.selfClosing);

		if (finalChildren.length === 1 && !hasComponentChild) {
			const child = finalChildren[0];
			const firstChild = node.children[0];

			// Try to inline if:
			// 1. Short string content (<= 20 chars)
			// 2. Simple JSX expression (Text or Html nodes)
			// 3. Self-closing elements/components
			// But DON'T inline if child is a non-self-closing Element
			const isNonSelfClosingElement = firstChild && firstChild.type === 'Element' && !firstChild.selfClosing;

			if (typeof child === 'string' && child.length < 20) {
				// Single line with short content
				elementOutput = group(['<', tagName, '>', child, '</', tagName, '>']);
			} else if (child && typeof child === 'object' && !isNonSelfClosingElement) {
				elementOutput = group(['<', tagName, '>', child, '</', tagName, '>']);
			} else {
				// Multi-line for non-self-closing elements
				elementOutput = group([
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
		} else {
			elementOutput = group([
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

		// Prepend element-level comments if any
		if (elementLevelCommentParts.length > 0) {
			return concat([...elementLevelCommentParts, elementOutput]);
		}
		return elementOutput;
	}

	// Determine the line break type for attributes
	// When singleAttributePerLine is true, force each attribute on its own line with hardline
	// Otherwise, use line to allow collapsing when it fits
	const attrLineBreak = options.singleAttributePerLine ? hardline : line;

	const openingTag = group([
		'<',
		tagName,
		indent(
			concat([
				...path.map((attrPath) => {
					return concat([attrLineBreak, print(attrPath)]);
				}, 'attributes'),
			]),
		),
		// Add line break opportunity before > or />
		// Use line for self-closing (keeps space), softline for non-self-closing when attributes present
		// When bracketSameLine is true, don't add line break for non-self-closing elements
		node.selfClosing || !node.children || node.children.length === 0
			? (node.attributes && node.attributes.length > 0 ? line : '')
			: (node.attributes && node.attributes.length > 0 && !options.bracketSameLine ? softline : ''),
		node.selfClosing || !node.children || node.children.length === 0 ? '/>' : '>',
	]);

	if (node.selfClosing || !node.children || node.children.length === 0) {
		// Restore original comments before returning
		if (originalLeadingComments && node.children && node.children[0]) {
			node.children[0].leadingComments = originalLeadingComments;
		}
		// Prepend element-level comments if any
		if (elementLevelCommentParts.length > 0) {
			return concat([...elementLevelCommentParts, openingTag]);
		}
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
			const whitespaceLinesCount = getWhitespaceLinesBetween(currentChild, nextChild);			// For element children (Text nodes and Html nodes), don't add automatic blank lines
			// Only preserve them if they existed in the original
			const isTextOrHtmlChild = currentChild.type === 'Text' || currentChild.type === 'Html' || nextChild.type === 'Text' || nextChild.type === 'Html';

			// Add blank line if there was original whitespace (> 0 lines)
			if (whitespaceLinesCount > 0) {
				// Double hardline for blank line
				finalChildren.push(hardline); // Line break
				finalChildren.push(hardline); // Blank line
			} else if (!isTextOrHtmlChild && shouldAddBlankLine(currentChild, nextChild)) {
				// Only apply formatting rules for non-text/html children
				// Double hardline for blank line
				finalChildren.push(hardline); // Line break
				finalChildren.push(hardline); // Blank line
			} else {
				// Single hardline for normal line break
				finalChildren.push(hardline);
			}
		}
	}

	// Restore original comments after printing
	if (originalLeadingComments && node.children && node.children[0]) {
		node.children[0].leadingComments = originalLeadingComments;
	}

	const closingTag = concat(['</', tagName, '>']);

	// Build the element output
	let elementOutput;

	// For single simple children, try to keep on one line
	// But never if the child is a non-self-closing Component node
	const hasComponentChild2 = node.children && node.children.some(ch => ch.type === 'Component' && !ch.selfClosing);

	if (finalChildren.length === 1 && !hasComponentChild2) {
		const child = finalChildren[0];
		const firstChild = node.children[0];

		// Try to inline if:
		// 1. Short string content (<= 20 chars)
		// 2. Simple JSX expression (Text or Html nodes)
		// 3. Self-closing elements/components
		// But DON'T inline if child is a non-self-closing Element or JSXElement
		const isNonSelfClosingElement = firstChild && (firstChild.type === 'Element' || firstChild.type === 'JSXElement') && !firstChild.selfClosing;

		// Check if child is any kind of Element/JSXElement (including self-closing)
		const isElementChild = firstChild && (firstChild.type === 'Element' || firstChild.type === 'JSXElement');

		// If parent has attributes and child is an element, always break to multiple lines
		const hasAttributes = node.attributes && node.attributes.length > 0;

		if (typeof child === 'string' && child.length < 20) {
			// Single line with short text
			elementOutput = group([openingTag, child, closingTag]);
		} else if (child && typeof child === 'object' && !isNonSelfClosingElement) {
			// For self-closing elements with parent having attributes, force multi-line
			if (isElementChild && hasAttributes) {
				elementOutput = concat([openingTag, indent(concat([hardline, child])), hardline, closingTag]);
			} else {
				// For simple JSX expressions (Text, Html nodes), use softline to collapse without spaces
				elementOutput = group([openingTag, indent(concat([softline, child])), softline, closingTag]);
			}
		} else {
			// Multi-line for nested elements
			elementOutput = concat([openingTag, indent(concat([hardline, ...finalChildren])), hardline, closingTag]);
		}
	} else {
		// Multi-line
		elementOutput = group([openingTag, indent(concat([hardline, ...finalChildren])), hardline, closingTag]);
	}

	// Prepend element-level comments if any
	if (elementLevelCommentParts.length > 0) {
		return concat([...elementLevelCommentParts, elementOutput]);
	}
	return elementOutput;
}

function printAttribute(node, path, options, print) {
	const parts = [];

	// Handle shorthand syntax: {id} instead of id={id}
	// Check if either node.shorthand is true, OR if the value is an Identifier with the same name
	const isShorthand = node.shorthand || (node.value && node.value.type === 'Identifier' && node.value.name === node.name.name);

	if (isShorthand) {
		parts.push('{');
		parts.push(node.name.name);
		parts.push('}');
		return parts;
	}

	parts.push(node.name.name);

	if (node.value) {
		if (node.value.type === 'Literal' && typeof node.value.value === 'string') {
			// String literals don't need curly braces
			// Use jsxSingleQuote option if available, otherwise use double quotes
			parts.push('=');
			const useJsxSingleQuote = options.jsxSingleQuote === true;
			parts.push(formatStringLiteral(node.value.value, { ...options, singleQuote: useJsxSingleQuote }));
		} else {
			// All other values need curly braces: numbers, booleans, null, expressions, etc.
			parts.push('={');
			// Pass inline context for attribute values (keep objects compact)
			parts.push(path.call((attrPath) => print(attrPath, { isInAttribute: true }), 'value'));
			parts.push('}');
		}
	}

	return parts;
}
