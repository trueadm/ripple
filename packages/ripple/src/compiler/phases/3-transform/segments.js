import { decode } from '@jridgewell/sourcemap-codec';

export const mapping_data = {
	verification: true,
	completion: true,
	semantic: true,
	navigation: true,
};

/**
 * Helper to find a meaningful token boundary by looking for word boundaries, 
 * punctuation, or whitespace
 * @param {string} text
 * @param {number} start
 * @param {number} direction
 */
function findTokenBoundary(text, start, direction = 1) {
	if (start < 0 || start >= text.length) return start;
	
	let pos = start;
	/** @param {string} c */
	const isAlphaNum = (c) => /[a-zA-Z0-9_$]/.test(c);
	
	// If we're at whitespace or punctuation, find the next meaningful character
	while (pos >= 0 && pos < text.length && /\s/.test(text[pos])) {
		pos += direction;
	}
	
	if (pos < 0 || pos >= text.length) return start;
	
	// If we're in the middle of a word/identifier, find the boundary
	if (isAlphaNum(text[pos])) {
		if (direction > 0) {
			while (pos < text.length && isAlphaNum(text[pos])) pos++;
		} else {
			while (pos >= 0 && isAlphaNum(text[pos])) pos--;
			pos++; // Adjust back to start of token
		}
	} else {
		// For punctuation, just move one character in the given direction
		pos += direction;
	}
	
	return Math.max(0, Math.min(text.length, pos));
}

/**
 * Check if source and generated content are meaningfully similar
 * @param {string} sourceContent
 * @param {string} generatedContent
 */
function isValidMapping(sourceContent, generatedContent) {
	// Remove whitespace for comparison
	const cleanSource = sourceContent.replace(/\s+/g, '');
	const cleanGenerated = generatedContent.replace(/\s+/g, '');
	
	// If either is empty, skip
	if (!cleanSource || !cleanGenerated) return false;
	
	// Skip obvious template transformations that don't make sense to map
	const templateTransforms = [
		/^\{.*\}$/, // Curly brace expressions
		/^<.*>$/, // HTML tags
		/^\(\(\)\s*=>\s*\{$/, // Generated function wrappers
		/^\}\)\(\)\}$/, // Generated function closures
	];
	
	for (const transform of templateTransforms) {
		if (transform.test(cleanSource) || transform.test(cleanGenerated)) {
			return false;
		}
	}
	
	// Check if content is similar (exact match, or generated contains source)
	if (cleanSource === cleanGenerated) return true;
	if (cleanGenerated.includes(cleanSource)) return true;
	if (cleanSource.includes(cleanGenerated) && cleanGenerated.length > 2) return true;
	
	return false;
}

/**
 * Convert esrap SourceMap to Volar mappings
 * @param {{ mappings: string }} source_map
 * @param {string} source
 * @param {string} generated_code
 * @returns {object}
 */
