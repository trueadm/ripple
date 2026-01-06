/**
 @import { PostProcessingChanges, LineOffsets } from './phases/3-transform/client/index.js';
 @import * as AST from 'estree';
 @import { CodeMapping } from 'ripple/compiler';
 @import { CodeMapping as VolarCodeMapping } from '@volar/language-core';
 */

/**
 @typedef {{
	 line: number,
	column: number,
	end_line: number,
	end_column: number,
	code: string,
	metadata: {
		css?: AST.Element['metadata']['css']
	},
}} CodePosition

@typedef {Map<string, CodePosition[]>} CodeToGeneratedMap
@typedef {Map<string, {line: number, column: number}[]>} GeneratedToSourceMap
*/

import { decode } from '@jridgewell/sourcemap-codec';

/** @type {VolarCodeMapping['data']} */
export const mapping_data = {
	verification: true,
	completion: true,
	semantic: true,
	navigation: true,
	structure: true,
	format: false,
};

/** @type {Partial<VolarCodeMapping['data']>} */
export const mapping_data_verify_only = {
	verification: true,
};

/**
 * Convert byte offset to line/column
 * @param {number} offset
 * @param {LineOffsets} line_offsets
 * @returns {{ line: number, column: number }}
 */
export const offset_to_line_col = (offset, line_offsets) => {
	// Binary search
	let left = 0;
	let right = line_offsets.length - 1;
	let line = 1;

	while (left <= right) {
		const mid = Math.floor((left + right) / 2);
		if (
			offset >= line_offsets[mid] &&
			(mid === line_offsets.length - 1 || offset < line_offsets[mid + 1])
		) {
			line = mid + 1;
			break;
		} else if (offset < line_offsets[mid]) {
			right = mid - 1;
		} else {
			left = mid + 1;
		}
	}

	const column = offset - line_offsets[line - 1];
	return { line, column };
};

/**
 * Build a source-to-generated position lookup map from an esrap source map
 * Applies post-processing adjustments during map building for efficiency
 * @param {object} source_map - The source map object from esrap (v3 format)
 * @param {PostProcessingChanges} post_processing_changes - Optional post-processing changes to apply
 * @param {LineOffsets} line_offsets - Pre-computed line offsets array
 * @param {string} generated_code - The final generated code (after post-processing)
 * @returns {[CodeToGeneratedMap, GeneratedToSourceMap]} Tuple of [source-to-generated map, generated-to-source map]
 */
export function build_src_to_gen_map(
	source_map,
	post_processing_changes,
	line_offsets,
	generated_code,
) {
	/** @type {CodeToGeneratedMap} */
	const map = new Map();
	/** @type {GeneratedToSourceMap} */
	const reverse_map = new Map();

	// Decode the VLQ-encoded mappings string
	// @ts-ignore
	const decoded = decode(source_map.mappings);

	/**
	 * Convert line/column position to byte offset
	 * @param {number} line - 1-based line number
	 * @param {number} column - 0-based column number
	 * @returns {number} Byte offset
	 */
	const line_col_to_byte_offset = (line, column) => {
		return line_offsets[line - 1] + column;
	};

	// Apply post-processing adjustments to all segments first
	/** @type {Array<Array<{line: number, column: number, sourceLine: number, sourceColumn: number}>>} */
	const adjusted_segments = [];

	for (let generated_line = 0; generated_line < decoded.length; generated_line++) {
		const line = decoded[generated_line];
		adjusted_segments[generated_line] = [];

		for (const segment of line) {
			if (segment.length >= 4) {
				let adjusted_line = generated_line + 1;
				let adjusted_column = segment[0];

				if (post_processing_changes) {
					const line_change = post_processing_changes.get(adjusted_line);

					if (line_change) {
						const pos_offset = line_col_to_byte_offset(adjusted_line, adjusted_column);

						if (pos_offset >= line_change.offset) {
							const adjusted_offset = pos_offset + line_change.delta;
							const adjusted_pos = offset_to_line_col(adjusted_offset, line_offsets);
							adjusted_line = adjusted_pos.line;
							adjusted_column = adjusted_pos.column;
						}
					}
				}

				adjusted_segments[generated_line].push({
					line: adjusted_line,
					column: adjusted_column,
					sourceLine: /** @type {number} */ (segment[2]),
					sourceColumn: /** @type {number} */ (segment[3]),
				});
			}
		}
	}

	// Now build the map using adjusted positions
	for (let line_idx = 0; line_idx < adjusted_segments.length; line_idx++) {
		const line_segments = adjusted_segments[line_idx];

		for (let seg_idx = 0; seg_idx < line_segments.length; seg_idx++) {
			const segment = line_segments[seg_idx];
			const line = segment.line;
			const column = segment.column;

			// Determine end position using next segment
			let end_line = line;
			let end_column = column;

			// Look for next segment to determine end position
			if (seg_idx + 1 < line_segments.length) {
				// Next segment on same line
				const next_segment = line_segments[seg_idx + 1];
				end_line = next_segment.line;
				end_column = next_segment.column;
			} else if (
				line_idx + 1 < adjusted_segments.length &&
				adjusted_segments[line_idx + 1].length > 0
			) {
				// Look at first segment of next line
				const next_segment = adjusted_segments[line_idx + 1][0];
				end_line = next_segment.line;
				end_column = next_segment.column;
			}

			// Extract code snippet
			const start_offset = line_col_to_byte_offset(line, column);
			const end_offset = line_col_to_byte_offset(end_line, end_column);
			const code_snippet = generated_code.slice(start_offset, end_offset);

			// Create key from source position (1-indexed line, 0-indexed column)
			segment.sourceLine += 1;
			const key = `${segment.sourceLine}:${segment.sourceColumn}`;

			// Store adjusted generated position with code snippet
			const gen_pos = { line, column, end_line, end_column, code: code_snippet, metadata: {} };

			if (!map.has(key)) {
				map.set(key, []);
			}
			/** @type {CodePosition[]} */ (map.get(key)).push(gen_pos);

			// Store reverse mapping (generated to source)
			const gen_key = `${gen_pos.line}:${gen_pos.column}`;

			if (!reverse_map.has(gen_key)) {
				reverse_map.set(gen_key, []);
			}
			reverse_map.get(gen_key)?.push({
				line: segment.sourceLine,
				column: segment.sourceColumn,
			});
		}
	}

	return [map, reverse_map];
}

