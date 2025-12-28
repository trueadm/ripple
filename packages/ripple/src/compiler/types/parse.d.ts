/**
 * Type definitions for Ripple's extended Acorn parser
 *
 * These types cover internal properties and static class members that aren't
 * included in Acorn's official type definitions but are used by Ripple's parser.
 *
 * Based on acorn source code: https://github.com/acornjs/acorn
 * and @sveltejs/acorn-typescript: https://github.com/sveltejs/acorn-typescript
 *
 * Usage in JSDoc: @type {Parse.Parser}
 */

import type * as acorn from 'acorn';
import type * as AST from 'estree';
import type * as ESTreeJSX from 'estree-jsx';
import type * as ESRap from 'esrap';
import type * as SourceMap from '@jridgewell/sourcemap-codec';
import type * as RippleCompiler from '#compiler';

type ForInit = boolean | 'await';

declare module 'acorn' {
	// Helper type for readToken method
	type ReadToken = Parse.Parser['readToken'];

	const tokContexts: Parse.TokContexts;
	class Position implements AST.Position {
		line: number;
		column: number;
		constructor(line: number, column: number);
	}
	function isNewLine(code: number): boolean;

	interface Parser {
		readToken(...args: Parameters<ReadToken>): ReturnType<ReadToken>;
	}
}

declare module 'esrap' {
	export function print<V extends RippleCompiler.Visitors<AST.Node, any>>(
		ast: AST.Node,
		visitors: V,
		options?: ESRap.PrintOptions,
	): { code: string; map: SourceMap.SourceMapMappings };
}

declare module 'esrap/languages/tsx' {
	export default function tsx<V extends RippleCompiler.Visitors<AST.Node, any>>(
		options: Parse.ESRapTSOptions,
	): V;
}

declare module 'zimmerframe' {
	export function walk(
		node: AST.Node,
		state: any,
		visitors: RippleCompiler.Visitors<AST.Node, any>,
	): AST.Node;

	export function walk(
		node: AST.CSS.Node,
		state: any,
		visitors: RippleCompiler.Visitors<AST.CSS.Node, any>,
	): AST.CSS.Node;
}

export namespace Parse {
	export interface ESRapTSOptions {
		quotes?: 'double' | 'single';
		comments?: AST.Comment[];
	}

	/**
	 * Destructuring errors object used during expression parsing
	 * See: https://github.com/acornjs/acorn/blob/main/acorn/src/parseutil.js
	 */
	export interface DestructuringErrors {
		shorthandAssign: number;
		trailingComma: number;
		parenthesizedAssign: number;
		parenthesizedBind: number;
		doubleProto: number;
	}

	/**
	 * Binding type constants used in checkLVal* and declareName
	 * to determine the type of a binding
	 */
	export interface BindingType {
		/** Not a binding */
		BIND_NONE: 0;
		/** Var-style binding */
		BIND_VAR: 1;
		/** Let- or const-style binding */
		BIND_LEXICAL: 2;
		/** Function declaration */
		BIND_FUNCTION: 3;
		/** Simple (identifier pattern) catch binding */
		BIND_SIMPLE_CATCH: 4;
		/** Special case for function names as bound inside the function */
		BIND_OUTSIDE: 5;
	}

	/**
	 * Branch ID for tracking disjunction structure in regular expressions
	 * Used to determine whether a duplicate capture group name is allowed
	 * because it is in a separate branch.
	 */
	export interface BranchID {
		/** Parent disjunction branch */
		parent: BranchID | null;
		/** Identifies this set of sibling branches */
		base: BranchID;
		/** Check if this branch is separated from another branch */
		separatedFrom(alt: BranchID): boolean;
		/** Create a sibling branch */
		sibling(): BranchID;
	}

	/**
	 * Regular expression validation state
	 * Used by the parser to validate regular expression literals
	 * See: https://github.com/acornjs/acorn/blob/main/acorn/src/regexp.js
	 */
	export interface RegExpValidationState {
		/** Reference to the parser instance */
		parser: Parser;
		/** Valid flags for the current ECMAScript version */
		validFlags: string;
		/** Unicode properties data for the current ECMAScript version */
		unicodeProperties: any;
		/** Source pattern string of the regular expression */
		source: string;
		/** Flags string of the regular expression */
		flags: string;
		/** Start position of the regular expression in the source */
		start: number;
		/** Whether unicode flag (u) is enabled */
		switchU: boolean;
		/** Whether unicode sets flag (v) is enabled (ES2024+) */
		switchV: boolean;
		/** Whether named capture groups are enabled */
		switchN: boolean;
		/** Current position in the pattern */
		pos: number;
		/** Last integer value parsed */
		lastIntValue: number;
		/** Last string value parsed */
		lastStringValue: string;
		/** Whether the last assertion can be quantified */
		lastAssertionIsQuantifiable: boolean;
		/** Number of capturing parentheses */
		numCapturingParens: number;
		/** Maximum back reference number */
		maxBackReference: number;
		/** Map of group names to their information */
		groupNames: Record<string, BranchID[]>;
		/** Array of back reference names */
		backReferenceNames: string[];
		/** Current branch ID for tracking disjunction structure */
		branchID: BranchID | null;

		/** Reset state for a new pattern */
		reset(start: number, pattern: string, flags: string): void;
		/** Raise a validation error */
		raise(message: string): void;
		/** Get code point at position i (handles surrogate pairs if unicode mode) */
		at(i: number, forceU?: boolean): number;
		/** Get next index after position i (handles surrogate pairs if unicode mode) */
		nextIndex(i: number, forceU?: boolean): number;
		/** Get code point at current position */
		current(forceU?: boolean): number;
		/** Get code point at next position */
		lookahead(forceU?: boolean): number;
		/** Advance position to next character */
		advance(forceU?: boolean): void;
		/** Try to eat a specific character */
		eat(ch: number, forceU?: boolean): boolean;
		/** Try to eat a sequence of characters */
		eatChars(chs: number[], forceU?: boolean): boolean;
	}

	export interface Options extends Omit<acorn.Options, 'onComment' | 'ecmaVersion'> {
		rippleOptions: {
			loose: boolean;
		};
		// The type has "latest" but it's converted to 1e8 at runtime
		// and if (ecmaVersion >= 2015) { ecmaVersion -= 2009 }
		// so we're making it always a number to reflect the runtime values
		ecmaVersion: number;
		onComment(
			block: boolean,
			value: string,
			start: number,
			end: number,
			start_loc: AST.Position,
			end_loc: AST.Position,
			metadata?: CommentMetaData | null,
		): void;
	}

