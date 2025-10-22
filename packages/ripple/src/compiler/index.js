/** @import { Program } from 'estree' */

import { parse as parse_module } from './phases/1-parse/index.js';
import { analyze } from './phases/2-analyze/index.js';
import { transform_client } from './phases/3-transform/client/index.js';
import { transform_server } from './phases/3-transform/server/index.js';
import { convert_source_map_to_mappings } from './phases/3-transform/segments.js';

/**
 * Parse Ripple source code to ESTree AST
 * @param {string} source
 * @returns {Program}
 */
export function parse(source) {
	return parse_module(source);
}

/**
 * Compile Ripple source code to JS/CSS output
 * @param {string} source
 * @param {string} filename
 * @param {{ mode?: 'client' | 'server' }} [options]
 * @returns {object}
 */
export function compile(source, filename, options = {}) {
	const ast = parse_module(source);
	const analysis = analyze(ast, filename, options);
	const result = options.mode === 'server'
		? transform_server(filename, source, analysis)
		: transform_client(filename, source, analysis, false);

	return result;
}

/** @import { PostProcessingChanges, LineOffsets } from './phases/3-transform/client/index.js' */

/**
 * Compile Ripple component to Volar virtual code with TypeScript mappings
 * @param {string} source
 * @param {string} filename
 * @returns {object} Volar mappings object
 */
export function compile_to_volar_mappings(source, filename) {
	const ast = parse_module(source);
	const analysis = analyze(ast, filename, { to_ts: true });
	const transformed = transform_client(filename, source, analysis, true);

	// Create volar mappings with esrap source map for accurate positioning
	return convert_source_map_to_mappings(
		transformed.ast,
		source,
		transformed.js.code,
		transformed.js.map,
    /** @type {PostProcessingChanges} */(transformed.js.post_processing_changes),
    /** @type {LineOffsets} */(transformed.js.line_offsets)
	);
}
