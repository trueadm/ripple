import type { StyleBlock } from '#style';
import type { AcornNodes } from './acorn-base';
import type { BlockStatement, Expression, Identifier, Node, TryStatement } from 'acorn';

export interface ComponentNode extends Node {
    type: 'Component';
    css: StyleBlock | null;
    default: boolean;
    id: Identifier | null;
    body: Node[];
}

export interface AccessorAttribute extends Node {
    type: 'AccessorAttribute';
    name: Identifier;
    get: AcornNodes | null;
    set: AcornNodes | null;
    argument: AcornNodes | undefined;
}

interface UseAttribute extends Omit<AccessorAttribute, 'type'> {
    type: 'UseAttribute';
}

interface SpreadAttribute extends Omit<AccessorAttribute, 'type'> {
    type: 'SpreadAttribute';
}

interface Attribute extends Omit<AccessorAttribute, 'type'> {
    type: 'Attribute';
    value: AcornNodes;
}

interface AsyncTryStatement extends TryStatement {
    async: BlockStatement | null;
}

interface Element extends Node {
    type: 'Element';
    id: AcornNodes;
    attributes: AcornNodes[];
    children: (AcornNodes | StyleBlock | null)[];
    selfClosing: boolean;
    metadata: unknown;
}

declare module 'acorn' {
    interface NodeTypes {
        ripple: ComponentNode | AccessorAttribute | UseAttribute | SpreadAttribute | Attribute | Element;
    }
}
