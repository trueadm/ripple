import type { TokenType } from "acorn";
import type tsPlugin from "acorn-typescript";
import type { TokContext } from "./acorn-base";

// see https://github.com/TyrealHu/acorn-typescript/blob/master/src/tokenType.ts
export type AcornTSKeywords = |
    'assert' | 'asserts' | 'global' | 'keyof' |
    'readonly' | 'unique' | 'abstract' | 'declare' |
    'enum' | 'module' | 'namespace' | 'interface' |
    'type';

export type AcornTSTokenTypeNames = |
    'at' | 'jsxName' | 'jsxText' | 'jsxTagStart' |
    'jsxTagEnd';

export type AcornTSTokenContextNames = 'tc_oTag' | 'tc_cTag' | 'tc_expr';

export type AcornTSTokenTypes = Record<AcornTSKeywords | AcornTSTokenTypeNames, TokenType>;
export type AcornTSTokenContexts = Record<AcornTSTokenContextNames, TokContext>;

export type AcornTS = ReturnType<ReturnType<typeof tsPlugin>> & {
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
