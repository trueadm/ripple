import type { Identifier, Node } from 'acorn';

export interface ComponentNode extends Node {
    type: 'Component';
    css: unknown | null;
    default: boolean;
    id: Identifier | null;
    body: Node[];
}

declare module 'acorn' {
    interface NodeTypes {
        ripple: ComponentNode;
    }
}