	export interface CommentMetaData {
		containerId: number;
		childIndex: number;
		beforeMeaningfulChild: boolean;
	}

	/**
	 * Token context - controls how tokens are interpreted in different syntactic contexts
	 */
	export interface TokContext {
		token: string;
		isExpr: boolean;
		preserveSpace?: boolean;
		override?: ((parser: Parser) => acorn.Token) | null;
	}

	/**
	 * Token type definition
	 */
	export interface TokenType {
		label: string;
		keyword: string | undefined;
		beforeExpr?: boolean;
		startsExpr?: boolean;
		isLoop?: boolean;
		isAssign?: boolean;
		prefix?: boolean;
		postfix?: boolean;
		binop?: number | null;
		updateContext?: ((prevType: TokenType) => void) | null;
	}

	/**
	 * Acorn's built-in token contexts
	 */
	export interface TokContexts {
		/** Block statement context - `{` in statement position */
		b_stat: TokContext & { token: '{' };
		/** Block expression context - `{` in expression position (object literals) */
		b_expr: TokContext & { token: '{' };
		/** Template literal context - `${` inside template */
		b_tmpl: TokContext & { token: '${' };
		/** Parenthesized statement context - `(` in statement position */
		p_stat: TokContext & { token: '(' };
		/** Parenthesized expression context - `(` in expression position */
		p_expr: TokContext & { token: '(' };
		/** Quasi/template context - `` ` `` backtick */
		q_tmpl: TokContext & { token: '`' };
		/** Function statement context - `function` keyword in statement */
		f_stat: TokContext & { token: 'function' };
		/** Function expression context - `function` keyword in expression */
		f_expr: TokContext & { token: 'function' };
		/** Generator function expression context - `function*` in expression */
		f_expr_gen: TokContext & { token: 'function' };
		/** Generator function context - `function*` in statement */
		f_gen: TokContext & { token: 'function' };
	}

	/**
	 * Acorn's built-in token types
	 */
	export interface TokTypes {
		// Literal tokens
		num: TokenType & { label: 'num' };
		regexp: TokenType & { label: 'regexp' };
		string: TokenType & { label: 'string' };
		name: TokenType & { label: 'name' };
		privateId: TokenType & { label: 'privateId' };
		eof: TokenType & { label: 'eof' };

		// Punctuation tokens
		bracketL: TokenType & { label: '[' };
		bracketR: TokenType & { label: ']' };
		braceL: TokenType & { label: '{' };
		braceR: TokenType & { label: '}' };
		parenL: TokenType & { label: '(' };
		parenR: TokenType & { label: ')' };
		comma: TokenType & { label: ',' };
		semi: TokenType & { label: ';' };
		colon: TokenType & { label: ':' };
		dot: TokenType & { label: '.' };
		question: TokenType & { label: '?' };
		questionDot: TokenType & { label: '?.' };
		arrow: TokenType & { label: '=>' };
		template: TokenType & { label: 'template' };
		invalidTemplate: TokenType & { label: 'invalidTemplate' };
		ellipsis: TokenType & { label: '...' };
		backQuote: TokenType & { label: '`' };
		dollarBraceL: TokenType & { label: '${' };

		// Operators
		eq: TokenType & { label: '='; isAssign: true };
		assign: TokenType & { label: '_='; isAssign: true };
		incDec: TokenType & { label: '++/--'; prefix: true; postfix: true };
		prefix: TokenType & { label: '!/~'; prefix: true };
		logicalOR: TokenType & { label: '||'; binop: 1 };
		logicalAND: TokenType & { label: '&&'; binop: 2 };
		bitwiseOR: TokenType & { label: '|'; binop: 3 };
		bitwiseXOR: TokenType & { label: '^'; binop: 4 };
		bitwiseAND: TokenType & { label: '&'; binop: 5 };
		equality: TokenType & { label: '==/!=/===/!=='; binop: 6 };
		relational: TokenType & { label: '</>/<=/>='; binop: 7 };
		bitShift: TokenType & { label: '<</>>/>>>'; binop: 8 };
		plusMin: TokenType & { label: '+/-'; binop: 9; prefix: true };
		modulo: TokenType & { label: '%'; binop: 10 };
		star: TokenType & { label: '*'; binop: 10 };
		slash: TokenType & { label: '/'; binop: 10 };
		starstar: TokenType & { label: '**' };
		coalesce: TokenType & { label: '??'; binop: 1 };

		// Keywords (label matches keyword name)
		_break: TokenType & { label: 'break'; keyword: 'break' };
		_case: TokenType & { label: 'case'; keyword: 'case' };
		_catch: TokenType & { label: 'catch'; keyword: 'catch' };
		_continue: TokenType & { label: 'continue'; keyword: 'continue' };
		_debugger: TokenType & { label: 'debugger'; keyword: 'debugger' };
		_default: TokenType & { label: 'default'; keyword: 'default' };
		_do: TokenType & { label: 'do'; keyword: 'do'; isLoop: true };
		_else: TokenType & { label: 'else'; keyword: 'else' };
		_finally: TokenType & { label: 'finally'; keyword: 'finally' };
		_for: TokenType & { label: 'for'; keyword: 'for'; isLoop: true };
		_function: TokenType & { label: 'function'; keyword: 'function' };
		_if: TokenType & { label: 'if'; keyword: 'if' };
		_return: TokenType & { label: 'return'; keyword: 'return' };
		_switch: TokenType & { label: 'switch'; keyword: 'switch' };
		_throw: TokenType & { label: 'throw'; keyword: 'throw' };
		_try: TokenType & { label: 'try'; keyword: 'try' };
		_var: TokenType & { label: 'var'; keyword: 'var' };
		_const: TokenType & { label: 'const'; keyword: 'const' };
		_while: TokenType & { label: 'while'; keyword: 'while'; isLoop: true };
		_with: TokenType & { label: 'with'; keyword: 'with' };
		_new: TokenType & { label: 'new'; keyword: 'new' };
		_this: TokenType & { label: 'this'; keyword: 'this' };
		_super: TokenType & { label: 'super'; keyword: 'super' };
		_class: TokenType & { label: 'class'; keyword: 'class' };
		_extends: TokenType & { label: 'extends'; keyword: 'extends' };
		_export: TokenType & { label: 'export'; keyword: 'export' };
		_import: TokenType & { label: 'import'; keyword: 'import' };
		_null: TokenType & { label: 'null'; keyword: 'null' };
		_true: TokenType & { label: 'true'; keyword: 'true' };
		_false: TokenType & { label: 'false'; keyword: 'false' };
		_in: TokenType & { label: 'in'; keyword: 'in'; binop: 7 };
		_instanceof: TokenType & { label: 'instanceof'; keyword: 'instanceof'; binop: 7 };
		_typeof: TokenType & { label: 'typeof'; keyword: 'typeof'; prefix: true };
		_void: TokenType & { label: 'void'; keyword: 'void'; prefix: true };
		_delete: TokenType & { label: 'delete'; keyword: 'delete'; prefix: true };
	}

