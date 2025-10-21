// @ts-nocheck
import { parse } from 'ripple/compiler';
import { doc } from 'prettier';

const { builders, utils } = doc;
const {
	concat,
	join,
	line,
	softline,
	hardline,
	group,
	indent,
	dedent,
	ifBreak,
	fill,
	conditionalGroup,
	breakParent,
	indentIfBreak,
	lineSuffix,
} = builders;
const { willBreak } = utils;

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

function wasOriginallySingleLine(node) {
	if (!node || !node.loc || !node.loc.start || !node.loc.end) {
		return false;
	}

	return node.loc.start.line === node.loc.end.line;
}

function isSingleLineObjectExpression(node) {
	return wasOriginallySingleLine(node);
}

// Prettier-style helper functions
function hasComment(node) {
	return !!(node.leadingComments || node.trailingComments || node.innerComments);
}

function getFunctionParameters(node) {
	const parameters = [];
	if (node.this) {
		parameters.push(node.this);
	}
	if (node.params) {
		parameters.push(...node.params);
	}
	if (node.rest) {
		parameters.push(node.rest);
	}
	return parameters;
}

function iterateFunctionParametersPath(path, iteratee) {
	const { node } = path;
	let index = 0;
	const callback = (paramPath) => iteratee(paramPath, index++);

	if (node.this) {
		path.call(callback, 'this');
	}
	if (node.params) {
		path.each(callback, 'params');
	}
	if (node.rest) {
		path.call(callback, 'rest');
	}
}

function createSkip(characters) {
	return (text, startIndex, options) => {
		const backwards = Boolean(options && options.backwards);

		if (startIndex === false) {
			return false;
		}

		const length = text.length;
		let cursor = startIndex;
		while (cursor >= 0 && cursor < length) {
			const character = text.charAt(cursor);
			if (characters instanceof RegExp) {
				if (!characters.test(character)) {
					return cursor;
				}
			} else if (!characters.includes(character)) {
				return cursor;
			}
			cursor = backwards ? cursor - 1 : cursor + 1;
		}

		if (cursor === -1 || cursor === length) {
			return cursor;
		}

		return false;
	};
}

const skipSpaces = createSkip(' \t');
const skipToLineEnd = createSkip(',; \t');
const skipEverythingButNewLine = createSkip(/[^\n\r]/u);

function skipInlineComment(text, startIndex) {
	if (startIndex === false) {
		return false;
	}

	if (text.charAt(startIndex) === '/' && text.charAt(startIndex + 1) === '*') {
		for (let i = startIndex + 2; i < text.length; i++) {
			if (text.charAt(i) === '*' && text.charAt(i + 1) === '/') {
				return i + 2;
			}
		}
	}

	return startIndex;
}

function skipNewline(text, startIndex, options) {
	const backwards = Boolean(options && options.backwards);
	if (startIndex === false) {
		return false;
	}

	const character = text.charAt(startIndex);
	if (backwards) {
		if (text.charAt(startIndex - 1) === '\r' && character === '\n') {
			return startIndex - 2;
		}
		if (
			character === '\n' ||
			character === '\r' ||
			character === '\u2028' ||
			character === '\u2029'
		) {
			return startIndex - 1;
		}
	} else {
		if (character === '\r' && text.charAt(startIndex + 1) === '\n') {
			return startIndex + 2;
		}
		if (
			character === '\n' ||
			character === '\r' ||
			character === '\u2028' ||
			character === '\u2029'
		) {
			return startIndex + 1;
		}
	}

	return startIndex;
}

function skipTrailingComment(text, startIndex) {
	if (startIndex === false) {
		return false;
	}

	if (text.charAt(startIndex) === '/' && text.charAt(startIndex + 1) === '/') {
		return skipEverythingButNewLine(text, startIndex);
	}

	return startIndex;
}

function hasNewline(text, startIndex, options) {
	const idx = skipSpaces(text, options && options.backwards ? startIndex - 1 : startIndex, options);
	const idx2 = skipNewline(text, idx, options);
	return idx !== idx2;
}

function isNextLineEmpty(node, options) {
	if (!node || !options || !options.originalText) {
		return false;
	}

	const text = options.originalText;
	const resolveEndIndex = () => {
		if (typeof options.locEnd === 'function') {
			const value = options.locEnd(node);
			if (typeof value === 'number') {
				return value;
			}
		}
		if (node.loc && node.loc.end) {
			if (typeof node.loc.end.index === 'number') {
				return node.loc.end.index;
			}
			if (typeof node.loc.end.offset === 'number') {
				return node.loc.end.offset;
			}
		}
		if (typeof node.end === 'number') {
			return node.end;
		}
		return null;
	};

	let index = resolveEndIndex();
	if (typeof index !== 'number') {
		return false;
	}

	let previousIndex = null;
	while (index !== previousIndex) {
		previousIndex = index;
		index = skipToLineEnd(text, index);
		index = skipInlineComment(text, index);
		index = skipSpaces(text, index);
	}

	index = skipTrailingComment(text, index);
	index = skipNewline(text, index);
	return index !== false && hasNewline(text, index);
}

function hasRestParameter(node) {
	return !!node.rest;
}

function shouldPrintComma(options, level = 'all') {
	switch (options.trailingComma) {
		case 'none':
			return false;
		case 'es5':
			return level === 'es5' || level === 'all';
		case 'all':
			return level === 'all';
		default:
			return false;
	}
}

function canAttachLeadingCommentToPreviousElement(comment, previousNode, nextNode) {
	if (!comment || !previousNode || !nextNode) {
		return false;
	}

	const isBlockComment = comment.type === 'Block' || comment.type === 'CommentBlock';
	if (!isBlockComment) {
		return false;
	}

	if (!comment.loc || !previousNode.loc || !nextNode.loc) {
		return false;
	}

	if (getBlankLinesBetweenNodes(previousNode, comment) > 0) {
		return false;
	}

	if (getBlankLinesBetweenNodes(comment, nextNode) > 0) {
		return false;
	}

	return true;
}

function buildInlineArrayCommentDoc(comments) {
	if (!Array.isArray(comments) || comments.length === 0) {
		return null;
	}

	const docs = [];
	for (let index = 0; index < comments.length; index++) {
		const comment = comments[index];
		if (!comment) {
			continue;
		}

		// Ensure spacing before the first comment and between subsequent ones.
		docs.push(' ');
		const isBlockComment = comment.type === 'Block' || comment.type === 'CommentBlock';
		if (isBlockComment) {
			docs.push('/*' + comment.value + '*/');
		} else if (comment.type === 'Line') {
			docs.push('//' + comment.value);
		}
	}

	return docs.length > 0 ? concat(docs) : null;
}

