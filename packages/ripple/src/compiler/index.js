import { parse as parse_module } from './phases/1-parse/index.js';
import { analyze } from './phases/2-analyze/index.js';
import { transform } from './phases/3-transform/index.js';
import { convert_source_map_to_mappings } from './phases/3-transform/segments.js';

/**
 * @param {string} source
 */
export function parse(source) {
	return parse_module(source);
}

/**
 * @param {string} source
 * @param {string} filename
 */
export function compile(source, filename) {
	const ast = parse_module(source);
	const analysis = analyze(ast, filename);
	const result = transform(filename, source, analysis, false);

	return result;
}

/**
 * @param {string} source
 * @param {string} filename
 */
export function compile_to_volar_mappings(source, filename) {
	// Parse and transform to get the esrap sourcemap
	const ast = parse_module(source);
	const analysis = analyze(ast, filename);
	const transformed = transform(filename, source, analysis, true);

	return convert_source_map_to_mappings(transformed.js.map, source, transformed.js.code);
}