	/**
	 * TypeScript-specific token types added by @sveltejs/acorn-typescript
	 */
	export interface AcornTypeScriptTokTypes {
		// JSX tokens
		jsxTagStart: TokenType & { label: 'jsxTagStart' };
		jsxTagEnd: TokenType & { label: 'jsxTagEnd' };
		jsxText: TokenType & { label: 'jsxText' };
		jsxName: TokenType & { label: 'jsxName' };

		// Decorator token
		at: TokenType & { label: '@' };

		// TypeScript keyword tokens
		abstract: TokenType & { label: 'abstract' };
		as: TokenType & { label: 'as' };
		asserts: TokenType & { label: 'asserts' };
		assert: TokenType & { label: 'assert' };
		bigint: TokenType & { label: 'bigint' };
		declare: TokenType & { label: 'declare' };
		enum: TokenType & { label: 'enum' };
		global: TokenType & { label: 'global' };
		implements: TokenType & { label: 'implements' };
		infer: TokenType & { label: 'infer' };
		interface: TokenType & { label: 'interface' };
		intrinsic: TokenType & { label: 'intrinsic' };
		is: TokenType & { label: 'is' };
		keyof: TokenType & { label: 'keyof' };
		module: TokenType & { label: 'module' };
		namespace: TokenType & { label: 'namespace' };
		never: TokenType & { label: 'never' };
		out: TokenType & { label: 'out' };
		override: TokenType & { label: 'override' };
		private: TokenType & { label: 'private' };
		protected: TokenType & { label: 'protected' };
		public: TokenType & { label: 'public' };
		readonly: TokenType & { label: 'readonly' };
		require: TokenType & { label: 'require' };
		satisfies: TokenType & { label: 'satisfies' };
		symbol: TokenType & { label: 'symbol' };
		type: TokenType & { label: 'type' };
		unique: TokenType & { label: 'unique' };
		unknown: TokenType & { label: 'unknown' };
	}

	/**
	 * TypeScript-specific token contexts added by @sveltejs/acorn-typescript
	 */
	export interface AcornTypeScriptTokContexts {
		/** JSX opening tag context - `<` starting a JSX tag */
		tc_oTag: TokContext & { token: '<' };
		/** JSX closing tag context - `</` closing a JSX tag */
		tc_cTag: TokContext & { token: '</' };
		/** JSX expression context - `{` inside JSX for expressions */
		tc_expr: TokContext & { token: '{' };
	}

	/**
	 * Combined TypeScript extensions object
	 */
	export interface AcornTypeScriptExtensions {
		tokTypes: AcornTypeScriptTokTypes;
		tokContexts: AcornTypeScriptTokContexts;
	}

	interface Scope {
		flags: number;
		var: string[];
		lexical: string[];
		functions: string[];
	}

	type Exports = Record<string, boolean>;

	/**
	 * Extended Parser instance with internal properties
	 *
	 * These properties are used internally by Acorn but not exposed in official types.
	 * They are accessed by Ripple's custom parser plugin for whitespace handling,
	 * JSX parsing, and other advanced features.
	 */
	export interface Parser {
		// ============================================================
		// Position and Location Tracking
		// ============================================================
		/** Start position of the current token (0-indexed) */
		start: number;
		/** End position of the current token (0-indexed) */
		end: number;
		/** Current parsing position in input string (0-indexed) */
		pos: number;
		/** Current line number (1-indexed) */
		curLine: number;
		/** Position where the current line starts (0-indexed) */
		lineStart: number;

		/** Start location of current token */
		startLoc: AST.Position;
		/** End location of current token */
		endLoc: AST.Position;
		/** End position of the last token */
		lastTokEnd: number;
		/** Start position of the last token */
		lastTokStart: number;
		/** End location of the last token */
		lastTokEndLoc: AST.Position;
		/** Start location of the last token */
		lastTokStartLoc: AST.Position;

		// ============================================================
		// Current Token State
		// ============================================================
		/** Current token type */
		type: TokenType;
		/** Current token value (string for names, number for nums, etc.) */
		value: string | number | RegExp | bigint | null;

		// ============================================================
		// Parser State
		// ============================================================
		/** The source code being parsed */
		input: string;
		/** Whether the current position expects an expression */
		exprAllowed: boolean;
		/** Whether the parser is in strict mode */
		strict: boolean;
		/** Whether we're inside a generator function */
		inGenerator: boolean;
		/** Whether we're inside an async function */
		inAsync: boolean;
		/** Whether we're inside a function */
		inFunction: boolean;
		/** Stack of label names for break/continue statements */
		labels: Array<{ kind: string | null; name?: string; statementStart?: number }>;
		/** Current scope flags stack */
		scopeStack: Array<{ flags: number; var: string[]; lexical: string[]; functions: string[] }>;
		/** Regular expression validation state */
		regexpState: RegExpValidationState | null;
		/** Whether we can use await keyword */
		canAwait: boolean;
		/** Position of await keyword (0 if not in async context) */
		awaitPos: number;
		/** Position of yield keyword (0 if not in generator context) */
		yieldPos: number;
		/** Position of await used as identifier (for error reporting) */
		awaitIdentPos: number;
		/** Whether current identifier contains escape sequences */
		containsEsc: boolean;
		/** Potential arrow function position */
		potentialArrowAt: number;
		/** Potential arrow in for-await position */
		potentialArrowInForAwait: boolean;
		/** Previous token type */
		preToken: TokenType | null;
		/** Previous token value */
		preValue: string | number | RegExp | bigint | null;
		/** Private name stack for class private fields validation */
		privateNameStack: Array<{ declared: Record<string, string>; used: Array<AST.Node> }>;
		/** Undefined exports for module validation */
		undefinedExports: Record<string, AST.Node>;

		// ============================================================
		// Context Stack
		// ============================================================
		/** Token context stack for tokenizer state */
		context: TokContext[];
		/** Whether to preserve spaces in current context */
		preserveSpace?: boolean;

		// ============================================================
		// Parser Configuration
		// ============================================================
		/** Parser options (from constructor) */
		options: Options;
		/** ECMAScript version being parsed */
		ecmaVersion: number;
		/** Keywords regex for current ecmaVersion */
		keywords: RegExp;
		/** Reserved words regex */
		reservedWords: RegExp;
		/** Whether we're parsing a module */
		inModule: boolean;

