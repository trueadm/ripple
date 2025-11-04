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
 * Recursively walks the AST and ensures all nodes have range and loc properties
 * ESLint's scope analyzer requires these properties on ALL nodes
 */
function ensureNodeProperties(node: any, code: string): void {
	if (!node || typeof node !== 'object') {
		return;
	}

	// Ensure range property exists
	if (node.start !== undefined && node.end !== undefined && !node.range) {
		node.range = [node.start, node.end];
	}

	// Ensure loc property exists
	if (!node.loc && node.start !== undefined && node.end !== undefined) {
		const lines = code.split('\n');
		let currentPos = 0;
		let startLine = 1;
		let startColumn = 0;
		let endLine = 1;
		let endColumn = 0;

		for (let i = 0; i < lines.length; i++) {
			const lineLength = lines[i].length + 1;
			if (currentPos + lineLength > node.start) {
				startLine = i + 1;
				startColumn = node.start - currentPos;
				break;
			}
			currentPos += lineLength;
		}

		currentPos = 0;
		for (let i = 0; i < lines.length; i++) {
			const lineLength = lines[i].length + 1;
			if (currentPos + lineLength > node.end) {
				endLine = i + 1;
				endColumn = node.end - currentPos;
				break;
			}
			currentPos += lineLength;
		}

		node.loc = {
			start: { line: startLine, column: startColumn },
			end: { line: endLine, column: endColumn },
		};
	}

	for (const key in node) {
		if (key === 'parent' || key === 'loc' || key === 'range') {
			continue; // Skip these to avoid infinite loops
		}

		const value = node[key];
		if (Array.isArray(value)) {
			value.forEach((child) => ensureNodeProperties(child, code));
		} else if (value && typeof value === 'object' && value.type) {
			ensureNodeProperties(value, code);
		}
	}
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
		if (!ast) throw new Error('Parser returned null or undefined AST');

		// Recursively ensure all nodes have range and loc properties
		ensureNodeProperties(ast, code);

		// Create a properly structured AST object ensuring all required properties exist
		const result: any = {
			type: ast.type || 'Program',
			start: ast.start !== undefined ? ast.start : 0,
			end: ast.end !== undefined ? ast.end : code.length,
			loc: ast.loc || {
				start: { line: 1, column: 0 },
				end: { line: code.split('\n').length, column: 0 },
			},
			range: ast.range || [0, code.length],
			body: ast.body || [],
			sourceType: ast.sourceType || 'module',
			comments: ast.comments || [],
			tokens: ast.tokens || [],
		};

		return {
			ast: result,
			services: {},
			visitorKeys: undefined, // Use ESLint's default visitor keys
		};
	} catch (error: any) {
		// Transform Ripple parse errors to ESLint-compatible format
		throw new SyntaxError(`Failed to parse Ripple file: ${error.message || error}`);
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
			throw new Error('Ripple compiler loaded but parse function not found.');
		}

		(globalThis as any).__RIPPLE_COMPILER__ = ripple;

		return ripple;
	} catch (error: any) {
		throw new Error(
			`Failed to load Ripple compiler: ${error.message}. ` +
				'Make sure the "ripple" package is installed as a peer dependency.',
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
