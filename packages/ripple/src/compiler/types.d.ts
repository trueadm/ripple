import * as a from '#acorn';

export type DeclarationKind = 'let' | 'const' | 'var' | 'import' | 'function' | 'component' | 'rest_param' | 'param' | 'using' | 'await using';
export type BindingKind = 'normal';

// I think this stuff comes from svelte, should it get removed at some point?
export type LetDirective = unknown;
export type Binding = { kind: BindingKind; [key: string]: unknown; };
