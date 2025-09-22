import * as acorn from 'acorn';
import { tsPlugin } from 'acorn-typescript';
import { parse_style } from './style.js';
import { walk } from 'zimmerframe';
import { regex_newline_characters } from '../../../utils/patterns.js';

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

      // Helper method to get the element name from a JSX identifier or member expression
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

      getTokenFromCode(code) {
        if (code === 60) {
          // < character
          if (this.#path.findLast((n) => n.type === 'Component')) {
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
                const tokTypes = this.acornTypeScript.tokTypes;
                ++this.pos;
                return this.finishToken(tokTypes.jsxTagStart);
              }
            }
          }
        }

        if (code === 64) {
          // @ character
          // Look ahead to see if this is followed by a valid identifier character
          if (this.pos + 1 < this.input.length) {
            const nextChar = this.input.charCodeAt(this.pos + 1);
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

      // Read an @ prefixed identifier
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

      // Override parseIdent to mark @ identifiers as tracked
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
        const lookahead = this.lookahead();

        if (lookahead.type?.label === ':') {
          let id = this.startNode();
          id.name = this.value;
          node.name = id;
          this.next();
          this.finishNode(id, 'Identifier');

          if (this.lookahead().value !== '=') {
            this.unexpected();
          }
          this.next();
          if (this.lookahead().type !== tt.braceL) {
            this.unexpected();
          }
          this.next();
          const value = this.jsx_parseAttributeValue();
          const expression = value.expression;
          node.get = null;
          node.set = null;

          if (expression.type == 'SequenceExpression') {
            node.get = expression.expressions[0];
            node.set = expression.expressions[1];
            if (expression.expressions.length > 2) {
              this.unexpected();
            }
          } else {
            node.get = expression;
          }

          return this.finishNode(node, 'AccessorAttribute');
        }

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

          if (this.type === tt.name || this.type.label === 'jsxName') {
            node.name = this.value;
            node.tracked = true;
            this.next();
          } else {
            // Unexpected token after @
            this.unexpected();
          }
        } else if (
          (this.type === tt.name || this.type.label === 'jsxName') &&
          this.value &&
          this.value.startsWith('@')
        ) {
          node.name = this.value.substring(1);
          node.tracked = true;
          this.next();
        } else if (this.type === tt.name || this.type.keyword || this.type.label === 'jsxName') {
          node.name = this.value;
          node.tracked = false; // Explicitly mark as not tracked
          this.next();
        } else {
          return super.jsx_parseIdentifier();
        }

        return this.finishNode(node, 'JSXIdentifier');
      }

      // Override jsx_parseElementName to support @ syntax in member expressions
      jsx_parseElementName() {
        let node = this.jsx_parseIdentifier();
        if (this.eat(tt.dot)) {
          let memberExpr = this.startNodeAt(node.start, node.loc && node.loc.start);
          memberExpr.object = node;
          memberExpr.property = this.jsx_parseIdentifier();
          memberExpr.computed = false;
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

        if (this.value === 'pending') {
          this.next();
          node.pending = this.parseBlock();
        } else {
          node.pending = null;
        }

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

        if (!node.handler && !node.finalizer && !node.pending) {
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
            if (attr.value !== null) {
              if (attr.value.type === 'JSXExpressionContainer') {
                attr.value = attr.value.expression;
              }
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
            // jsx_parseOpeningElementAt treats ID selectors (ie. #myid) or type selectors (ie. div) as identifier and read it
            // So backtrack to the end of the <style> tag to make sure everything is included
            const start = open.end;
            const input = this.input.slice(start);
            const end = input.indexOf('</style>');
            const content = input.slice(0, end);

            const component = this.#path.findLast((n) => n.type === 'Component');
            if (component.css !== null) {
              throw new Error('Components can only have one style tag');
            }
            component.css = parse_style(content);

            const newLines = content.match(regex_newline_characters)?.length;
            if (newLines) {
              this.curLine = open.loc.end.line + newLines;
              this.lineStart = start + content.lastIndexOf('\n') + 1;
            }
            this.pos = start + content.length + 1;

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
            // Ensure we escape JSX <tag></tag> context
            const tokContexts = this.acornTypeScript.tokContexts;
            const curContext = this.curContext();

            if (curContext === tokContexts.tc_expr) {
              this.context.pop();
            }

            this.finishNode(element, 'Element');
            return element;
          } else {
            this.enterScope(0);
            this.parseTemplateBody(element.children);
            this.exitScope();

            // Check if this element was properly closed
            // If we reach here and this element is still in the path, it means it was never closed
            if (this.#path[this.#path.length - 1] === element) {
              const tagName = this.getElementName(element.id);
              this.raise(
                this.start,
                `Unclosed tag '<${tagName}>'. Expected '</${tagName}>' before end of component.`,
              );
            }
          }
          // Ensure we escape JSX <tag></tag> context
          const tokContexts = this.acornTypeScript.tokContexts;
          const curContext = this.curContext();

          if (curContext === tokContexts.tc_expr) {
            this.context.pop();
          }
        }

        this.finishNode(element, 'Element');
        return element;
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

        if (this.type.label === '</>/<=/>=') {
          debugger;
          console.log('HERE', this.value, this.type);
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
            const closingTag = this.jsx_parseElementName();
            this.exprAllowed = true;

            // Validate that the closing tag matches the opening tag
            const currentElement = this.#path[this.#path.length - 1];
            if (!currentElement || currentElement.type !== 'Element') {
              this.raise(this.start, 'Unexpected closing tag');
            }

            const openingTagName = this.getElementName(currentElement.id);
            const closingTagName = this.getElementName(closingTag);

            if (openingTagName !== closingTagName) {
              this.raise(
                this.start,
                `Expected closing tag to match opening tag. Expected '</${openingTagName}>' but found '</${closingTagName}>'`,
              );
            }

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
