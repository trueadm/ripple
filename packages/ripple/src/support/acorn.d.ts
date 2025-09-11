import './acorn-ripple';
import type { AcornTS } from './acorn-ts';
import type { JSXParser } from './acorn-jsx';
import type { AcornNodes } from './acorn-base';

export * from './acorn-ripple';
export * from './acorn-base';

export declare class BetterParser extends JSXParser {
    public acornTypeScript: AcornTS;
}

export type CommentedNode = AcornNodes & {
    leadingComments?: CommentWithLocation[];
    innerComments?: CommentWithLocation[];
    trailingComments?: CommentWithLocation[];
};