		// ============================================================
		// Token Methods
		// ============================================================
		/**
		 * Finish current token with given type and optional value
		 * @see https://github.com/acornjs/acorn/blob/main/acorn/src/tokenize.js
		 */
		finishToken(type: TokenType, val?: string | number | RegExp | bigint): void;

		readAtIdentifier(): void;

		/**
		 * Read a token based on character code
		 * Called by nextToken() for each character
		 */
		readToken(code: number): void;

		/**
		 * Read a word (identifier or keyword)
		 * @returns Token type (name or keyword)
		 */
		readWord(): TokenType;

		/**
		 * Read word starting from current position
		 * @returns The word string
		 */
		readWord1(): string;

		/** Read a number literal */
		readNumber(startsWithDot: boolean): void;

		/** Read a string literal */
		readString(quote: number): void;

		/** Read a template token */
		readTmplToken(): void;

		/** Read a regular expression literal */
		readRegexp(): void;

		/** Skip block comment, tracking line positions */
		skipBlockComment(): void;

		/** Skip line comment */
		skipLineComment(startSkip: number): void;

		/** Skip whitespace and comments */
		skipSpace(): void;

		/** Read and return the next token */
		nextToken(): void;

		/** Advance to next token (wrapper around nextToken) */
		next(): void;

		/**
		 * Get token from character code
		 * Main tokenizer dispatch based on first character
		 */
		getTokenFromCode(code: number): void;

		/**
		 * Get current position as Position object
		 * @returns { line: number, column: number, index: number }
		 */
		curPosition(): AST.Position;

		/**
		 * Finish building an operator token
		 * @param type Token type
		 * @param size Number of characters consumed
		 */
		finishOp(type: TokenType, size: number): TokenType;

		// ============================================================
		// Node Creation Methods
		// ============================================================
		/**
		 * Finish a node, setting its end position and type
		 * @template T Node type extending AST.Node
		 * @param node The node to finish
		 * @param type The node type string (e.g., "Identifier", "BinaryExpression")
		 * @returns The finished node
		 */
		finishNode<T extends AST.Node>(node: T, type: T['type']): T;

		/**
		 * Finish a node at a specific position
		 */
		finishNodeAt<T extends AST.Node>(node: T, type: T['type'], pos: number, loc: AST.Position): T;

		/**
		 * Start a new node at current position
		 */
		startNode(): AST.Node;

		/**
		 * Start a new node at a specific position
		 * @param pos Start position
		 * @param loc Start location
		 * @returns A new node with specified start position
		 */
		startNodeAt(pos: number, loc: AST.Position): AST.Node;

		/**
		 * Start a node at the same position as another node
		 * @param node The node to copy position from
		 * @returns A new node with copied start position
		 */
		startNodeAtNode(node: AST.Node): AST.Node;

		/**
		 * Copy a node's position info
		 * @template T Node type
		 * @param node The node to copy
		 * @returns A shallow copy of the node
		 */
		copyNode<T extends AST.Node>(node: T): T;

		/**
		 * Reset end location from another node
		 * @param node Node to update
		 */
		resetEndLocation(node: AST.Node): void;

		/**
		 * Reset start location from another node
		 * @param node Node to update
		 * @param locationNode Node to copy from
		 */
		resetStartLocationFromNode(node: AST.Node, locationNode: AST.Node): void;

		// ============================================================
		// Error Handling
		// ============================================================
		/**
		 * Raise a fatal error at given position
		 * @throws SyntaxError
		 */
		raise(pos: number, message: string): never;

		/**
		 * Raise a recoverable error (warning that doesn't stop parsing)
		 */
		raiseRecoverable(pos: number, message: string): void;

		/**
		 * Throw unexpected token error
		 * @param pos Optional position (defaults to current)
		 */
		unexpected(pos?: number): never;

		// ============================================================
		// Token Consumption Methods
		// ============================================================
		/**
		 * Expect a specific token type, raise error if not found
		 * @param type Expected token type
		 */
		expect(type: TokenType): void;

		/**
		 * Consume token if it matches, return true if consumed
		 * @param type Token type to eat
		 * @returns true if token was consumed
		 */
		eat(type: TokenType): boolean;

		/**
		 * Check if current token matches type (alias for this.type === type)
		 * @param type Token type to match
		 */
		match(type: TokenType): boolean;

		/**
		 * Peek at character at position
		 * @deprecated Use charCodeAt instead
		 */
		charAt(pos: number): string;

		/**
		 * Get character code at position in input
		 */
		charCodeAt(pos: number): number;

		/**
		 * Check if current token is a contextual keyword
		 * @param name Keyword to check (e.g., "async", "of")
		 */
		isContextual(name: string): boolean;

		/**
		 * Consume if current token is a contextual keyword
		 * @param name Keyword to consume
		 * @returns true if consumed
		 */
		eatContextual(name: string): boolean;

		/**
		 * Expect a contextual keyword, raise error if not found
		 * @param name Expected keyword
		 */
		expectContextual(name: string): void;

		/**
		 * Check if semicolon can be inserted at current position (ASI)
		 */
		canInsertSemicolon(): boolean;

		/**
		 * Insert a semicolon if allowed by ASI rules
		 * returns true if semicolon was inserted
		 */
		insertSemicolon(): boolean;

		/**
		 * Consume semicolon or insert via ASI
		 */
		semicolon(): void;

		/**
		 * Handle trailing comma in lists
		 */
		afterTrailingComma(type: TokenType, notNext?: boolean): boolean;

		// ============================================================
		// Scope Management
		// ============================================================
		/**
		 * Enter a new scope
		 * @param flags Scope flags (SCOPE_* constants)
		 */
		enterScope(flags: number): void;

		/** Exit current scope */
		exitScope(): void;

		/**
		 * Declare a name in current scope
		 */
		declareName(name: string, bindingType: BindingType[keyof BindingType], pos: number): void;

		/** Get current scope */
		currentScope(): Scope;

		/** Get current variable scope (for var declarations) */
		currentVarScope(): Scope;

		/** Get current "this" scope */
		currentThisScope(): Scope;

		/** Check if treating functions as var in current scope */
		treatFunctionsAsVarInScope(scope: Scope): boolean;

		// ============================================================
		// Context Management
		// ============================================================
		/**
		 * Get current token context
		 * @returns Current context from stack
		 */
		curContext(): TokContext;

		/**
		 * Update token context based on previous token
		 * @param prevType Previous token type
		 */
		updateContext(prevType: TokenType): void;

		/**
		 * Override the current context
		 * @param context New context to push
		 */
		overrideContext(context: TokContext): void;

