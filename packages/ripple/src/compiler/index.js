/** @import * as AST from 'estree' */

import { parse as parse_module } from './phases/1-parse/index.js';
import { analyze } from './phases/2-analyze/index.js';
import { transform_client } from './phases/3-transform/client/index.js';
import { transform_server } from './phases/3-transform/server/index.js';
import { convert_source_map_to_mappings } from './phases/3-transform/segments.js';

/**
 * Parse Ripple source code to ESTree AST
 * @param {string} source
 * @returns {AST.Program}
 */
export function parse(source) {
	return parse_module(source, undefined);
}

/**
 * Compile Ripple source code to JS/CSS output
 * @param {string} source
 * @param {string} filename
 * @param {CompileOptions} [options]
 * @returns {object}
 */
export function compile(source, filename, options = {}) {
	const ast = parse_module(source, undefined);
	const analysis = analyze(ast, filename, options);
	const result =
		options.mode === 'server'
			? transform_server(filename, source, analysis, options?.minify_css ?? false)
			: transform_client(filename, source, analysis, false, options?.minify_css ?? false);

	return result;
}

/** @import { PostProcessingChanges, LineOffsets } from './phases/3-transform/client/index.js' */
/** @import { VolarMappingsResult, VolarCompileOptions, CompileOptions } from 'ripple/compiler' */

/**
 * Compile Ripple component to Volar virtual code with TypeScript mappings
 * @param {string} source
 * @param {string} filename
 * @param {VolarCompileOptions} [options] - Compiler options
 * @returns {VolarMappingsResult} Volar mappings object
 */
export function compile_to_volar_mappings(source, filename, options) {
	const ast = parse_module(source, options);
	const analysis = analyze(ast, filename, { to_ts: true, loose: !!options?.loose });
	const transformed = transform_client(
		filename,
		source,
		analysis,
		true,
		options?.minify_css ?? false,
	);

	return {
		...convert_source_map_to_mappings(
			transformed.ast,
			ast,
			source,
			transformed.js.code,
			transformed.js.map,
			/** @type {PostProcessingChanges} */ (transformed.js.post_processing_changes),
			/** @type {LineOffsets} */ (transformed.js.line_offsets),
		),
		errors: transformed.errors,
	};
}
