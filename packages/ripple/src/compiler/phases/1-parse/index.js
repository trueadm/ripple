/** @import * as AST from 'estree' */
/** @import * as ESTreeJSX from 'estree-jsx' */
/** @import { Parse } from '#parser' */

/**
 * @import {
 *   RipplePluginConfig
 * } from '#compiler' */

/** @import { ParseOptions } from 'ripple/compiler' */

import * as acorn from 'acorn';
import { tsPlugin } from '@sveltejs/acorn-typescript';
import { parse_style } from './style.js';
import { walk } from 'zimmerframe';
import { regex_newline_characters } from '../../../utils/patterns.js';

/**
 * @typedef {(BaseParser: typeof acorn.Parser) => typeof acorn.Parser} AcornPlugin
 */

const parser = /** @type {Parse.ParserConstructor} */ (
	/** @type {unknown} */ (
		acorn.Parser.extend(
			tsPlugin({ jsx: true }),
			/** @type {AcornPlugin} */ (/** @type {unknown} */ (RipplePlugin())),
		)
	)
);

/** @type {Parse.BindingType} */
const BINDING_TYPES = {
	BIND_NONE: 0, // Not a binding
	BIND_VAR: 1, // Var-style binding
	BIND_LEXICAL: 2, // Let- or const-style binding
	BIND_FUNCTION: 3, // Function declaration
	BIND_SIMPLE_CATCH: 4, // Simple (identifier pattern) catch binding
	BIND_OUTSIDE: 5, // Special case for function names as bound inside the function
};

/**
 * @this {Parse.DestructuringErrors}
 * @returns {Parse.DestructuringErrors}
 */
function DestructuringErrors() {
	if (!(this instanceof DestructuringErrors)) {
		throw new TypeError("'DestructuringErrors' must be invoked with 'new'");
	}
	this.shorthandAssign = -1;
	this.trailingComma = -1;
	this.parenthesizedAssign = -1;
	this.parenthesizedBind = -1;
	this.doubleProto = -1;
	return this;
}

/**
 * Convert JSX node types to regular JavaScript node types
 * @param {ESTreeJSX.JSXIdentifier | ESTreeJSX.JSXMemberExpression | AST.Node} node - The JSX node to convert
 * @returns {AST.Identifier | AST.MemberExpression | AST.Node} The converted node
 */
function convert_from_jsx(node) {
	/** @type {AST.Identifier | AST.MemberExpression | AST.Node} */
	let converted_node;
	if (node.type === 'JSXIdentifier') {
		converted_node = /** @type {AST.Identifier} */ (/** @type {unknown} */ (node));
		converted_node.type = 'Identifier';
	} else if (node.type === 'JSXMemberExpression') {
		converted_node = /** @type {AST.MemberExpression} */ (/** @type {unknown} */ (node));
		converted_node.type = 'MemberExpression';
		converted_node.object = /** @type {AST.Identifier | AST.MemberExpression} */ (
			convert_from_jsx(converted_node.object)
		);
		converted_node.property = /** @type {AST.Identifier} */ (
			convert_from_jsx(converted_node.property)
		);
	} else {
		converted_node = node;
	}
	return converted_node;
}

const regex_whitespace_only = /\s/;

/**
 * Skip whitespace characters without skipping comments.
 * This is needed because Acorn's skipSpace() also skips comments, which breaks
 * parsing in certain contexts. Updates parser position and line tracking.
 * @param {Parse.Parser} parser
 */
function skipWhitespace(parser) {
	const originalStart = parser.start;
	/** @type {acorn.Position | undefined} */
	let lineInfo;
	while (
		parser.start < parser.input.length &&
		regex_whitespace_only.test(parser.input[parser.start])
	) {
		parser.start++;
	}
	// Update line tracking if whitespace was skipped
	if (parser.start !== originalStart) {
		lineInfo = acorn.getLineInfo(parser.input, parser.start);
		parser.curLine = lineInfo.line;
		parser.lineStart = parser.start - lineInfo.column;
	}

	// After skipping whitespace, update startLoc to reflect our actual position
	// so the next node's start location is correct
	parser.startLoc = lineInfo || acorn.getLineInfo(parser.input, parser.start);
}

/**
 * @param {AST.Node | null | undefined} node
 * @returns {boolean}
 */
function isWhitespaceTextNode(node) {
	if (!node || node.type !== 'Text') {
		return false;
	}

	const expr = node.expression;
	if (expr && expr.type === 'Literal' && typeof expr.value === 'string') {
		return /^\s*$/.test(expr.value);
	}
	return false;
}

/**
 * @param {AST.Element} element
 * @param {ESTreeJSX.JSXOpeningElement} open
 */
function addOpeningAndClosing(element, open) {
	const name = /** @type {ESTreeJSX.JSXIdentifier} */ (open.name).name;

	element.openingElement = open;
	element.closingElement = {
		type: 'JSXClosingElement',
		name: open.name,
		start: /** @type {AST.NodeWithLocation} */ (element).end - `</${name}>`.length,
		end: element.end,
		loc: {
			start: {
				line: element.loc.end.line,
				column: element.loc.end.column - `</${name}>`.length,
			},
			end: {
				line: element.loc.end.line,
				column: element.loc.end.column,
			},
		},
		metadata: { path: [] },
	};
}

/**
 * Acorn parser plugin for Ripple syntax extensions
 * @param {RipplePluginConfig} [config] - Plugin configuration
 * @returns {(Parser: Parse.ParserConstructor) => Parse.ParserConstructor} Parser extension function
 */