		// ============================================================
		// Lookahead
		// ============================================================
		/**
		 * Look ahead one token without consuming
		 * @returns Object with type and value of next token
		 */
		lookahead(): { type: TokenType; value: any };

		/**
		 * Get next token start position
		 */
		nextTokenStart(): number;

		/**
		 * Get next token start since given position
		 */
		nextTokenStartSince(pos: number): number;

		/**
		 * Look ahead at character code
		 */
		lookaheadCharCode(): number;

		// ============================================================
		// Expression Parsing
		// ============================================================
		/**
		 * Parse an expression
		 */
		parseExpression(
			forInit?: ForInit,
			refDestructuringErrors?: DestructuringErrors,
		): AST.Expression;

		/**
		 * Parse maybe-assignment expression (handles = and op=)
		 */
		parseMaybeAssign(
			forInit?: ForInit,
			refDestructuringErrors?: DestructuringErrors,
			afterLeftParse?: (node: AST.Node, startPos: number, startLoc: AST.Position) => AST.Node,
		): AST.Expression;

		/**
		 * Parse maybe-conditional expression (?:)
		 */
		parseMaybeConditional(
			forInit?: ForInit,
			refDestructuringErrors?: DestructuringErrors,
		): AST.Expression;

		/**
		 * Parse expression with operators (handles precedence)
		 */
		parseExprOps(forInit?: ForInit, refDestructuringErrors?: DestructuringErrors): AST.Expression;

		/**
		 * Parse expression with operator at given precedence
		 */
		parseExprOp(
			left: AST.Expression,
			leftStartPos: number,
			leftStartLoc: AST.Position,
			minPrec: number,
			forInit?: ForInit,
		): AST.Expression;

		/**
		 * Parse maybe-unary expression (prefix operators)
		 */
		parseMaybeUnary(
			refDestructuringErrors?: DestructuringErrors | null,
			sawUnary?: boolean,
			incDec?: boolean,
			forInit?: ForInit,
		): AST.Expression;

		/**
		 * Parse expression subscripts (member access, calls)
		 */
		parseExprSubscripts(
			refDestructuringErrors?: DestructuringErrors,
			forInit?: ForInit,
		): AST.Expression;

		/**
		 * Parse subscripts (., [], (), ?.)
		 */
		parseSubscripts(
			base: AST.Expression,
			startPos: number,
			startLoc: AST.Position,
			noCalls?: boolean,
			maybeAsyncArrow?: boolean,
			optionalChained?: boolean,
			forInit?: ForInit,
		): AST.Expression;

		parseSubscript(
			base: AST.Expression,
			startPos: number,
			startLoc: AST.Position,
			noCalls?: boolean,
			maybeAsyncArrow?: boolean,
			optionalChained?: boolean,
			forInit?: ForInit,
		): AST.Expression;

		/**
		 * Parse expression atom (literals, identifiers, etc.)
		 */
		parseExprAtom(
			refDestructuringErrors?: DestructuringErrors,
			forInit?: ForInit,
			forNew?: boolean,
		):
			| AST.ServerIdentifier
			| AST.StyleIdentifier
			| AST.TrackedExpression
			| AST.TrackedMapExpression
			| AST.TrackedSetExpression
			| AST.TrackedArrayExpression
			| AST.TrackedObjectExpression
			| AST.Component
			| AST.Identifier;

		/** Default handler for parseExprAtom when no other case matches */
		parseExprAtomDefault(): AST.Expression;

		/**
		 * Parse a literal value (string, number, boolean, null, regex)
		 * @param value The literal value
		 * @returns Literal node
		 */
		parseLiteral(value: string | number | boolean | null | RegExp | bigint): AST.Literal;

		/**
		 * Parse parenthesized expression, distinguishing arrow functions
		 */
		parseParenAndDistinguishExpression(canBeArrow?: boolean, forInit?: ForInit): AST.Expression;

		/** Parse parenthesized expression (just the expression) */
		parseParenExpression(): AST.Expression;

		parseTrackedCollectionExpression(
			type: 'TrackedMapExpression' | 'TrackedSetExpression',
		): AST.TrackedMapExpression | AST.TrackedSetExpression;

		parseTrackedArrayExpression(): AST.TrackedArrayExpression;

		parseTrackedExpression(): AST.TrackedExpression;

		parseTrackedObjectExpression(): AST.TrackedObjectExpression;

		/**
		 * Parse item in parentheses (can be overridden for flow/ts)
		 */
		parseParenItem(item: AST.Node): AST.Node;

		/**
		 * Parse arrow expression

		 */
		parseArrowExpression(
			node: AST.Node,
			params: AST.Node[],
			isAsync?: boolean,
			forInit?: ForInit,
		): AST.ArrowFunctionExpression;

		/**
		 * Check if arrow should be parsed
		 */
		shouldParseArrow(exprList: AST.Node[]): boolean;

		/**
		 * Parse spread element (...expr)
		 */
		parseSpread(refDestructuringErrors?: DestructuringErrors): AST.SpreadElement;

		/**
		 * Parse rest binding pattern (...pattern)
		 * @returns RestElement node
		 */
		parseRestBinding(): AST.RestElement;

		/**
		 * Parse 'new' expression
		 * @returns NewExpression or MetaProperty (new.target)
		 */
		parseNew(): AST.NewExpression | AST.MetaProperty;

		/**
		 * Parse dynamic import expression
		 * @param forNew Whether in new expression context
		 */
		parseExprImport(forNew?: boolean): AST.ImportExpression | AST.MetaProperty;

		/**
		 * Parse dynamic import call
		 * @param node Import expression node
		 */
		parseDynamicImport(node: AST.Node): AST.ImportExpression;

		/**
		 * Parse import.meta
		 * @param node MetaProperty node
		 */
		parseImportMeta(node: AST.Node): AST.MetaProperty;

		/** Parse yield expression */
		parseYield(forInit?: ForInit): AST.YieldExpression;

		/** Parse await expression */
		parseAwait(forInit?: ForInit): AST.AwaitExpression;

		/**
		 * Parse template literal
		 * @param isTagged Whether this is a tagged template
		 */
		parseTemplate(isTagged?: { start: number }): AST.TemplateLiteral;

		/**
		 * Parse template element
		 * @param options { isTagged: boolean }
		 */
		parseTemplateElement(options: { isTagged: boolean }): AST.TemplateElement;

		// ============================================================
		// Identifier Parsing
		// ============================================================
		/**
		 * Parse an identifier
		 */
		parseIdent(liberal?: boolean): AST.Identifier;

		/**
		 * Parse identifier node (internal, doesn't consume token)
		 * @returns Partial identifier node
		 */
		parseIdentNode(): AST.Node;