export function convert_source_map_to_mappings(source_map, source, generated_code) {
	/** @type {Array<{sourceOffsets: number[], generatedOffsets: number[], lengths: number[], data: any}>} */
	const mappings = [];

	// Decode the VLQ mappings from esrap
	const decoded_mappings = decode(source_map.mappings);

	let generated_offset = 0;
	const generated_lines = generated_code.split('\n');
	const source_lines = source.split('\n');

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
			let source_offset = 0;
			for (let i = 0; i < Math.min(source_line, source_lines.length - 1); i++) {
				source_offset += source_lines[i].length + 1; // +1 for newline
			}
			source_offset += source_column;

			// Calculate generated offset
			const current_generated_offset = generated_offset + generated_column;

			// Find meaningful token boundaries for source content
			const source_token_end = findTokenBoundary(source, source_offset, 1);
			const source_token_start = findTokenBoundary(source, source_offset, -1);
			
			// Find meaningful token boundaries for generated content  
			const generated_token_end = findTokenBoundary(generated_code, current_generated_offset, 1);
			const generated_token_start = findTokenBoundary(generated_code, current_generated_offset, -1);
			
			// Extract potential source content (prefer forward boundary but try both directions)
			let best_source_content = source.substring(source_offset, source_token_end);
			let best_generated_content = generated_code.substring(current_generated_offset, generated_token_end);
			
			// Try different segment boundaries to find the best match
			const candidates = [
				// Forward boundaries
				{
					source: source.substring(source_offset, source_token_end),
					generated: generated_code.substring(current_generated_offset, generated_token_end)
				},
				// Backward boundaries
				{
					source: source.substring(source_token_start, source_offset + 1),
					generated: generated_code.substring(generated_token_start, current_generated_offset + 1)
				},
				// Single character
				{
					source: source.charAt(source_offset),
					generated: generated_code.charAt(current_generated_offset)
				},
				// Try to find exact matches in nearby content
			];
			
			// Look for the best candidate match
			let best_match = null;
			for (const candidate of candidates) {
				if (isValidMapping(candidate.source, candidate.generated)) {
					best_match = candidate;
					break;
				}
			}
			
			// If no good match found, try extracting identifiers/keywords
			if (!best_match) {
				const sourceIdMatch = source.substring(source_offset).match(/^[a-zA-Z_$][a-zA-Z0-9_$]*/);
				const generatedIdMatch = generated_code.substring(current_generated_offset).match(/^[a-zA-Z_$][a-zA-Z0-9_$]*/);
				
				if (sourceIdMatch && generatedIdMatch && sourceIdMatch[0] === generatedIdMatch[0]) {
					best_match = {
						source: sourceIdMatch[0],
						generated: generatedIdMatch[0]
					};
				}
			}
			
		// Handle special cases for Ripple keywords that might not have generated equivalents
		if (!best_match || best_match.source.length === 0) {
			continue;
		}
		
		// Special handling for Ripple-specific syntax that may be omitted in generated code
		const sourceAtOffset = source.substring(source_offset, source_offset + 10);
		if (sourceAtOffset.includes('index ')) {
			// For the 'index' keyword, create a mapping even if there's no generated equivalent
			const indexMatch = sourceAtOffset.match(/index\s+/);
			if (indexMatch) {
				best_match = {
					source: indexMatch[0].trim(),
					generated: '' // Empty generated content for keywords that are transformed away
				};
			}
		}
		
		// Skip if we still don't have a valid source match
		if (!best_match || best_match.source.length === 0) {
			continue;
		}
		
		// Skip mappings for complex RefAttribute syntax to avoid overlapping sourcemaps,
		// but allow simple 'ref' keyword mappings for IntelliSense
		if (best_match.source.includes('{ref ') && best_match.source.length > 10) {
			// Skip complex ref expressions like '{ref (node) => { ... }}'
			continue;
		}
		
		// Allow simple 'ref' keyword mappings for IntelliSense
		if (best_match.source.trim() === 'ref' && best_match.generated.length === 0) {
			// This is just the ref keyword, allow it for syntax support
			// but map it to current position since there's no generated equivalent
		}
			
		// Calculate actual offsets and lengths for the best match
		let actual_source_offset, actual_generated_offset;
		
		if (best_match.generated.length > 0) {
			actual_source_offset = source.indexOf(best_match.source, source_offset - best_match.source.length);
			actual_generated_offset = generated_code.indexOf(best_match.generated, current_generated_offset - best_match.generated.length);
		} else {
			// For keywords with no generated equivalent, use the exact source position
			actual_source_offset = source_offset;
			actual_generated_offset = current_generated_offset; // Map to current position in generated code
		}
		
		// Use the match we found, but fall back to original positions if indexOf fails
		const final_source_offset = actual_source_offset !== -1 ? actual_source_offset : source_offset;
		const final_generated_offset = actual_generated_offset !== -1 ? actual_generated_offset : current_generated_offset;			// Avoid duplicate mappings by checking if we already have this exact mapping
			const isDuplicate = mappings.some(existing => 
				existing.sourceOffsets[0] === final_source_offset &&
				existing.generatedOffsets[0] === final_generated_offset &&
				existing.lengths[0] === best_match.source.length
			);
			
			if (!isDuplicate) {
				mappings.push({
					sourceOffsets: [final_source_offset],
					generatedOffsets: [final_generated_offset],
					lengths: [best_match.source.length],
					data: mapping_data,
				});
			}
		}

		// Add line length + 1 for newline (except for last line)
		generated_offset += line.length;
		if (generated_line < generated_lines.length - 1) {
			generated_offset += 1; // newline character
		}
	}

	// Sort mappings by source offset for better organization
	mappings.sort((a, b) => a.sourceOffsets[0] - b.sourceOffsets[0]);

	return {
		code: generated_code,
		mappings,
	};
}
