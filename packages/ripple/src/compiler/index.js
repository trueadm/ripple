import { parse as parse_module } from './phases/1-parse/index.js';
import { analyze } from './phases/2-analyze/index.js';
import { transform } from './phases/3-transform/index.js';
import { convert_source_map_to_mappings } from './phases/3-transform/segments.js';

export function parse(source) {
	return parse_module(source);
}

export function compile(source, filename) {
	const ast = parse_module(source);
	const analysis = analyze(ast, filename);
	const result = transform(filename, source, analysis, false);

	return result;
}

export function compile_to_volar_mappings(source, filename) {
	// Parse and transform to get the esrap sourcemap
	const ast = parse_module(source);
	const analysis = analyze(ast, filename);
	const transformed = transform(filename, source, analysis, true);

	// For VS Code TypeScript analysis, we need to add the import statement
	// and ensure proper global declarations are available
	let code = transformed.js.code;
	
	// Add import statement if not already present and if the code uses $ namespace
	if (code.includes('$.') && !code.includes('import * as $ from')) {
		code = `import * as $ from 'ripple/internal/client';\n${code}`;
	}
	
	// For global declarations like __block, add a reference directive
	if (code.includes('__block')) {
		code = `/// <reference types="ripple" />\n${code}`;
	}

	return convert_source_map_to_mappings(transformed.js.map, source, code);
}
