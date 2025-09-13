import type { StyleBlock } from '#style';
import type { Scope } from '../compiler/scope';
import type { AcornNodes } from './acorn-base';
import type { BlockStatement, Identifier, Node, TryStatement } from 'acorn';

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
    id: Identifier;
    attributes: RippleNode[];
    children: RippleNode[];
    selfClosing: boolean;
    metadata: unknown;
}

interface RippleMeta {
    hoisted?: boolean;
    hoisted_params?: unknown[];
    scope?: Scope;
    tracked?: boolean;
    path?: RippleNode[];
    delegated?: boolean;
    function?: Function & { metadata?: RippleMeta; };
}

type RippleNode = AcornNodes & {
    metadata?: RippleMeta;
};

declare module 'acorn' {
    interface NodeTypes {
        ripple: ComponentNode | AccessorAttribute | UseAttribute | SpreadAttribute | Attribute | Element | StyleBlock;
    }
}