/**
 * Look up generated position for a given source position
 * @param {number} src_line - 1-based line number in source
 * @param {number} src_column - 0-based column number in source
 * @param {CodeToGeneratedMap} src_to_gen_map - Lookup map
 * @returns {CodePosition} Generated position
 */
export function get_generated_position(src_line, src_column, src_to_gen_map) {
	const key = `${src_line}:${src_column}`;
	const positions = src_to_gen_map.get(key);

	if (!positions || positions.length === 0) {
		// No mapping found in source map - this shouldn't happen since all tokens should have mappings
		throw new Error(`No source map entry for position "${src_line}:${src_column}"`);
	}

	// If multiple generated positions map to same source, return the first
	return positions[0];
}

/**
 * Convert line/column to byte offset
 * @param {number} line
 * @param {number} column
 * @param {number[]} line_offsets
 * @returns {number}
 */
export function loc_to_offset(line, column, line_offsets) {
	if (line < 1 || line > line_offsets.length) {
		throw new Error(
			`Location line or line offsets length is out of bounds, line: ${line}, line offsets length: ${line_offsets.length}`,
		);
	}
	return line_offsets[line - 1] + column;
}

/**
 * Converts line/column positions to byte offsets
 * @param {string} text
 * @returns {number[]}
 */
export function build_line_offsets(text) {
	const offsets = [0]; // Line 1 starts at offset 0
	for (let i = 0; i < text.length; i++) {
		if (text[i] === '\n') {
			offsets.push(i + 1);
		}
	}
	return offsets;
}

/**
 * @param {AST.Node} node
 * @param {CodeToGeneratedMap} src_to_gen_map
 * @param {number[]} gen_line_offsets
 * @param {Partial<VolarCodeMapping['data']>} [filtered_data]
 * @param {number} [src_max_len]
 * @param {number} [gen_max_len]
 * @returns {CodeMapping}
 */
export function get_mapping_from_node(
	node,
	src_to_gen_map,
	gen_line_offsets,
	filtered_data,
	src_max_len,
	gen_max_len,
) {
	const src_start_offset = /** @type {number} */ (node.start);
	const src_end_offset = /** @type {number} */ (node.end);
	const src_length = src_max_len || src_end_offset - src_start_offset;
	const loc = /** @type {AST.SourceLocation} */ (node.loc);

	const gen_loc = get_generated_position(loc.start.line, loc.start.column, src_to_gen_map);
	const gen_start_offset = loc_to_offset(gen_loc.line, gen_loc.column, gen_line_offsets);
	const gen_end_loc = get_generated_position(loc.end.line, loc.end.column, src_to_gen_map);
	const gen_end_offset = loc_to_offset(gen_end_loc.line, gen_end_loc.column, gen_line_offsets);
	const gen_length = gen_max_len || gen_end_offset - gen_start_offset;
	return {
		sourceOffsets: [src_start_offset],
		lengths: [src_length],
		generatedOffsets: [gen_start_offset],
		generatedLengths: [gen_length],
		data: {
			...(filtered_data || mapping_data),
			customData: {
				generatedLengths: [gen_length],
			},
		},
	};
}
