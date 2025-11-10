// @ts-nocheck
/** @import { Program } from 'estree' */
/** @import {
 *   CommentWithLocation,
 *   RipplePluginConfig
 * } from '#compiler' */

import * as acorn from 'acorn';
import { tsPlugin } from '@sveltejs/acorn-typescript';
import { parse_style } from './style.js';
import { walk } from 'zimmerframe';
import { regex_newline_characters } from '../../../utils/patterns.js';

const parser = acorn.Parser.extend(tsPlugin({ jsx: true }), RipplePlugin());

/**
 * Convert JSX node types to regular JavaScript node types
 * @param {any} node - The JSX node to convert
 * @returns {any} The converted node
 */
function convert_from_jsx(node) {
	if (node.type === 'JSXIdentifier') {
		node.type = 'Identifier';
	} else if (node.type === 'JSXMemberExpression') {
		node.type = 'MemberExpression';
		node.object = convert_from_jsx(node.object);
		node.property = convert_from_jsx(node.property);
	}
	return node;
}

const regex_whitespace_only = /\s/;

/**
 * Skip whitespace characters without skipping comments.
 * This is needed because Acorn's skipSpace() also skips comments, which breaks
 * parsing in certain contexts. Updates parser position and line tracking.
 * @param {acorn.Parser} parser
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

function isWhitespaceTextNode(node) {
	if (!node || node.type !== 'Text') {
		return false;
	}
	const value =
		typeof node.value === 'string' ? node.value : typeof node.raw === 'string' ? node.raw : '';
	return /^\s*$/.test(value);
}

/**
 * Acorn parser plugin for Ripple syntax extensions
 * @param {RipplePluginConfig} [config] - Plugin configuration
 * @returns {function(any): any} Parser extension function
 */