		/**
		 * Parse private identifier (#name)
		 * @returns PrivateIdentifier node
		 */
		parsePrivateIdent(): AST.PrivateIdentifier;

		/**
		 * Check if identifier is unreserved
		 * @param ref Node with name, start, end
		 */
		checkUnreserved(ref: { name: string; start: number; end: number }): void;

		// ============================================================
		// Object/Array Parsing
		// ============================================================
		/**
		 * Parse object expression or pattern
		 * @param isPattern Whether parsing a pattern
		 * @param refDestructuringErrors Error collector
		 * @returns ObjectExpression or ObjectPattern
		 */
		parseObj(
			isPattern?: boolean,
			refDestructuringErrors?: DestructuringErrors,
		): AST.ObjectExpression | AST.ObjectPattern;

		/**
		 * Parse property in object literal
		 * @param isPattern Whether parsing a pattern
		 * @param refDestructuringErrors Error collector
		 * @returns Property node
		 */
		parseProperty(
			isPattern: boolean,
			refDestructuringErrors?: DestructuringErrors,
		): AST.Property | AST.SpreadElement;

		/**
		 * Parse property name (identifier, string, number, computed)
		 * @param prop Property node to update
		 * @returns The key expression
		 */
		parsePropertyName(prop: AST.Node): AST.Expression | AST.PrivateIdentifier;

		/**
		 * Parse property value
		 * @param prop Property node
		 * @param isPattern Whether parsing pattern
		 * @param isGenerator Whether generator method
		 * @param isAsync Whether async method
		 * @param startPos Start position
		 * @param startLoc Start location
		 * @param refDestructuringErrors Error collector
		 * @param containsEsc Whether key contains escapes
		 */
		parsePropertyValue(
			prop: AST.Node,
			isPattern: boolean,
			isGenerator: boolean,
			isAsync: boolean,
			startPos: number,
			startLoc: AST.Position,
			refDestructuringErrors?: DestructuringErrors,
			containsEsc?: boolean,
		): void;

		/**
		 * Get property kind from name
		 * @param prop Property node
		 * @returns "init", "get", or "set"
		 */
		getPropertyKind(prop: AST.Node): 'init' | 'get' | 'set';

		/**
		 * Parse expression list (array elements, call arguments)
		 * @param close Closing token type
		 * @param allowTrailingComma Whether trailing comma allowed
		 * @param allowEmpty Whether empty slots allowed
		 * @param refDestructuringErrors Error collector
		 * @returns Array of expressions
		 */
		parseExprList(
			close: TokenType,
			allowTrailingComma?: boolean,
			allowEmpty?: boolean,
			refDestructuringErrors?: DestructuringErrors,
		): (AST.Expression | null)[];

		/**
		 * Parse binding list (pattern elements)
		 * @param close Closing token type
		 * @param allowEmpty Whether empty slots allowed
		 * @param allowTrailingComma Whether trailing comma allowed
		 * @param allowModifiers Whether modifiers allowed (TS)
		 */
		parseBindingList(
			close: TokenType,
			allowEmpty?: boolean,
			allowTrailingComma?: boolean,
			allowModifiers?: boolean,
		): AST.Pattern[];

		/**
		 * Parse binding atom (identifier or pattern)
		 * @returns Pattern node
		 */
		parseBindingAtom(): AST.Pattern;

		// ============================================================
		// Statement Parsing
		// ============================================================
		/**
		 * Parse top level program
		 * @param node Program node to populate
		 * @returns Completed Program node
		 */
		parseTopLevel(node: AST.Program): AST.Program;

		parseServerBlock(): AST.ServerBlock;

		parseElement(): AST.Element | AST.TsxCompat;

		parseTemplateBody(
			body: (AST.Statement | AST.Node | ESTreeJSX.JSXText | ESTreeJSX.JSXElement['children'])[],
		): void;

		parseComponent(
			params?:
				| {
						requireName?: boolean;
						isDefault?: boolean;
						declareName?: boolean;
				  }
				| undefined,
		): AST.Component;

		/**
		 * Parse a statement
		 * @param context Statement context ("for", "if", "label", etc.)
		 * @param topLevel Whether at top level
		 * @param exports Export set for module
		 * @returns Statement node
		 */
		parseStatement(
			context?: string | null,
			topLevel?: boolean,
			exports?: AST.ExportSpecifier,
		):
			| AST.TextNode
			| ESTreeJSX.JSXEmptyExpression
			| ESTreeJSX.JSXExpressionContainer
			| AST.ServerBlock
			| AST.Component
			| AST.ExpressionStatement
			| ReturnType<Parser['parseElement']>
			| AST.Statement;

		parseBlock(
			createNewLexicalScope?: boolean,
			node?: AST.BlockStatement,
			exitStrict?: boolean,
		): AST.BlockStatement;

		/** Parse empty statement (;) */
		parseEmptyStatement(node: AST.Node): AST.EmptyStatement;

		/** Parse expression statement */
		parseExpressionStatement(node: AST.Node, expr: AST.Expression): AST.ExpressionStatement;

		/** Parse labeled statement */
		parseLabeledStatement(
			node: AST.Node,
			maybeName: string,
			expr: AST.Expression,
			context?: string,
		): AST.LabeledStatement;

		/** Parse if statement */
		parseIfStatement(node: AST.Node): AST.IfStatement;

		/** Parse switch statement */
		parseSwitchStatement(node: AST.Node): AST.SwitchStatement;

		/** Parse while statement */
		parseWhileStatement(node: AST.Node): AST.WhileStatement;

		/** Parse do-while statement */
		parseDoStatement(node: AST.Node): AST.DoWhileStatement;

		/** Parse for statement (all variants) */
		parseForStatement(
			node: AST.ForStatement | AST.ForInStatement | AST.ForOfStatement,
		): AST.ForStatement | AST.ForInStatement | AST.ForOfStatement;

		parseForAfterInitWithIndex(
			node: AST.ForStatement | AST.ForInStatement | AST.ForOfStatement,
			init: AST.VariableDeclaration,
			awaitAt: number,
		): AST.ForStatement | AST.ForInStatement | AST.ForOfStatement;

		parseForInWithIndex(
			node: AST.ForInStatement | AST.ForOfStatement,
			init: AST.VariableDeclaration | AST.Pattern,
		): AST.ForInStatement | AST.ForOfStatement;

		/**
		 * Parse regular for loop
		 * @param node For statement node
		 * @param init Initializer expression
		 */
		parseFor(node: AST.Node, init: AST.Node | null): AST.ForStatement;

