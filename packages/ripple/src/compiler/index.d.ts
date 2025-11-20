import type { Program } from 'estree';

// ============================================================================
// Compiler API Exports
// ============================================================================
/**
 * Result of compilation operation
 */
export interface CompileResult {
	/** The transformed AST */
	ast: Program;
	/** The generated JavaScript code with source map */
	js: {
		code: string;
		map: any;
	};
	/** The generated CSS */
	css: string;
}

/**
 * Result of Volar mappings compilation
 */
export interface VolarMappingsResult {
	/** Array of code mappings for Volar integration */
	[key: string]: any;
}

/**
 * Compilation options
 */
export interface CompileOptions {
	/** Compilation mode: 'client' or 'server' */
	mode?: 'client' | 'server';
}

export interface ParseOptions {
	/** Enable loose mode */
	loose?: boolean;
}

/**
 * Parse Ripple source code to ESTree AST
 * @param source - The Ripple source code to parse
 * @param options - Parse options
 * @returns The parsed ESTree Program AST
 */
export function parse(source: string, options?: ParseOptions): Program;

/**
 * Compile Ripple source code to JS/CSS output
 * @param source - The Ripple source code to compile
 * @param filename - The filename for source map generation
 * @param options - Compilation options (mode: 'client' or 'server')
 * @returns The compilation result with AST, JS, and CSS
 */
export function compile(source: string, filename: string, options?: CompileOptions): CompileResult;

/**
 * Compile Ripple source to Volar mappings for editor integration
 * @param source - The Ripple source code
 * @param filename - The filename for source map generation
 * @param options - Parse options
 * @returns Volar mappings object for editor integration
 */
export function compile_to_volar_mappings(
	source: string,
	filename: string,
	options?: ParseOptions,
): VolarMappingsResult;