function RipplePlugin(config) {
	return (/** @type {any} */ Parser) => {
		const original = acorn.Parser.prototype;
		const tt = Parser.tokTypes || acorn.tokTypes;
		const tc = Parser.tokContexts || acorn.tokContexts;
		const tstt = Parser.acornTypeScript.tokTypes;
		const tstc = Parser.acornTypeScript.tokContexts;

		class RippleParser extends Parser {
			/** @type {any[]} */
			#path = [];
			#commentContextId = 0;

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

				container.metadata ??= {};
				if (container.metadata.commentContainerId === undefined) {
					container.metadata.commentContainerId = ++this.#commentContextId;
				}

				return {
					containerId: container.metadata.commentContainerId,
					containerType: container.type,
					childIndex: children.length,
					beforeMeaningfulChild: !hasMeaningfulChildren,
				};
			}

			/**
			 * Helper method to get the element name from a JSX identifier or member expression
			 * @param {any} node - The node to get the name from
			 * @returns {string | null} Element name or null
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
			 * @param {number} code - Character code
			 * @returns {any} Token or calls super method
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
			 * @returns {any} Token with @ identifier
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
			 * @param {any} [liberal] - Whether to allow liberal parsing
			 * @returns {any} Parsed identifier node
			 */
			parseIdent(liberal) {
				const node = super.parseIdent(liberal);
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
			 * @param {any} base - The base expression
			 * @param {number} startPos - Start position
			 * @param {any} startLoc - Start location
			 * @param {boolean} noCalls - Whether calls are disallowed
			 * @param {any} maybeAsyncArrow - Optional async arrow flag
			 * @param {any} optionalChained - Optional chaining flag
			 * @param {any} forInit - For-init flag
			 * @returns {any} Parsed subscript expression
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
						const node = this.startNodeAt(startPos, startLoc);
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
						base = this.finishNode(node, 'MemberExpression');

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
			 * @param {any} [refDestructuringErrors]
			 * @param {any} [forNew]
			 * @param {any} [forInit]
			 * @returns {any} Parsed expression atom
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
					return this.finishNode(node, 'ServerIdentifier');
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
			 */
			parseParenAndDistinguishExpression(canBeArrow, forInit) {
				const startPos = this.start;
				const expr = super.parseParenAndDistinguishExpression(canBeArrow, forInit);

				// If the expression's start position is after the opening paren,
				// it means it was wrapped in parentheses. Mark it in metadata.
				if (expr && expr.start > startPos) {
					expr.metadata ??= {};
					expr.metadata.parenthesized = true;
				}

				return expr;
			}

			/**
			 * Parse `@(expression)` syntax for unboxing tracked values
			 * Creates a TrackedExpression node with the argument property
			 * @returns {any} TrackedExpression node
			 */
			parseTrackedExpression() {
				const node = this.startNode();
				this.next(); // consume '@(' token
				node.argument = this.parseExpression();
				this.expect(tt.parenR); // expect ')'
				return this.finishNode(node, 'TrackedExpression');
			}

			/**
			 * Override to allow TrackedExpression as a valid lvalue for update expressions
			 * @param {any} expr - Expression to check
			 * @param {any} bindingType - Binding type
			 * @param {any} checkClashes - Check for clashes
			 */
			checkLValSimple(expr, bindingType, checkClashes) {
				// Allow TrackedExpression as a valid lvalue for ++/-- operators
				if (expr.type === 'TrackedExpression') {
					return;
				}
				return super.checkLValSimple(expr, bindingType, checkClashes);
			}

			parseServerBlock() {
				const node = this.startNode();
				this.next();

				const body = this.startNode();
				node.body = body;
				body.body = [];

				this.expect(tt.braceL);
				this.enterScope(0);
				while (this.type !== tt.braceR) {
					const stmt = this.parseStatement(null, true);
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
			 * @param {string} type - Either 'TrackedMap' or 'TrackedSet'
			 * @returns {any} TrackedMap or TrackedSet node
			 */
			parseTrackedCollectionExpression(type) {
				const node = this.startNode();
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

				if (isAfterNew && this.type === tt.parenL) {
					// Don't consume parens - they belong to NewExpression
					node.arguments = [];
					return this.finishNode(node, type);
				}

				// If we reach here, it means #Map or #Set is being called without 'new'
				// Throw a TypeError to match JavaScript class constructor behavior
				const constructorName =
					type === 'TrackedMapExpression' ? '#Map (TrackedMap)' : '#Set (TrackedSet)';
				this.raise(
					node.start,
					`TypeError: Class constructor ${constructorName} cannot be invoked without 'new'`,
				);

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

			parseTrackedArrayExpression() {
				const node = this.startNode();
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

			parseTrackedObjectExpression() {
				const node = this.startNode();
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
						node.properties.push(this.parseProperty(false, {}));
					}
				}

				return this.finishNode(node, 'TrackedObjectExpression');
			}

			/**
			 * Parse a component - common implementation used by statements, expressions, and export defaults
			 * @param {Object} options - Parsing options
			 * @param {boolean} [options.requireName=false] - Whether component name is required
			 * @param {boolean} [options.isDefault=false] - Whether this is an export default component
			 * @param {boolean} [options.declareName=false] - Whether to declare the name in scope
			 * @returns {any} Component node
			 */
			parseComponent({ requireName = false, isDefault = false, declareName = false } = {}) {
				const node = this.startNode();
				node.type = 'Component';
				node.css = null;
				node.default = isDefault;
				this.next(); // consume 'component'
				this.enterScope(0);

				if (requireName) {
					node.id = this.parseIdent();
					if (declareName) {
						this.declareName(node.id.name, 'var', node.id.start);
					}
				} else {
					node.id = this.type.label === 'name' ? this.parseIdent() : null;
					if (declareName && node.id) {
						this.declareName(node.id.name, 'var', node.id.start);
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

			parseExportDefaultDeclaration() {
				// Check if this is "export default component"
				if (this.value === 'component') {
					return this.parseComponent({ isDefault: true });
				}

				return super.parseExportDefaultDeclaration();
			}

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
					let init = this.startNode(),
						kind = isLet ? 'let' : this.value;
					this.next();
					this.parseVar(init, true, kind);
					this.finishNode(init, 'VariableDeclaration');
					return this.parseForAfterInitWithIndex(node, init, awaitAt);
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
					let init = this.startNode();
					this.next();
					if (usingKind === 'await using') {
						if (!this.canAwait) {
							this.raise(this.start, 'Await using cannot appear outside of async function');
						}
						this.next();
					}
					this.parseVar(init, true, usingKind);
					this.finishNode(init, 'VariableDeclaration');
					return this.parseForAfterInitWithIndex(node, init, awaitAt);
				}

				let containsEsc = this.containsEsc;
				let refDestructuringErrors = {};
				let initPos = this.start;
				let init =
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
						node.await = true;
					} else if (isForOf && this.options.ecmaVersion >= 8) {
						if (
							init.start === initPos &&
							!containsEsc &&
							init.type === 'Identifier' &&
							init.name === 'async'
						)
							this.unexpected();
						else if (this.options.ecmaVersion >= 9) node.await = false;
					}
					if (startsWithLet && isForOf)
						this.raise(init.start, "The left-hand side of a for-of loop may not start with 'let'.");
					this.toAssignable(init, false, refDestructuringErrors);
					this.checkLValPattern(init);
					return this.parseForInWithIndex(node, init);
				} else {
					this.checkExpressionErrors(refDestructuringErrors, true);
				}

				if (awaitAt > -1) this.unexpected(awaitAt);
				return this.parseFor(node, init);
			}

			parseForAfterInitWithIndex(node, init, awaitAt) {
				if (
					(this.type === tt._in || (this.options.ecmaVersion >= 6 && this.isContextual('of'))) &&
					init.declarations.length === 1
				) {
					if (this.options.ecmaVersion >= 9) {
						if (this.type === tt._in) {
							if (awaitAt > -1) this.unexpected(awaitAt);
						} else node.await = awaitAt > -1;
					}
					return this.parseForInWithIndex(node, init);
				}
				if (awaitAt > -1) this.unexpected(awaitAt);
				return this.parseFor(node, init);
			}

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
						init.start,
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
						node.index = this.parseExpression();
						if (node.index.type !== 'Identifier') {
							this.raise(this.start, 'Expected identifier after "index" keyword');
						}
						this.eat(tt.semi);
					}

					if (this.isContextual('key')) {
						this.next(); // consume 'key'
						node.key = this.parseExpression();
					}

					if (this.isContextual('index')) {
						this.raise(this.start, '"index" must come before "key" in for-of loop');
					}
				} else if (!isForIn) {
					// Set index to null for standard for-of loops
					node.index = null;
				}

				this.expect(tt.parenR);
				node.body = this.parseStatement('for');
				this.exitScope();
				this.labels.pop();
				return this.finishNode(node, isForIn ? 'ForInStatement' : 'ForOfStatement');
			}

			shouldParseExportStatement() {
				if (super.shouldParseExportStatement()) {
					return true;
				}
				if (this.value === 'component') {
					return true;
				}
				return this.type.keyword === 'var';
			}

			jsx_parseExpressionContainer() {
				let node = this.startNode();
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

			jsx_parseEmptyExpression() {
				// Override to properly handle the range for JSXEmptyExpression
				// The range should be from after { to before }
				const node = this.startNodeAt(this.lastTokEnd, this.lastTokEndLoc);
				node.end = this.start;
				node.loc.end = this.startLoc;
				return this.finishNodeAt(node, 'JSXEmptyExpression', this.start, this.startLoc);
			}

			jsx_parseTupleContainer() {
				const t = this.startNode();
				return (
					this.next(),
					(t.expression =
						this.type === tt.bracketR ? this.jsx_parseEmptyExpression() : this.parseExpression()),
					this.expect(tt.bracketR),
					this.finishNode(t, 'JSXExpressionContainer')
				);
			}

			jsx_parseAttribute() {
				let node = this.startNode();

				if (this.eat(tt.braceL)) {
					if (this.value === 'ref') {
						this.next();
						if (this.type === tt.braceR) {
							this.raise(
								this.start,
								'"ref" is a Ripple keyword and must be used in the form {ref fn}',
							);
						}
						node.argument = this.parseMaybeAssign();
						this.expect(tt.braceR);
						return this.finishNode(node, 'RefAttribute');
					} else if (this.type === tt.ellipsis) {
						this.expect(tt.ellipsis);
						node.argument = this.parseMaybeAssign();
						this.expect(tt.braceR);
						return this.finishNode(node, 'SpreadAttribute');
					} else if (this.lookahead().type === tt.ellipsis) {
						this.expect(tt.ellipsis);
						node.argument = this.parseMaybeAssign();
						this.expect(tt.braceR);
						return this.finishNode(node, 'SpreadAttribute');
					} else {
						const id = this.parseIdentNode();
						id.tracked = false;
						if (id.name.startsWith('@')) {
							id.tracked = true;
							id.name = id.name.slice(1);
						}
						this.finishNode(id, 'Identifier');
						node.name = id;
						node.value = id;
						node.shorthand = true; // Mark as shorthand since name and value are the same
						this.next();
						this.expect(tt.braceR);
						return this.finishNode(node, 'Attribute');
					}
				}
				node.name = this.jsx_parseNamespacedName();
				node.value = this.eat(tt.eq) ? this.jsx_parseAttributeValue() : null;
				return this.finishNode(node, 'JSXAttribute');
			}

			jsx_parseNamespacedName() {
				const base = this.jsx_parseIdentifier();
				if (!this.eat(tt.colon)) return base;
				const node = this.startNodeAt(base.start, base.loc.start);
				node.namespace = base;
				node.name = this.jsx_parseIdentifier();
				return this.finishNode(node, 'JSXNamespacedName');
			}

			jsx_parseIdentifier() {
				const node = this.startNode();

				if (this.type.label === '@') {
					this.next(); // consume @

					if (this.type === tt.name || this.type === tstt.jsxName) {
						node.name = this.value;
						node.tracked = true;
						this.next();
					} else {
						// Unexpected token after @
						this.unexpected();
					}
				} else if (
					(this.type === tt.name || this.type === tstt.jsxName) &&
					this.value &&
					this.value.startsWith('@')
				) {
					node.name = this.value.substring(1);
					node.tracked = true;
					this.next();
				} else if (this.type === tt.name || this.type.keyword || this.type === tstt.jsxName) {
					node.name = this.value;
					node.tracked = false; // Explicitly mark as not tracked
					this.next();
				} else {
					return super.jsx_parseIdentifier();
				}

				return this.finishNode(node, 'JSXIdentifier');
			}

			jsx_parseElementName() {
				if (this.type === tstt.jsxTagEnd) {
					return '';
				}

				let node = this.jsx_parseNamespacedName();

				if (node.type === 'JSXNamespacedName') {
					return node;
				}

				if (this.eat(tt.dot)) {
					let memberExpr = this.startNodeAt(node.start, node.loc && node.loc.start);
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
							memberExpr.property = this.parseExpression();
							memberExpr.property.tracked = true;

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
						let newMemberExpr = this.startNodeAt(
							memberExpr.start,
							memberExpr.loc && memberExpr.loc.start,
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

			jsx_parseAttributeValue() {
				switch (this.type) {
					case tt.braceL:
						const t = this.jsx_parseExpressionContainer();
						return (
							'JSXEmptyExpression' === t.expression.type &&
								this.raise(t.start, 'attributes must only be assigned a non-empty expression'),
							t
						);
					case tstt.jsxTagStart:
					case tt.string:
						return this.parseExprAtom();
					default:
						this.raise(this.start, 'value should be either an expression or a quoted text');
				}
			}

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
					const clause = this.startNode();
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
					this.raise(node.start, 'Missing catch or finally clause');
				}
				return this.finishNode(node, 'TryStatement');
			}

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

			parseElement() {
				const inside_head = this.#path.findLast(
					(n) => n.type === 'Element' && n.id.type === 'Identifier' && n.id.name === 'head',
				);
				// Adjust the start so we capture the `<` as part of the element
				const prev_pos = this.pos;
				this.pos = this.start - 1;
				const position = this.curPosition();
				this.pos = prev_pos;

				const element = this.startNode();
				element.start = position.index;
				element.loc.start = position;
				element.metadata = {};
				element.children = [];

				// Check if this is a <script> or <style> tag
				const tagName = this.value;
				const isScriptOrStyle = tagName === 'script' || tagName === 'style';

				let open;
				if (isScriptOrStyle) {
					// Manually parse opening tag to avoid jsx_parseOpeningElementAt consuming content
					const tagStart = this.start;
					const tagEndPos = this.input.indexOf('>', tagStart);

					open = {
						type: 'JSXOpeningElement',
						name: { type: 'JSXIdentifier', name: tagName },
						attributes: [],
						selfClosing: false,
						end: tagEndPos + 1,
						loc: {
							end: {
								line: this.curLine,
								column: tagEndPos + 1,
							},
						},
					};

					// Position after the '>'
					this.pos = tagEndPos + 1;
				} else {
					open = this.jsx_parseOpeningElementAt();
				}

				// Check if this is a namespaced element (tsx:react)
				const is_tsx_compat = open.name.type === 'JSXNamespacedName';

				if (is_tsx_compat) {
					element.type = 'TsxCompat';
					element.kind = open.name.name.name; // e.g., "react" from "tsx:react"

					if (open.selfClosing) {
						const tagName = open.name.namespace.name + ':' + open.name.name.name;
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
						attr.type = 'Attribute';
						if (attr.name.type === 'JSXIdentifier') {
							attr.name.type = 'Identifier';
						}
						if (attr.value !== null) {
							if (attr.value.type === 'JSXExpressionContainer') {
								attr.value = attr.value.expression;
							}
						}
					}
				}

				if (!is_tsx_compat) {
					if (open.name.type === 'JSXIdentifier') {
						open.name.type = 'Identifier';
					}
					element.id = convert_from_jsx(open.name);
					element.selfClosing = open.selfClosing;
				}

				element.attributes = open.attributes;
				element.metadata ??= {};
				element.metadata.commentContainerId = ++this.#commentContextId;

				if (element.selfClosing) {
					this.#path.pop();

					if (this.type.label === '</>/<=/>=') {
						this.pos--;
						this.next();
					}
				} else {
					if (open.name.name === 'script') {
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

						element.content = content;
						this.finishNode(element, 'Element');
					} else if (open.name.name === 'style') {
						// jsx_parseOpeningElementAt treats ID selectors (ie. #myid) or type selectors (ie. div) as identifier and read it
						// So backtrack to the end of the <style> tag to make sure everything is included
						const start = open.end;
						const input = this.input.slice(start);
						const end = input.indexOf('</style>');
						const content = input.slice(0, end);

						const component = this.#path.findLast((n) => n.type === 'Component');
						const parsed_css = parse_style(content);

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
						element.children = [parsed_css];

						// Ensure we escape JSX <tag></tag> context
						const curContext = this.curContext();

						if (curContext === tstc.tc_expr) {
							this.context.pop();
						}

						element.css = content;
						this.finishNode(element, 'Element');
						return element;
					} else {
						this.enterScope(0);
						this.parseTemplateBody(element.children);
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
							// If we reach here and this element is still in the path, it means it was never closed
							const tagName = this.getElementName(element.id);

							this.raise(
								this.start,
								`Unclosed tag '<${tagName}>'. Expected '</${tagName}>' before end of component.`,
							);
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
								const node = {
									type: 'JSXText',
									value: text,
									raw: text,
									start,
									end: this.pos,
								};
								body.push(node);
							}

							this.next();
						}
					}
				}
				if (this.type === tt.braceL) {
					const node = this.jsx_parseExpressionContainer();
					node.type = node.html ? 'Html' : 'Text';
					delete node.html;
					body.push(node);
				} else if (this.type === tt.braceR) {
					return;
				} else if (this.type === tstt.jsxTagStart) {
					this.next();
					if (this.value === '/') {
						this.next();
						const closingTag = this.jsx_parseElementName();
						this.exprAllowed = true;

						// Validate that the closing tag matches the opening tag
						const currentElement = this.#path[this.#path.length - 1];
						if (
							!currentElement ||
							(currentElement.type !== 'Element' && currentElement.type !== 'TsxCompat')
						) {
							this.raise(this.start, 'Unexpected closing tag');
						}

						let openingTagName;
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
							this.raise(
								this.start,
								`Expected closing tag to match opening tag. Expected '</${openingTagName}>' but found '</${closingTagName}>'`,
							);
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

			parseStatement(context, topLevel, exports) {
				if (
					context !== 'for' &&
					context !== 'if' &&
					this.context.at(-1) === tc.b_stat &&
					this.type === tt.braceL &&
					this.context.some((c) => c === tstt.tc_expr)
				) {
					this.next();
					const node = this.jsx_parseExpressionContainer();
					node.type = 'Text';
					this.next();
					this.context.pop();
					this.context.pop();
					return node;
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
						const node = this.startNode();
						this.next();
						// Force expression context to ensure @ is tokenized correctly
						const old_expr_allowed = this.exprAllowed;
						this.exprAllowed = true;
						node.expression = this.parseExpression();

						if (node.expression.type === 'UpdateExpression') {
							let object = node.expression.argument;
							while (object.type === 'MemberExpression') {
								object = object.object;
							}
							if (object.type === 'Identifier') {
								object.tracked = true;
							}
						} else if (node.expression.type === 'AssignmentExpression') {
							let object = node.expression.left;
							while (object.type === 'MemberExpression') {
								object = object.object;
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

			parseBlock(createNewLexicalScope, node, exitStrict) {
				const parent = this.#path.at(-1);

				if (parent?.type === 'Component' || parent?.type === 'Element') {
					if (createNewLexicalScope === void 0) createNewLexicalScope = true;
					if (node === void 0) node = this.startNode();

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

		return RippleParser;
	};
}

/**
 * Acorn doesn't add comments to the AST by itself. This factory returns the capabilities
 * to add them after the fact. They are needed in order to support `ripple-ignore` comments
 * in JS code and so that `prettier-plugin` doesn't remove all comments when formatting.
 * @param {string} source
 * @param {CommentWithLocation[]} comments
 * @param {number} [index=0] - Starting index
 * @returns {{ onComment: Function, add_comments: Function }} Comment handler functions
 */
function get_comment_handlers(source, comments, index = 0) {
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
					start: /** @type {import('acorn').Position} */ (start_loc),
					end: /** @type {import('acorn').Position} */ (end_loc),
				},
				context: metadata ?? null,
			});
		},
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

			walk(ast, null, {
				_(node, { next, path }) {
					let comment;

					const metadata =
						/** @type {{ commentContainerId?: number, elementLeadingComments?: CommentWithLocation[] }} */ (
							node?.metadata
						);

					if (metadata && metadata.commentContainerId !== undefined) {
						while (
							comments[0] &&
							comments[0].context &&
							comments[0].context.containerId === metadata.commentContainerId &&
							comments[0].context.beforeMeaningfulChild
						) {
							const elementComment = /** @type {CommentWithLocation & { context?: any }} */ (
								comments.shift()
							);
							(metadata.elementLeadingComments ||= []).push(elementComment);
						}
					}

					while (comments[0] && comments[0].start < node.start) {
						comment = /** @type {CommentWithLocation} */ (comments.shift());

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

						if (comment.loc) {
							const ancestorElements = path
								.filter((ancestor) => ancestor && ancestor.type === 'Element' && ancestor.loc)
								.sort((a, b) => a.loc.start.line - b.loc.start.line);

							const targetAncestor = ancestorElements.find(
								(ancestor) => comment.loc.start.line < ancestor.loc.start.line,
							);

							if (targetAncestor) {
								targetAncestor.metadata ??= {};
								(targetAncestor.metadata.elementLeadingComments ||= []).push(comment);
								continue;
							}
						}
						(node.leadingComments ||= []).push(comment);
					}

					next();

					if (comments[0]) {
						if (node.type === 'BlockStatement' && node.body.length === 0) {
							// Collect all comments that fall within this empty block
							while (comments[0] && comments[0].start < node.end && comments[0].end < node.end) {
								comment = /** @type {CommentWithLocation} */ (comments.shift());
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
								comments[0].start >= node.start &&
								comments[0].end <= node.end
							) {
								comment = /** @type {CommentWithLocation} */ (comments.shift());
								(node.innerComments ||= []).push(comment);
							}
							if (node.innerComments && node.innerComments.length > 0) {
								return;
							}
						}
						// Handle empty Element nodes the same way as empty BlockStatements
						if (node.type === 'Element' && (!node.children || node.children.length === 0)) {
							if (comments[0].start < node.end && comments[0].end < node.end) {
								comment = /** @type {CommentWithLocation} */ (comments.shift());
								(node.innerComments ||= []).push(comment);
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
												/** @type {CommentWithLocation} */ (comments.shift()),
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
							} else if (node.end <= comments[0].start) {
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
										node.trailingComments = [/** @type {CommentWithLocation} */ (comments.shift())];
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
												/** @type {CommentWithLocation} */ (comments.shift()),
											];
										}
										// Otherwise leave it for next parameter's leading comments
									} else {
										node.trailingComments = [/** @type {CommentWithLocation} */ (comments.shift())];
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
													(node.trailingComments ||= []).push(comments.shift());
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
 * @returns {Program}
 */
export function parse(source) {
	/** @type {CommentWithLocation[]} */
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
			onComment: /** @type {any} */ (onComment),
		});
	} catch (e) {
		throw e;
	}

	add_comments(ast);

	return /** @type {Program} */ (ast);
}