function RipplePlugin(config) {
	return (/** @type {Parse.ParserConstructor} */ Parser) => {
		const original = acorn.Parser.prototype;
		const tt = Parser.tokTypes || acorn.tokTypes;
		const tc = Parser.tokContexts || acorn.tokContexts;
		const tstt = Parser.acornTypeScript.tokTypes;
		const tstc = Parser.acornTypeScript.tokContexts;

		class RippleParser extends Parser {
			/** @type {AST.Node[]} */
			#path = [];
			#commentContextId = 0;
			#loose = false;

			/**
			 * @param {Parse.Options} options
			 * @param {string} input
			 */
			constructor(options, input) {
				super(options, input);
				this.#loose = options?.rippleOptions.loose === true;
			}

			/**
			 * @returns {Parse.CommentMetaData | null}
			 */
			#createCommentMetadata() {
				if (this.#path.length === 0) {
					return null;
				}

				const container = this.#path[this.#path.length - 1];
				if (!container || container.type !== 'Element') {
					return null;
				}

				const children = Array.isArray(container.children) ? container.children : [];
				const hasMeaningfulChildren = children.some(
					(child) => child && !isWhitespaceTextNode(child),
				);

				if (hasMeaningfulChildren) {
					return null;
				}

				container.metadata ??= { path: [] };
				if (container.metadata.commentContainerId === undefined) {
					container.metadata.commentContainerId = ++this.#commentContextId;
				}

				return /*** @type {Parse.CommentMetaData} */ ({
					containerId: container.metadata.commentContainerId,
					childIndex: children.length,
					beforeMeaningfulChild: !hasMeaningfulChildren,
				});
			}

			/**
			 * Helper method to get the element name from a JSX identifier or member expression
			 * @type {Parse.Parser['getElementName']}
			 */
			getElementName(node) {
				if (!node) return null;
				if (node.type === 'Identifier' || node.type === 'JSXIdentifier') {
					return node.name;
				} else if (node.type === 'MemberExpression' || node.type === 'JSXMemberExpression') {
					// For components like <Foo.Bar>, return "Foo.Bar"
					return this.getElementName(node.object) + '.' + this.getElementName(node.property);
				}
				return null;
			}

			/**
			 * Get token from character code - handles Ripple-specific tokens
			 * @type {Parse.Parser['getTokenFromCode']}
			 */
			getTokenFromCode(code) {
				if (code === 60) {
					// < character
					const inComponent = this.#path.findLast((n) => n.type === 'Component');

					// Check if this could be TypeScript generics instead of JSX
					// TypeScript generics appear after: identifiers, closing parens, 'new' keyword
					// For example: Array<T>, func<T>(), new Map<K,V>(), method<T>()
					// This check applies everywhere, not just inside components

					// Look back to see what precedes the <
					let lookback = this.pos - 1;

					// Skip whitespace backwards
					while (lookback >= 0) {
						const ch = this.input.charCodeAt(lookback);
						if (ch !== 32 && ch !== 9) break; // not space or tab
						lookback--;
					}

					// Check what character/token precedes the <
					if (lookback >= 0) {
						const prevChar = this.input.charCodeAt(lookback);

						// If preceded by identifier character (letter, digit, _, $) or closing paren,
						// this is likely TypeScript generics, not JSX
						const isIdentifierChar =
							(prevChar >= 65 && prevChar <= 90) || // A-Z
							(prevChar >= 97 && prevChar <= 122) || // a-z
							(prevChar >= 48 && prevChar <= 57) || // 0-9
							prevChar === 95 || // _
							prevChar === 36 || // $
							prevChar === 41; // )

						if (isIdentifierChar) {
							return super.getTokenFromCode(code);
						}
					}

					if (inComponent) {
						// Check if we're inside a nested function (arrow function, function expression, etc.)
						// We need to distinguish between being inside a function vs just being in nested scopes
						// (like for loops, if blocks, JSX elements, etc.)
						const nestedFunctionContext = this.context.some((ctx) => ctx.token === 'function');

						// Inside nested functions, treat < as relational/generic operator
						// BUT: if the < is followed by /, it's a closing JSX tag, not a less-than operator
						const nextChar =
							this.pos + 1 < this.input.length ? this.input.charCodeAt(this.pos + 1) : -1;
						const isClosingTag = nextChar === 47; // '/'

						if (nestedFunctionContext && !isClosingTag) {
							// Inside function - treat as TypeScript generic, not JSX
							++this.pos;
							return this.finishToken(tt.relational, '<');
						}

						// Check if everything before this position on the current line is whitespace
						let lineStart = this.pos - 1;
						while (
							lineStart >= 0 &&
							this.input.charCodeAt(lineStart) !== 10 &&
							this.input.charCodeAt(lineStart) !== 13
						) {
							lineStart--;
						}
						lineStart++; // Move past the newline character

						// Check if all characters from line start to current position are whitespace
						let allWhitespace = true;
						for (let i = lineStart; i < this.pos; i++) {
							const ch = this.input.charCodeAt(i);
							if (ch !== 32 && ch !== 9) {
								allWhitespace = false;
								break;
							}
						}

						// Check if the character after < is not whitespace
						if (allWhitespace && this.pos + 1 < this.input.length) {
							const nextChar = this.input.charCodeAt(this.pos + 1);
							if (nextChar !== 32 && nextChar !== 9 && nextChar !== 10 && nextChar !== 13) {
								++this.pos;
								return this.finishToken(tstt.jsxTagStart);
							}
						}
					}
				}

				if (code === 35) {
					// # character
					// Look ahead to see if this is followed by [ for tuple syntax or 'server' keyword
					if (this.pos + 1 < this.input.length) {
						const nextChar = this.input.charCodeAt(this.pos + 1);
						if (nextChar === 91 || nextChar === 123) {
							// [ or { character
							// This is a tuple literal #[ or #{
							// Consume both # and [ or {
							++this.pos; // consume #
							++this.pos; // consume [ or {
							if (nextChar === 123) {
								return this.finishToken(tt.braceL, '#{');
							} else {
								return this.finishToken(tt.bracketL, '#[');
							}
						}

						// Check if this is #Map or #Set
						if (this.input.slice(this.pos, this.pos + 4) === '#Map') {
							const charAfter =
								this.pos + 4 < this.input.length ? this.input.charCodeAt(this.pos + 4) : -1;
							if (charAfter === 40) {
								// ( character
								this.pos += 4; // consume '#Map'
								return this.finishToken(tt.name, '#Map');
							}
						}
						if (this.input.slice(this.pos, this.pos + 4) === '#Set') {
							const charAfter =
								this.pos + 4 < this.input.length ? this.input.charCodeAt(this.pos + 4) : -1;
							if (charAfter === 40) {
								// ( character
								this.pos += 4; // consume '#Set'
								return this.finishToken(tt.name, '#Set');
							}
						}

						// Check if this is #server
						if (this.input.slice(this.pos, this.pos + 7) === '#server') {
							// Check that next char after 'server' is whitespace, {, . (dot), or EOF
							const charAfter =
								this.pos + 7 < this.input.length ? this.input.charCodeAt(this.pos + 7) : -1;
							if (
								charAfter === 123 || // {
								charAfter === 46 || // . (dot)
								charAfter === 32 || // space
								charAfter === 9 || // tab
								charAfter === 10 || // newline
								charAfter === 13 || // carriage return
								charAfter === -1 // EOF
							) {
								// { or . or whitespace or EOF
								this.pos += 7; // consume '#server'
								return this.finishToken(tt.name, '#server');
							}
						}

						// Check if this is an invalid #Identifier pattern
						// Valid patterns: #[, #{, #Map(, #Set(, #server
						// If we see # followed by an uppercase letter that isn't Map or Set, it's an error
						if (nextChar >= 65 && nextChar <= 90) {
							// A-Z
							// Extract the identifier name
							let identEnd = this.pos + 1;
							while (identEnd < this.input.length) {
								const ch = this.input.charCodeAt(identEnd);
								if (
									(ch >= 65 && ch <= 90) ||
									(ch >= 97 && ch <= 122) ||
									(ch >= 48 && ch <= 57) ||
									ch === 95
								) {
									// A-Z, a-z, 0-9, _
									identEnd++;
								} else {
									break;
								}
							}
							const identName = this.input.slice(this.pos + 1, identEnd);
							if (identName !== 'Map' && identName !== 'Set') {
								this.raise(
									this.pos,
									`Invalid tracked syntax '#${identName}'. Only #Map and #Set are currently supported using shorthand tracked syntax.`,
								);
							}
						}
					}
				}
				if (code === 64) {
					// @ character
					// Look ahead to see if this is followed by a valid identifier character or opening paren
					if (this.pos + 1 < this.input.length) {
						const nextChar = this.input.charCodeAt(this.pos + 1);

						// Check if this is @( for unboxing expression syntax
						if (nextChar === 40) {
							// ( character
							this.pos += 2; // skip '@('
							return this.finishToken(tt.parenL, '@(');
						}

						// Check if the next character can start an identifier
						if (
							(nextChar >= 65 && nextChar <= 90) || // A-Z
							(nextChar >= 97 && nextChar <= 122) || // a-z
							nextChar === 95 ||
							nextChar === 36
						) {
							// _ or $

							// Check if we're in an expression context
							// In JSX expressions, inside parentheses, assignments, etc.
							// we want to treat @ as an identifier prefix rather than decorator
							const currentType = this.type;
							const inExpression =
								this.exprAllowed ||
								currentType === tt.braceL || // Inside { }
								currentType === tt.parenL || // Inside ( )
								currentType === tt.eq || // After =
								currentType === tt.comma || // After ,
								currentType === tt.colon || // After :
								currentType === tt.question || // After ?
								currentType === tt.logicalOR || // After ||
								currentType === tt.logicalAND || // After &&
								currentType === tt.dot || // After . (for member expressions like obj.@prop)
								currentType === tt.questionDot; // After ?. (for optional chaining like obj?.@prop)

							if (inExpression) {
								return this.readAtIdentifier();
							}
						}
					}
				}
				return super.getTokenFromCode(code);
			}

			/**
			 * Read an @ prefixed identifier
			 * @type {Parse.Parser['readAtIdentifier']}
			 */
			readAtIdentifier() {
				const start = this.pos;
				this.pos++; // skip '@'

				// Read the identifier part manually
				let word = '';
				while (this.pos < this.input.length) {
					const ch = this.input.charCodeAt(this.pos);
					if (
						(ch >= 65 && ch <= 90) || // A-Z
						(ch >= 97 && ch <= 122) || // a-z
						(ch >= 48 && ch <= 57) || // 0-9
						ch === 95 ||
						ch === 36
					) {
						// _ or $
						word += this.input[this.pos++];
					} else {
						break;
					}
				}

				if (word === '') {
					this.raise(start, 'Invalid @ identifier');
				}

				// Return the full identifier including @
				return this.finishToken(tt.name, '@' + word);
			}

			/**
			 * Override parseIdent to mark @ identifiers as tracked
			 * @type {Parse.Parser['parseIdent']}
			 */
			parseIdent(liberal) {
				const node = /** @type {AST.Identifier &AST.NodeWithLocation} */ (
					super.parseIdent(liberal)
				);
				if (node.name && node.name.startsWith('@')) {
					node.name = node.name.slice(1); // Remove the '@' for internal use
					node.tracked = true;
					node.start++;
					const prev_pos = this.pos;
					this.pos = node.start;
					node.loc.start = this.curPosition();
					this.pos = prev_pos;
				}
				return node;
			}

			/**
			 * Override parseSubscripts to handle `.@[expression]` syntax for reactive computed member access
			 * @type {Parse.Parser['parseSubscripts']}
			 */
			parseSubscripts(
				base,
				startPos,
				startLoc,
				noCalls,
				maybeAsyncArrow,
				optionalChained,
				forInit,
			) {
				// Check for `.@[` pattern for reactive computed member access
				const isDotOrOptional = this.type === tt.dot || this.type === tt.questionDot;

				if (isDotOrOptional) {
					// Check the next two characters without consuming tokens
					// this.pos currently points AFTER the dot token
					const nextChar = this.input.charCodeAt(this.pos);
					const charAfter = this.input.charCodeAt(this.pos + 1);

					// Check for @[ pattern (@ = 64, [ = 91)
					if (nextChar === 64 && charAfter === 91) {
						const node = /** @type {AST.MemberExpression} */ (this.startNodeAt(startPos, startLoc));
						node.object = base;
						node.computed = true;
						node.optional = this.type === tt.questionDot;
						node.tracked = true;

						// Consume the dot/questionDot token
						this.next();

						// Manually skip the @ character
						this.pos += 1;

						// Now call finishToken to properly consume the [ bracket
						this.finishToken(tt.bracketL);

						// Now we're positioned correctly to parse the expression
						this.next(); // Move to first token inside brackets

						// Parse the expression inside brackets
						node.property = this.parseExpression();

						// Expect closing bracket
						this.expect(tt.bracketR);

						// Finish this MemberExpression node
						base = /** @type {AST.MemberExpression} */ (this.finishNode(node, 'MemberExpression'));

						// Recursively handle any further subscripts (chaining)
						return this.parseSubscripts(
							base,
							startPos,
							startLoc,
							noCalls,
							maybeAsyncArrow,
							optionalChained,
							forInit,
						);
					}
				}

				// Fall back to default parseSubscripts implementation
				return super.parseSubscripts(
					base,
					startPos,
					startLoc,
					noCalls,
					maybeAsyncArrow,
					optionalChained,
					forInit,
				);
			}

			/**
			 * Parse expression atom - handles TrackedArray and TrackedObject literals
			 * @type {Parse.Parser['parseExprAtom']}
			 */
			parseExprAtom(refDestructuringErrors, forNew, forInit) {
				// Check if this is @(expression) for unboxing tracked values
				if (this.type === tt.parenL && this.value === '@(') {
					return this.parseTrackedExpression();
				}

				// Check if this is #server identifier for server function calls
				if (this.type === tt.name && this.value === '#server') {
					const node = this.startNode();
					this.next();
					return /** @type {AST.ServerIdentifier} */ (this.finishNode(node, 'ServerIdentifier'));
				}

				// Check if this is #Map( or #Set(
				if (this.type === tt.name && (this.value === '#Map' || this.value === '#Set')) {
					const type = this.value === '#Map' ? 'TrackedMapExpression' : 'TrackedSetExpression';
					return this.parseTrackedCollectionExpression(type);
				}

				// Check if this is a tuple literal starting with #[
				if (this.type === tt.bracketL && this.value === '#[') {
					return this.parseTrackedArrayExpression();
				} else if (this.type === tt.braceL && this.value === '#{') {
					return this.parseTrackedObjectExpression();
				}

				// Check if this is a component expression (e.g., in object literal values)
				if (this.type === tt.name && this.value === 'component') {
					return this.parseComponent();
				}

				return super.parseExprAtom(refDestructuringErrors, forNew, forInit);
			}

			/**
			 * Override to track parenthesized expressions in metadata
			 * This allows the prettier plugin to preserve parentheses where they existed
			 * @type {Parse.Parser['parseParenAndDistinguishExpression']}
			 */
			parseParenAndDistinguishExpression(canBeArrow, forInit) {
				const startPos = this.start;
				const expr = super.parseParenAndDistinguishExpression(canBeArrow, forInit);

				// If the expression's start position is after the opening paren,
				// it means it was wrapped in parentheses. Mark it in metadata.
				if (expr && /** @type {AST.NodeWithLocation} */ (expr).start > startPos) {
					expr.metadata ??= { path: [] };
					expr.metadata.parenthesized = true;
				}

				return expr;
			}

			/**
			 * Parse `@(expression)` syntax for unboxing tracked values
			 * Creates a TrackedExpression node with the argument property
			 * @type {Parse.Parser['parseTrackedExpression']}
			 */
			parseTrackedExpression() {
				const node = /** @type {AST.TrackedExpression} */ (this.startNode());
				this.next(); // consume '@(' token
				node.argument = this.parseExpression();
				this.expect(tt.parenR); // expect ')'
				return this.finishNode(node, 'TrackedExpression');
			}

			/**
			 * Override to allow TrackedExpression as a valid lvalue for update expressions
			 * @type {Parse.Parser['checkLValSimple']}
			 */
			checkLValSimple(expr, bindingType, checkClashes) {
				// Allow TrackedExpression as a valid lvalue for ++/-- operators
				if (expr.type === 'TrackedExpression') {
					return;
				}
				return super.checkLValSimple(expr, bindingType, checkClashes);
			}

			/**
			 * @type {Parse.Parser['parseServerBlock']}
			 */
			parseServerBlock() {
				const node = /** @type {AST.ServerBlock} */ (this.startNode());
				this.next();

				const body = /** @type {AST.BlockStatement} */ (this.startNode());
				node.body = body;
				body.body = [];

				this.expect(tt.braceL);
				this.enterScope(0);
				while (this.type !== tt.braceR) {
					const stmt = /** @type {AST.Statement} */ (this.parseStatement(null, true));
					body.body.push(stmt);
				}
				this.next();
				this.exitScope();
				this.finishNode(body, 'BlockStatement');

				this.awaitPos = 0;
				return this.finishNode(node, 'ServerBlock');
			}

			/**
			 * Parse `#Map(...)` or `#Set(...)` syntax for tracked collections
			 * Creates a TrackedMap or TrackedSet node with the arguments property
			 * @type {Parse.Parser['parseTrackedCollectionExpression']}
			 */
			parseTrackedCollectionExpression(type) {
				const node =
					/** @type {(AST.TrackedMapExpression | AST.TrackedSetExpression) & AST.NodeWithLocation} */ (
						this.startNode()
					);
				this.next(); // consume '#Map' or '#Set'

				// Check if we should NOT consume the parentheses
				// This happens when #Map/#Set appears as a callee in 'new #Map(...)'
				// In this case, the parentheses and arguments belong to the NewExpression
				// We detect this by checking if next token is '(' but we just consumed a token
				// that came right after 'new' keyword (indicated by context or recent token)

				// Simple heuristic: if the input around our start position looks like 'new #Map('
				// then don't consume the parens
				const beforeStart = this.input.substring(Math.max(0, node.start - 5), node.start);
				const isAfterNew = /new\s*$/.test(beforeStart);

				if (!isAfterNew) {
					// If we reach here, it means #Map or #Set is being called without 'new'
					// Throw a TypeError to match JavaScript class constructor behavior
					const constructorName =
						type === 'TrackedMapExpression' ? '#Map (TrackedMap)' : '#Set (TrackedSet)';
					this.raise(
						node.start,
						`TypeError: Class constructor ${constructorName} cannot be invoked without 'new'`,
					);
				}

				if (this.type === tt.parenL) {
					// Don't consume parens - they belong to NewExpression
					node.arguments = [];
					return this.finishNode(node, type);
				}

				this.expect(tt.parenL); // expect '('

				node.arguments = [];
				// Parse arguments similar to function call arguments
				let first = true;
				while (!this.eat(tt.parenR)) {
					if (!first) {
						this.expect(tt.comma);
						if (this.afterTrailingComma(tt.parenR)) break;
					} else {
						first = false;
					}

					if (this.type === tt.ellipsis) {
						// Spread argument
						const arg = this.parseSpread();
						node.arguments.push(arg);
					} else {
						// Regular argument
						node.arguments.push(this.parseMaybeAssign(false));
					}
				}

				return this.finishNode(node, type);
			}

			/**
			 * @type {Parse.Parser['parseTrackedArrayExpression']}
			 */
			parseTrackedArrayExpression() {
				const node = /** @type {AST.TrackedArrayExpression} */ (this.startNode());
				this.next(); // consume the '#['

				node.elements = [];

				// Parse array elements similar to regular array parsing
				let first = true;
				while (!this.eat(tt.bracketR)) {
					if (!first) {
						this.expect(tt.comma);
						if (this.afterTrailingComma(tt.bracketR)) break;
					} else {
						first = false;
					}

					if (this.type === tt.comma) {
						// Hole in array
						node.elements.push(null);
					} else if (this.type === tt.ellipsis) {
						// Spread element
						const element = this.parseSpread();
						node.elements.push(element);
						if (this.type === tt.comma && this.input.charCodeAt(this.pos) === 93) {
							this.raise(this.pos, 'Trailing comma is not permitted after the rest element');
						}
					} else {
						// Regular element
						node.elements.push(this.parseMaybeAssign(false));
					}
				}

				return this.finishNode(node, 'TrackedArrayExpression');
			}

			/**
			 * @type {Parse.Parser['parseTrackedObjectExpression']}
			 */
			parseTrackedObjectExpression() {
				const node = /** @type {AST.TrackedObjectExpression} */ (this.startNode());
				this.next(); // consume the '#{'

				node.properties = [];

				// Parse object properties similar to regular object parsing
				let first = true;
				while (!this.eat(tt.braceR)) {
					if (!first) {
						this.expect(tt.comma);
						if (this.afterTrailingComma(tt.braceR)) break;
					} else {
						first = false;
					}

					if (this.type === tt.ellipsis) {
						// Spread property
						const prop = this.parseSpread();
						node.properties.push(prop);
						if (this.type === tt.comma && this.input.charCodeAt(this.pos) === 125) {
							this.raise(this.pos, 'Trailing comma is not permitted after the rest element');
						}
					} else {
						// Regular property
						node.properties.push(this.parseProperty(false, new DestructuringErrors()));
					}
				}

				return this.finishNode(node, 'TrackedObjectExpression');
			}

			/**
			 * Parse a component - common implementation used by statements, expressions, and export defaults
			 * @type {Parse.Parser['parseComponent']}
			 */
			parseComponent({ requireName = false, isDefault = false, declareName = false } = {}) {
				const node = /** @type {AST.Component} */ (this.startNode());
				node.type = 'Component';
				node.css = null;
				node.default = isDefault;
				this.next(); // consume 'component'
				this.enterScope(0);

				if (requireName) {
					node.id = this.parseIdent();
					if (declareName) {
						this.declareName(
							node.id.name,
							BINDING_TYPES.BIND_VAR,
							/** @type {AST.NodeWithLocation} */ (node.id).start,
						);
					}
				} else {
					node.id = this.type.label === 'name' ? this.parseIdent() : null;
					if (declareName && node.id) {
						this.declareName(
							node.id.name,
							BINDING_TYPES.BIND_VAR,
							/** @type {AST.NodeWithLocation} */ (node.id).start,
						);
					}
				}

				this.parseFunctionParams(node);
				this.eat(tt.braceL);
				node.body = [];
				this.#path.push(node);

				this.parseTemplateBody(node.body);
				this.#path.pop();
				this.exitScope();

				this.next();
				skipWhitespace(this);
				this.finishNode(node, 'Component');
				this.awaitPos = 0;

				return node;
			}

			/**
			 * @type {Parse.Parser['parseExportDefaultDeclaration']}
			 */
			parseExportDefaultDeclaration() {
				// Check if this is "export default component"
				if (this.value === 'component') {
					return this.parseComponent({ isDefault: true });
				}

				return super.parseExportDefaultDeclaration();
			}

			/** @type {Parse.Parser['parseForStatement']} */
			parseForStatement(node) {
				this.next();
				let awaitAt =
					this.options.ecmaVersion >= 9 && this.canAwait && this.eatContextual('await')
						? this.lastTokStart
						: -1;
				this.labels.push({ kind: 'loop' });
				this.enterScope(0);
				this.expect(tt.parenL);

				if (this.type === tt.semi) {
					if (awaitAt > -1) this.unexpected(awaitAt);
					return this.parseFor(node, null);
				}

				let isLet = this.isLet();
				if (this.type === tt._var || this.type === tt._const || isLet) {
					let init = /** @type {AST.VariableDeclaration} */ (this.startNode()),
						kind = isLet ? 'let' : /** @type {AST.VariableDeclaration['kind']} */ (this.value);
					this.next();
					this.parseVar(init, true, kind);
					this.finishNode(init, 'VariableDeclaration');
					return this.parseForAfterInitWithIndex(
						/** @type {AST.ForInStatement | AST.ForOfStatement} */ (node),
						init,
						awaitAt,
					);
				}

				// Handle other cases like using declarations if they exist
				let startsWithLet = this.isContextual('let'),
					isForOf = false;
				let usingKind =
					this.isUsing && this.isUsing(true)
						? 'using'
						: this.isAwaitUsing && this.isAwaitUsing(true)
							? 'await using'
							: null;
				if (usingKind) {
					let init = /** @type {AST.VariableDeclaration} */ (this.startNode());
					this.next();
					if (usingKind === 'await using') {
						if (!this.canAwait) {
							this.raise(this.start, 'Await using cannot appear outside of async function');
						}
						this.next();
					}
					this.parseVar(init, true, usingKind);
					this.finishNode(init, 'VariableDeclaration');
					return this.parseForAfterInitWithIndex(
						/** @type {AST.ForInStatement | AST.ForOfStatement} */ (node),
						init,
						awaitAt,
					);
				}

				let containsEsc = this.containsEsc;
				let refDestructuringErrors = new DestructuringErrors();
				let initPos = this.start;
				let init_expr =
					awaitAt > -1
						? this.parseExprSubscripts(refDestructuringErrors, 'await')
						: this.parseExpression(true, refDestructuringErrors);

				if (
					this.type === tt._in ||
					(isForOf = this.options.ecmaVersion >= 6 && this.isContextual('of'))
				) {
					if (awaitAt > -1) {
						// implies `ecmaVersion >= 9`
						if (this.type === tt._in) this.unexpected(awaitAt);
						/** @type {AST.ForOfStatement} */ (node).await = true;
					} else if (isForOf && this.options.ecmaVersion >= 8) {
						if (
							init_expr.start === initPos &&
							!containsEsc &&
							init_expr.type === 'Identifier' &&
							init_expr.name === 'async'
						)
							this.unexpected();
						else if (this.options.ecmaVersion >= 9)
							/** @type {AST.ForOfStatement} */ (node).await = false;
					}
					if (startsWithLet && isForOf)
						this.raise(
							/** @type {AST.NodeWithLocation} */ (init_expr).start,
							"The left-hand side of a for-of loop may not start with 'let'.",
						);
					const init = this.toAssignable(init_expr, false, refDestructuringErrors);
					this.checkLValPattern(init);
					return this.parseForInWithIndex(
						/** @type {AST.ForInStatement | AST.ForOfStatement} */ (node),
						init,
					);
				} else {
					this.checkExpressionErrors(refDestructuringErrors, true);
				}

				if (awaitAt > -1) this.unexpected(awaitAt);
				return this.parseFor(node, init_expr);
			}

			/** @type {Parse.Parser['parseForAfterInitWithIndex']} */
			parseForAfterInitWithIndex(node, init, awaitAt) {
				if (
					(this.type === tt._in || (this.options.ecmaVersion >= 6 && this.isContextual('of'))) &&
					init.declarations.length === 1
				) {
					if (this.options.ecmaVersion >= 9) {
						if (this.type === tt._in) {
							if (awaitAt > -1) {
								this.unexpected(awaitAt);
							}
						} else {
							/** @type {AST.ForOfStatement} */ (node).await = awaitAt > -1;
						}
					}
					return this.parseForInWithIndex(
						/** @type {AST.ForInStatement | AST.ForOfStatement} */ (node),
						init,
					);
				}
				if (awaitAt > -1) {
					this.unexpected(awaitAt);
				}
				return this.parseFor(node, init);
			}

			/** @type {Parse.Parser['parseForInWithIndex']} */
			parseForInWithIndex(node, init) {
				const isForIn = this.type === tt._in;
				this.next();

				if (
					init.type === 'VariableDeclaration' &&
					init.declarations[0].init != null &&
					(!isForIn ||
						this.options.ecmaVersion < 8 ||
						this.strict ||
						init.kind !== 'var' ||
						init.declarations[0].id.type !== 'Identifier')
				) {
					this.raise(
						/** @type {AST.NodeWithLocation} */ (init).start,
						`${isForIn ? 'for-in' : 'for-of'} loop variable declaration may not have an initializer`,
					);
				}

				node.left = init;
				node.right = isForIn ? this.parseExpression() : this.parseMaybeAssign();

				// Check for our extended syntax: "; index varName"
				if (!isForIn && this.type === tt.semi) {
					this.next(); // consume ';'

					if (this.isContextual('index')) {
						this.next(); // consume 'index'
						/** @type {AST.ForOfStatement} */ (node).index = /** @type {AST.Identifier} */ (
							this.parseExpression()
						);
						if (
							/** @type {AST.Identifier} */ (/** @type {AST.ForOfStatement} */ (node).index)
								.type !== 'Identifier'
						) {
							this.raise(this.start, 'Expected identifier after "index" keyword');
						}
						this.eat(tt.semi);
					}

					if (this.isContextual('key')) {
						this.next(); // consume 'key'
						/** @type {AST.ForOfStatement} */ (node).key = this.parseExpression();
					}

					if (this.isContextual('index')) {
						this.raise(this.start, '"index" must come before "key" in for-of loop');
					}
				} else if (!isForIn) {
					// Set index to null for standard for-of loops
					/** @type {AST.ForOfStatement} */ (node).index = null;
				}

				this.expect(tt.parenR);
				node.body = /** @type {AST.BlockStatement} */ (this.parseStatement('for'));
				this.exitScope();
				this.labels.pop();
				return this.finishNode(node, isForIn ? 'ForInStatement' : 'ForOfStatement');
			}

			/**
			 * @type {Parse.Parser['checkUnreserved']}
			 */
			checkUnreserved(ref) {
				if (ref.name === 'component') {
					this.raise(
						ref.start,
						'"component" is a Ripple keyword and cannot be used as an identifier',
					);
				}
				return super.checkUnreserved(ref);
			}

			/** @type {Parse.Parser['shouldParseExportStatement']} */
			shouldParseExportStatement() {
				if (super.shouldParseExportStatement()) {
					return true;
				}
				if (this.value === 'component') {
					return true;
				}
				return this.type.keyword === 'var';
			}

			/**
			 * @return {ESTreeJSX.JSXExpressionContainer}
			 */
			jsx_parseExpressionContainer() {
				let node = /** @type {ESTreeJSX.JSXExpressionContainer} */ (this.startNode());
				this.next();
				let tracked = false;

				if (this.value === 'html') {
					node.html = true;
					this.next();
					if (this.type === tt.braceR) {
						this.raise(
							this.start,
							'"html" is a Ripple keyword and must be used in the form {html some_content}',
						);
					}
					if (this.type.label === '@') {
						this.next(); // consume @
						tracked = true;
					}
				}

				node.expression =
					this.type === tt.braceR ? this.jsx_parseEmptyExpression() : this.parseExpression();
				this.expect(tt.braceR);

				if (tracked && node.expression.type === 'Identifier') {
					node.expression.tracked = true;
				}

				return this.finishNode(node, 'JSXExpressionContainer');
			}

			/**
			 * @type {Parse.Parser['jsx_parseEmptyExpression']}
			 */
			jsx_parseEmptyExpression() {
				// Override to properly handle the range for JSXEmptyExpression
				// The range should be from after { to before }
				const node = /** @type {ESTreeJSX.JSXEmptyExpression} */ (
					this.startNodeAt(this.lastTokEnd, this.lastTokEndLoc)
				);
				node.end = this.start;
				node.loc.end = this.startLoc;
				return this.finishNodeAt(node, 'JSXEmptyExpression', this.start, this.startLoc);
			}

			/**
			 * @type {Parse.Parser['jsx_parseTupleContainer']}
			 */
			jsx_parseTupleContainer() {
				const t = /** @type {ESTreeJSX.JSXExpressionContainer} */ (this.startNode());
				return (
					this.next(),
					(t.expression =
						this.type === tt.bracketR ? this.jsx_parseEmptyExpression() : this.parseExpression()),
					this.expect(tt.bracketR),
					this.finishNode(t, 'JSXExpressionContainer')
				);
			}

			/**
			 * @type {Parse.Parser['jsx_parseAttribute']}
			 */
			jsx_parseAttribute() {
				let node = /** @type {AST.RippleAttribute | ESTreeJSX.JSXAttribute} */ (this.startNode());

				if (this.eat(tt.braceL)) {
					if (this.value === 'ref') {
						this.next();
						if (this.type === tt.braceR) {
							this.raise(
								this.start,
								'"ref" is a Ripple keyword and must be used in the form {ref fn}',
							);
						}
						/** @type {AST.RefAttribute} */ (node).argument = this.parseMaybeAssign();
						this.expect(tt.braceR);
						return /** @type {AST.RefAttribute} */ (this.finishNode(node, 'RefAttribute'));
					} else if (this.type === tt.ellipsis) {
						this.expect(tt.ellipsis);
						/** @type {AST.SpreadAttribute} */ (node).argument = this.parseMaybeAssign();
						this.expect(tt.braceR);
						return this.finishNode(node, 'SpreadAttribute');
					} else if (this.lookahead().type === tt.ellipsis) {
						this.expect(tt.ellipsis);
						/** @type {AST.SpreadAttribute} */ (node).argument = this.parseMaybeAssign();
						this.expect(tt.braceR);
						return this.finishNode(node, 'SpreadAttribute');
					} else {
						const id = /** @type {AST.Identifier} */ (this.parseIdentNode());
						id.tracked = false;
						if (id.name.startsWith('@')) {
							id.tracked = true;
							id.name = id.name.slice(1);
						}
						this.finishNode(id, 'Identifier');
						/** @type {AST.Attribute} */ (node).name = id;
						/** @type {AST.Attribute} */ (node).value = id;
						/** @type {AST.Attribute} */ (node).shorthand = true; // Mark as shorthand since name and value are the same
						this.next();
						this.expect(tt.braceR);
						return this.finishNode(node, 'Attribute');
					}
				}
				/** @type {ESTreeJSX.JSXAttribute} */ (node).name = this.jsx_parseNamespacedName();
				/** @type {ESTreeJSX.JSXAttribute} */ (node).value =
					/** @type {ESTreeJSX.JSXAttribute['value'] | null} */ (
						this.eat(tt.eq) ? this.jsx_parseAttributeValue() : null
					);
				return this.finishNode(node, 'JSXAttribute');
			}

			/**
			 * @type {Parse.Parser['jsx_parseNamespacedName']}
			 */
			jsx_parseNamespacedName() {
				const base = this.jsx_parseIdentifier();
				if (!this.eat(tt.colon)) return base;
				const node = /** @type {ESTreeJSX.JSXNamespacedName} */ (
					this.startNodeAt(
						/** @type {AST.NodeWithLocation} */ (base).start,
						/** @type {AST.NodeWithLocation} */ (base).loc.start,
					)
				);
				node.namespace = base;
				node.name = this.jsx_parseIdentifier();
				return this.finishNode(node, 'JSXNamespacedName');
			}

			/**
			 * @type {Parse.Parser['jsx_parseIdentifier']}
			 */
			jsx_parseIdentifier() {
				const node = /** @type {ESTreeJSX.JSXIdentifier} */ (this.startNode());

				if (this.type.label === '@') {
					this.next(); // consume @

					if (this.type === tt.name || this.type === tstt.jsxName) {
						node.name = /** @type {string} */ (this.value);
						node.tracked = true;
						this.next();
					} else {
						// Unexpected token after @
						this.unexpected();
					}
				} else if (
					(this.type === tt.name || this.type === tstt.jsxName) &&
					this.value &&
					/** @type {string} */ (this.value).startsWith('@')
				) {
					node.name = /** @type {string} */ (this.value).substring(1);
					node.tracked = true;
					this.next();
				} else if (this.type === tt.name || this.type.keyword || this.type === tstt.jsxName) {
					node.name = /** @type {string} */ (this.value);
					node.tracked = false; // Explicitly mark as not tracked
					this.next();
				} else {
					return super.jsx_parseIdentifier();
				}

				return this.finishNode(node, 'JSXIdentifier');
			}

			/**
			 * @type {Parse.Parser['jsx_parseElementName']}
			 */
			jsx_parseElementName() {
				if (this.type === tstt.jsxTagEnd) {
					return '';
				}

				let node = this.jsx_parseNamespacedName();

				if (node.type === 'JSXNamespacedName') {
					return node;
				}

				if (this.eat(tt.dot)) {
					let memberExpr = /** @type {ESTreeJSX.JSXMemberExpression} */ (
						this.startNodeAt(
							/** @type {AST.NodeWithLocation} */ (node).start,
							/** @type {AST.NodeWithLocation} */ (node).loc.start,
						)
					);
					memberExpr.object = node;

					// Check for .@[expression] syntax for tracked computed member access
					// After eating the dot, check if the current token is @ followed by [
					if (this.type.label === '@') {
						// Check if the next character after @ is [
						const nextChar = this.input.charCodeAt(this.pos);

						if (nextChar === 91) {
							// [ character
							memberExpr.computed = true;

							// Consume the @ token
							this.next();

							// Now this.type should be bracketL
							// Consume the [ and parse the expression inside
							this.expect(tt.bracketL);

							// Parse the expression inside brackets
							memberExpr.property = /** @type {ESTreeJSX.JSXIdentifier} */ (this.parseExpression());
							/** @type {AST.TrackedNode} */ (memberExpr.property).tracked = true;

							// Expect closing bracket
							this.expect(tt.bracketR);
						} else {
							// @ not followed by [, treat as regular tracked identifier
							memberExpr.property = this.jsx_parseIdentifier();
							memberExpr.computed = false;
						}
					} else {
						// Regular dot notation
						memberExpr.property = this.jsx_parseIdentifier();
						memberExpr.computed = false;
					}
					while (this.eat(tt.dot)) {
						let newMemberExpr = /** @type {ESTreeJSX.JSXMemberExpression} */ (
							this.startNodeAt(
								/** @type {AST.NodeWithLocation} */ (memberExpr).start,
								/** @type {AST.NodeWithLocation} */ (memberExpr).loc.start,
							)
						);
						newMemberExpr.object = memberExpr;
						newMemberExpr.property = this.jsx_parseIdentifier();
						newMemberExpr.computed = false;
						memberExpr = this.finishNode(newMemberExpr, 'JSXMemberExpression');
					}
					return this.finishNode(memberExpr, 'JSXMemberExpression');
				}
				return node;
			}

			/** @type {Parse.Parser['jsx_parseAttributeValue']} */
			jsx_parseAttributeValue() {
				switch (this.type) {
					case tt.braceL:
						const t = this.jsx_parseExpressionContainer();
						return (
							t.expression.type === 'JSXEmptyExpression' &&
								this.raise(
									/** @type {AST.NodeWithLocation} */ (t).start,
									'attributes must only be assigned a non-empty expression',
								),
							t
						);
					case tstt.jsxTagStart:
					case tt.string:
						return this.parseExprAtom();
					default:
						this.raise(this.start, 'value should be either an expression or a quoted text');
				}
			}

			/**
			 * @type {Parse.Parser['parseTryStatement']}
			 */
			parseTryStatement(node) {
				this.next();
				node.block = this.parseBlock();
				node.handler = null;

				if (this.value === 'pending') {
					this.next();
					node.pending = this.parseBlock();
				} else {
					node.pending = null;
				}

				if (this.type === tt._catch) {
					const clause = /** @type {AST.CatchClause} */ (this.startNode());
					this.next();
					if (this.eat(tt.parenL)) {
						clause.param = this.parseCatchClauseParam();
					} else {
						if (this.options.ecmaVersion < 10) {
							this.unexpected();
						}
						clause.param = null;
						this.enterScope(0);
					}
					clause.body = this.parseBlock(false);
					this.exitScope();
					node.handler = this.finishNode(clause, 'CatchClause');
				}
				node.finalizer = this.eat(tt._finally) ? this.parseBlock() : null;

				if (!node.handler && !node.finalizer && !node.pending) {
					this.raise(
						/** @type {AST.NodeWithLocation} */ (node).start,
						'Missing catch or finally clause',
					);
				}
				return this.finishNode(node, 'TryStatement');
			}

			/** @type {Parse.Parser['jsx_readToken']} */
			jsx_readToken() {
				const inside_tsx_compat = this.#path.findLast((n) => n.type === 'TsxCompat');
				if (inside_tsx_compat) {
					return super.jsx_readToken();
				}
				let out = '',
					chunkStart = this.pos;

				while (true) {
					if (this.pos >= this.input.length) this.raise(this.start, 'Unterminated JSX contents');
					let ch = this.input.charCodeAt(this.pos);

					switch (ch) {
						case 60: // '<'
						case 123: // '{'
							if (ch === 60 && this.exprAllowed) {
								++this.pos;
								return this.finishToken(tstt.jsxTagStart);
							}
							if (ch === 123 && this.exprAllowed) {
								return this.getTokenFromCode(ch);
							}
							throw new Error('TODO: Invalid syntax');

						case 47: // '/'
							// Check if this is a comment (// or /*)
							if (this.input.charCodeAt(this.pos + 1) === 47) {
								// '//'
								// Line comment - handle it properly
								const commentStart = this.pos;
								const startLoc = this.curPosition();
								this.pos += 2;

								let commentText = '';
								while (this.pos < this.input.length) {
									const nextCh = this.input.charCodeAt(this.pos);
									if (acorn.isNewLine(nextCh)) break;
									commentText += this.input[this.pos];
									this.pos++;
								}

								const commentEnd = this.pos;
								const endLoc = this.curPosition();

								// Call onComment if it exists
								if (this.options.onComment) {
									const metadata = this.#createCommentMetadata();
									this.options.onComment(
										false,
										commentText,
										commentStart,
										commentEnd,
										startLoc,
										endLoc,
										metadata,
									);
								}

								// Continue processing from current position
								break;
							} else if (this.input.charCodeAt(this.pos + 1) === 42) {
								// '/*'
								// Block comment - handle it properly
								const commentStart = this.pos;
								const startLoc = this.curPosition();
								this.pos += 2;

								let commentText = '';
								while (this.pos < this.input.length - 1) {
									if (
										this.input.charCodeAt(this.pos) === 42 &&
										this.input.charCodeAt(this.pos + 1) === 47
									) {
										this.pos += 2;
										break;
									}
									commentText += this.input[this.pos];
									this.pos++;
								}

								const commentEnd = this.pos;
								const endLoc = this.curPosition();

								// Call onComment if it exists
								if (this.options.onComment) {
									const metadata = this.#createCommentMetadata();
									this.options.onComment(
										true,
										commentText,
										commentStart,
										commentEnd,
										startLoc,
										endLoc,
										metadata,
									);
								}

								// Continue processing from current position
								break;
							}
							// If not a comment, fall through to default case
							this.context.push(tc.b_stat);
							this.exprAllowed = true;
							return original.readToken.call(this, ch);

						case 38: // '&'
							out += this.input.slice(chunkStart, this.pos);
							out += this.jsx_readEntity();
							chunkStart = this.pos;
							break;

						case 62: // '>'
						case 125: {
							// '}'
							if (
								ch === 125 &&
								(this.#path.length === 0 ||
									this.#path.at(-1)?.type === 'Component' ||
									this.#path.at(-1)?.type === 'Element')
							) {
								return original.readToken.call(this, ch);
							}
							this.raise(
								this.pos,
								'Unexpected token `' +
									this.input[this.pos] +
									'`. Did you mean `' +
									(ch === 62 ? '&gt;' : '&rbrace;') +
									'` or ' +
									'`{"' +
									this.input[this.pos] +
									'"}' +
									'`?',
							);
						}

						default:
							if (acorn.isNewLine(ch)) {
								out += this.input.slice(chunkStart, this.pos);
								out += this.jsx_readNewLine(true);
								chunkStart = this.pos;
							} else if (ch === 32 || ch === 9) {
								++this.pos;
							} else {
								this.context.push(tc.b_stat);
								this.exprAllowed = true;
								return original.readToken.call(this, ch);
							}
					}
				}
			}

			/**
			 * @type {Parse.Parser['parseElement']}
			 */
			parseElement() {
				const inside_head = this.#path.findLast(
					(n) => n.type === 'Element' && n.id.type === 'Identifier' && n.id.name === 'head',
				);
				// Adjust the start so we capture the `<` as part of the element
				const start = this.start - 1;
				const position = new acorn.Position(this.curLine, start - this.lineStart);

				const element = /** @type {AST.Element | AST.TsxCompat} */ (this.startNode());
				element.start = start;
				/** @type {AST.NodeWithLocation} */ (element).loc.start = position;
				element.metadata = { path: [] };
				element.children = [];

				// Check if this is a <script> or <style> tag
				const tagName = this.value;
				const isScriptOrStyle = tagName === 'script' || tagName === 'style';
				/** @type {ESTreeJSX.JSXOpeningElement & AST.NodeWithLocation} */
				let open;
				if (isScriptOrStyle) {
					// Manually parse opening tag to avoid jsx_parseOpeningElementAt consuming content
					const tagEndPos = this.input.indexOf('>', start) + 1; // +1 as end positions are exclusive
					const opening_position = new acorn.Position(position.line, position.column);
					const end_position = acorn.getLineInfo(this.input, tagEndPos);

					open = {
						type: 'JSXOpeningElement',
						name: {
							type: 'JSXIdentifier',
							name: tagName,
							metadata: { path: [] },
							start: start + 1,
							end: tagEndPos - 1,
							loc: {
								start: { ...position, column: position.column + 1 },
								end: {
									...end_position,
									column: end_position.column - 1,
								},
							},
						},
						attributes: [],
						selfClosing: false,
						start,
						end: tagEndPos,
						loc: {
							start: opening_position,
							end: end_position,
						},
						metadata: { path: [] },
					};

					// Position after the '>'
					this.pos = tagEndPos;

					// Add opening and closing for easier location tracking
					// TODO: we should also parse attributes inside the opening tag
				} else {
					open =
						/** @type {ReturnType<Parse.Parser['jsx_parseOpeningElementAt']> & AST.NodeWithLocation} */ (
							this.jsx_parseOpeningElementAt()
						);
				}

				// Check if this is a namespaced element (tsx:react)
				const is_tsx_compat = open.name.type === 'JSXNamespacedName';

				if (is_tsx_compat) {
					const namespace_node = /** @type {ESTreeJSX.JSXNamespacedName} */ (open.name);
					/** @type {AST.TsxCompat} */ (element).type = 'TsxCompat';
					/** @type {AST.TsxCompat} */ (element).kind = namespace_node.name.name; // e.g., "react" from "tsx:react"

					if (open.selfClosing) {
						const tagName = namespace_node.namespace.name + ':' + namespace_node.name.name;
						this.raise(
							open.start,
							`TSX compatibility elements cannot be self-closing. '<${tagName} />' must have a closing tag '</${tagName}>'.`,
						);
					}
				} else {
					element.type = 'Element';
				}

				this.#path.push(element);

				for (const attr of open.attributes) {
					if (attr.type === 'JSXAttribute') {
						/** @type {AST.Attribute} */ (/** @type {unknown} */ (attr)).type = 'Attribute';
						if (attr.name.type === 'JSXIdentifier') {
							/** @type {AST.Identifier} */ (/** @type {unknown} */ (attr.name)).type =
								'Identifier';
						}
						if (attr.value !== null) {
							if (attr.value.type === 'JSXExpressionContainer') {
								/** @type {ESTreeJSX.JSXExpressionContainer['expression']} */ (attr.value) =
									attr.value.expression;
							}
						}
					}
				}

				if (!is_tsx_compat) {
					/** @type {AST.Element} */ (element).id = /** @type {AST.Identifier} */ (
						convert_from_jsx(/** @type {ESTreeJSX.JSXIdentifier} */ (open.name))
					);
					element.selfClosing = open.selfClosing;
				}

				element.attributes = open.attributes;
				element.metadata ??= { path: [] };
				element.metadata.commentContainerId = ++this.#commentContextId;
				// Store opening tag's end position for use in loose mode when element is unclosed
				element.metadata.openingTagEnd = open.end;
				element.metadata.openingTagEndLoc = open.loc.end;

				if (element.selfClosing) {
					this.#path.pop();

					if (this.type.label === '</>/<=/>=') {
						this.pos--;
						this.next();
					}
				} else {
					if (/** @type {ESTreeJSX.JSXIdentifier} */ (open.name).name === 'script') {
						let content = '';

						// TODO implement this where we get a string for content of the content of the script tag
						// This is a temporary workaround to get the content of the script tag
						const start = open.end;
						const input = this.input.slice(start);
						const end = input.indexOf('</script>');
						content = input.slice(0, end);

						const newLines = content.match(regex_newline_characters)?.length;
						if (newLines) {
							this.curLine = open.loc.end.line + newLines;
							this.lineStart = start + content.lastIndexOf('\n') + 1;
						}
						this.pos = start + content.length + 1;

						this.type = tstt.jsxTagStart;
						this.next();
						if (this.value === '/') {
							this.next();
							this.jsx_parseElementName();
							this.exprAllowed = true;
							this.#path.pop();
							this.next();
						}

						/** @type {AST.Element} */ (element).content = content;
						this.finishNode(element, 'Element');
						addOpeningAndClosing(/** @type {AST.Element} */ (element), open);
					} else if (/** @type {ESTreeJSX.JSXIdentifier} */ (open.name).name === 'style') {
						// jsx_parseOpeningElementAt treats ID selectors (ie. #myid) or type selectors (ie. div) as identifier and read it
						// So backtrack to the end of the <style> tag to make sure everything is included
						const start = open.end;
						const input = this.input.slice(start);
						const end = input.indexOf('</style>');
						const content = input.slice(0, end);

						const component = /** @type {AST.Component} */ (
							this.#path.findLast((n) => n.type === 'Component')
						);
						const parsed_css = parse_style(content, { loose: this.#loose });

						if (!inside_head) {
							if (component.css !== null) {
								throw new Error('Components can only have one style tag');
							}
							component.css = parsed_css;
						}

						const newLines = content.match(regex_newline_characters)?.length;
						if (newLines) {
							this.curLine = open.loc.end.line + newLines;
							this.lineStart = start + content.lastIndexOf('\n') + 1;
						}
						this.pos = start + content.length + 1;

						this.type = tstt.jsxTagStart;
						this.next();
						if (this.value === '/') {
							this.next();
							this.jsx_parseElementName();
							this.exprAllowed = true;
							this.#path.pop();
							this.next();
						}
						// This node is used for Prettier - always add parsed CSS as children
						// for proper formatting, regardless of whether it's inside head or not
						/** @type {AST.Element} */ (element).children = [
							/** @type {AST.Node} */ (/** @type {unknown} */ (parsed_css)),
						];

						// Ensure we escape JSX <tag></tag> context
						const curContext = this.curContext();

						if (curContext === tstc.tc_expr) {
							this.context.pop();
						}

						/** @type {AST.Element} */ (element).css = content;
						this.finishNode(element, 'Element');
						addOpeningAndClosing(/** @type {AST.Element} */ (element), open);
						return element;
					} else {
						this.enterScope(0);
						this.parseTemplateBody(/** @type {AST.Element} */ (element).children);
						this.exitScope();

						if (element.type === 'TsxCompat') {
							this.#path.pop();

							const raise_error = () => {
								this.raise(this.start, `Expected closing tag '</tsx:${element.kind}>'`);
							};

							this.next();
							// we should expect to see </tsx:kind>
							if (this.value !== '/') {
								raise_error();
							}
							this.next();
							if (this.value !== 'tsx') {
								raise_error();
							}
							this.next();
							if (this.type.label !== ':') {
								raise_error();
							}
							this.next();
							if (this.value !== element.kind) {
								raise_error();
							}
							this.next();
							if (this.type !== tstt.jsxTagEnd) {
								raise_error();
							}
							this.next();
						} else if (this.#path[this.#path.length - 1] === element) {
							// Check if this element was properly closed
							if (!this.#loose) {
								const tagName = this.getElementName(element.id);
								this.raise(
									this.start,
									`Unclosed tag '<${tagName}>'. Expected '</${tagName}>' before end of component.`,
								);
							} else {
								element.unclosed = true;
								const position = this.curPosition();
								position.line = element.metadata.openingTagEndLoc.line;
								position.column = element.metadata.openingTagEndLoc.column;
								element.loc.end = position;
								element.end = element.metadata.openingTagEnd;
								this.#path.pop();
							}
						}
					}

					// Ensure we escape JSX <tag></tag> context
					const curContext = this.curContext();

					if (curContext === tstc.tc_expr) {
						this.context.pop();
					}
				}

				this.finishNode(element, element.type);
				return element;
			}

			/**
			 * @type {Parse.Parser['parseTemplateBody']}
			 */
			parseTemplateBody(body) {
				const inside_func =
					this.context.some((n) => n.token === 'function') || this.scopeStack.length > 1;
				const inside_tsx_compat = this.#path.findLast((n) => n.type === 'TsxCompat');

				if (!inside_func) {
					if (this.type.label === 'return') {
						throw new Error('`return` statements are not allowed in components');
					}
					if (this.type.label === 'continue') {
						throw new Error('`continue` statements are not allowed in components');
					}
					if (this.type.label === 'break') {
						throw new Error('`break` statements are not allowed in components');
					}
				}

				if (inside_tsx_compat) {
					this.exprAllowed = true;

					while (true) {
						if (this.input.slice(this.pos, this.pos + 5) === '/tsx:') {
							return;
						}

						if (this.type === tt.braceL) {
							const node = this.jsx_parseExpressionContainer();
							body.push(node);
						} else if (this.type === tstt.jsxTagStart) {
							// Parse JSX element
							const node = super.parseExpression();
							body.push(node);
						} else {
							const start = this.start;
							this.pos = start;
							let text = '';

							while (this.pos < this.input.length) {
								const ch = this.input.charCodeAt(this.pos);

								// Stop at opening tag, closing tag, or expression
								if (ch === 60 || ch === 123) {
									// < or {
									break;
								}

								text += this.input[this.pos];
								this.pos++;
							}

							if (text) {
								const node = /** @type {ESTreeJSX.JSXText} */ ({
									type: 'JSXText',
									value: text,
									raw: text,
									start,
									end: this.pos,
								});
								body.push(node);
							}

							this.next();
						}
					}
				}
				if (this.type === tt.braceL) {
					const node = this.jsx_parseExpressionContainer();
					// Keep JSXEmptyExpression as-is (for prettier to handle comments)
					// but convert other expressions to Text/Html nodes
					if (node.expression.type !== 'JSXEmptyExpression') {
						/** @type {AST.Html | AST.TextNode} */ (/** @type {unknown} */ (node)).type = node.html
							? 'Html'
							: 'Text';
						delete node.html;
					}
					body.push(node);
				} else if (this.type === tt.braceR) {
					return;
				} else if (this.type === tstt.jsxTagStart) {
					this.next();
					if (this.value === '/') {
						this.next();
						const closingTag =
							/** @type {ESTreeJSX.JSXIdentifier | ESTreeJSX.JSXNamespacedName | ESTreeJSX.JSXMemberExpression} */ (
								this.jsx_parseElementName()
							);
						this.exprAllowed = true;

						// Validate that the closing tag matches the opening tag
						const currentElement = this.#path[this.#path.length - 1];
						if (
							!currentElement ||
							(currentElement.type !== 'Element' && currentElement.type !== 'TsxCompat')
						) {
							this.raise(this.start, 'Unexpected closing tag');
						}

						/** @type {string | null} */
						let openingTagName;
						/** @type {string | null} */
						let closingTagName;

						if (currentElement.type === 'TsxCompat') {
							if (closingTag.type === 'JSXNamespacedName') {
								openingTagName = 'tsx:' + currentElement.kind;
								closingTagName = closingTag.namespace.name + ':' + closingTag.name.name;
							} else {
								openingTagName = 'tsx:' + currentElement.kind;
								closingTagName = this.getElementName(closingTag);
							}
						} else {
							// Regular Element node
							openingTagName = this.getElementName(currentElement.id);
							closingTagName =
								closingTag.type === 'JSXNamespacedName'
									? closingTag.namespace.name + ':' + closingTag.name.name
									: this.getElementName(closingTag);
						}

						if (openingTagName !== closingTagName) {
							if (!this.#loose) {
								this.raise(
									this.start,
									`Expected closing tag to match opening tag. Expected '</${openingTagName}>' but found '</${closingTagName}>'`,
								);
							} else {
								// Loop through all unclosed elements on the stack
								while (this.#path.length > 0) {
									const elem = this.#path[this.#path.length - 1];

									// Stop at non-Element boundaries (Component, etc.)
									if (elem.type !== 'Element' && elem.type !== 'TsxCompat') {
										break;
									}

									const elemName =
										elem.type === 'TsxCompat' ? 'tsx:' + elem.kind : this.getElementName(elem.id);

									// Found matching opening tag
									if (elemName === closingTagName) {
										break;
									}

									// Mark as unclosed and adjust location
									elem.unclosed = true;
									const position = this.curPosition();
									position.line = /** @type {AST.Position} */ (elem.metadata.openingTagEndLoc).line;
									position.column = /** @type {AST.Position} */ (
										elem.metadata.openingTagEndLoc
									).column;
									/** @type {AST.NodeWithLocation} */ (elem).loc.end = position;
									elem.end = elem.metadata.openingTagEnd;

									this.#path.pop(); // Remove from stack
								}
							}
						}

						this.#path.pop();
						this.next();
						skipWhitespace(this);
						return;
					}
					const node = this.parseElement();
					if (node !== null) {
						body.push(node);
					}
				} else {
					const node = this.parseStatement(null);
					body.push(node);

					// Ensure we're not in JSX context before recursing
					// This is important when elements are parsed at statement level
					if (this.curContext() === tstc.tc_expr) {
						this.context.pop();
					}
				}

				this.parseTemplateBody(body);
			}

			/**
			 * @type {Parse.Parser['parseStatement']}
			 */
			parseStatement(context, topLevel, exports) {
				if (
					context !== 'for' &&
					context !== 'if' &&
					this.context.at(-1) === tc.b_stat &&
					this.type === tt.braceL &&
					this.context.some((c) => c === tstc.tc_expr)
				) {
					this.next();
					const node = this.jsx_parseExpressionContainer();
					// Keep JSXEmptyExpression as-is (don't convert to Text)
					if (node.expression.type !== 'JSXEmptyExpression') {
						/** @type {AST.TextNode} */ (/** @type {unknown} */ (node)).type = 'Text';
					}
					this.next();
					this.context.pop();
					this.context.pop();
					return /** @type {ESTreeJSX.JSXEmptyExpression | AST.TextNode | ESTreeJSX.JSXExpressionContainer} */ (
						/** @type {unknown} */ (node)
					);
				}

				if (this.value === '#server') {
					return this.parseServerBlock();
				}

				if (this.value === 'component') {
					this.awaitPos = 0;
					return this.parseComponent({ requireName: true, declareName: true });
				}
				if (this.type.label === '@') {
					// Try to parse as an expression statement first using tryParse
					// This allows us to handle Ripple @ syntax like @count++ without
					// interfering with legitimate decorator syntax
					this.skip_decorator = true;
					const expressionResult = this.tryParse(() => {
						const node = /** @type {AST.ExpressionStatement} */ (this.startNode());
						this.next();
						// Force expression context to ensure @ is tokenized correctly
						const old_expr_allowed = this.exprAllowed;
						this.exprAllowed = true;
						node.expression = this.parseExpression();

						if (node.expression.type === 'UpdateExpression') {
							/** @type {AST.Expression} */
							let object = node.expression.argument;
							while (object.type === 'MemberExpression') {
								object = /** @type {AST.Expression} */ (object.object);
							}
							if (object.type === 'Identifier') {
								object.tracked = true;
							}
						} else if (node.expression.type === 'AssignmentExpression') {
							/** @type {AST.Expression | AST.Pattern | AST.Identifier} */
							let object = node.expression.left;
							while (object.type === 'MemberExpression') {
								object = /** @type {AST.Expression} */ (object.object);
							}
							if (object.type === 'Identifier') {
								object.tracked = true;
							}
						} else if (node.expression.type === 'Identifier') {
							node.expression.tracked = true;
						} else {
							// TODO?
						}

						this.exprAllowed = old_expr_allowed;
						return this.finishNode(node, 'ExpressionStatement');
					});
					this.skip_decorator = false;

					// If parsing as expression statement succeeded, use that result
					if (expressionResult.node) {
						return expressionResult.node;
					}
				}

				if (this.type === tstt.jsxTagStart) {
					this.next();
					if (this.value === '/') {
						this.unexpected();
					}
					const node = this.parseElement();

					if (!node) {
						this.unexpected();
					}
					return node;
				}

				return super.parseStatement(context, topLevel, exports);
			}

			/**
			 * @type {Parse.Parser['parseBlock']}
			 */
			parseBlock(createNewLexicalScope, node, exitStrict) {
				const parent = this.#path.at(-1);

				if (parent?.type === 'Component' || parent?.type === 'Element') {
					if (createNewLexicalScope === void 0) createNewLexicalScope = true;
					if (node === void 0) node = /** @type {AST.BlockStatement} */ (this.startNode());

					node.body = [];
					this.expect(tt.braceL);
					if (createNewLexicalScope) {
						this.enterScope(0);
					}
					this.parseTemplateBody(node.body);

					if (exitStrict) {
						this.strict = false;
					}
					this.exprAllowed = true;

					this.next();
					if (createNewLexicalScope) {
						this.exitScope();
					}
					return this.finishNode(node, 'BlockStatement');
				}

				return super.parseBlock(createNewLexicalScope, node, exitStrict);
			}
		}

		return /** @type {Parse.ParserConstructor} */ (RippleParser);
	};
}

/**
 * Acorn doesn't add comments to the AST by itself. This factory returns the capabilities
 * to add them after the fact. They are needed in order to support `ripple-ignore` comments
 * in JS code and so that `prettier-plugin` doesn't remove all comments when formatting.
 * @param {string} source
 * @param {AST.CommentWithLocation[]} comments
 * @param {number} [index=0] - Starting index
 */
function get_comment_handlers(source, comments, index = 0) {
	/**
	 * @param {string} text
	 * @param {number} startIndex
	 * @returns {string | null}
	 */
	function getNextNonWhitespaceCharacter(text, startIndex) {
		for (let i = startIndex; i < text.length; i++) {
			const char = text[i];
			if (char !== ' ' && char !== '\t' && char !== '\n' && char !== '\r') {
				return char;
			}
		}
		return null;
	}

	return {
		/**
		 * @type {Parse.Options['onComment']}
		 */
		onComment: (block, value, start, end, start_loc, end_loc, metadata) => {
			if (block && /\n/.test(value)) {
				let a = start;
				while (a > 0 && source[a - 1] !== '\n') a -= 1;

				let b = a;
				while (/[ \t]/.test(source[b])) b += 1;

				const indentation = source.slice(a, b);
				value = value.replace(new RegExp(`^${indentation}`, 'gm'), '');
			}

			comments.push({
				type: block ? 'Block' : 'Line',
				value,
				start,
				end,
				loc: {
					start: start_loc,
					end: end_loc,
				},
				context: metadata ?? null,
			});
		},

		/**
		 * @param {AST.Node} ast
		 */
		add_comments: (ast) => {
			if (comments.length === 0) return;

			comments = comments
				.filter((comment) => comment.start >= index)
				.map(({ type, value, start, end, loc, context }) => ({
					type,
					value,
					start,
					end,
					loc,
					context,
				}));

			/**
			 *  @param {AST.Node} ast
			 */
			walk(ast, null, {
				/** @param {AST.Node} node */
				_(node, { next, path }) {
					const metadata = node?.metadata;

					if (metadata && metadata.commentContainerId !== undefined) {
						while (
							comments[0] &&
							comments[0].context &&
							comments[0].context.containerId === metadata.commentContainerId &&
							comments[0].context.beforeMeaningfulChild
						) {
							const elementComment = /** @type {AST.CommentWithLocation} */ (comments.shift());

							(metadata.elementLeadingComments ||= []).push(elementComment);
						}
					}

					while (
						comments[0] &&
						comments[0].start < /** @type {AST.NodeWithLocation} */ (node).start
					) {
						const comment = /** @type {AST.CommentWithLocation} */ (comments.shift());

						// Skip leading comments for BlockStatement that is a function body
						// These comments should be dangling on the function instead
						if (node.type === 'BlockStatement') {
							const parent = path.at(-1);
							if (
								parent &&
								(parent.type === 'FunctionDeclaration' ||
									parent.type === 'FunctionExpression' ||
									parent.type === 'ArrowFunctionExpression') &&
								parent.body === node
							) {
								// This is a function body - don't attach comment, let it be handled by function
								(parent.comments ||= []).push(comment);
								continue;
							}
						}

						const ancestorElements = /** @type {(AST.Element & AST.NodeWithLocation)[]} */ (
							path.filter((ancestor) => ancestor && ancestor.type === 'Element' && ancestor.loc)
						).sort((a, b) => a.loc.start.line - b.loc.start.line);

						const targetAncestor = ancestorElements.find(
							(ancestor) => comment.loc.start.line < ancestor.loc.start.line,
						);

						if (targetAncestor) {
							targetAncestor.metadata ??= { path: [] };
							(targetAncestor.metadata.elementLeadingComments ||= []).push(comment);
							continue;
						}

						(node.leadingComments ||= []).push(comment);
					}

					next();

					if (comments[0]) {
						if (node.type === 'BlockStatement' && node.body.length === 0) {
							// Collect all comments that fall within this empty block
							while (
								comments[0] &&
								comments[0].start < /** @type {AST.NodeWithLocation} */ (node).end &&
								comments[0].end < /** @type {AST.NodeWithLocation} */ (node).end
							) {
								const comment = /** @type {AST.CommentWithLocation} */ (comments.shift());
								(node.innerComments ||= []).push(comment);
							}
							if (node.innerComments && node.innerComments.length > 0) {
								return;
							}
						}
						// Handle JSXEmptyExpression - these represent {/* comment */} in JSX
						if (node.type === 'JSXEmptyExpression') {
							// Collect all comments that fall within this JSXEmptyExpression
							while (
								comments[0] &&
								comments[0].start >= /** @type {AST.NodeWithLocation} */ (node).start &&
								comments[0].end <= /** @type {AST.NodeWithLocation} */ (node).end
							) {
								const comment = /** @type {AST.CommentWithLocation} */ (comments.shift());
								(node.innerComments ||= []).push(comment);
							}
							if (node.innerComments && node.innerComments.length > 0) {
								return;
							}
						}
						// Handle empty Element nodes the same way as empty BlockStatements
						if (node.type === 'Element' && (!node.children || node.children.length === 0)) {
							// Collect all comments that fall within this empty element
							while (
								comments[0] &&
								comments[0].start < /** @type {AST.NodeWithLocation} */ (node).end &&
								comments[0].end < /** @type {AST.NodeWithLocation} */ (node).end
							) {
								const comment = /** @type {AST.CommentWithLocation} */ (comments.shift());
								(node.innerComments ||= []).push(comment);
							}
							if (node.innerComments && node.innerComments.length > 0) {
								return;
							}
						}

						const parent = /** @type {any} */ (path.at(-1));

						if (parent === undefined || node.end !== parent.end) {
							const slice = source.slice(node.end, comments[0].start);

							// Check if this node is the last item in an array-like structure
							let is_last_in_array = false;
							let array_prop = null;

							if (
								parent?.type === 'BlockStatement' ||
								parent?.type === 'Program' ||
								parent?.type === 'Component' ||
								parent?.type === 'ClassBody'
							) {
								array_prop = 'body';
							} else if (parent?.type === 'SwitchStatement') {
								array_prop = 'cases';
							} else if (parent?.type === 'SwitchCase') {
								array_prop = 'consequent';
							} else if (
								parent?.type === 'ArrayExpression' ||
								parent?.type === 'TrackedArrayExpression'
							) {
								array_prop = 'elements';
							} else if (
								parent?.type === 'ObjectExpression' ||
								parent?.type === 'TrackedObjectExpression'
							) {
								array_prop = 'properties';
							} else if (
								parent?.type === 'FunctionDeclaration' ||
								parent?.type === 'FunctionExpression' ||
								parent?.type === 'ArrowFunctionExpression'
							) {
								array_prop = 'params';
							} else if (
								parent?.type === 'CallExpression' ||
								parent?.type === 'OptionalCallExpression' ||
								parent?.type === 'NewExpression'
							) {
								array_prop = 'arguments';
							}
							if (array_prop && Array.isArray(parent[array_prop])) {
								is_last_in_array =
									parent[array_prop].indexOf(node) === parent[array_prop].length - 1;
							}

							if (is_last_in_array) {
								const isParam = array_prop === 'params';
								const isArgument = array_prop === 'arguments';
								if (isParam || isArgument) {
									while (comments.length) {
										const potentialComment = comments[0];
										if (parent && potentialComment.start >= parent.end) {
											break;
										}

										const nextChar = getNextNonWhitespaceCharacter(source, potentialComment.end);
										if (nextChar === ')') {
											(node.trailingComments ||= []).push(
												/** @type {AST.CommentWithLocation} */ (comments.shift()),
											);
											continue;
										}

										break;
									}
								} else {
									// Special case: There can be multiple trailing comments after the last node in a block,
									// and they can be separated by newlines
									let end = node.end;

									while (comments.length) {
										const comment = comments[0];
										if (parent && comment.start >= parent.end) break;

										(node.trailingComments ||= []).push(comment);
										comments.shift();
										end = comment.end;
									}
								}
							} else if (/** @type {AST.NodeWithLocation} */ (node).end <= comments[0].start) {
								const onlySimpleWhitespace = /^[,) \t]*$/.test(slice);
								const onlyWhitespace = /^\s*$/.test(slice);
								const hasBlankLine = /\n\s*\n/.test(slice);
								const nodeEndLine = node.loc?.end?.line ?? null;
								const commentStartLine = comments[0].loc?.start?.line ?? null;
								const isImmediateNextLine =
									nodeEndLine !== null &&
									commentStartLine !== null &&
									commentStartLine === nodeEndLine + 1;
								const isSwitchCaseSibling = array_prop === 'cases';

								if (isSwitchCaseSibling && !is_last_in_array) {
									if (
										nodeEndLine !== null &&
										commentStartLine !== null &&
										nodeEndLine === commentStartLine
									) {
										node.trailingComments = [
											/** @type {AST.CommentWithLocation} */ (comments.shift()),
										];
									}
									return;
								}

								if (
									onlySimpleWhitespace ||
									(onlyWhitespace && !hasBlankLine && isImmediateNextLine)
								) {
									// Check if this is a block comment that's inline with the next statement
									// e.g., /** @type {SomeType} */ (a) = 5;
									// These should be leading comments, not trailing
									if (
										comments[0].type === 'Block' &&
										!is_last_in_array &&
										array_prop &&
										parent[array_prop]
									) {
										const currentIndex = parent[array_prop].indexOf(node);
										const nextSibling = parent[array_prop][currentIndex + 1];

										if (nextSibling && nextSibling.loc) {
											const commentEndLine = comments[0].loc?.end?.line;
											const nextSiblingStartLine = nextSibling.loc?.start?.line;

											// If comment ends on same line as next sibling starts, it's inline with next
											if (commentEndLine === nextSiblingStartLine) {
												// Leave it for next sibling's leading comments
												return;
											}
										}
									}

									// For function parameters, only attach as trailing comment if it's on the same line
									// Comments on next line after comma should be leading comments of next parameter
									const isParam = array_prop === 'params';
									if (isParam) {
										// Check if comment is on same line as the node
										const nodeEndLine = source.slice(0, node.end).split('\n').length;
										const commentStartLine = source.slice(0, comments[0].start).split('\n').length;
										if (nodeEndLine === commentStartLine) {
											node.trailingComments = [
												/** @type {AST.CommentWithLocation} */ (comments.shift()),
											];
										}
										// Otherwise leave it for next parameter's leading comments
									} else {
										node.trailingComments = [
											/** @type {AST.CommentWithLocation} */ (comments.shift()),
										];
									}
								} else if (hasBlankLine && onlyWhitespace && array_prop && parent[array_prop]) {
									// When there's a blank line between node and comment(s),
									// check if there's also a blank line after the comment(s) before the next node
									// If so, attach comments as trailing to preserve the grouping
									// Only do this for statement-level contexts (BlockStatement, Program),
									// not for Element children or other contexts
									const isStatementContext =
										parent.type === 'BlockStatement' || parent.type === 'Program';

									// Don't apply for Component - let Prettier handle comment attachment there
									// Component bodies have different comment handling via metadata.elementLeadingComments
									if (!isStatementContext) {
										return;
									}

									const currentIndex = parent[array_prop].indexOf(node);
									const nextSibling = parent[array_prop][currentIndex + 1];

									if (nextSibling && nextSibling.loc) {
										// Find where the comment block ends
										let lastCommentIndex = 0;
										let lastCommentEnd = comments[0].end;

										// Collect consecutive comments (without blank lines between them)
										while (comments[lastCommentIndex + 1]) {
											const currentComment = comments[lastCommentIndex];
											const nextComment = comments[lastCommentIndex + 1];
											const sliceBetween = source.slice(currentComment.end, nextComment.start);

											// If there's a blank line, stop
											if (/\n\s*\n/.test(sliceBetween)) {
												break;
											}

											lastCommentIndex++;
											lastCommentEnd = nextComment.end;
										}

										// Check if there's a blank line after the last comment and before next sibling
										const sliceAfterComments = source.slice(lastCommentEnd, nextSibling.start);
										const hasBlankLineAfter = /\n\s*\n/.test(sliceAfterComments);

										if (hasBlankLineAfter) {
											// Don't attach comments as trailing if next sibling is an Element
											// and any comment falls within the Element's line range
											// This means the comments are inside the Element (between opening and closing tags)
											const nextIsElement = nextSibling.type === 'Element';
											const commentsInsideElement =
												nextIsElement &&
												nextSibling.loc &&
												comments.some((c) => {
													if (!c.loc) return false;
													// Check if comment is on a line between Element's start and end lines
													return (
														c.loc.start.line >= nextSibling.loc.start.line &&
														c.loc.end.line <= nextSibling.loc.end.line
													);
												});

											if (!commentsInsideElement) {
												// Attach all the comments as trailing
												for (let i = 0; i <= lastCommentIndex; i++) {
													(node.trailingComments ||= []).push(
														/** @type {AST.CommentWithLocation} */ (comments.shift()),
													);
												}
											}
										}
									}
								}
							}
						}
					}
				},
			});
		},
	};
}

