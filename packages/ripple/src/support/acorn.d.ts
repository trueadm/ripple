import './acorn-ripple';
import type { AcornTS } from './acorn-ts';
import type { JSXParser } from './acorn-jsx';

export * from './acorn-base';

export declare class BetterParser extends JSXParser {
    public acornTypeScript: AcornTS;
}
