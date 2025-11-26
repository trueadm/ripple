import type { Program } from 'estree';
import type {
	CodeInformation as VolarCodeInformation,
	Mapping as VolarMapping,
} from '@volar/language-core';
import type { DocumentHighlightKind } from 'vscode-languageserver-types';

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

export interface PluginActionOverrides {
	/** Whether to enable word document highlighting for this mapping */
	wordHighlight?: {
		kind: DocumentHighlightKind;
	};
	/** TypeScript diagnostic codes to suppress for this mapping */
	suppressedDiagnostics?: number[];
	/** Custom hover documentation for this mapping, false to disable */
	hover?:
		| {
				contents: string;
		  }
		| false;
	/** Custom definition info for this mapping, false to disable */
	definition?:
		| {
				description: string;
		  }
		| false;
}

export interface CustomMappingData extends PluginActionOverrides {
	generatedLengths: number[];
}

export interface MappingData extends VolarCodeInformation {
	customData: CustomMappingData;
}

export interface CodeMapping extends VolarMapping<MappingData> {
	data: MappingData;
}

export interface ScopedClass {
	className: string;
	offset: number;
}

export interface CssClass {
	text: string;
	offset: number;
}

/**
 * Result of Volar mappings compilation
 */
export interface VolarMappingsResult {
	code: string;
	mappings: CodeMapping[];
	cssMappings: CodeMapping[];
	cssSources: string[];
	cssClasses: CssClass[][];
	scopedClasses: ScopedClass[][];
}

/**
 * Compilation options
 */

interface SharedCompileOptions {
	minify_css?: boolean;
}
export interface CompileOptions extends SharedCompileOptions {
	mode?: 'client' | 'server';
}

export interface ParseOptions {
	loose?: boolean;
}

export interface AnalyzeOptions extends ParseOptions, Pick<CompileOptions, 'mode'> {
	to_ts?: boolean;
}

export interface VolarCompileOptions extends ParseOptions, SharedCompileOptions {}

export function parse(source: string, options?: ParseOptions): Program;

export function compile(source: string, filename: string, options?: CompileOptions): CompileResult;

export function compile_to_volar_mappings(
	source: string,
	filename: string,
	options?: VolarCompileOptions,
): VolarMappingsResult;
