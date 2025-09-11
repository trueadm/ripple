import type { Expression, Node, SourceLocation } from 'acorn';
import type { AcornNodesMap, BaseParser } from './acorn-base';

export interface JSXExpressionContainer extends Node {
    type: 'JSXExpressionContainer';
    expression: Expression | JSXExpression;
}

export interface Text extends Omit<JSXExpressionContainer, 'type'> {
    type: 'Text';
}

export declare class JSXParser extends BaseParser {
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
    public jsx_parseExpressionContainer(): AcornNodesMap['JSXExpressionContainer'];
    public jsx_parseAttribute(): Node;
    public jsx_parseOpeningElementAt(startPos: number, startLoc?: SourceLocation): Node;
    public jsx_parseClosingElementAt(startPos: number, startLoc?: SourceLocation): Node;
    public jsx_parseElementAt(startPos: number, startLoc?: SourceLocation): Node;
    public jsx_parseText(): Node;
    public jsx_parseElement(): Node;
}

declare module 'acorn' {
    interface NodeTypes {
        jsx: JSXExpressionContainer | Text;
    }
}