		/**
		 * Parse for-in loop
		 * @param node For statement node
		 * @param init Left-hand binding
		 */
		parseForIn(node: AST.Node, init: AST.Node): AST.ForInStatement;

		/** Parse break statement */
		parseBreakContinueStatement(
			node: AST.Node,
			keyword: string,
		): AST.BreakStatement | AST.ContinueStatement;

		/** Parse return statement */
		parseReturnStatement(node: AST.Node): AST.ReturnStatement;

		/** Parse throw statement */
		parseThrowStatement(node: AST.Node): AST.ThrowStatement;

		/** Parse try statement */
		parseTryStatement(node: AST.TryStatement): AST.TryStatement;

		/**
		 * Parse catch clause parameter
		 * @returns Pattern node for catch param
		 */
		parseCatchClauseParam(): AST.Pattern;

		/** Parse with statement */
		parseWithStatement(node: AST.Node): AST.WithStatement;

		/** Parse debugger statement */
		parseDebuggerStatement(node: AST.Node): AST.DebuggerStatement;

		// ============================================================
		// Variable Declaration Parsing
		// ============================================================
		/** Parse variable statement (var, let, const) */
		parseVarStatement(node: AST.Node, kind: string): AST.VariableDeclaration;

		/**
		 * Parse variable declarations
		 * @param node Declaration node
		 * @param isFor Whether in for-loop initializer
		 * @param kind "var", "let", "const", "using", or "await using"
		 * @returns VariableDeclaration node
		 */
		parseVar(node: AST.Node, isFor: boolean, kind: string): AST.VariableDeclaration;

		/**
		 * Parse variable ID (identifier or pattern)
		 * @param decl Declarator node
		 * @param kind Variable kind
		 */
		parseVarId(decl: AST.Node, kind: string): void;

		/** Check if current token starts 'let' declaration */
		isLet(context?: string): boolean;

		/** Check if current token starts 'using' declaration */
		isUsing?(isFor?: boolean): boolean;

		/** Check if current token starts 'await using' declaration */
		isAwaitUsing?(isFor?: boolean): boolean;

		// ============================================================
		// Function Parsing
		// ============================================================
		/**
		 * Parse function declaration or expression
		 */
		parseFunction(
			node: AST.Node,
			statement: number,
			allowExpressionBody?: boolean,
			isAsync?: boolean,
			forInit?: ForInit,
		): AST.FunctionDeclaration | AST.FunctionExpression;

		/** Parse function statement */
		parseFunctionStatement(
			node: AST.Node,
			isAsync?: boolean,
			declarationPosition?: boolean,
		): AST.FunctionDeclaration;

		/**
		 * Parse function parameters into node.params
		 * @param node Function node to populate
		 */
		parseFunctionParams(node: AST.Node): void;

		/**
		 * Parse function body
		 */
		parseFunctionBody(
			node: AST.Node,
			isArrowFunction: boolean,
			isMethod: boolean,
			forInit?: ForInit,
		): void;

		/** Initialize function node properties */
		initFunction(node: AST.Node): void;

		/** Check for yield/await in default parameters */
		checkYieldAwaitInDefaultParams(): void;

		/** Check if async function */
		isAsyncFunction(): boolean;

		// ============================================================
		// Class Parsing
		// ============================================================
		/**
		 * Parse class declaration or expression
		 * @param node Class node
		 * @param isStatement true, "nullableID", or false
		 */
		parseClass(
			node: AST.Node,
			isStatement: boolean | 'nullableID',
		): AST.ClassDeclaration | AST.ClassExpression;

		/** Parse class ID (name) */
		parseClassId(node: AST.Node, isStatement: boolean | 'nullableID'): void;

		/** Parse class superclass */
		parseClassSuper(node: AST.Node): void;

		/** Enter class body scope */
		enterClassBody(): Record<string, string>;

		/** Exit class body scope */
		exitClassBody(): void;

		/**
		 * Parse class element (method, field, static block)
		 * @param constructorAllowsSuper Whether constructor can call super
		 */
		parseClassElement(
			constructorAllowsSuper: boolean,
		): AST.MethodDefinition | AST.PropertyDefinition | AST.StaticBlock | null;

		/** Parse class element name */
		parseClassElementName(element: AST.Node): void;

		/** Parse class static block */
		parseClassStaticBlock(node: AST.Node): AST.StaticBlock;

		/** Parse class method */
		parseClassMethod(
			method: AST.Node,
			isGenerator: boolean,
			isAsync: boolean,
			allowDirectSuper: boolean,
		): AST.MethodDefinition;

		/** Parse class field */
		parseClassField(field: AST.Node): AST.PropertyDefinition;

		/** Check if class element name start */
		isClassElementNameStart(): boolean;

		/**
		 * Parse method definition
		 * @param isGenerator Whether generator method
		 * @param isAsync Whether async method
		 * @param allowDirectSuper Whether super() allowed
		 */
		parseMethod(
			isGenerator: boolean,
			isAsync?: boolean,
			allowDirectSuper?: boolean,
		): AST.FunctionExpression;

		// ============================================================
		// Module Parsing (Import/Export)
		// ============================================================
		/** Parse import declaration */
		parseImport(node: AST.Node): AST.ImportDeclaration;

		/** Parse import specifiers */
		parseImportSpecifiers(): AST.ImportSpecifier[];

		/** Parse single import specifier */
		parseImportSpecifier(): AST.ImportSpecifier;

		/** Parse module export name (identifier or string) */
		parseModuleExportName(): AST.Identifier | AST.Literal;

		/** Parse export declaration */
		parseExport(
			node: AST.Node,
			exports?: Exports,
		): AST.ExportNamedDeclaration | AST.ExportDefaultDeclaration | AST.ExportAllDeclaration;

		/** Parse export specifiers */
		parseExportSpecifiers(exports?: Exports): AST.ExportSpecifier[];

		/** Parse export default declaration */
		parseExportDefaultDeclaration(): AST.Declaration | AST.Expression | AST.Component;

		/** Check if export statement should be parsed */
		shouldParseExportStatement(): boolean;

		/** Parse export declaration body */
		parseExportDeclaration(node: AST.Node): AST.Declaration;

		// ============================================================
		// LValue and Pattern Checking
		// ============================================================
		/**
		 * Convert expression to assignable pattern
		 * @param node Expression to convert
		 * @param isBinding Whether binding pattern
		 * @param refDestructuringErrors Error collector
		 */
		toAssignable(
			node: AST.Node,
			isBinding?: boolean,
			refDestructuringErrors?: DestructuringErrors,
		): AST.Pattern;

