import type { Parser, Node, TokenType, SourceLocation, AnyNode, Expression } from 'acorn';
import type { tsPlugin } from 'acorn-typescript';

type AcornNodes = AnyNode;

type AcornNodesMap = {
    [K in AcornNodes['type']]: Extract<AcornNodes, { type: K }>;
};

// see https://github.com/acornjs/acorn/blob/8.15.0/acorn/src/tokencontext.js
export declare class TokContext {
    token: string;
    isExpr: boolean;
    preserveSpace: boolean;
    override: (parser: BetterParser) => string;
    generator: boolean;

    constructor(token: string, isExpr: boolean, preserveSpace?: boolean, override?: (parser: BetterParser) => string, generator?: boolean);
}

// see https://github.com/TyrealHu/acorn-typescript/blob/master/src/tokenType.ts
type AcornTSKeywords = |
    'assert' | 'asserts' | 'global' | 'keyof' |
    'readonly' | 'unique' | 'abstract' | 'declare' |
    'enum' | 'module' | 'namespace' | 'interface' |
    'type';

type AcornTSTokenTypeNames = |
    'at' | 'jsxName' | 'jsxText' | 'jsxTagStart' |
    'jsxTagEnd';

type AcornTSTokenContextNames = 'tc_oTag' | 'tc_cTag' | 'tc_expr';

type AcornTSTokenTypes = Record<AcornTSKeywords | AcornTSTokenTypeNames, TokenType>;
type AcornTSTokenContexts = Record<AcornTSTokenContextNames, TokContext>;

type AcornTS = ReturnType<ReturnType<typeof tsPlugin>> & {
    tokTypes: AcornTSTokenTypes;
    tokContexts: AcornTSTokenContexts;
    keywordsRegExp: RegExp;
    tokenIsLiteralPropertyName(token: TokenType): boolean
    tokenIsKeywordOrIdentifier(token: TokenType): boolean
    tokenIsIdentifier(token: TokenType): boolean
    tokenIsTSDeclarationStart(token: TokenType): boolean
    tokenIsTSTypeOperator(token: TokenType): boolean
    tokenIsTemplate(token: TokenType): boolean;
};

/**
 * Why does this exist? Because of how acorn is written, their type definitions suck.
 * This class is just a way to get around that.
 * 
 * It's not complete, just enough to make the types work.
 */
export declare class BetterParser extends Parser {
    acornTypeScript: AcornTS;

    public startNode(): Node;
    public startNodeAt(pos: unknown, loc: unknown): Node;

    public finishNode<K extends keyof AcornNodesMap>(node: Node, type: K): AcornNodesMap[K];
    public finishNodeAt<K extends keyof AcornNodesMap>(node: Node, type: K, pos: unknown, loc: unknown): AcornNodesMap[K];

    public copyNode(node: Node): Node;

    public enterScope(flags: number): void;
    public exitScope(): void;

    public parseIdent(liberal?: boolean): AcornNodesMap['Identifier'];
    public parseFunctionParams(node: Node): void;
    public parseExportDefaultDeclaration(): AcornNodesMap['ExportDefaultDeclaration'];
    public parseExpression(forInit?: boolean, refDestructuringErrors?: boolean): Expression;
    public parseMaybeAssign(forInit?: boolean, refDestructuringErrors?: boolean, afterLeftParse?: (this: BetterParser, left: Node, startPos: unknown, startLoc: unknown) => Node): Node;
    public parseIdentNode(): AcornNodesMap['Identifier'];

    public shouldParseExportStatement(): boolean;

    public eat(type: TokenType): boolean;
    public expect(type: TokenType): void;
    public next(ignoreEscapeSequenceInKeyword?: boolean): void;
    public unexpected(pos?: unknown): void;

    // See https://github.com/acornjs/acorn-jsx/blob/main/index.d.ts#L44
    public jsx_readToken(): string;
    public jsx_readNewLine(normalizeCRLF: boolean): void;
    public jsx_readString(quote: number): void;
    public jsx_readEntity(): string;
    public jsx_readWord(): void;
    public jsx_parseIdentifier(): Node;
    public jsx_parseNamespacedName(): Node;
    public jsx_parseElementName(): Node | string;
    public jsx_parseAttributeValue(): Node;
    public jsx_parseEmptyExpression(): Node;
    public jsx_parseExpressionContainer(): Node;
    public jsx_parseAttribute(): Node;
    public jsx_parseOpeningElementAt(startPos: number, startLoc?: SourceLocation): Node;
    public jsx_parseClosingElementAt(startPos: number, startLoc?: SourceLocation): Node;
    public jsx_parseElementAt(startPos: number, startLoc?: SourceLocation): Node;
    public jsx_parseText(): Node;
    public jsx_parseElement(): Node;
}
