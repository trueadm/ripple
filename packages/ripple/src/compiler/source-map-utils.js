import { decode } from '@jridgewell/sourcemap-codec';

/** @import { PostProcessingChanges, LineOffsets } from './phases/3-transform/client/index.js' */

/** @typedef {{line: number, column: number}} GeneratedPosition */
/** @typedef {Map<string, GeneratedPosition[]>} SourceToGeneratedMap */

/**
 * Build a source-to-generated position lookup map from an esrap source map
 * Applies post-processing adjustments during map building for efficiency
 * @param {object} source_map - The source map object from esrap (v3 format)
 * @param {PostProcessingChanges} post_processing_changes - Optional post-processing changes to apply
 * @param {LineOffsets} line_offsets - Pre-computed line offsets array
 * @returns {SourceToGeneratedMap} Map from "sourceLine:sourceColumn" to array of generated positions
 */
export function build_source_to_generated_map(source_map, post_processing_changes, line_offsets) {
	/** @type {SourceToGeneratedMap} */
	const map = new Map();

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

	/**
	 * Convert byte offset to line/column
	 * @param {number} offset
	 * @returns {{ line: number, column: number }}
	 */
	const offset_to_line_col = (offset) => {
		// Binary search
		let left = 0;
		let right = line_offsets.length - 1;
		let line = 1;

		while (left <= right) {
			const mid = Math.floor((left + right) / 2);
			if (offset >= line_offsets[mid] && (mid === line_offsets.length - 1 || offset < line_offsets[mid + 1])) {
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

	// decoded is an array of lines, each line is an array of segments
	// Each segment is [generatedColumn, sourceIndex, sourceLine, sourceColumn, nameIndex?]
	for (let generated_line = 0; generated_line < decoded.length; generated_line++) {
		const line = decoded[generated_line];

		for (const segment of line) {
			if (segment.length >= 4) {
				let generated_column = segment[0];
				// just keeping this unused for context
				// const source_index = segment[1]; // which source file (we only have one)
				const source_line = /** @type {number} */ (segment[2]);
				const source_column = /** @type {number} */ (segment[3]);

				// Apply post-processing adjustments if needed
				let adjusted_line = generated_line + 1;
				let adjusted_column = generated_column;

				if (post_processing_changes) {
					const line_change = post_processing_changes.get(adjusted_line);

					if (line_change) {
						// Check if this position is affected by the change
						const pos_offset = line_col_to_byte_offset(adjusted_line, adjusted_column);

						if (pos_offset >= line_change.offset) {
							// Position is on or after the change - apply delta
							const adjusted_offset = pos_offset + line_change.delta;
							const adjusted_pos = offset_to_line_col(adjusted_offset);
							adjusted_line = adjusted_pos.line;
							adjusted_column = adjusted_pos.column;
						}
					}
				}

				// Create key from source position (1-indexed line, 0-indexed column)
				const key = `${source_line + 1}:${source_column}`;

				// Store adjusted generated position
				const gen_pos = { line: adjusted_line, column: adjusted_column };

				if (!map.has(key)) {
					map.set(key, []);
				}
				/** @type {GeneratedPosition[]} */ (map.get(key)).push(gen_pos);
			}
		}
	}

	return map;
}

/**
 * Look up generated position for a given source position
 * @param {number} source_line - 1-based line number in source
 * @param {number} source_column - 0-based column number in source
 * @param {SourceToGeneratedMap} source_to_gen_map - Lookup map
 * @returns {{line: number, column: number} | null} Generated position or null if not found
 */
export function get_generated_position(source_line, source_column, source_to_gen_map) {
	const key = `${source_line}:${source_column}`;
	const positions = source_to_gen_map.get(key);

	if (!positions || positions.length === 0) {
		return null;
	}

	// If multiple generated positions map to same source, return the first
	return positions[0];
}
