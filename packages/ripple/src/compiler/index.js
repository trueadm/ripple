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
  const analysis = analyze(ast, filename);
  const result = options.mode === 'server'
      ? transform_server(filename, source, analysis)
      : transform_client(filename, source, analysis, false);

  return result;
}

/**
 * Compile Ripple source to Volar mappings for editor integration
 * @param {string} source
 * @param {string} filename
 * @returns {object} Volar mappings object
 */
export function compile_to_volar_mappings(source, filename) {
  // Parse and transform
  const ast = parse_module(source);

  // Add unique IDs to import declarations before transformation
  // This allows us to match source imports with generated imports reliably
	// This strategy can potentially be used for other node types in the future
  let gen_id = 0;
  const source_import_map = new Map();
  for (const node of ast.body) {
    if (node.type === 'ImportDeclaration') {
      const start = /** @type {any} */ (node).start;
      const end = /** @type {any} */ (node).end;
      if (start !== undefined && end !== undefined) {
        // Add a unique ID as a string property that will be copied during transformation
        const id = `__volar_import_${gen_id++}__`;
        /** @type {any} */ (node).__volar_id = id;
        source_import_map.set(id, { start, end });
      }
    }
  }

  const analysis = analyze(ast, filename);
  const transformed = transform_client(filename, source, analysis, true);

  // Create volar mappings directly from the AST instead of relying on esrap's sourcemap
  return convert_source_map_to_mappings(transformed.ast, source, transformed.js.code, source_import_map);
}
