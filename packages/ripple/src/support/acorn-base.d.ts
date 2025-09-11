import type { Parser, Node, TokenType, SourceLocation, AnyNode, Expression, Token, Position } from 'acorn';

type AcornNodes = AnyNode;

type AcornNodesMap = {
    [K in AcornNodes['type']]: Extract<AcornNodes, { type: K }>;
};

// see https://github.com/acornjs/acorn/blob/8.15.0/acorn/src/tokencontext.js
export declare class TokContext {
    token: string;
    isExpr: boolean;
    preserveSpace: boolean;
    override: (parser: BaseParser) => string;
    generator: boolean;

    constructor(token: string, isExpr: boolean, preserveSpace?: boolean, override?: (parser: BaseParser) => string, generator?: boolean);
}

type AcornTokenTypeNames = |
    'num' | 'regexp' | 'string' | 'name' |
    'privateId' | 'eof' | 'bracketL' | 'bracketR' |
    'braceL' | 'braceR' | 'parenL' | 'parenR' |
    'comma' | 'semi' | 'colon' | 'dot' |
    'question' | 'questionDot' | 'arrow' | 'template' |
    'invalidTemplate' | 'ellipsis' | 'backQuote' | 'dollarBraceL' |
    'eq' | 'assign' | 'incDec' | 'prefix' |
    'logicalOR' | 'logicalAND' | 'bitwiseOR' | 'bitwiseXOR' |
    'bitwiseAND' | 'equality' | 'relational' | 'bitShift' |
    'plusMin' | 'modulo' | 'star' | 'slash' |
    'starstar' | 'coalesce';

type AcornKeywords = |
    '_break' | '_case' | '_catch' | '_continue' |
    '_debugger' | '_default' | '_do' | '_else' |
    '_finally' | '_for' | '_function' | '_if' |
    '_return' | '_switch' | '_throw' | '_try' |
    '_var' | '_const' | '_while' | '_with' |
    '_new' | '_this' | '_super' | '_class' |
    '_extends' | '_export' | '_import' | '_null' |
    '_true' | '_false' | '_in' | '_instanceof' |
    '_typeof' | '_void' | '_delete';

type AcornTokenTypes = Record<AcornTokenTypeNames | AcornKeywords, TokenType>;

type AcornContextNames = |
    'b_stat' | 'b_expr' | 'b_tmpl' | 'p_stat' |
    'p_expr' | 'q_tmpl' | 'f_stat' | 'f_expr' |
    'f_expr_gen' | 'f_gen';

type AcornContexts = Record<AcornContextNames, TokContext>;

// see https://github.com/acornjs/acorn/blob/8.15.0/acorn/src/scope.js
export declare class Scope {
    flags: number;
    var: unknown[];
    lexical: unknown[];
    functions: unknown[];

    constructor(flags: number);
}

/**
 * Why does this exist? Because of how acorn is written, their type definitions suck.
 * This class is just a way to get around that.
 * 
 * It's not complete, just enough to make the types work.
 */
export declare class BaseParser extends Parser {
    // I use 'public' - can you tell I started out with Java yet?
    //  - Redstone

    public start: number;
    public end: number;
    public pos: number;
    public input: string;

    public context: TokContext[];
    public scopeStack: Scope[];

    public static tokTypes?: AcornTokenTypes;
    public static tokContexts?: AcornContexts;

    public startNode(): Node;
    public startNodeAt(pos: number, loc: SourceLocation): Node;

    public finishNode<K extends keyof AcornNodesMap>(node: AcornNodesMap[K] | AnyNode, type: K): AcornNodesMap[K];
    public finishNodeAt<K extends keyof AcornNodesMap>(node: AcornNodesMap[K] | AnyNode, type: K, pos: number, loc: SourceLocation): AcornNodesMap[K];

    public copyNode(node: Node): Node;

    public enterScope(flags: number): void;
    public exitScope(): void;

    public parseIdent(liberal?: boolean): AcornNodesMap['Identifier'];
    public parseFunctionParams(node: Node): void;
    public parseExportDefaultDeclaration(): Node;
    public parseExpression(forInit?: boolean, refDestructuringErrors?: boolean): Expression;
    public parseMaybeAssign(forInit?: boolean, refDestructuringErrors?: boolean, afterLeftParse?: (this: BaseParser, left: Node, startPos: number, startLoc: SourceLocation) => Node): Node;
    public parseIdentNode(): AcornNodesMap['Identifier'];

    public shouldParseExportStatement(): boolean;

    public eat(type: TokenType): boolean;
    public expect(type: TokenType): void;
    public next(ignoreEscapeSequenceInKeyword?: boolean): void;
    public unexpected(pos?: unknown): void;
    public lookahead(): Token & { value?: string }; // I can't even find this one in the acorn repo :(
    public raise(pos: number, message: string): never;
    public raiseRecoverable(pos: number, message: string): void;
    public curPosition(): Position;
    public curContext(): TokContext;

    public readToken(code: number): Token;
}

declare module 'acorn' {
    const tokContexts: AcornContexts;
}
