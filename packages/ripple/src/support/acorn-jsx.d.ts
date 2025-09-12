import type { Node, SourceLocation, Token } from 'acorn';
import type { AcornNodes, BaseParser } from './acorn-base';

export interface JSXExpressionContainer extends Node {
    type: 'JSXExpressionContainer';
    expression: AcornNodes;
}

export interface Text extends Omit<JSXExpressionContainer, 'type'> {
    type: 'Text';
}

export interface JSXIdentifier extends Node {
    type: 'JSXIdentifier';
    name: string;
}

export interface JSXMemberExpression extends Node {
    type: 'JSXMemberExpression';
    object: AcornNodes;
    property: JSXIdentifier;
}

export interface JSXSpreadAttribute extends Node {
    type: 'JSXSpreadAttribute';
    argument: AcornNodes;
}

export interface JSXAttribute extends Node {
    type: 'JSXAttribute';
    name: AcornNodes;
    value: AcornNodes | null;
}

export interface JSXNamespacedName extends Node {
    type: 'JSXNamespacedName';
    namespace: JSXIdentifier;
    name: JSXIdentifier;
}

export interface JSXEmptyExpression extends Node {
    type: 'JSXEmptyExpression';
}

export interface JSXOpeningElement extends Node {
    type: 'JSXOpeningElement' | 'JSXOpeningFragment';
    attributes: AcornNodes[];
    name: AcornNodes;
    selfClosing: boolean;
}

export interface JSXElement extends Node {
    type: 'JSXElement';
}

export declare class JSXParser extends BaseParser {
    // see https://github.com/acornjs/acorn-jsx/blob/main/index.d.ts#L44
    // (but also modified, like, a lot.)

    public jsx_readToken(): string | void | Token;
    public jsx_readNewLine(normalizeCRLF: boolean): void;
    public jsx_readString(quote: number): void;
    public jsx_readEntity(): string;
    public jsx_readWord(): void;
    public jsx_parseIdentifier(): JSXIdentifier;
    public jsx_parseNamespacedName(): JSXNamespacedName;
    public jsx_parseElementName(): AcornNodes;
    public jsx_parseAttributeValue(): AcornNodes;
    public jsx_parseEmptyExpression(): JSXEmptyExpression;
    public jsx_parseExpressionContainer(): JSXExpressionContainer;
    public jsx_parseAttribute(): AcornNodes;
    public jsx_parseOpeningElementAt(startPos?: number, startLoc?: SourceLocation): JSXOpeningElement;
    public jsx_parseClosingElementAt(startPos?: number, startLoc?: SourceLocation): Node;
    public jsx_parseElementAt(startPos: number, startLoc?: SourceLocation): Node;
    public jsx_parseText(): Node;
    public jsx_parseElement(): Node;
}

declare module 'acorn' {
    interface NodeTypes {
        jsx: JSXExpressionContainer | Text | JSXIdentifier | JSXMemberExpression | JSXAttribute | JSXSpreadAttribute | JSXNamespacedName | JSXEmptyExpression | JSXOpeningElement | JSXElement;
    }
}
