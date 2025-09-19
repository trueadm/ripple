import { decode } from '@jridgewell/sourcemap-codec';

export const mapping_data = {
	verification: true,
	completion: true,
	semantic: true,
	navigation: true,
};

/**
 * Convert esrap SourceMap to Volar mappings
 * @param {object} source_map
 * @param {string} source
 * @param {string} generated_code
 * @returns {object}
 */
export function convert_source_map_to_mappings(source_map, source, generated_code) {
	const mappings = [];

	// Decode the VLQ mappings from esrap
	const decoded_mappings = decode(source_map.mappings);

	let generated_offset = 0;
	const generated_lines = generated_code.split('\n');

	// Process each line of generated code
	for (let generated_line = 0; generated_line < generated_lines.length; generated_line++) {
		const line = generated_lines[generated_line];
		const line_mappings = decoded_mappings[generated_line] || [];

		// Process mappings for this line
		for (const mapping of line_mappings) {
			const [generated_column, source_file_index, source_line, source_column] = mapping;

			// Skip mappings without source information
			if (source_file_index == null || source_line == null || source_column == null) {
				continue;
			}

			// Calculate source offset
			const source_lines = source.split('\n');
			let source_offset = 0;
			for (let i = 0; i < Math.min(source_line, source_lines.length - 1); i++) {
				source_offset += source_lines[i].length + 1; // +1 for newline
			}
			source_offset += source_column;

			// Calculate generated offset
			const current_generated_offset = generated_offset + generated_column;

			// Determine segment length (look ahead to next mapping or end of line)
			const next_mapping = line_mappings[line_mappings.indexOf(mapping) + 1];
			let segment_length = next_mapping
				? next_mapping[0] - generated_column
				: Math.max(1, line.length - generated_column);

			// Determine the actual segment content
			const generated_content = generated_code.substring(
				current_generated_offset,
				current_generated_offset + segment_length,
			);
			const source_content = source.substring(source_offset, source_offset + segment_length);

			// Skip mappings for RefAttribute syntax to avoid overlapping sourcemaps
			if (source_content.includes('{ref ') || source_content.match(/\{\s*ref\s+/)) {
				continue;
			}

			// Fix for children mapping: when generated content is "children",
			// it should only map to the component name in the source, not include attributes
			if (generated_content === 'children') {
				// Look for the component name in the source content
				const component_name_match = source_content.match(/^(\w+)/);
				if (component_name_match) {
					const component_name = component_name_match[1];
					segment_length = component_name.length;
				}
			}

			mappings.push({
				sourceOffsets: [source_offset],
				generatedOffsets: [current_generated_offset],
				lengths: [segment_length],
				data: mapping_data,
			});
		}

		// Add line length + 1 for newline (except for last line)
		generated_offset += line.length;
		if (generated_line < generated_lines.length - 1) {
			generated_offset += 1; // newline character
		}
	}

	return {
		code: generated_code,
		mappings,
	};
}
