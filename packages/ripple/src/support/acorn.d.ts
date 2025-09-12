import './acorn-ripple';
import type { AcornTS } from './acorn-ts';
import type { JSXParser } from './acorn-jsx';
import type { AcornNodes } from './acorn-base';
import type { Comment } from 'acorn';

export * from 'acorn';
export * from './acorn-ripple';
export * from './acorn-base';

export declare class BetterParser extends JSXParser {
    public acornTypeScript: AcornTS;
}

export type CommentWithLocation = Comment;

export type CommentedNode = AcornNodes & {
    leadingComments?: CommentWithLocation[];
    innerComments?: CommentWithLocation[];
    trailingComments?: CommentWithLocation[];
};