		/**
		 * Convert expression list to assignable list
		 * @param exprList Expression list
		 * @param isBinding Whether binding patterns
		 */
		toAssignableList(exprList: AST.Node[], isBinding: boolean): AST.Pattern[];

		/**
		 * Parse maybe-default pattern (pattern = defaultValue)
		 * @param startPos Start position
		 * @param startLoc Start location
		 * @param left Left-hand pattern
		 */
		parseMaybeDefault(startPos: number, startLoc: AST.Position, left?: AST.Node): AST.Pattern;

		/**
		 * Check left-value pattern (for destructuring)
		 */
		checkLValPattern(
			node: AST.Node,
			bindingType?: BindingType[keyof BindingType],
			checkClashes?: Record<string, boolean>,
		): void;

		/**
		 * Check left-value simple (identifier or member expression)
		 */
		checkLValSimple(
			expr: AST.Node,
			bindingType?: BindingType[keyof BindingType],
			checkClashes?: Record<string, boolean>,
		): void;

		/**
		 * Check left-value inner pattern
		 * @param node Pattern node
		 * @param bindingType Binding type constant
		 * @param checkClashes Clash detection object
		 */
		checkLValInnerPattern(
			node: AST.Node,
			bindingType?: BindingType[keyof BindingType],
			checkClashes?: Record<string, boolean>,
		): void;

		/**
		 * Check expression errors
		 * @param refDestructuringErrors Error collector
		 * @param andThrow Whether to throw on error
		 * @returns Whether there were errors
		 */
		checkExpressionErrors(
			refDestructuringErrors: DestructuringErrors | null,
			andThrow?: boolean,
		): boolean;

		/**
		 * Check if expression is simple assign target
		 * @param expr Expression to check
		 */
		isSimpleAssignTarget(expr: AST.Node): boolean;

		// ============================================================
		// JSX Methods (from @sveltejs/acorn-typescript)
		// ============================================================
		/**
		 * Read JSX contents token
		 */
		jsx_readToken(): void;

		/**
		 * Read JSX word (element/attribute name)
		 */
		jsx_readWord(): void;

		/**
		 * Read JSX string
		 * @param quote Quote character code
		 */
		jsx_readString(quote: number): void;

		/**
		 * Read JSX entity (e.g., &amp; &lt;)
		 * @returns Decoded entity string
		 */
		jsx_readEntity(): string;

		/**
		 * Read JSX new line (handles CRLF normalization)
		 * @param normalizeCRLF Whether to normalize CRLF to LF
		 * @returns Newline string
		 */
		jsx_readNewLine(normalizeCRLF?: boolean): string;

		/**
		 * Parse JSX identifier
		 * @returns JSXIdentifier node
		 */
		jsx_parseIdentifier(): ESTreeJSX.JSXIdentifier;

		/**
		 * Parse JSX namespaced name (ns:name)
		 */
		jsx_parseNamespacedName():
			| ESTreeJSX.JSXNamespacedName
			| ReturnType<Parser['jsx_parseIdentifier']>;

		/**
		 * Parse JSX element name (identifier, member, namespaced)
		 */
		jsx_parseElementName():
			| ESTreeJSX.JSXMemberExpression
			| ReturnType<Parser['jsx_parseNamespacedName']>
			| '';

		/**
		 * Parse JSX attribute value
		 * @returns Attribute value (expression, string, or element)
		 */
		jsx_parseAttributeValue():
			| ESTreeJSX.JSXExpressionContainer
			| ReturnType<Parser['parseExprAtom']>;

		/**
		 * Parse JSX empty expression (for {})
		 */
		jsx_parseEmptyExpression(): ESTreeJSX.JSXEmptyExpression;

		jsx_parseTupleContainer(): ESTreeJSX.JSXExpressionContainer;

		/**
		 * Parse JSX expression container ({...})
		 * @returns JSXExpressionContainer node
		 */
		jsx_parseExpressionContainer(): AST.Node;

		/**
		 * Parse JSX attribute (name="value" or {spread})
		 * @returns JSXAttribute or JSXSpreadAttribute
		 */
		jsx_parseAttribute(): AST.RippleAttribute | ESTreeJSX.JSXAttribute;

		/**
		 * Parse JSX opening element at position
		 * @param startPos Start position
		 * @param startLoc Start location
		 * @returns JSXOpeningElement or JSXOpeningFragment
		 */
		jsx_parseOpeningElementAt(
			startPos?: number,
			startLoc?: AST.Position,
		): ESTreeJSX.JSXOpeningElement;
		// it could also be ESTreeJSX.JSXOpeningFragment
		// but not in our case since we don't use fragments

		/**
		 * Parse JSX closing element at position
		 * @param startPos Start position
		 * @param startLoc Start location
		 * @returns JSXClosingElement or JSXClosingFragment
		 */
		jsx_parseClosingElementAt(startPos: number, startLoc: AST.Position): AST.Node;

		/**
		 * Parse JSX element at position
		 * @param startPos Start position
		 * @param startLoc Start location
		 * @returns JSXElement or JSXFragment
		 */
		jsx_parseElementAt(startPos: number, startLoc: AST.Position): AST.Node;

		/**
		 * Parse JSX text node
		 * @returns JSXText node
		 */
		jsx_parseText(): AST.Node;

		/**
		 * Parse complete JSX element
		 * @returns JSXElement or JSXFragment
		 */
		jsx_parseElement(): AST.Node;

		// ============================================================
		// Try-Parse for Recovery
		// ============================================================
		/**
		 * Try to parse, returning result with error info if failed
		 * @param fn Parsing function to try
		 * @returns Result with node, error, thrown, aborted, failState
		 */
		tryParse<T>(fn: () => T): {
			node: T | null;
			error: Error | null;
			thrown: boolean;
			aborted: boolean;
			failState: any;
		};
		parse(input: string, options: Options): AST.Program;

		getElementName(node?: AST.Node): string | null;
	}

	/**
	 * The constructor/class type for the extended Ripple parser.
	 * This represents the static side of the parser class after extending with plugins.
	 */
	export interface ParserConstructor {
		new (options: Options, input: string): Parser;
		/** Built-in token types */
		tokTypes: TokTypes;
		/** Built-in token contexts */
		tokContexts: TokContexts;
		/** TypeScript extensions when using acorn-typescript */
		acornTypeScript: AcornTypeScriptExtensions;
		/** Static parse method that returns Ripple's extended Program type */
		parse(input: string, options: Options): AST.Program;
		/** Static parseExpressionAt method */
		parseExpressionAt(input: string, pos: number, options: Options): AST.Expression;
		/** Extend with plugins */
		extend(...plugins: ((BaseParser: ParserConstructor) => ParserConstructor)[]): ParserConstructor;
	}
}
