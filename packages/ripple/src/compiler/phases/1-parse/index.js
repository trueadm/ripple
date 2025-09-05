import * as acorn from 'acorn';
import { tsPlugin } from 'acorn-typescript';
import { parse_style } from './style.js';
import { walk } from 'zimmerframe';

const parser = acorn.Parser.extend(tsPlugin({ allowSatisfies: true }), RipplePlugin());

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

function RipplePlugin(config) {
	return (Parser) => {
		const original = acorn.Parser.prototype;
		const tt = Parser.tokTypes || acorn.tokTypes;
		const tc = Parser.tokContexts || acorn.tokContexts;

		class RippleParser extends Parser {
			#path = [];

			parseExportDefaultDeclaration() {
				// Check if this is "export default component"
				if (this.value === 'component') {
					const node = this.startNode();
					node.type = 'Component';
					node.css = null;
					node.default = true;
					this.next();
					this.enterScope(0);

					node.id = this.type.label === 'name' ? this.parseIdent() : null;

					this.parseFunctionParams(node);
					this.eat(tt.braceL);
					node.body = [];
					this.#path.push(node);

					this.parseTemplateBody(node.body);

					this.#path.pop();
					this.exitScope();

					this.next();
					this.finishNode(node, 'Component');
					this.awaitPos = 0;

					return node;
				}

				return super.parseExportDefaultDeclaration();
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

				node.expression =
					this.type === tt.braceR ? this.jsx_parseEmptyExpression() : this.parseExpression();
				this.expect(tt.braceR);
				return this.finishNode(node, 'JSXExpressionContainer');
			}

			jsx_parseTupleContainer() {
				var t = this.startNode();
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
					if (this.type.label === '@') {
						this.next();
						if (this.value !== 'use') {
							this.unexpected();
						}
						this.next();
						node.argument = this.parseMaybeAssign();
						this.expect(tt.braceR);
						return this.finishNode(node, 'UseAttribute');
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
						this.finishNode(id, 'Identifier');
						node.name = id;
						node.value = id;
						this.next();
						this.expect(tt.braceR);
						return this.finishNode(node, 'Attribute');
					}
				}
				node.name = this.jsx_parseNamespacedName();
				node.value = this.eat(tt.eq) ? this.jsx_parseAttributeValue() : null;
				return this.finishNode(node, 'JSXAttribute');
			}

			jsx_parseAttributeValue() {
				const tok = this.acornTypeScript.tokTypes;

				switch (this.type) {
					case tt.braceL:
						var t = this.jsx_parseExpressionContainer();
						return (
							'JSXEmptyExpression' === t.expression.type &&
								this.raise(t.start, 'attributes must only be assigned a non-empty expression'),
							t
						);
					case tok.jsxTagStart:
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
				if (this.type === tt._catch) {
					var clause = this.startNode();
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

				if (this.value === 'async') {
					this.next();
					node.async = this.parseBlock();
				} else {
					node.async = null;
				}

				if (!node.handler && !node.finalizer && !node.async) {
					this.raise(node.start, 'Missing catch or finally clause');
				}
				return this.finishNode(node, 'TryStatement');
			}

			jsx_readToken() {
				let out = '',
					chunkStart = this.pos;
				const tok = this.acornTypeScript.tokTypes;

				for (;;) {
					if (this.pos >= this.input.length) this.raise(this.start, 'Unterminated JSX contents');
					let ch = this.input.charCodeAt(this.pos);

					switch (ch) {
						case 60: // '<'
						case 123: // '{'
							if (ch === 60 && this.exprAllowed) {
								++this.pos;
								return this.finishToken(tok.jsxTagStart);
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
									this.options.onComment(
										false,
										commentText,
										commentStart,
										commentEnd,
										startLoc,
										endLoc,
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
									this.options.onComment(
										true,
										commentText,
										commentStart,
										commentEnd,
										startLoc,
										endLoc,
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
								(this.#path.length === 0 || this.#path.at(-1)?.type === 'Component')
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
				const tok = this.acornTypeScript.tokTypes;
				// Adjust the start so we capture the `<` as part of the element
				const prev_pos = this.pos;
				this.pos = this.start - 1;
				const position = this.curPosition();
				this.pos = prev_pos;

				const element = this.startNode();
				element.start = position.index;
				element.loc.start = position;
				element.type = 'Element';
				this.#path.push(element);
				element.children = [];
				const open = this.jsx_parseOpeningElementAt();
				for (const attr of open.attributes) {
					if (attr.type === 'JSXAttribute') {
						attr.type = 'Attribute';
						if (attr.name.type === 'JSXIdentifier') {
							attr.name.type = 'Identifier';
						}
						if (attr.value.type === 'JSXExpressionContainer') {
							attr.value = attr.value.expression;
						}
					}
				}
				if (open.name.type === 'JSXIdentifier') {
					open.name.type = 'Identifier';
				}

				element.id = convert_from_jsx(open.name);
				element.attributes = open.attributes;
				element.selfClosing = open.selfClosing;
				element.metadata = {};

				if (element.selfClosing) {
					this.#path.pop();

					if (this.type.label === '</>/<=/>=') {
						this.pos--;
						this.next();
					}
				} else {
					if (open.name.name === 'style') {
						const start = this.start;
						const input = this.input.slice(start);
						const end = input.indexOf('</style>');
						const content = input.slice(0, end);

						const component = this.#path.findLast((n) => n.type === 'Component');
						if (component.css !== null) {
							throw new Error('Components can only have one style tag');
						}
						component.css = parse_style(content);

						this.pos = start + end + 1;
						this.type = tok.jsxTagStart;
						this.next();
						if (this.value === '/') {
							this.next();
							this.jsx_parseElementName();
							this.exprAllowed = true;
							this.#path.pop();
							this.next();
						}
						// This node is used for Prettier, we don't actually need
						// the node for Ripple's transform process
						element.children = [component.css];
						return element;
					} else {
						this.parseTemplateBody(element.children);
					}
					const tokContexts = this.acornTypeScript.tokContexts;

					const curContext = this.curContext();

					if (curContext === tokContexts.tc_expr) {
						this.context.pop();
					}
				}

				this.finishNode(element, 'Element');
				return element;
			}

			parseSubscript(base, startPos, startLoc, noCalls, maybeAsyncArrow, optionalChained, forInit) {
				if (this.value === '<' && this.#path.findLast((n) => n.type === 'Component')) {
					// Check if this looks like JSX by looking ahead
					const ahead = this.lookahead();
					if (ahead.type.label === 'name' || ahead.value === '/' || ahead.value === '>') {
						// This is JSX, rewind to the end of the object expression
						// and let ASI handle the semicolon insertion naturally
						this.pos = base.end;
						this.type = tt.braceR;
						this.value = '}';
						this.start = base.end - 1;
						this.end = base.end;
						const position = this.curPosition();
						this.startLoc = position;
						this.endLoc = position;
						// Avoid triggering onComment handlers, as they will have
						// already been triggered when parsing the subscript before
						const onComment = this.options.onComment;
						this.options.onComment = () => {};
						this.next();
						this.options.onComment = onComment;

						return base;
					}
				}
				return super.parseSubscript(
					base,
					startPos,
					startLoc,
					noCalls,
					maybeAsyncArrow,
					optionalChained,
					forInit,
				);
			}

			parseTemplateBody(body) {
				var inside_func =
					this.context.some((n) => n.token === 'function') || this.scopeStack.length > 1;

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

				if (this.type.label === '{') {
					const node = this.jsx_parseExpressionContainer();
					node.type = 'Text';
					body.push(node);
				} else if (this.type.label === '}') {
					return;
				} else if (this.type.label === 'jsxTagStart') {
					this.next();
					if (this.value === '/') {
						this.next();
						this.jsx_parseElementName();
						this.exprAllowed = true;
						this.#path.pop();
						this.next();
						return;
					}
					const node = this.parseElement();
					if (node !== null) {
						body.push(node);
					}
				} else {
					const node = this.parseStatement(null);
					body.push(node);
				}
				this.parseTemplateBody(body);
			}

			parseStatement(context, topLevel, exports) {
				const tok = this.acornTypeScript.tokContexts;

				if (
					context !== 'for' &&
					context !== 'if' &&
					this.context.at(-1) === tc.b_stat &&
					this.type === tt.braceL &&
					this.context.some((c) => c === tok.tc_expr)
				) {
					this.next();
					const node = this.jsx_parseExpressionContainer();
					node.type = 'Text';
					this.next();
					this.context.pop();
					this.context.pop();
					return node;
				}

				if (this.value === 'component') {
					const node = this.startNode();
					node.type = 'Component';
					node.css = null;
					this.next();
					this.enterScope(0);
					node.id = this.parseIdent();
					this.parseFunctionParams(node);
					this.eat(tt.braceL);
					node.body = [];
					this.#path.push(node);

					this.parseTemplateBody(node.body);

					this.#path.pop();
					this.exitScope();

					this.next();
					this.finishNode(node, 'Component');
					this.awaitPos = 0;

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
 * in JS code and so that `prettier-plugin-ripple` doesn't remove all comments when formatting.
 * @param {string} source
 * @param {CommentWithLocation[]} comments
 * @param {number} index
 */
function get_comment_handlers(source, comments, index = 0) {
	return {
		onComment: (block, value, start, end, start_loc, end_loc) => {
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
			});
		},
		add_comments: (ast) => {
			if (comments.length === 0) return;

			comments = comments
				.filter((comment) => comment.start >= index)
				.map(({ type, value, start, end }) => ({ type, value, start, end }));

			walk(ast, null, {
				_(node, { next, path }) {
					let comment;

					while (comments[0] && comments[0].start < node.start) {
						comment = /** @type {CommentWithLocation} */ (comments.shift());
						(node.leadingComments ||= []).push(comment);
					}

					next();

					if (comments[0]) {
						if (node.type === 'BlockStatement' && node.body.length === 0) {
							if (comments[0].start < node.end && comments[0].end < node.end) {
								comment = /** @type {CommentWithLocation} */ (comments.shift());
								(node.innerComments ||= []).push(comment);
								return;
							}
						}
						const parent = /** @type {any} */ (path.at(-1));

						if (parent === undefined || node.end !== parent.end) {
							const slice = source.slice(node.end, comments[0].start);
							const is_last_in_body =
								((parent?.type === 'BlockStatement' || parent?.type === 'Program') &&
									parent.body.indexOf(node) === parent.body.length - 1) ||
								(parent?.type === 'ArrayExpression' &&
									parent.elements.indexOf(node) === parent.elements.length - 1) ||
								(parent?.type === 'ObjectExpression' &&
									parent.properties.indexOf(node) === parent.properties.length - 1);

							if (is_last_in_body) {
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
							} else if (node.end <= comments[0].start && /^[,) \t]*$/.test(slice)) {
								node.trailingComments = [/** @type {CommentWithLocation} */ (comments.shift())];
							}
						}
					}
				},
			});

			// Special case: Trailing comments after the root node (which can only happen for expression tags or for Program nodes).
			// Adding them ensures that we can later detect the end of the expression tag correctly.
			if (comments.length > 0 && (comments[0].start >= ast.end || ast.type === 'Program')) {
				(ast.trailingComments ||= []).push(...comments.splice(0));
			}
		},
	};
}

export function parse(source) {
	const comments = [];
	const { onComment, add_comments } = get_comment_handlers(source, comments);
	let ast;

	try {
		ast = parser.parse(source, {
			sourceType: 'module',
			ecmaVersion: 13,
			locations: true,
			onComment,
		});
	} catch (e) {
		throw e;
	}

	add_comments(ast);

	return ast;
}