function printRippleNode(node, path, options, print, args) {
	if (!node || typeof node !== 'object') {
		return String(node || '');
	}

	const parts = [];

	const isInlineContext = args && args.isInlineContext;
	const suppressLeadingComments = args && args.suppressLeadingComments;
	const suppressExpressionLeadingComments = args && args.suppressExpressionLeadingComments;

	// Check if this node is a direct child of Program (top-level)
	const parentNode = path.getParentNode();
	const isTopLevel = parentNode && parentNode.type === 'Program';

	// For Text and Html nodes, don't add leading comments here - they should be handled
	// as separate children within the element, not as part of the expression
	const shouldSkipLeadingComments = node.type === 'Text' || node.type === 'Html';

	// Handle leading comments
	if (node.leadingComments && !shouldSkipLeadingComments && !suppressLeadingComments) {
		for (let i = 0; i < node.leadingComments.length; i++) {
			const comment = node.leadingComments[i];
			const nextComment = node.leadingComments[i + 1];
			const isLastComment = i === node.leadingComments.length - 1;

			if (comment.type === 'Line') {
				parts.push('//' + comment.value);
				parts.push(hardline);

				// Check if there should be blank lines between this comment and the next
				if (nextComment) {
					const blankLinesBetween = getBlankLinesBetweenNodes(comment, nextComment);
					if (blankLinesBetween > 0) {
						parts.push(hardline);
					}
				} else if (isLastComment) {
					// Preserve a blank line between the last comment and the node if it existed
					const blankLinesBetween = getBlankLinesBetweenNodes(comment, node);
					if (blankLinesBetween > 0) {
						parts.push(hardline);
					}
				}
			} else if (comment.type === 'Block') {
				parts.push('/*' + comment.value + '*/');

				// Check if comment and node are on the same line (for inline JSDoc comments)
				const isCommentOnSameLine =
					isLastComment && comment.loc && node.loc && comment.loc.end.line === node.loc.start.line;

				if (!isInlineContext && !isCommentOnSameLine) {
					parts.push(hardline);

					// Check if there should be blank lines between this comment and the next
					if (nextComment) {
						const blankLinesBetween = getBlankLinesBetweenNodes(comment, nextComment);
						if (blankLinesBetween > 0) {
							parts.push(hardline);
						}
					} else if (isLastComment) {
						// Preserve a blank line between the last comment and the node if it existed
						const blankLinesBetween = getBlankLinesBetweenNodes(comment, node);
						if (blankLinesBetween > 0) {
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
			const suppressLeadingCommentIndices = new Set();
			const inlineCommentsBetween = new Array(Math.max(node.elements.length - 1, 0)).fill(null);

			for (let index = 0; index < node.elements.length - 1; index++) {
				const currentElement = node.elements[index];
				const nextElement = node.elements[index + 1];
				if (
					!nextElement ||
					!nextElement.leadingComments ||
					nextElement.leadingComments.length === 0
				) {
					continue;
				}

				const canTransferAllLeadingComments = nextElement.leadingComments.every((comment) =>
					canAttachLeadingCommentToPreviousElement(comment, currentElement, nextElement),
				);

				if (!canTransferAllLeadingComments) {
					continue;
				}

				const inlineCommentDoc = buildInlineArrayCommentDoc(nextElement.leadingComments);
				if (inlineCommentDoc) {
					inlineCommentsBetween[index] = inlineCommentDoc;
					suppressLeadingCommentIndices.add(index + 1);
				}
			}

			// Check if all elements are objects with multiple properties
			// In that case, each object should be on its own line
			const objectElements = node.elements.filter((el) => el && el.type === 'ObjectExpression');
			const allElementsAreObjects =
				node.elements.length > 0 &&
				node.elements.every((el) => el && el.type === 'ObjectExpression');
			const allObjectsHaveMultipleProperties =
				allElementsAreObjects &&
				objectElements.length > 0 &&
				objectElements.every((obj) => obj.properties && obj.properties.length > 1);

			// For arrays of simple objects with only a few properties, try to keep compact
			// But NOT if all objects have multiple properties
			if (hasObjectElements && !allObjectsHaveMultipleProperties) {
				shouldInlineObjects = true;
				for (let i = 0; i < node.elements.length; i++) {
					const element = node.elements[i];
					if (element && element.type === 'ObjectExpression') {
						if (!isSingleLineObjectExpression(element)) {
							shouldInlineObjects = false;
							break;
						}
					}
				}
			}

			// Default printing - pass isInArray or isInAttribute context
			const arrayWasSingleLine = wasOriginallySingleLine(node);
			const shouldUseTrailingComma = options.trailingComma !== 'none';
			const elements = path.map(
				/**
				 * @param {any} elPath
				 * @param {number} index
				 */
				(elPath, index) => {
					const childNode = node.elements[index];
					const childArgs = {};

					if (suppressLeadingCommentIndices.has(index)) {
						childArgs.suppressLeadingComments = true;
					}

					if (isInAttribute) {
						childArgs.isInAttribute = true;
						return print(elPath, childArgs);
					}

					if (
						hasObjectElements &&
						childNode &&
						childNode.type === 'ObjectExpression' &&
						shouldInlineObjects
					) {
						childArgs.isInArray = true;
						childArgs.allowInlineObject = true;
						return print(elPath, childArgs);
					}

					if (hasObjectElements) {
						childArgs.isInArray = true;
					}

					return Object.keys(childArgs).length > 0 ? print(elPath, childArgs) : print(elPath);
				},
				'elements',
			);

			if (hasObjectElements && shouldInlineObjects && arrayWasSingleLine) {
				const separator = concat([',', line]);
				const trailing = shouldUseTrailingComma ? ifBreak(',', '') : '';
				nodeContent = group(
					concat([
						prefix + '[',
						indent(concat([softline, join(separator, elements), trailing])),
						softline,
						']',
					]),
				);
				break;
			}

			// Arrays should inline all elements unless:
			// 1. An element (not first) has blank line above it - then that element on new line with blank
			// 2. Elements don't fit within printWidth
			// 3. Array contains objects and every object has more than 1 property - each object on own line

			// Check which elements have blank lines above them
			const elementsWithBlankLineAbove = [];
			for (let i = 1; i < node.elements.length; i++) {
				const prevElement = node.elements[i - 1];
				const currentElement = node.elements[i];
				if (!prevElement || !currentElement) {
					continue;
				}

				const leadingComments = currentElement.leadingComments || [];
				if (leadingComments.length > 0) {
					const firstComment = leadingComments[0];
					const lastComment = leadingComments[leadingComments.length - 1];

					const linesBeforeComment = getBlankLinesBetweenNodes(prevElement, firstComment);
					const linesAfterComment = getBlankLinesBetweenNodes(lastComment, currentElement);

					if (linesBeforeComment > 0 || linesAfterComment > 0) {
						elementsWithBlankLineAbove.push(i);
					}
					continue;
				}

				if (getBlankLinesBetweenNodes(prevElement, currentElement) > 0) {
					elementsWithBlankLineAbove.push(i);
				}
			}

			const hasAnyBlankLines = elementsWithBlankLineAbove.length > 0;

			// Check if any elements contain hard breaks (like multiline ternaries)
			// Don't check willBreak() as that includes soft breaks from groups
			// Only check for actual multiline content that forces breaking
			const hasHardBreakingElements = node.elements.some((el) => {
				if (!el) return false;
				// Multiline ternaries are the main case that should force all elements on separate lines
				return el.type === 'ConditionalExpression';
			});

			if (!hasAnyBlankLines && !allObjectsHaveMultipleProperties && !hasHardBreakingElements) {
				const fillParts = [];
				let skipNextSeparator = false;
				for (let index = 0; index < elements.length; index++) {
					if (index > 0) {
						if (skipNextSeparator) {
							skipNextSeparator = false;
						} else {
							fillParts.push(line);
						}
					}

					if (index < elements.length - 1) {
						const inlineCommentDoc = inlineCommentsBetween[index];

						if (inlineCommentDoc) {
							// Build comment without leading space for separate-line version
							const nextElement = node.elements[index + 1];
							const commentParts = [];
							if (nextElement && nextElement.leadingComments) {
								for (const comment of nextElement.leadingComments) {
									const isBlockComment =
										comment.type === 'Block' || comment.type === 'CommentBlock';
									if (isBlockComment) {
										commentParts.push('/*' + comment.value + '*/');
									} else if (comment.type === 'Line') {
										commentParts.push('//' + comment.value);
									}
								}
							}
							const commentDocNoSpace = commentParts.length > 0 ? concat(commentParts) : '';

							// Provide conditional rendering: inline if it fits, otherwise on separate line
							fillParts.push(
								conditionalGroup([
									// Try inline first (with space before comment)
									concat([elements[index], ',', inlineCommentDoc, hardline]),
									// If doesn't fit, put comment on next line (without leading space)
									concat([elements[index], ',', hardline, commentDocNoSpace, hardline]),
								]),
							);
							skipNextSeparator = true;
						} else {
							fillParts.push(group(concat([elements[index], ','])));
							skipNextSeparator = false;
						}
					} else {
						fillParts.push(elements[index]);
						skipNextSeparator = false;
					}
				}

				const trailingDoc = shouldUseTrailingComma ? ifBreak(',', '') : '';
				nodeContent = group(
					concat([
						prefix + '[',
						indent(concat([softline, fill(fillParts), trailingDoc])),
						softline,
						']',
					]),
				);
				break;
			}

			// If array has breaking elements (multiline ternaries, functions, etc.)
			// use join() to put each element on its own line, per Prettier spec
			if (hasHardBreakingElements) {
				const separator = concat([',', line]);
				const parts = [];
				for (let index = 0; index < elements.length; index++) {
					parts.push(elements[index]);
				}
				const trailingDoc = shouldUseTrailingComma ? ifBreak(',', '') : '';
				nodeContent = group(
					concat([
						prefix + '[',
						indent(concat([softline, join(separator, parts), trailingDoc])),
						softline,
						']',
					]),
				);
				break;
			}

			// If array has multi-property objects, force each object on its own line
			// Objects that were originally inline can stay inline if they fit printWidth
			// Objects that were originally multi-line should stay multi-line
			if (allObjectsHaveMultipleProperties) {
				const inlineElements = path.map((elPath, index) => {
					const obj = node.elements[index];
					const wasObjSingleLine =
						obj && obj.type === 'ObjectExpression' && wasOriginallySingleLine(obj);
					return print(elPath, {
						isInArray: true,
						allowInlineObject: wasObjSingleLine,
					});
				}, 'elements');
				const separator = concat([',', hardline]);
				const trailingDoc = shouldUseTrailingComma ? ifBreak(',', '') : '';
				nodeContent = group(
					concat([
						prefix + '[',
						indent(concat([hardline, join(separator, inlineElements), trailingDoc])),
						hardline,
						']',
					]),
				);
				break;
			}

			// Has blank lines - format with blank lines preserved
			// Group elements between blank lines together so they can inline
			const contentParts = [];

			// Split elements into groups separated by blank lines
			const groups = [];
			let currentGroup = [];

			for (let i = 0; i < elements.length; i++) {
				const hasBlankLineAbove = elementsWithBlankLineAbove.includes(i);

				if (hasBlankLineAbove && currentGroup.length > 0) {
					// Save current group and start new one
					groups.push(currentGroup);
					currentGroup = [i];
				} else {
					currentGroup.push(i);
				}
			}

			// Don't forget the last group
			if (currentGroup.length > 0) {
				groups.push(currentGroup);
			}

			// Now output each group
			for (let groupIdx = 0; groupIdx < groups.length; groupIdx++) {
				const group_indices = groups[groupIdx];

				// Add blank line before this group (except first group)
				if (groupIdx > 0) {
					contentParts.push(hardline);
					contentParts.push(hardline);
				}

				// Build the group elements
				// Use fill() to automatically pack as many elements as fit per line
				// IMPORTANT: Each element+comma needs to be grouped for proper width calculation
				const fillParts = [];
				for (let i = 0; i < group_indices.length; i++) {
					const elemIdx = group_indices[i];
					const isLastInArray = elemIdx === elements.length - 1;

					if (i > 0) {
						fillParts.push(line);
					}
					// Wrap element+comma in group so fill() measures them together including breaks
					// But don't add comma to the very last element (it gets trailing comma separately)
					if (isLastInArray && shouldUseTrailingComma) {
						fillParts.push(group(elements[elemIdx]));
					} else {
						fillParts.push(group(concat([elements[elemIdx], ','])));
					}
				}

				contentParts.push(fill(fillParts));
			}

			// Add trailing comma only if the last element didn't already have one
			if (shouldUseTrailingComma) {
				contentParts.push(',');
			}

			// Array with blank lines - format as multi-line
			// Use simple group that will break to fit within printWidth
			nodeContent = group(
				concat([prefix + '[', indent(concat([line, concat(contentParts)])), line, ']']),
			);
			break;
		}

		case 'ObjectExpression':
		case 'TrackedObjectExpression':
			nodeContent = printObjectExpression(node, path, options, print, args);
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

		case 'AssignmentExpression': {
			let leftPart = path.call(print, 'left');
			// Preserve parentheses around the left side when present
			if (node.left.metadata?.parenthesized) {
				leftPart = concat(['(', leftPart, ')']);
			}
			nodeContent = concat([leftPart, ' ', node.operator, ' ', path.call(print, 'right')]);
			break;
		}

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
			const calleePart = path.call(print, 'callee');
			parts.push(calleePart);

			if (node.optional) {
				parts.push('?.');
			}

			// Add TypeScript generics if present
			if (node.typeArguments) {
				parts.push(path.call(print, 'typeArguments'));
			} else if (node.typeParameters) {
				parts.push(path.call(print, 'typeParameters'));
			}

			const argsDoc = printCallArguments(path, options, print);
			parts.push(argsDoc);

			let callContent = concat(parts);

			// Preserve parentheses for type-annotated call expressions
			if (node.metadata?.parenthesized) {
				callContent = concat(['(', callContent, ')']);
			}
			nodeContent = callContent;
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
			// When used with 'new', the arguments are empty and belong to NewExpression
			if (!node.arguments || node.arguments.length === 0) {
				nodeContent = '#Map';
			} else {
				const args = path.map(print, 'arguments');
				nodeContent = concat(['#Map(', join(concat([',', line]), args), ')']);
			}
			break;
		}

		case 'TrackedSetExpression': {
			// Format: #Set(arg1, arg2, ...)
			// When used with 'new', the arguments are empty and belong to NewExpression
			if (!node.arguments || node.arguments.length === 0) {
				nodeContent = '#Set';
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
				path.call(print, 'typeAnnotation'),
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

		case 'TSEnumDeclaration':
			nodeContent = printTSEnumDeclaration(node, path, options, print);
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
			break;

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
			const argumentDoc = path.call(print, 'argument');
			nodeContent = concat(['...', argumentDoc]);
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

		case 'ExpressionStatement': {
			// Object literals at statement position need parentheses to avoid ambiguity with blocks
			const needsParens =
				node.expression.type === 'ObjectExpression' ||
				node.expression.type === 'TrackedObjectExpression';
			if (needsParens) {
				nodeContent = concat(['(', path.call(print, 'expression'), ')', semi(options)]);
			} else {
				nodeContent = concat([path.call(print, 'expression'), semi(options)]);
			}
			break;
		}
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
			const trackedPrefix = node.tracked ? '@' : '';
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
			nodeContent = group(
				concat([
					path.call(print, 'left'),
					' ',
					node.operator,
					indent(concat([line, path.call(print, 'right')])),
				]),
			);
			break;

		case 'LogicalExpression':
			nodeContent = group(
				concat([
					path.call(print, 'left'),
					' ',
					node.operator,
					indent(concat([line, path.call(print, 'right')])),
				]),
			);
			break;

		case 'ConditionalExpression': {
			// Use Prettier's grouping to handle line breaking when exceeding printWidth
			const testDoc = path.call(print, 'test');

			// Check if we have nested ternaries (but not if they're parenthesized, which keeps them inline)
			const hasUnparenthesizedNestedConditional =
				(node.consequent.type === 'ConditionalExpression' &&
					!node.consequent.metadata?.parenthesized) ||
				(node.alternate.type === 'ConditionalExpression' &&
					!node.alternate.metadata?.parenthesized);

			// If we have unparenthesized nested ternaries, tell the children they're nested
			const consequentDoc =
				hasUnparenthesizedNestedConditional &&
				node.consequent.type === 'ConditionalExpression' &&
				!node.consequent.metadata?.parenthesized
					? path.call((childPath) => print(childPath, { isNestedConditional: true }), 'consequent')
					: path.call(print, 'consequent');
			const alternateDoc =
				hasUnparenthesizedNestedConditional &&
				node.alternate.type === 'ConditionalExpression' &&
				!node.alternate.metadata?.parenthesized
					? path.call((childPath) => print(childPath, { isNestedConditional: true }), 'alternate')
					: path.call(print, 'alternate');

			// Check if the consequent or alternate will break
			const consequentBreaks = willBreak(consequentDoc);
			const alternateBreaks = willBreak(alternateDoc);

			let result;
			// If either branch breaks OR we have unparenthesized nested ternaries OR we're already nested, use multiline format
			if (
				consequentBreaks ||
				alternateBreaks ||
				hasUnparenthesizedNestedConditional ||
				args?.isNestedConditional
			) {
				result = concat([
					testDoc,
					indent(concat([line, '? ', consequentBreaks ? indent(consequentDoc) : consequentDoc])),
					indent(concat([line, ': ', alternateBreaks ? indent(alternateDoc) : alternateDoc])),
				]);
			} else {
				// Otherwise try inline first, then multiline if it doesn't fit
				result = conditionalGroup([
					// Try inline first
					concat([testDoc, ' ? ', consequentDoc, ' : ', alternateDoc]),
					// If inline doesn't fit, use multiline
					concat([
						testDoc,
						indent(concat([line, '? ', consequentDoc])),
						indent(concat([line, ': ', alternateDoc])),
					]),
				]);
			}

			// Wrap in parentheses if metadata indicates they were present
			if (node.metadata?.parenthesized) {
				result = concat(['(', result, ')']);
			}

			nodeContent = result;
			break;
		}

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

		case 'TSEnumMember':
			nodeContent = printTSEnumMember(node, path, options, print);
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

		case 'TSParenthesizedType': {
			nodeContent = concat(['(', path.call(print, 'typeAnnotation'), ')']);
			break;
		}

		case 'Element':
			nodeContent = printElement(node, path, options, print);
			break;

		case 'TsxCompat':
			nodeContent = printTsxCompat(node, path, options, print);
			break;

		case 'JSXElement':
			nodeContent = printJSXElement(node, path, options, print);
			break;

		case 'JSXFragment':
			nodeContent = printJSXFragment(node, path, options, print);
			break;

		case 'JSXText':
			nodeContent = node.value;
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

		case 'NestingSelector':
			nodeContent = printCSSNestingSelector(node, path, options, print);
			break;

		case 'Block':
			nodeContent = printCSSBlock(node, path, options, print);
			break;

		case 'Attribute':
			nodeContent = printAttribute(node, path, options, print);
			break;

		case 'Text': {
			const expressionDoc = suppressExpressionLeadingComments
				? path.call((exprPath) => print(exprPath, { suppressLeadingComments: true }), 'expression')
				: path.call(print, 'expression');
			nodeContent = concat(['{', expressionDoc, '}']);
			break;
		}

		case 'Html': {
			const expressionDoc = suppressExpressionLeadingComments
				? path.call((exprPath) => print(exprPath, { suppressLeadingComments: true }), 'expression')
				: path.call(print, 'expression');
			nodeContent = concat(['{html ', expressionDoc, '}']);
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
		let previousComment = null;

		for (let i = 0; i < node.trailingComments.length; i++) {
			const comment = node.trailingComments[i];
			const isInlineComment = Boolean(
				node.loc && comment.loc && node.loc.end.line === comment.loc.start.line,
			);

			const commentDoc =
				comment.type === 'Line' ? '//' + comment.value : '/*' + comment.value + '*/';

			if (isInlineComment) {
				if (comment.type === 'Line') {
					trailingParts.push(lineSuffix([' ', commentDoc]));
					trailingParts.push(breakParent);
				} else {
					trailingParts.push(' ' + commentDoc);
				}
			} else {
				const refs = [];
				refs.push(hardline);

				const blankLinesBetween = previousComment
					? getBlankLinesBetweenNodes(previousComment, comment)
					: getBlankLinesBetweenNodes(node, comment);
				if (blankLinesBetween > 0) {
					refs.push(hardline);
				}

				if (comment.type === 'Line') {
					refs.push(commentDoc);
					trailingParts.push(lineSuffix(refs));
				} else {
					refs.push(commentDoc);
					trailingParts.push(lineSuffix(refs));
				}
			}

			previousComment = comment;
		}

		if (trailingParts.length > 0) {
			parts.push(nodeContent);
			parts.push(...trailingParts);
			return concat(parts);
		}
	} // Return with or without leading comments
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

	// Print parameters using shared function
	const paramsPart = printFunctionParameters(path, options, print);
	signatureParts.push(group(paramsPart)); // Build body content using the same pattern as BlockStatement
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
	const parts = [concat(signatureParts), ' {'];

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

		// Add the body and closing brace
		parts.push(indentedContent, hardline, '}');
	} else {
		// Empty component body
		parts[1] = ' {}';
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

	// Add TypeScript generics if present
	if (node.typeParameters) {
		// Only add space if there's no function name
		if (!node.id) {
			parts.push(' ');
		}
		const typeParams = path.call(print, 'typeParameters');
		if (Array.isArray(typeParams)) {
			parts.push(...typeParams);
		} else {
			parts.push(typeParams);
		}
	} else if (!node.id) {
		// If no name and no type parameters, add space before params
		parts.push(' ');
	}

	// Print parameters using shared function
	const paramsPart = printFunctionParameters(path, options, print);
	parts.push(group(paramsPart)); // Handle return type annotation
	if (node.returnType) {
		parts.push(': ', path.call(print, 'returnType'));
	}

	parts.push(' ');
	parts.push(path.call(print, 'body'));

	return concat(parts);
}

function printArrowFunction(node, path, options, print) {
	const parts = [];

	if (node.async) {
		parts.push('async ');
	}

	// Add TypeScript generics if present
	if (node.typeParameters) {
		const typeParams = path.call(print, 'typeParameters');
		if (Array.isArray(typeParams)) {
			parts.push(...typeParams);
		} else {
			parts.push(typeParams);
		}
	}

	// Handle single param without parens (when arrowParens !== 'always')
	// Note: can't use single param syntax if there are type parameters or return type
	if (
		options.arrowParens !== 'always' &&
		node.params &&
		node.params.length === 1 &&
		node.params[0].type === 'Identifier' &&
		!node.params[0].typeAnnotation &&
		!node.returnType &&
		!node.typeParameters
	) {
		parts.push(path.call(print, 'params', 0));
	} else {
		// Print parameters using shared function
		const paramsPart = printFunctionParameters(path, options, print);
		parts.push(group(paramsPart));
	} // Handle return type annotation
	if (node.returnType) {
		parts.push(': ', path.call(print, 'returnType'));
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

function shouldHugTheOnlyFunctionParameter(node) {
	if (!node) {
		return false;
	}
	const parameters = getFunctionParameters(node);
	if (parameters.length !== 1) {
		return false;
	}
	const [parameter] = parameters;
	return (
		!hasComment(parameter) &&
		(parameter.type === 'ObjectPattern' ||
			parameter.type === 'ArrayPattern' ||
			(parameter.type === 'Identifier' &&
				parameter.typeAnnotation &&
				(parameter.typeAnnotation.type === 'TypeAnnotation' ||
					parameter.typeAnnotation.type === 'TSTypeAnnotation')))
	);
}

function printFunctionParameters(path, options, print) {
	const functionNode = path.node;
	const parameters = getFunctionParameters(functionNode);

	if (parameters.length === 0) {
		return ['(', ')'];
	}

	const shouldHugParameters = shouldHugTheOnlyFunctionParameter(functionNode);
	const printed = [];

	iterateFunctionParametersPath(path, (parameterPath, index) => {
		const isLastParameter = index === parameters.length - 1;

		if (isLastParameter && functionNode.rest) {
			printed.push('...');
		}

		printed.push(print());

		if (!isLastParameter) {
			printed.push(',');
			if (shouldHugParameters) {
				printed.push(' ');
			} else if (isNextLineEmpty(parameters[index], options)) {
				printed.push(hardline, hardline);
			} else {
				printed.push(line);
			}
		}
	});

	const hasNotParameterDecorator = parameters.every(
		(node) => !node.decorators || node.decorators.length === 0,
	);

	if (shouldHugParameters && hasNotParameterDecorator) {
		return ['(', ...printed, ')'];
	}

	return [
		'(',
		indent([softline, ...printed]),
		ifBreak(shouldPrintComma(options, 'all') && !hasRestParameter(functionNode) ? ',' : ''),
		softline,
		')',
	];
}

function isSpreadLike(node) {
	return node && (node.type === 'SpreadElement' || node.type === 'RestElement');
}

function isBlockLikeFunction(node) {
	if (!node) {
		return false;
	}
	if (node.type === 'FunctionExpression') {
		return true;
	}
	if (node.type === 'ArrowFunctionExpression') {
		return node.body && node.body.type === 'BlockStatement';
	}
	return false;
}

function shouldHugLastArgument(args, argumentBreakFlags) {
	if (!args || args.length === 0) {
		return false;
	}

	const lastIndex = args.length - 1;
	const lastArg = args[lastIndex];

	if (isSpreadLike(lastArg)) {
		return false;
	}

	if (!isBlockLikeFunction(lastArg)) {
		return false;
	}

	if (hasComment(lastArg)) {
		return false;
	}

	for (let index = 0; index < lastIndex; index++) {
		const argument = args[index];
		if (isSpreadLike(argument) || hasComment(argument) || argumentBreakFlags[index]) {
			return false;
		}
	}

	return true;
}

// Check if arguments contain arrow functions with block bodies that should be hugged
function shouldHugArrowFunctions(args) {
	if (!args || args.length === 0) {
		return false;
	}

	// If any argument is an arrow function with a block body, we should hug
	return args.some((arg) => isBlockLikeFunction(arg));
}

function printCallArguments(path, options, print) {
	const { node } = path;
	const args = node.arguments || [];

	if (args.length === 0) {
		return '()';
	}

	const printedArguments = [];
	const argumentDocs = [];
	const argumentBreakFlags = [];
	let anyArgumentHasEmptyLine = false;

	path.each((argumentPath, index) => {
		const isLast = index === args.length - 1;
		const argumentNode = args[index];
		const argumentDoc = print(argumentPath, { isInlineContext: true });

		argumentDocs.push(argumentDoc);
		// Arrow functions with block bodies have internal breaks but shouldn't
		// cause the call arguments to break - they stay inline with the call
		const shouldTreatAsBreaking = willBreak(argumentDoc) && !isBlockLikeFunction(argumentNode);
		argumentBreakFlags.push(shouldTreatAsBreaking);

		if (!isLast) {
			if (isNextLineEmpty(argumentNode, options)) {
				anyArgumentHasEmptyLine = true;
				printedArguments.push(concat([argumentDoc, ',', hardline, hardline]));
			} else {
				printedArguments.push(concat([argumentDoc, ',', line]));
			}
		} else {
			printedArguments.push(argumentDoc);
		}
	}, 'arguments');

	const trailingComma = shouldPrintComma(options, 'all') ? ',' : '';

	// Special case: single array argument should keep opening bracket inline
	const isSingleArrayArgument =
		args.length === 1 &&
		args[0] &&
		(args[0].type === 'ArrayExpression' || args[0].type === 'TrackedArrayExpression');

	if (isSingleArrayArgument) {
		// Don't use group() - just concat to allow array to control its own breaking
		// For single argument, no trailing comma needed
		return concat(['(', argumentDocs[0], ')']);
	} // Check if we should hug arrow functions (keep params inline even when body breaks)
	const shouldHugArrows = shouldHugArrowFunctions(args);

	// For arrow functions, we want to keep params on same line as opening paren
	// but allow the block body to break naturally
	if (shouldHugArrows && !anyArgumentHasEmptyLine) {
		// Build a version that keeps arguments inline with opening paren
		const huggedParts = ['('];

		for (let index = 0; index < args.length; index++) {
			if (index > 0) {
				huggedParts.push(', ');
			}
			huggedParts.push(argumentDocs[index]);
		}

		huggedParts.push(')');

		// Don't use group - just concat to allow arrow function blocks to control breaking
		return concat(huggedParts);
	}

	// Build standard breaking version with indentation
	const contents = [
		'(',
		indent([softline, ...printedArguments]),
		ifBreak(trailingComma),
		softline,
		')',
	];

	// Force break only if there are explicit empty lines between arguments
	const shouldForceBreak = anyArgumentHasEmptyLine;

	const groupedContents = group(contents, {
		shouldBreak: shouldForceBreak,
	});
	if (!anyArgumentHasEmptyLine && shouldHugLastArgument(args, argumentBreakFlags)) {
		const lastIndex = args.length - 1;
		const inlineParts = ['('];

		for (let index = 0; index < lastIndex; index++) {
			if (index > 0) {
				inlineParts.push(', ');
			}
			inlineParts.push(argumentDocs[index]);
		}

		if (lastIndex > 0) {
			inlineParts.push(', ');
		}

		inlineParts.push(argumentDocs[lastIndex]);
		inlineParts.push(')');

		return conditionalGroup([group(inlineParts), groupedContents]);
	}

	return groupedContents;
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

	// Add TypeScript generics if present
	if (node.typeParameters) {
		const typeParams = path.call(print, 'typeParameters');
		if (Array.isArray(typeParams)) {
			parts.push(...typeParams);
		} else {
			parts.push(typeParams);
		}
	}

	// Print parameters using shared function
	const paramsPart = printFunctionParameters(path, options, print);
	parts.push(group(paramsPart));

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
	const skip_offset = node.type === 'TrackedObjectExpression' ? 2 : 1;
	const open_brace = node.type === 'TrackedObjectExpression' ? '#{' : '{';
	if (!node.properties || node.properties.length === 0) {
		return open_brace + '}';
	}

	// Check if there are blank lines between any properties
	let hasBlankLinesBetweenProperties = false;
	for (let i = 0; i < node.properties.length - 1; i++) {
		const current = node.properties[i];
		const next = node.properties[i + 1];
		if (current && next && getBlankLinesBetweenNodes(current, next) > 0) {
			hasBlankLinesBetweenProperties = true;
			break;
		}
	}

	// Check if object was originally multi-line
	let isOriginallyMultiLine = false;
	if (node.loc && node.loc.start && node.loc.end) {
		isOriginallyMultiLine = node.loc.start.line !== node.loc.end.line;
	}

	// Also check for blank lines at edges (after { or before })
	// If the original code has blank lines anywhere in the object, format multi-line
	let hasAnyBlankLines = hasBlankLinesBetweenProperties;
	if (!hasAnyBlankLines && node.properties.length > 0 && options.originalText) {
		const firstProp = node.properties[0];
		const lastProp = node.properties[node.properties.length - 1];

		// Check for blank line after opening brace (before first property)
		if (firstProp && node.loc && node.loc.start) {
			hasAnyBlankLines = getBlankLinesBetweenPositions(
				node.loc.start.offset(skip_offset),
				firstProp.loc.start,
			);
		}

		// Check for blank line before closing brace (after last property)
		if (!hasAnyBlankLines && lastProp && node.loc && node.loc.end) {
			hasAnyBlankLines = getBlankLinesBetweenPositions(
				lastProp.loc.end,
				node.loc.end.offset(-1), // -1 to skip the '}'
			);
		}
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
	// BUT: if there are ANY blank lines in the object (between props or at edges), always use multi-line
	if (isSimple && (isInArray || isInAttribute) && !hasAnyBlankLines) {
		if (isInArray) {
			if (isVerySimple) {
				// 1-property objects: force inline with spaces
				return concat([open_brace, ' ', properties[0], ' ', '}']);
			}
			// 2-property objects: let normal formatting handle it (will be multiline)
			// Fall through to default multiline formatting below
		} else {
			// For attributes, force inline without spaces
			const parts = [open_brace];
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

		return group(
			concat([open_brace, indent(concat([spacing, propertyDoc, trailingDoc])), spacing, '}']),
		);
	}

	// For objects that were originally inline (single-line) and don't have blank lines,
	// and aren't in arrays, allow inline formatting if it fits printWidth
	// This handles cases like `const T0: t17 = { x: 1 };` staying inline when it fits
	// The group() will automatically break to multi-line if it doesn't fit
	if (!hasAnyBlankLines && !isOriginallyMultiLine && !isInArray) {
		const separator = concat([',', line]);
		const propertyDoc = join(separator, properties);
		const spacing = options.bracketSpacing === false ? softline : line;
		const trailingDoc = shouldUseTrailingComma ? ifBreak(',', '') : '';

		return group(
			concat([open_brace, indent(concat([spacing, propertyDoc, trailingDoc])), spacing, '}']),
		);
	}

	let content = [hardline];
	if (properties.length > 0) {
		// Build properties with blank line preservation
		const propertyParts = [];
		for (let i = 0; i < properties.length; i++) {
			if (i > 0) {
				propertyParts.push(',');

				// Check for blank lines between properties and preserve them
				const prevProp = node.properties[i - 1];
				const currentProp = node.properties[i];
				if (prevProp && currentProp && getBlankLinesBetweenNodes(prevProp, currentProp) > 0) {
					propertyParts.push(hardline);
					propertyParts.push(hardline); // Two hardlines = blank line
				} else {
					propertyParts.push(hardline);
				}
			}
			propertyParts.push(properties[i]);
		}

		content.push(concat(propertyParts));
		if (shouldUseTrailingComma) {
			content.push(',');
		}
		content.push(hardline);
	}

	return group([open_brace, indent(content.slice(0, -1)), content[content.length - 1], '}']);
}

function printClassDeclaration(node, path, options, print) {
	const parts = [];
	parts.push('class ');
	parts.push(node.id.name);

	// Add TypeScript generics if present
	if (node.typeParameters) {
		const typeParams = path.call(print, 'typeParameters');
		if (Array.isArray(typeParams)) {
			parts.push(...typeParams);
		} else {
			parts.push(typeParams);
		}
	}

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

	// Add TypeScript generics if present (always on the method node, not on value)
	if (node.typeParameters) {
		const typeParams = path.call(print, 'typeParameters');
		if (Array.isArray(typeParams)) {
			parts.push(...typeParams);
		} else {
			parts.push(typeParams);
		}
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
	let objectPart = path.call(print, 'object');
	// Preserve parentheses around the object when present
	if (node.object.metadata?.parenthesized) {
		objectPart = concat(['(', objectPart, ')']);
	}
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

function printTSEnumDeclaration(node, path, options, print) {
	const parts = [];

	// Handle 'const enum' vs 'enum'
	if (node.const) {
		parts.push('const ');
	}

	parts.push('enum ');
	parts.push(node.id.name);
	parts.push(' ');

	// Print enum body
	if (!node.members || node.members.length === 0) {
		parts.push('{}');
	} else {
		const members = path.map(print, 'members');
		const membersWithCommas = [];

		for (let i = 0; i < members.length; i++) {
			membersWithCommas.push(members[i]);
			if (i < members.length - 1) {
				membersWithCommas.push(',');
				membersWithCommas.push(hardline);
			}
		}

		parts.push(
			group([
				'{',
				indent([hardline, concat(membersWithCommas)]),
				options.trailingComma !== 'none' ? ',' : '',
				hardline,
				'}',
			]),
		);
	}

	return concat(parts);
}

function printTSEnumMember(node, path, options, print) {
	const parts = [];

	// Print the key (id)
	if (node.id.type === 'Identifier') {
		parts.push(node.id.name);
	} else {
		// Handle computed or string literal keys
		parts.push(path.call(print, 'id'));
	}

	// Print the initializer if present
	if (node.initializer) {
		parts.push(' = ');
		parts.push(path.call(print, 'initializer'));
	}

	return concat(parts);
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
	const discriminantDoc = group(
		concat(['switch (', indent([softline, path.call(print, 'discriminant')]), softline, ')']),
	);

	const cases = [];
	for (let i = 0; i < node.cases.length; i++) {
		const caseDoc = [path.call(print, 'cases', i)];
		if (i < node.cases.length - 1 && isNextLineEmpty(node.cases[i], options)) {
			caseDoc.push(hardline);
		}
		cases.push(concat(caseDoc));
	}

	const bodyDoc =
		cases.length > 0 ? concat([indent([hardline, join(hardline, cases)]), hardline]) : hardline;

	return concat([discriminantDoc, ' {', bodyDoc, '}']);
}

function printSwitchCase(node, path, options, print) {
	const header = node.test ? concat(['case ', path.call(print, 'test'), ':']) : 'default:';

	const consequents = node.consequent || [];
	const printedConsequents = [];
	const referencedConsequents = [];

	for (let i = 0; i < consequents.length; i++) {
		const child = consequents[i];
		if (!child || child.type === 'EmptyStatement') {
			continue;
		}
		referencedConsequents.push(child);
		printedConsequents.push(path.call(print, 'consequent', i));
	}

	let bodyDoc = null;
	if (printedConsequents.length > 0) {
		const singleBlock =
			printedConsequents.length === 1 && referencedConsequents[0].type === 'BlockStatement';
		if (singleBlock) {
			bodyDoc = concat([' ', printedConsequents[0]]);
		} else {
			bodyDoc = indent([hardline, join(hardline, printedConsequents)]);
		}
	}

	let trailingDoc = null;
	if (node.trailingComments && node.trailingComments.length > 0) {
		const commentDocs = [];
		let previousNode =
			referencedConsequents.length > 0
				? referencedConsequents[referencedConsequents.length - 1]
				: node;

		for (let i = 0; i < node.trailingComments.length; i++) {
			const comment = node.trailingComments[i];
			const blankLines = previousNode ? getBlankLinesBetweenNodes(previousNode, comment) : 0;
			commentDocs.push(hardline);
			for (let j = 0; j < blankLines; j++) {
				commentDocs.push(hardline);
			}
			const commentDoc =
				comment.type === 'Line'
					? concat(['//', comment.value])
					: concat(['/*', comment.value, '*/']);
			commentDocs.push(commentDoc);
			previousNode = comment;
		}

		trailingDoc = concat(commentDocs);
		delete node.trailingComments;
	}

	const parts = [header];
	if (bodyDoc) {
		parts.push(bodyDoc);
	}
	if (trailingDoc) {
		parts.push(trailingDoc);
	}

	return concat(parts);
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

function getBlankLinesBetweenPositions(current_pos, next_pos) {
	const line_gap = next_pos.line - current_pos.line;

	// lineGap = 1 means adjacent lines (no blank lines)
	// lineGap = 2 means one blank line between them
	// lineGap = 3 means two blank lines between them, etc.
	return Math.max(0, line_gap - 1);
}

function getBlankLinesBetweenNodes(currentNode, nextNode) {
	// Return the number of blank lines between two nodes based on their location
	if (
		currentNode.loc &&
		nextNode?.loc &&
		typeof currentNode.loc.end?.line === 'number' &&
		typeof nextNode.loc.start?.line === 'number'
	) {
		return getBlankLinesBetweenPositions(currentNode.loc.end, nextNode.loc.start);
	}

	// If no location info, assume no whitespace
	return 0;
}

function shouldAddBlankLine(currentNode, nextNode) {
	// Simplified blank line logic:
	// 1. Check if there was originally 1+ blank lines between nodes
	// 2. If yes, preserve exactly 1 blank line (collapse multiple to one)
	// 3. Only exception: add blank line after imports when followed by non-imports
	//    (this is standard Prettier behavior)

	// Determine the source node for whitespace checking
	// If currentNode has trailing comments, use the last one
	let sourceNode = currentNode;
	if (currentNode.trailingComments && currentNode.trailingComments.length > 0) {
		sourceNode = currentNode.trailingComments[currentNode.trailingComments.length - 1];
	}

	// If nextNode has leading comments, check whitespace between source node and first comment
	// Otherwise check whitespace between source node and next node
	let targetNode = nextNode;
	if (nextNode.leadingComments && nextNode.leadingComments.length > 0) {
		targetNode = nextNode.leadingComments[0];
	}

	// Check if there was original whitespace between the nodes
	const originalBlankLines = getBlankLinesBetweenNodes(sourceNode, targetNode);

	// Special case: Always add blank line after import declarations when followed by non-imports
	// This is standard Prettier behavior for separating imports from code
	if (currentNode.type === 'ImportDeclaration' && nextNode.type !== 'ImportDeclaration') {
		return true;
	}

	// Default behavior: preserve blank line if one or more existed originally
	return originalBlankLines > 0;
}

function printObjectPattern(node, path, options, print) {
	const propList = path.map(print, 'properties');
	if (propList.length === 0) {
		if (node.typeAnnotation) {
			return concat(['{}', ': ', path.call(print, 'typeAnnotation')]);
		}
		return '{}';
	}

	const allowTrailingComma =
		node.properties &&
		node.properties.length > 0 &&
		node.properties[node.properties.length - 1].type !== 'RestElement';

	const trailingCommaDoc =
		allowTrailingComma && options.trailingComma !== 'none' ? ifBreak(',', '') : '';

	// When the pattern has a type annotation, we need to format them together
	// so they break at the same time
	if (node.typeAnnotation) {
		const typeAnn = node.typeAnnotation.typeAnnotation;

		// If it's a TSTypeLiteral, format both object and type
		if (typeAnn && typeAnn.type === 'TSTypeLiteral') {
			const typeMembers = path.call(
				(path) => path.map(print, 'members'),
				'typeAnnotation',
				'typeAnnotation',
			);

			// Use softline for proper spacing - will become space when inline, line when breaking
			// Format type members with semicolons between AND after the last member
			const typeMemberDocs = join(concat([';', line]), typeMembers);

			// Don't wrap in group - let the outer params group control breaking
			const objectDoc = concat([
				'{',
				indent(concat([line, join(concat([',', line]), propList), trailingCommaDoc])),
				line,
				'}',
			]);
			const typeDoc =
				typeMembers.length === 0
					? '{}'
					: concat(['{', indent(concat([line, typeMemberDocs, ifBreak(';', '')])), line, '}']);

			// Return combined
			return concat([objectDoc, ': ', typeDoc]);
		}

		// For other type annotations, just concatenate
		const objectContent = group(
			concat([
				'{',
				indent(concat([line, join(concat([',', line]), propList), trailingCommaDoc])),
				line,
				'}',
			]),
		);
		return concat([objectContent, ': ', path.call(print, 'typeAnnotation')]);
	}

	// No type annotation - just format the object pattern
	const objectContent = group(
		concat([
			'{',
			indent(concat([line, join(concat([',', line]), propList), trailingCommaDoc])),
			line,
			'}',
		]),
	);

	return objectContent;
}

function printArrayPattern(node, path, options, print) {
	const parts = [];
	parts.push('[');
	const elementList = path.map(print, 'elements');
	for (let i = 0; i < elementList.length; i++) {
		if (i > 0) parts.push(', ');
		parts.push(elementList[i]);
	}
	parts.push(']');

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

	// Handle method shorthand: increment() {} instead of increment: function() {}
	if (node.method && node.value.type === 'FunctionExpression') {
		const methodParts = [];
		const funcValue = node.value;

		// Handle async and generator
		if (funcValue.async) {
			methodParts.push('async ');
		}

		// Print key (with computed property brackets if needed)
		if (node.computed) {
			methodParts.push('[', path.call(print, 'key'), ']');
		} else if (node.key.type === 'Literal' && typeof node.key.value === 'string') {
			// Check if the key is a valid identifier that doesn't need quotes
			const key = node.key.value;
			const isValidIdentifier = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key);
			if (isValidIdentifier) {
				methodParts.push(key);
			} else {
				methodParts.push(formatStringLiteral(key, options));
			}
		} else {
			methodParts.push(path.call(print, 'key'));
		}

		if (funcValue.generator) {
			methodParts.push('*');
		}

		// Print parameters by calling into the value path
		const paramsPart = path.call(
			(valuePath) => printFunctionParameters(valuePath, options, print),
			'value',
		);
		methodParts.push(group(paramsPart));

		// Handle return type annotation
		if (funcValue.returnType) {
			methodParts.push(': ', path.call(print, 'value', 'returnType'));
		}

		methodParts.push(' ', path.call(print, 'value', 'body'));
		return concat(methodParts);
	}

	// Handle property key - if it's a Literal (quoted string in source),
	// check if it needs quotes or can be unquoted
	if (node.computed) {
		// Computed property: [key]
		parts.push('[', path.call(print, 'key'), ']');
	} else if (node.key.type === 'Literal' && typeof node.key.value === 'string') {
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
		// For non-literal keys, print normally
		parts.push(path.call(print, 'key'));
	}

	parts.push(': ');
	parts.push(path.call(print, 'value'));
	return concat(parts);
}

function printVariableDeclarator(node, path, options, print) {
	if (node.init) {
		const id = path.call(print, 'id');
		const init = path.call(print, 'init');

		// For arrays/objects with blank lines, use conditionalGroup to try both layouts
		// Prettier will break the declaration if keeping it inline doesn't fit
		const isArray =
			node.init.type === 'ArrayExpression' || node.init.type === 'TrackedArrayExpression';
		const isObject =
			node.init.type === 'ObjectExpression' || node.init.type === 'TrackedObjectExpression';

		if (isArray || isObject) {
			const items = isArray ? node.init.elements || [] : node.init.properties || [];
			let hasBlankLines = false;

			if (isArray) {
				for (let i = 1; i < items.length; i++) {
					const prevElement = items[i - 1];
					const currentElement = items[i];
					if (
						prevElement &&
						currentElement &&
						getBlankLinesBetweenNodes(prevElement, currentElement) > 0
					) {
						hasBlankLines = true;
						break;
					}
				}
			} else {
				for (let i = 0; i < items.length - 1; i++) {
					const current = items[i];
					const next = items[i + 1];
					if (current && next && getBlankLinesBetweenNodes(current, next) > 0) {
						hasBlankLines = true;
						break;
					}
				}
			}

			if (hasBlankLines) {
				// Provide two alternatives: inline vs broken
				// Prettier picks the broken version if inline doesn't fit
				return conditionalGroup([
					// Try inline first
					concat([id, ' = ', init]),
					// Fall back to broken with extra indent
					concat([id, ' =', indent(concat([line, init]))]),
				]);
			}
		}

		return concat([id, ' = ', init]);
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
	const inlineMembers = members.map((member, index) =>
		index < members.length - 1 ? concat([member, ';']) : member,
	);
	const multilineMembers = members.map((member) => concat([member, ';']));

	const inlineDoc = group(
		concat(['{', indent(concat([line, join(line, inlineMembers)])), line, '}']),
	);

	const multilineDoc = group(
		concat(['{', indent(concat([hardline, join(hardline, multilineMembers)])), hardline, '}']),
	);

	return conditionalGroup(
		wasOriginallySingleLine(node) ? [inlineDoc, multilineDoc] : [multilineDoc, inlineDoc],
	);
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
	const readonlyMod =
		node.readonly === true || node.readonly === 'plus' || node.readonly === '+'
			? 'readonly '
			: node.readonly === 'minus' || node.readonly === '-'
				? '-readonly '
				: '';

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
		// Check for blank lines between CSS items and preserve them
		const result = [];
		for (let i = 0; i < cssItems.length; i++) {
			result.push(cssItems[i]);
			if (i < cssItems.length - 1) {
				// Check if there are blank lines between current and next item
				const currentItem = node.body[i];
				const nextItem = node.body[i + 1];

				// Check for blank lines in the original CSS source between rules
				let hasBlankLine = false;
				if (
					node.source &&
					typeof currentItem.end === 'number' &&
					typeof nextItem.start === 'number'
				) {
					const textBetween = node.source.substring(currentItem.end, nextItem.start);
					// Count newlines in the text between the rules
					const newlineCount = (textBetween.match(/\n/g) || []).length;
					// If there are 2 or more newlines, there's at least one blank line
					hasBlankLine = newlineCount >= 2;
				}
				if (hasBlankLine) {
					// If there are blank lines, add an extra hardline (to create a blank line)
					result.push(hardline, hardline);
				} else {
					result.push(hardline);
				}
			}
		}

		return concat(result);
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
		// Join selectors with comma and line break for proper CSS formatting
		return join([',', hardline], selectors);
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
	const parts = [];

	// Print combinator if it exists (e.g., +, >, ~, or space)
	if (node.combinator) {
		if (node.combinator.name === ' ') {
			// Space combinator (descendant selector)
			parts.push(' ');
		} else {
			// Other combinators (+, >, ~)
			parts.push(' ', node.combinator.name, ' ');
		}
	}

	if (node.selectors && node.selectors.length > 0) {
		const selectorParts = [];
		for (let i = 0; i < node.selectors.length; i++) {
			const part = path.call(print, 'selectors', i);
			selectorParts.push(part);
		}
		parts.push(...selectorParts);
	}

	return concat(parts);
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

function printCSSNestingSelector(node, path, options, print) {
	// NestingSelector for & (parent reference in nested CSS)
	return '&';
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

function shouldInlineSingleChild(parentNode, firstChild, childDoc) {
	if (!firstChild || childDoc == null) {
		return false;
	}

	if (typeof childDoc === 'string') {
		return childDoc.length <= 20 && !childDoc.includes('\n');
	}

	if (firstChild.type === 'Text' || firstChild.type === 'Html') {
		return true;
	}

	if (
		(firstChild.type === 'Element' || firstChild.type === 'JSXElement') &&
		firstChild.selfClosing
	) {
		return !parentNode.attributes || parentNode.attributes.length === 0;
	}

	return false;
}

function getElementLeadingComments(node) {
	const fromMetadata = node?.metadata?.elementLeadingComments;
	if (Array.isArray(fromMetadata)) {
		return fromMetadata;
	}
	return [];
}

function createElementLevelCommentParts(comments) {
	if (!comments || comments.length === 0) {
		return [];
	}

	const parts = [];

	for (let i = 0; i < comments.length; i++) {
		const comment = comments[i];
		const nextComment = comments[i + 1];

		if (comment.type === 'Line') {
			parts.push('//' + comment.value);
			parts.push(hardline);
		} else if (comment.type === 'Block') {
			parts.push('/*' + comment.value + '*/');
			parts.push(hardline);
		}

		if (nextComment) {
			const blankLinesBetween = getBlankLinesBetweenNodes(comment, nextComment);
			if (blankLinesBetween > 0) {
				parts.push(hardline);
			}
		}
	}

	return parts;
}

function printTsxCompat(node, path, options, print) {
	const tagName = `<tsx:${node.kind}>`;
	const closingTagName = `</tsx:${node.kind}>`;

	const hasChildren = Array.isArray(node.children) && node.children.length > 0;

	if (!hasChildren) {
		return concat([tagName, closingTagName]);
	}

	// Print JSXElement children - they remain as JSX
	// Filter out whitespace-only JSXText nodes
	const finalChildren = [];

	for (let i = 0; i < node.children.length; i++) {
		const child = node.children[i];

		// Skip whitespace-only JSXText nodes
		if (child.type === 'JSXText' && !child.value.trim()) {
			continue;
		}

		const printedChild = path.call(print, 'children', i);
		finalChildren.push(printedChild);

		if (i < node.children.length - 1) {
			// Only add hardline if the next child is not whitespace-only
			const nextChild = node.children[i + 1];
			if (nextChild && !(nextChild.type === 'JSXText' && !nextChild.value.trim())) {
				finalChildren.push(hardline);
			}
		}
	}

	// Format the TsxCompat element
	const elementOutput = group([
		tagName,
		indent(concat([hardline, ...finalChildren])),
		hardline,
		closingTagName,
	]);

	return elementOutput;
}

function printJSXElement(node, path, options, print) {
	// Get the tag name from the opening element
	const openingElement = node.openingElement;
	const closingElement = node.closingElement;

	let tagName;
	if (openingElement.name.type === 'JSXIdentifier') {
		tagName = openingElement.name.name;
	} else if (openingElement.name.type === 'JSXMemberExpression') {
		// Handle Member expressions like React.Fragment
		tagName = printJSXMemberExpression(openingElement.name);
	} else {
		tagName = openingElement.name.name || 'Unknown';
	}

	const isSelfClosing = openingElement.selfClosing;
	const hasAttributes = openingElement.attributes && openingElement.attributes.length > 0;
	const hasChildren = node.children && node.children.length > 0;

	// Format attributes
	let attributesDoc = '';
	if (hasAttributes) {
		const attrs = openingElement.attributes.map((attr, i) => {
			if (attr.type === 'JSXAttribute') {
				return printJSXAttribute(attr, path, options, print, i);
			} else if (attr.type === 'JSXSpreadAttribute') {
				return concat([
					'{...',
					path.call(print, 'openingElement', 'attributes', i, 'argument'),
					'}',
				]);
			}
			return '';
		});
		attributesDoc = concat([' ', join(' ', attrs)]);
	}

	if (isSelfClosing) {
		return concat(['<', tagName, attributesDoc, ' />']);
	}

	if (!hasChildren) {
		return concat(['<', tagName, attributesDoc, '></', tagName, '>']);
	}

	// Format children - filter out empty text nodes
	const childrenDocs = [];
	for (let i = 0; i < node.children.length; i++) {
		const child = node.children[i];

		if (child.type === 'JSXText') {
			// Handle JSX text nodes - only include if not just whitespace
			const text = child.value;
			if (text.trim()) {
				childrenDocs.push(text);
			}
		} else if (child.type === 'JSXExpressionContainer') {
			// Handle JSX expression containers
			childrenDocs.push(concat(['{', path.call(print, 'children', i, 'expression'), '}']));
		} else {
			// Handle nested JSX elements
			childrenDocs.push(path.call(print, 'children', i));
		}
	}

	// Check if content can be inlined (single text node or single expression)
	if (childrenDocs.length === 1 && typeof childrenDocs[0] === 'string') {
		return concat(['<', tagName, attributesDoc, '>', childrenDocs[0], '</', tagName, '>']);
	}

	// Multiple children or complex children - format with line breaks
	const formattedChildren = [];
	for (let i = 0; i < childrenDocs.length; i++) {
		formattedChildren.push(childrenDocs[i]);
		if (i < childrenDocs.length - 1) {
			formattedChildren.push(hardline);
		}
	}

	// Build the final element
	return group([
		'<',
		tagName,
		attributesDoc,
		'>',
		indent(concat([hardline, ...formattedChildren])),
		hardline,
		'</',
		tagName,
		'>',
	]);
}

function printJSXFragment(node, path, options, print) {
	const hasChildren = node.children && node.children.length > 0;

	if (!hasChildren) {
		return '<></>';
	}

	// Format children - filter out empty text nodes
	const childrenDocs = [];
	for (let i = 0; i < node.children.length; i++) {
		const child = node.children[i];

		if (child.type === 'JSXText') {
			// Handle JSX text nodes - trim whitespace and only include if not empty
			const text = child.value.trim();
			if (text) {
				childrenDocs.push(text);
			}
		} else if (child.type === 'JSXExpressionContainer') {
			// Handle JSX expression containers
			childrenDocs.push(concat(['{', path.call(print, 'children', i, 'expression'), '}']));
		} else {
			// Handle nested JSX elements and fragments
			childrenDocs.push(path.call(print, 'children', i));
		}
	}

	// Check if content can be inlined (single text node or single expression)
	if (childrenDocs.length === 1 && typeof childrenDocs[0] === 'string') {
		return concat(['<>', childrenDocs[0], '</>']);
	}

	// Multiple children or complex children - format with line breaks
	const formattedChildren = [];
	for (let i = 0; i < childrenDocs.length; i++) {
		formattedChildren.push(childrenDocs[i]);
		if (i < childrenDocs.length - 1) {
			formattedChildren.push(hardline);
		}
	}

	// Build the final fragment
	return group(['<>', indent(concat([hardline, ...formattedChildren])), hardline, '</>']);
}

function printJSXAttribute(attr, path, options, print, index) {
	const name = attr.name.name;

	if (!attr.value) {
		return name;
	}

	if (attr.value.type === 'Literal' || attr.value.type === 'StringLiteral') {
		const quote = options.jsxSingleQuote ? "'" : '"';
		return concat([name, '=', quote, attr.value.value, quote]);
	}

	if (attr.value.type === 'JSXExpressionContainer') {
		// For JSXExpressionContainer, we need to access the expression inside
		// Use a simple approach since we don't have direct path access here
		const exprValue = attr.value.expression;
		let exprStr;

		if (exprValue.type === 'Literal' || exprValue.type === 'StringLiteral') {
			exprStr = JSON.stringify(exprValue.value);
		} else if (exprValue.type === 'Identifier') {
			exprStr = (exprValue.tracked ? '@' : '') + exprValue.name;
		} else if (exprValue.type === 'MemberExpression') {
			exprStr = printMemberExpressionSimple(exprValue, options);
		} else {
			// For complex expressions, try to stringify
			exprStr = '...';
		}

		return concat([name, '={', exprStr, '}']);
	}

	return name;
}

function printJSXMemberExpression(node) {
	if (node.type === 'JSXIdentifier') {
		return node.name;
	}
	if (node.type === 'JSXMemberExpression') {
		return printJSXMemberExpression(node.object) + '.' + printJSXMemberExpression(node.property);
	}
	return 'Unknown';
}

function printMemberExpressionSimple(node, options, computed = false) {
	if (node.type === 'Identifier') {
		return node.name;
	}

	if (node.type === 'MemberExpression') {
		const obj = printMemberExpressionSimple(node.object, options);
		const prop = node.computed
			? (node.property.tracked ? '.@[' : '[') +
				printMemberExpressionSimple(node.property, options, node.computed) +
				']'
			: (node.property.tracked ? '.@' : '.') +
				printMemberExpressionSimple(node.property, options, node.computed);
		return obj + prop;
	}

	if (node.type === 'Literal') {
		return computed ? formatStringLiteral(node.value, options) : JSON.stringify(node.value);
	}
	return '';
}

function printElement(node, path, options, print) {
	const tagName = (node.id.tracked ? '@' : '') + printMemberExpressionSimple(node.id, options);

	const elementLeadingComments = getElementLeadingComments(node);
	const metadataCommentParts =
		elementLeadingComments.length > 0 ? createElementLevelCommentParts(elementLeadingComments) : [];
	const fallbackElementComments = [];
	const shouldLiftTextLevelComments = elementLeadingComments.length === 0;

	const hasChildren = Array.isArray(node.children) && node.children.length > 0;
	const hasInnerComments = Array.isArray(node.innerComments) && node.innerComments.length > 0;
	const isSelfClosing = !!node.selfClosing;
	const hasAttributes = Array.isArray(node.attributes) && node.attributes.length > 0;

	if (isSelfClosing && !hasInnerComments && !hasAttributes) {
		const elementDoc = group(['<', tagName, ' />']);
		return metadataCommentParts.length > 0
			? concat([...metadataCommentParts, elementDoc])
			: elementDoc;
	}

	// Determine the line break type for attributes
	// When singleAttributePerLine is true, force each attribute on its own line with hardline
	// Otherwise, use line to allow collapsing when it fits
	const attrLineBreak = options.singleAttributePerLine ? hardline : line;

	const shouldUseSelfClosingSyntax = isSelfClosing || (!hasChildren && !hasInnerComments);

	const openingTag = group([
		'<',
		tagName,
		hasAttributes
			? indent(
					concat([
						...path.map((attrPath) => {
							return concat([attrLineBreak, print(attrPath)]);
						}, 'attributes'),
					]),
				)
			: '',
		// Add line break opportunity before > or />
		// Use line for self-closing (keeps space), softline for non-self-closing when attributes present
		// When bracketSameLine is true, don't add line break for non-self-closing elements
		shouldUseSelfClosingSyntax
			? hasAttributes
				? line
				: ''
			: hasAttributes && !options.bracketSameLine
				? softline
				: '',
		shouldUseSelfClosingSyntax ? (hasAttributes ? '/>' : ' />') : '>',
	]);

	if (!hasChildren) {
		if (!hasInnerComments) {
			return metadataCommentParts.length > 0
				? concat([...metadataCommentParts, openingTag])
				: openingTag;
		}

		const innerParts = [];
		for (const comment of node.innerComments) {
			if (comment.type === 'Line') {
				innerParts.push('//' + comment.value);
				innerParts.push(hardline);
			} else if (comment.type === 'Block') {
				innerParts.push('/*' + comment.value + '*/');
				innerParts.push(hardline);
			}
		}

		if (innerParts.length > 0 && innerParts[innerParts.length - 1] === hardline) {
			innerParts.pop();
		}

		const closingTag = concat(['</', tagName, '>']);
		const elementOutput = group([
			openingTag,
			indent(concat([hardline, ...innerParts])),
			hardline,
			closingTag,
		]);
		return metadataCommentParts.length > 0
			? concat([...metadataCommentParts, elementOutput])
			: elementOutput;
	}

	// Has children - use unified children processing
	// Build children with whitespace preservation
	const finalChildren = [];

	for (let i = 0; i < node.children.length; i++) {
		const currentChild = node.children[i];
		const nextChild = node.children[i + 1];
		const isTextLikeChild = currentChild.type === 'Text' || currentChild.type === 'Html';
		const hasTextLeadingComments =
			shouldLiftTextLevelComments &&
			isTextLikeChild &&
			Array.isArray(currentChild.leadingComments) &&
			currentChild.leadingComments.length > 0;
		const rawExpressionLeadingComments =
			isTextLikeChild && Array.isArray(currentChild.expression?.leadingComments)
				? currentChild.expression.leadingComments
				: null;

		if (hasTextLeadingComments) {
			for (let j = 0; j < currentChild.leadingComments.length; j++) {
				fallbackElementComments.push(currentChild.leadingComments[j]);
			}
		}

		const childPrintArgs = {};
		if (hasTextLeadingComments) {
			childPrintArgs.suppressLeadingComments = true;
		}
		if (rawExpressionLeadingComments && rawExpressionLeadingComments.length > 0) {
			childPrintArgs.suppressExpressionLeadingComments = true;
		}

		const printedChild =
			Object.keys(childPrintArgs).length > 0
				? path.call((childPath) => print(childPath, childPrintArgs), 'children', i)
				: path.call(print, 'children', i);

		const childDoc =
			rawExpressionLeadingComments && rawExpressionLeadingComments.length > 0
				? concat([...createElementLevelCommentParts(rawExpressionLeadingComments), printedChild])
				: printedChild;
		finalChildren.push(childDoc);

		if (nextChild) {
			const whitespaceLinesCount = getBlankLinesBetweenNodes(currentChild, nextChild);
			const isTextOrHtmlChild =
				currentChild.type === 'Text' ||
				currentChild.type === 'Html' ||
				nextChild.type === 'Text' ||
				nextChild.type === 'Html';

			if (whitespaceLinesCount > 0) {
				finalChildren.push(hardline);
				finalChildren.push(hardline);
			} else if (!isTextOrHtmlChild && shouldAddBlankLine(currentChild, nextChild)) {
				finalChildren.push(hardline);
				finalChildren.push(hardline);
			} else {
				finalChildren.push(hardline);
			}
		}
	}

	const fallbackCommentParts =
		fallbackElementComments.length > 0
			? createElementLevelCommentParts(fallbackElementComments)
			: [];
	const leadingCommentParts =
		metadataCommentParts.length > 0
			? [...metadataCommentParts, ...fallbackCommentParts]
			: fallbackCommentParts;

	const closingTag = concat(['</', tagName, '>']);
	let elementOutput;

	const hasComponentChild =
		node.children &&
		node.children.some((child) => child.type === 'Component' && !child.selfClosing);

	if (finalChildren.length === 1 && !hasComponentChild) {
		const child = finalChildren[0];
		const firstChild = node.children[0];
		const isNonSelfClosingElement =
			firstChild &&
			(firstChild.type === 'Element' || firstChild.type === 'JSXElement') &&
			!firstChild.selfClosing;
		const isElementChild =
			firstChild && (firstChild.type === 'Element' || firstChild.type === 'JSXElement');

		if (typeof child === 'string' && child.length < 20) {
			elementOutput = group([openingTag, child, closingTag]);
		} else if (
			child &&
			typeof child === 'object' &&
			!isNonSelfClosingElement &&
			shouldInlineSingleChild(node, firstChild, child)
		) {
			if (isElementChild && hasAttributes) {
				elementOutput = concat([
					openingTag,
					indent(concat([hardline, child])),
					hardline,
					closingTag,
				]);
			} else {
				elementOutput = group([
					openingTag,
					indent(concat([softline, child])),
					softline,
					closingTag,
				]);
			}
		} else {
			elementOutput = concat([
				openingTag,
				indent(concat([hardline, ...finalChildren])),
				hardline,
				closingTag,
			]);
		}
	} else {
		elementOutput = group([
			openingTag,
			indent(concat([hardline, ...finalChildren])),
			hardline,
			closingTag,
		]);
	}

	return leadingCommentParts.length > 0
		? concat([...leadingCommentParts, elementOutput])
		: elementOutput;
}

function printAttribute(node, path, options, print) {
	const parts = [];

	// Handle shorthand syntax: {id} instead of id={id}
	// Check if either node.shorthand is true, OR if the value is an Identifier with the same name
	const isShorthand =
		node.shorthand ||
		(node.value && node.value.type === 'Identifier' && node.value.name === node.name.name);

	if (isShorthand) {
		parts.push('{');
		// Check if the value has tracked property for @count syntax
		const trackedPrefix = node.value && node.value.tracked ? '@' : '';
		parts.push(trackedPrefix + node.name.name);
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
			parts.push(
				formatStringLiteral(node.value.value, { ...options, singleQuote: useJsxSingleQuote }),
			);
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