/**
 * Parse Ripple source code into an AST
 * @param {string} source
 * @param {ParseOptions} [options]
 * @returns {AST.Program}
 */
export function parse(source, options) {
	/** @type {AST.CommentWithLocation[]} */
	const comments = [];

	// Preprocess step 1: Add trailing commas to single-parameter generics followed by (
	// This is a workaround for @sveltejs/acorn-typescript limitations with JSX enabled
	let preprocessedSource = source;
	let sourceChanged = false;

	preprocessedSource = source.replace(/(<\s*[A-Z][a-zA-Z0-9_$]*\s*)>\s*\(/g, (_, generic) => {
		sourceChanged = true;
		// Add trailing comma to disambiguate from JSX
		return `${generic},>(`;
	});

	// Preprocess step 2: Convert generic method shorthand in object literals to function property syntax
	// Transform `method<T,>(...): ReturnType { body }` to `method: function<T,>(...): ReturnType { body }`
	// Note: This only applies to object literal methods, not class methods
	// The trailing comma was already added by step 1
	preprocessedSource = preprocessedSource.replace(
		/(\w+)(<[A-Z][a-zA-Z0-9_$,\s]*>)\s*\(([^)]*)\)(\s*:\s*[^{]+)?(\s*\{)/g,
		(match, methodName, generics, params, returnType, brace, offset) => {
			// Look backward to determine context
			let checkPos = offset - 1;
			while (checkPos >= 0 && /\s/.test(preprocessedSource[checkPos])) checkPos--;
			const prevChar = preprocessedSource[checkPos];

			// Check if we're inside a class
			const before = preprocessedSource.substring(Math.max(0, offset - 500), offset);
			const classMatch = before.match(/\bclass\s+\w+[^{]*\{[^}]*$/);

			// Only transform if we're in an object literal context AND not inside a class
			if ((prevChar === '{' || prevChar === ',') && !classMatch) {
				sourceChanged = true;
				// This is object literal method shorthand - convert to function property
				// Add trailing comma if not already present
				const fixedGenerics = generics.includes(',') ? generics : generics.replace('>', ',>');
				return `${methodName}: function${fixedGenerics}(${params})${returnType || ''}${brace}`;
			}
			return match;
		},
	);

	// Only mark as preprocessed if we actually changed something
	if (!sourceChanged) {
		preprocessedSource = source;
	}

	const { onComment, add_comments } = get_comment_handlers(preprocessedSource, comments);
	let ast;

	try {
		ast = parser.parse(preprocessedSource, {
			sourceType: 'module',
			ecmaVersion: 13,
			locations: true,
			onComment,
			rippleOptions: {
				loose: options?.loose || false,
			},
		});
	} catch (e) {
		throw e;
	}

	add_comments(ast);

	return ast;
}
