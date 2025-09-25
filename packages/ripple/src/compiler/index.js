/** @import { RawSourceMap } from 'source-map' */
/** @import { Program } from 'estree' */
/** @import { ParseError } from './phases/1-parse/index.js' */

import { parse as parse_module } from './phases/1-parse/index.js';
import { analyze } from './phases/2-analyze/index.js';
import { transform_client } from './phases/3-transform/client/index.js';
import { transform_server } from './phases/3-transform/server/index.js';
import { convert_source_map_to_mappings } from './phases/3-transform/segments.js';

/**
 * @param {string} source 
 * @returns {{ ast: Program, errors: ParseError[] }}
 */
export function parse(source) {
  return parse_module(source);
}

/**
 * @param {string} source 
 * @param {string} filename 
 * @param {{ mode?: 'client' | 'server' }} options 
 * @returns {{ js: { code: string, map: RawSourceMap }, css: { code: string, map: RawSourceMap } | null }}
 */
export function compile(source, filename, options = {}) {
  const ast = parse_module(source);
  const analysis = analyze(ast, filename);
  const result = options.mode === 'server'
      ? transform_server(filename, source, analysis)
      : transform_client(filename, source, analysis, false);

  return result;
}

export function compile_to_volar_mappings(source, filename) {
  // Parse and transform to get the esrap sourcemap
  const ast = parse_module(source);
  const analysis = analyze(ast, filename);
  const transformed = transform_client(filename, source, analysis, true);

  return convert_source_map_to_mappings(transformed.js.map, source, transformed.js.code);
}
