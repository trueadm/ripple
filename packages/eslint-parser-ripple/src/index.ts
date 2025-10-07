import type { Program } from 'estree';
import type { AST, Linter } from 'eslint';
import { createRequire } from 'module';

interface ParseResult {
  ast: Program;
  services?: Record<string, any>;
  scopeManager?: any;
  visitorKeys?: Record<string, string[]>;
}

/**
 * ESLint parser for Ripple (.ripple) files
 *
 * This parser uses Ripple's built-in compiler to parse .ripple files
 * and returns an ESTree-compatible AST for ESLint to analyze.
 */
export function parseForESLint(code: string, options?: Linter.ParserOptions): ParseResult {
  try {
    // Dynamically import the Ripple compiler
    // We use dynamic import to avoid bundling the entire compiler
    const rippleCompiler = requireRippleCompiler();

    // Parse the Ripple source code using the Ripple compiler
    const ast = rippleCompiler.parse(code);

    if (!ast) {
      throw new Error('Parser returned null or undefined AST');
    }

    if (!ast.tokens) {
      ast.tokens = [];
    }
    if (!ast.comments) {
      ast.comments = [];
    }
    if (!ast.loc) {
      ast.loc = {
        start: { line: 1, column: 0 },
        end: { line: 1, column: code.length },
      };
    }
    if (!ast.range) {
      ast.range = [0, code.length];
    }

    return {
      ast,
      services: {},
      visitorKeys: undefined,
    };
  } catch (error: any) {
    // Transform Ripple parse errors to ESLint-compatible format
    throw new SyntaxError(
      `Failed to parse Ripple file: ${error.message || error}`
    );
  }
}

/**
 * Legacy parse function for older ESLint versions
 */
export function parse(code: string, options?: Linter.ParserOptions): Program {
  const result = parseForESLint(code, options);
  return result.ast;
}

/**
 * Helper to require the Ripple compiler
 * This handles both CommonJS and ESM environments
 */
function requireRippleCompiler(): any {
  const globalRipple = (globalThis as any).__RIPPLE_COMPILER__;
  if (globalRipple && globalRipple.parse) {
    return globalRipple;
  }

  try {
    // Use createRequire to dynamically require the module
    // This works in both ESM and CommonJS contexts
    const require = createRequire(import.meta.url);
    const ripple = require('ripple/compiler');

    if (!ripple || !ripple.parse) {
      throw new Error(
        'Ripple compiler loaded but parse function not found.'
      );
    }

    (globalThis as any).__RIPPLE_COMPILER__ = ripple;

    return ripple;
  } catch (error: any) {
    throw new Error(
      `Failed to load Ripple compiler: ${error.message}. ` +
      'Make sure the "ripple" package is installed as a peer dependency.'
    );
  }
}

declare global {
  var __RIPPLE_COMPILER__: {
    parse: (source: string) => Program;
    compile: (source: string, filename: string, options?: any) => any;
  };
}

export default {
  parseForESLint,
  parse,
};
