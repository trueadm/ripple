/**
@import * as AST from 'estree';
@import * as ESTreeJSX from 'estree-jsx';
@import { DocumentHighlightKind } from 'vscode-languageserver-types';
@import { CodeMapping as VolarCodeMapping } from '@volar/language-core';
@import { SourceMapMappings } from '@jridgewell/sourcemap-codec';
@import {
	CustomMappingData,
	PluginActionOverrides,
	MappingData,
	CodeMapping,
	VolarMappingsResult,
} from 'ripple/compiler';
@import { PostProcessingChanges } from './client/index.js';
 */

/**
@typedef {{
	start: number,
	end: number,
	content: string,
	id: string,
}} CssSourceRegion;
@typedef {{
	source: string | null | undefined;
	generated: string;
	loc: AST.SourceLocation;
	end_loc?: AST.SourceLocation;
	metadata?: PluginActionOverrides;
}} Token;
@typedef {{
	name: string,
	line: number,
	column: number,
	offset: number,
	length: number,
	sourceOffset: number,
}} TokenClass
@typedef {Map<string, AST.Element['metadata']['css']>} CssElementInfo
 */

import { walk } from 'zimmerframe';
import {
	build_src_to_gen_map,
	get_generated_position,
	offset_to_line_col,
} from '../../source-map-utils.js';

/** @type {VolarCodeMapping['data']} */
export const mapping_data = {
	verification: true,
	completion: true,
	semantic: true,
	navigation: true,
	structure: true,
	format: false,
};

/**
 * @param {string} [hash]
 * @param {string} [fallback]
 * @returns `style-${hash | fallback}`
 */
function get_style_region_id(hash, fallback) {
	return `style-${hash || fallback}`;
}

/**
 * Converts line/column positions to byte offsets
 * @param {string} text
 * @returns {number[]}
 */
function build_line_offsets(text) {
	const offsets = [0]; // Line 1 starts at offset 0
	for (let i = 0; i < text.length; i++) {
		if (text[i] === '\n') {
			offsets.push(i + 1);
		}
	}
	return offsets;
}

/**
 * Convert line/column to byte offset
 * @param {number} line
 * @param {number} column
 * @param {number[]} line_offsets
 * @returns {number}
 */
function loc_to_offset(line, column, line_offsets) {
	if (line < 1 || line > line_offsets.length) {
		throw new Error(
			`Location line or line offsets length is out of bounds, line: ${line}, line offsets length: ${line_offsets.length}`,
		);
	}
	return line_offsets[line - 1] + column;
}

/**
 * Extract CSS source regions from style elements in the AST
 * @param {AST.Node} ast - The parsed AST
 * @param {number[]} src_line_offsets
 * @param {{
 * 	regions: CssSourceRegion[],
 * 	css_element_info: CssElementInfo,
 * }} param2
 * @returns {void}
 */
function visit_source_ast(ast, src_line_offsets, { regions, css_element_info }) {
	let region_id = 0;
	walk(ast, null, {
		Element(node, context) {
			// Check if this is a style element with CSS content
			if (node.id?.name === 'style' && node.css) {
				const openLoc = /** @type {ESTreeJSX.JSXOpeningElement & AST.NodeWithLocation} */ (
					node.openingElement
				).loc;
				const cssStart = loc_to_offset(openLoc.end.line, openLoc.end.column, src_line_offsets);

				const closeLoc = /** @type {ESTreeJSX.JSXClosingElement & AST.NodeWithLocation} */ (
					node.closingElement
				).loc;
				const cssEnd = loc_to_offset(closeLoc.start.line, closeLoc.start.column, src_line_offsets);

				regions.push({
					start: cssStart,
					end: cssEnd,
					content: node.css,
					id: get_style_region_id(node.metadata.styleScopeHash, `head-${region_id}`),
				});
			}

			context.next();
		},
		Attribute(node, context) {
			const element = context.path?.find((n) => n.type === 'Element');
			if (element?.metadata?.css?.scopedClasses) {
				// we don't need to check is_element_dom_element(node)
				// since scopedClasses are added during pruning only to DOM elements
				const css = element.metadata.css;
				const { line, column } = node.value?.loc?.start ?? {};

				if (line === undefined || column === undefined) {
					return;
				}

				css_element_info.set(`${line}:${column}`, css);
			}
		},
	});
}

/**
 * Extract individual class names and their offsets from class attribute values
 * Handles: "foo bar", { foo: true }, ['foo', { bar: true }], etc.
 *
 * @param {AST.Node} node - The attribute value node
 * @param {ReturnType<typeof build_src_to_gen_map>[0]} src_to_gen_map
 * @param {number[]} gen_line_offsets
 * @param {number[]} src_line_offsets
 * @returns {TokenClass[]}
 */
function extract_classes(node, src_to_gen_map, gen_line_offsets, src_line_offsets) {
	/** @type {TokenClass[]} */
	const classes = [];

	switch (node.type) {
		case 'Literal': {
			// Static: class="foo bar baz"

			const content = node.raw ?? '';
			let text = content;
			let textOffset = 0;

			// Remove quotes
			if (
				(content.startsWith(`'`) && content.endsWith(`'`)) ||
				(content.startsWith(`"`) && content.endsWith(`"`)) ||
				(content.startsWith('`') && content.endsWith('`'))
			) {
				text = content.slice(1, -1);
				textOffset = 1;
			}

			// Split by whitespace
			const classNames = text.split(/\s+/).filter((c) => c.length > 0);
			const nodeSrcStart = /** @type {AST.Position} */ (node.loc?.start);

			let currentPos = 0;
			const nodeGenStart = get_generated_position(
				nodeSrcStart.line,
				nodeSrcStart.column,
				src_to_gen_map,
			);
			const offset = loc_to_offset(nodeGenStart.line, nodeGenStart.column, gen_line_offsets);
			const sourceOffset = loc_to_offset(nodeSrcStart.line, nodeSrcStart.column, src_line_offsets);

			for (const name of classNames) {
				const classStart = text.indexOf(name, currentPos);
				const classOffset = offset + textOffset + classStart;
				const classSourceOffset = sourceOffset + textOffset + classStart;
				const { line, column } = offset_to_line_col(classOffset, gen_line_offsets);

				classes.push({
					name,
					line,
					column,
					offset: classOffset,
					length: name.length,
					sourceOffset: classSourceOffset,
				});

				currentPos = classStart + name.length;
			}
			break;
		}

		case 'ObjectExpression': {
			// Dynamic: class={{ foo: true, bar: @show }}
			for (const prop of node.properties) {
				if (prop.type === 'Property' && prop.key) {
					const key = prop.key;
					if (key.type === 'Identifier' && key.name && key.loc) {
						const nodeSrcStart = /** @type {AST.Position} */ (key.loc?.start);
						const nodeGenStart = get_generated_position(
							nodeSrcStart.line,
							nodeSrcStart.column,
							src_to_gen_map,
						);
						const offset = loc_to_offset(nodeGenStart.line, nodeGenStart.column, gen_line_offsets);
						const sourceOffset = loc_to_offset(
							nodeSrcStart.line,
							nodeSrcStart.column,
							src_line_offsets,
						);
						const { line, column } = offset_to_line_col(offset, gen_line_offsets);

						classes.push({
							name: key.name,
							line,
							column,
							offset,
							length: key.name.length,
							sourceOffset,
						});
					}
				}
			}
			break;
		}

		case 'ArrayExpression': {
			// Dynamic: class={['foo', { bar: true }]}
			for (const el of node.elements) {
				if (el) {
					classes.push(...extract_classes(el, src_to_gen_map, gen_line_offsets, src_line_offsets));
				}
			}
			break;
		}

		case 'ConditionalExpression': {
			// Conditional: class={@show ? 'active' : 'inactive'}
			if (node.consequent) {
				classes.push(
					...extract_classes(node.consequent, src_to_gen_map, gen_line_offsets, src_line_offsets),
				);
			}
			if (node.alternate) {
				classes.push(
					...extract_classes(node.alternate, src_to_gen_map, gen_line_offsets, src_line_offsets),
				);
			}
			break;
		}

		case 'LogicalExpression': {
			// Logical: class={[@show && 'active']}
			if (node.operator === '&&' && node.right) {
				classes.push(
					...extract_classes(node.right, src_to_gen_map, gen_line_offsets, src_line_offsets),
				);
			} else if (node.operator === '||') {
				if (node.left) {
					classes.push(
						...extract_classes(node.left, src_to_gen_map, gen_line_offsets, src_line_offsets),
					);
				}
				if (node.right) {
					classes.push(
						...extract_classes(node.right, src_to_gen_map, gen_line_offsets, src_line_offsets),
					);
				}
			}
			break;
		}
	}

	return classes;
}

/**
 * Create Volar mappings by walking the transformed AST
 * @param {AST.Node} ast - The transformed AST
 * @param {AST.Node} ast_from_source - The original AST from source
 * @param {string} source - Original source code
 * @param {string} generated_code - Generated code (returned in output, not used for searching)
 * @param {SourceMapMappings} source_map - Esrap source map for accurate position lookup
 * @param {PostProcessingChanges } post_processing_changes - Optional post-processing changes
 * @param {number[]} line_offsets - Pre-computed line offsets array for generated code
 * @returns {VolarMappingsResult}
 */
export function convert_source_map_to_mappings(
	ast,
	ast_from_source,
	source,
	generated_code,
	source_map,
	post_processing_changes,
	line_offsets,
) {
	/** @type {CodeMapping[]} */
	const mappings = [];
	let isImportDeclarationPresent = false;

	const src_line_offsets = build_line_offsets(source);
	const gen_line_offsets = build_line_offsets(generated_code);

	const [src_to_gen_map] = build_src_to_gen_map(
		source_map,
		post_processing_changes,
		line_offsets,
		generated_code,
	);

	/** @type {Token[]} */
	const tokens = [];
	/** @type {CssSourceRegion[]} */
	const css_regions = [];
	/** @type {CssElementInfo} */
	const css_element_info = new Map();

	visit_source_ast(ast_from_source, src_line_offsets, {
		regions: css_regions,
		css_element_info,
	});

	// We have to visit everything in generated order to maintain correct indices

	walk(ast, null, {
		_(node, { visit }) {
			// Collect key node types: Identifiers, Literals, and JSX Elements
			if (node.type === 'Identifier') {
				// Only create mappings for identifiers with location info (from source)
				// Synthesized identifiers (created by builders) don't have .loc and are skipped
				if (node.name && node.loc) {
					// Check if this identifier was changed in metadata (e.g., #Map -> TrackedMap)
					// Or if it was capitalized during transformation
					if (node.metadata?.source_name) {
						tokens.push({
							source: node.metadata.source_name,
							generated: node.name,
							loc: node.loc,
						});
					} else {
						const token = /** @type {Token} */ ({
							source: node.name,
							generated: node.name,
							loc: node.loc,
						});
						if (node.name === '#') {
							// Suppress 'Invalid character' to allow typing out the shorthands
							token.metadata = {
								suppressedDiagnostics: [1127],
							};
						}
						// No transformation - source and generated names are the same
						tokens.push(token);
					}
				}
				return; // Leaf node, don't traverse further
			} else if (node.type === 'JSXIdentifier') {
				// JSXIdentifiers can also be capitalized (for dynamic components)
				if (node.loc && node.name) {
					if (node.metadata?.is_capitalized) {
						tokens.push({
							source: node.metadata.source_name,
							generated: node.name,
							loc: node.loc,
						});
					} else {
						tokens.push({ source: node.name, generated: node.name, loc: node.loc });
					}
				}
				return; // Leaf node, don't traverse further
			} else if (node.type === 'Literal' && node.raw) {
				if (node.loc) {
					tokens.push({ source: node.raw, generated: node.raw, loc: node.loc });
				}
				return; // Leaf node, don't traverse further
			} else if (node.type === 'ImportDeclaration') {
				isImportDeclarationPresent = true;

				// Add 'import' keyword token to anchor statement-level diagnostics
				// And the last character of the statement (semicolon or closing brace)
				// (e.g., when ALL imports are unused, TS reports on the whole statement)
				// We only map the 'import' and the last character
				// to avoid overlapping with individual specifier mappings
				// which would interfere when only SOME imports are unused.
				if (node.loc) {
					tokens.push({
						source: 'import',
						generated: 'import',
						loc: {
							start: node.loc.start,
							end: {
								line: node.loc.start.line,
								column: node.loc.start.column + 'import'.length,
							},
						},
					});

					tokens.push({
						source:
							source[loc_to_offset(node.loc.end.line, node.loc.end.column - 1, src_line_offsets)],
						// we always add `;' in the generated import
						generated: ';',
						loc: {
							start: {
								line: node.loc.end.line,
								column: node.loc.end.column - 1,
							},
							end: node.loc.end,
						},
					});
				}

				// Visit specifiers in source order
				if (node.specifiers) {
					for (const specifier of node.specifiers) {
						visit(specifier);
					}
				}
				visit(node.source);
				return;
			} else if (node.type === 'ImportSpecifier') {
				// If local and imported are the same, only visit local to avoid duplicates
				// Otherwise visit both in order
				if (
					node.imported &&
					node.local &&
					/** @type {AST.Identifier} */ (node.imported).name !== node.local.name
				) {
					visit(node.imported);
					visit(node.local);
				} else if (node.local) {
					visit(node.local);
				}
				return;
			} else if (
				node.type === 'ImportDefaultSpecifier' ||
				node.type === 'ImportNamespaceSpecifier'
			) {
				// Just visit local
				if (node.local) {
					visit(node.local);
				}
				return;
			} else if (node.type === 'ExportSpecifier') {
				// If local and exported are the same, only visit local to avoid duplicates
				// Otherwise visit both in order
				if (
					node.local &&
					node.exported &&
					/** @type {AST.Identifier} */ (node.local).name !==
						/** @type {AST.Identifier} */ (node.exported).name
				) {
					visit(node.local);
					visit(node.exported);
				} else if (node.local) {
					visit(node.local);
				}
				return;
			} else if (node.type === 'ExportNamedDeclaration') {
				if (node.specifiers && node.specifiers.length > 0) {
					for (const specifier of node.specifiers) {
						visit(specifier);
					}
				}
				if (node.declaration) {
					// The declaration will be visited with proper ordering
					visit(node.declaration);
				}
				return;
			} else if (node.type === 'ExportDefaultDeclaration') {
				// Visit the declaration
				if (node.declaration) {
					visit(/** @type {AST.Node} */ (node.declaration));
				}
				return;
			} else if (node.type === 'ExportAllDeclaration') {
				// Nothing to visit (just source string)
				return;
			} else if (node.type === 'JSXOpeningElement') {
				// Visit name and attributes in source order
				if (node.name) {
					visit(node.name);
				}
				if (node.attributes) {
					for (const attr of node.attributes) {
						visit(attr);
					}
				}
				return;
			} else if (node.type === 'JSXAttribute') {
				// Visit name and value in source order
				// For shorthand attributes ({ count }), key and value are the same node, only visit once
				if (node.shorthand) {
					if (node.value) {
						visit(node.value);
					}
				} else {
					const attr =
						node.name.name === 'class' && node.value?.type === 'JSXExpressionContainer'
							? node.value.expression
							: node.value;

					const css = attr
						? css_element_info.get(`${attr.loc?.start.line}:${attr.loc?.start.column}`)
						: null;

					if (attr && css) {
						// Extract class names from the attribute value
						const classes = extract_classes(
							attr,
							src_to_gen_map,
							gen_line_offsets,
							src_line_offsets,
						);

						// For each class name, look up CSS location and create token
						for (const { name, line, column, offset, sourceOffset, length } of classes) {
							const cssLocation = css.scopedClasses.get(name);

							if (!cssLocation) {
								continue;
							}

							mappings.push({
								sourceOffsets: [sourceOffset],
								generatedOffsets: [offset],
								lengths: [length],
								generatedLengths: [length],
								data: {
									...mapping_data,
									customData: {
										generatedLengths: [length],
										hover: {
											contents:
												'```css\n.' +
												name +
												'\n```\n\nCSS class selector.\n\nUse **Cmd+Click** (macOS) or **Ctrl+Click** (Windows/Linux) to navigate to its definition.',
										},
										definition: {
											description: `CSS class selector for '.${name}'`,
											location: {
												embeddedId: get_style_region_id(css.hash),
												start: cssLocation.start,
												end: cssLocation.end,
											},
										},
									},
								},
							});
						}
					} else {
						if (node.name) {
							visit(node.name);
						}
						if (node.value) {
							visit(node.value);
						}
					}
				}
				return;
			} else if (node.type === 'JSXSpreadAttribute') {
				// Visit the spread argument
				if (node.argument) {
					visit(node.argument);
				}
				return;
			} else if (node.type === 'JSXExpressionContainer') {
				// Visit the expression inside {}
				if (node.expression) {
					visit(node.expression);
				}
				return;
			} else if (node.type === 'JSXText') {
				// Text content, no tokens to collect
				return;
			} else if (node.type === 'JSXElement') {
				// Manually visit in source order: opening element, children, closing element

				// 1. Visit opening element (name and attributes)
				if (node.openingElement) {
					// Add tokens for '<' and '>' brackets to ensure auto-close feature works
					const openingElem = node.openingElement;

					// Add '<' bracket
					if (openingElem.loc) {
						tokens.push({
							source: '<',
							generated: '<',
							loc: {
								start: { line: openingElem.loc.start.line, column: openingElem.loc.start.column },
								end: { line: openingElem.loc.start.line, column: openingElem.loc.start.column + 1 },
							},
						});
					}

					visit(node.openingElement);

					// Add '>' bracket (or '/>' for self-closing)
					if (openingElem.loc && !openingElem.selfClosing) {
						tokens.push({
							source: '>',
							generated: '>',
							loc: {
								start: { line: openingElem.loc.end.line, column: openingElem.loc.end.column - 1 },
								end: { line: openingElem.loc.end.line, column: openingElem.loc.end.column },
							},
						});
					}
				}

				// 2. Visit children in order
				if (node.children) {
					for (const child of node.children) {
						visit(/** @type {AST.Node} */ (child));
					}
				}

				// 3. Push closing tag name (not visited by AST walker)
				if (
					!node.openingElement?.selfClosing &&
					node.closingElement?.name?.type === 'JSXIdentifier'
				) {
					const closingNameNode = /** @type {ESTreeJSX.JSXIdentifier & AST.NodeWithLocation} */ (
						node.closingElement.name
					);
					if (closingNameNode.metadata?.is_capitalized) {
						tokens.push({
							source: closingNameNode.metadata.source_name,
							generated: closingNameNode.name,
							loc: closingNameNode.loc,
						});
					} else {
						tokens.push({
							source: closingNameNode.name,
							generated: closingNameNode.name,
							loc: closingNameNode.loc,
						});
					}
				}

				return;
			} else if (
				node.type === 'FunctionDeclaration' ||
				node.type === 'FunctionExpression' ||
				node.type === 'ArrowFunctionExpression'
			) {
				// Add function/component keyword token
				if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression') {
					const node_fn = /** @type (typeof node) & AST.NodeWithLocation */ (node);
					const source_func_keyword = node.metadata?.was_component ? 'component' : 'function';
					let start_col = node_fn.loc.start.column;
					const async_keyword = 'async';

					// We explicitly mapped async and function in esrap
					if (node_fn.async) {
						tokens.push({
							source: async_keyword,
							generated: async_keyword,
							loc: {
								start: { line: node_fn.loc.start.line, column: start_col },
								end: {
									line: node_fn.loc.start.line,
									column: start_col + async_keyword.length,
								},
							},
						});

						start_col += async_keyword.length + 1; // +1 for space
					}

					tokens.push({
						source: source_func_keyword,
						generated: 'function',
						loc: {
							start: { line: node_fn.loc.start.line, column: start_col },
							end: {
								line: node_fn.loc.start.line,
								column: start_col + source_func_keyword.length,
							},
						},
					});
				}

				// Visit in source order: id, params, body
				if (/** @type {AST.FunctionDeclaration | AST.FunctionExpression} */ (node).id) {
					visit(/** @type {AST.FunctionDeclaration | AST.FunctionExpression} */ (node).id);
				}
				if (node.params) {
					for (const param of node.params) {
						visit(param);
						if (param.typeAnnotation) {
							visit(param.typeAnnotation);
						}
					}
				}
				if (node.body) {
					visit(node.body);
				}
				return;
			} else if (node.type === 'VariableDeclaration') {
				// Visit declarators in order
				if (node.declarations) {
					for (const declarator of node.declarations) {
						visit(declarator);
					}
				}
				return;
			} else if (node.type === 'VariableDeclarator') {
				// Visit in source order: id, typeAnnotation, init
				if (node.id) {
					visit(node.id);
					// Visit type annotation if present
					if (node.id.typeAnnotation) {
						visit(node.id.typeAnnotation);
					}
				}
				if (node.init) {
					visit(node.init);
				}
				return;
			} else if (node.type === 'IfStatement') {
				// Visit in source order: test, consequent, alternate
				if (node.test) {
					visit(node.test);
				}
				if (node.consequent) {
					visit(node.consequent);
				}
				if (node.alternate) {
					visit(node.alternate);
				}
				return;
			} else if (node.type === 'ForStatement') {
				// Visit in source order: init, test, update, body
				if (node.init) {
					visit(node.init);
				}
				if (node.test) {
					visit(node.test);
				}
				if (node.update) {
					visit(node.update);
				}
				if (node.body) {
					visit(node.body);
				}
				return;
			} else if (node.type === 'ForOfStatement' || node.type === 'ForInStatement') {
				// Visit in source order: left, right, index (Ripple-specific), body
				if (node.left) {
					visit(node.left);
				}
				if (node.right) {
					visit(node.right);
				}
				// Ripple-specific: index variable
				if (/** @type {AST.ForOfStatement} */ (node).index) {
					visit(/** @type {AST.ForOfStatement} */ (node).index);
				}
				if (node.body) {
					visit(node.body);
				}
				return;
			} else if (node.type === 'WhileStatement' || node.type === 'DoWhileStatement') {
				// Visit in source order: test, body (while) or body, test (do-while)
				if (node.type === 'WhileStatement') {
					if (node.test) {
						visit(node.test);
					}
					if (node.body) {
						visit(node.body);
					}
				} else {
					if (node.body) {
						visit(node.body);
					}
					if (node.test) {
						visit(node.test);
					}
				}
				return;
			} else if (node.type === 'TryStatement') {
				// Visit in source order: block, pending, handler, finalizer
				if (node.block) {
					visit(node.block);
				}
				if (node.pending) {
					// Add a special token for the 'pending' keyword with customData
					// to suppress TypeScript diagnostics and provide custom hover/definition
					const pending = /** @type {(typeof node.pending) & AST.NodeWithLocation} */ (
						node.pending
					);
					const pendingKeywordLoc = {
						start: {
							line: pending.loc.start.line,
							column: pending.loc.start.column - 'pending '.length,
						},
						end: {
							line: pending.loc.start.line,
							column: pending.loc.start.column - 1,
						},
					};
					tokens.push({
						source: 'pending',
						generated: 'pending',
						loc: pendingKeywordLoc,
						metadata: {
							wordHighlight: {
								/** @type {DocumentHighlightKind} */
								kind: 1,
							},
							suppressedDiagnostics: [
								1472, // 'catch' or 'finally' expected
								2304, // Cannot find name 'pending'
							],
							// suppress all hovers
							hover: false,

							// Example of a custom hover contents (uses markdown)
							// hover: {
							// 	contents:
							// 		'```ripple\npending\n```\n\nRipple-specific keyword for try/pending blocks.\n\nThe `pending` block executes while async operations inside the `try` block are awaiting. This provides a built-in loading state for async components.',
							// },

							// Example of a custom definition and its type definition file
							// definition: {
							// 	typeReplace: {
							// 		name: 'SomeType',
							// 		path: 'types/index.d.ts',
							// 	},
							// },
						},
					});
					visit(node.pending);
				}
				if (node.handler) {
					visit(node.handler);
				}
				if (node.finalizer) {
					visit(node.finalizer);
				}
				return;
			} else if (node.type === 'CatchClause') {
				// Visit in source order: param, body
				if (node.param) {
					visit(node.param);
				}
				if (node.body) {
					visit(node.body);
				}
				return;
			} else if (node.type === 'CallExpression' || node.type === 'NewExpression') {
				// Visit in source order: callee, arguments
				if (node.callee) {
					visit(node.callee);
				}
				if (node.arguments) {
					for (const arg of node.arguments) {
						visit(arg);
					}
				}
				return;
			} else if (node.type === 'LogicalExpression' || node.type === 'BinaryExpression') {
				// Visit in source order: left, right
				if (node.left) {
					visit(node.left);
				}
				if (node.right) {
					visit(node.right);
				}
				return;
			} else if (node.type === 'MemberExpression') {
				// Visit in source order: object, property
				if (node.object) {
					visit(node.object);
				}
				if (node.computed && node.property && node.loc) {
					// Need to cover the whole computed property ['something'] or obj[expr]:
					// Add a mapping for the closing bracket ']'
					// ESRap sourcemap includes the opening bracket '[' in the property loc,
					// but for the closing bracket it also includes what comes after it
					// so we never get the mapping that covers just the computed property.
					tokens.push({
						source: ']',
						generated: ']',
						loc: {
							start: {
								line: node.loc.end.line,
								column: node.loc.end.column - 1,
							},
							end: node.loc.end,
						},
					});

					// Also visit the property for its own mapping
					visit(node.property);
				} else if (!node.computed && node.property) {
					visit(node.property);
				}
				return;
			} else if (node.type === 'AssignmentExpression' || node.type === 'AssignmentPattern') {
				// Visit in source order: left, typeAnnotation, right
				if (node.left) {
					visit(node.left);
					// Visit type annotation if present (for AssignmentPattern)
					if (node.left.typeAnnotation) {
						visit(node.left.typeAnnotation);
					}
				}
				if (node.right) {
					visit(node.right);
				}
				return;
			} else if (node.type === 'ObjectExpression' || node.type === 'ObjectPattern') {
				// Visit properties in order
				if (node.properties) {
					for (const prop of node.properties) {
						visit(prop);
					}
				}
				return;
			} else if (node.type === 'Property') {
				// Visit in source order: key, value
				// For shorthand properties ({ count }), key and value are the same node, only visit once
				if (node.shorthand) {
					if (node.value) {
						visit(node.value);
					}
				} else {
					if (node.key) {
						visit(node.key);
					}
					if (node.value) {
						visit(node.value);
					}
				}
				return;
			} else if (node.type === 'ArrayExpression' || node.type === 'ArrayPattern') {
				// Visit elements in order
				if (node.elements) {
					for (const element of node.elements) {
						if (element) visit(element);
					}
				}
				return;
			} else if (node.type === 'ConditionalExpression') {
				// Visit in source order: test, consequent, alternate
				if (node.test) {
					visit(node.test);
				}
				if (node.consequent) {
					visit(node.consequent);
				}
				if (node.alternate) {
					visit(node.alternate);
				}
				return;
			} else if (node.type === 'UnaryExpression' || node.type === 'UpdateExpression') {
				// Visit argument
				if (node.argument) {
					visit(node.argument);
				}
				return;
			} else if (node.type === 'TemplateLiteral') {
				// Visit quasis and expressions in order
				for (let i = 0; i < node.quasis.length; i++) {
					if (node.quasis[i]) {
						visit(node.quasis[i]);
					}
					if (i < node.expressions.length && node.expressions[i]) {
						visit(node.expressions[i]);
					}
				}
				return;
			} else if (node.type === 'TaggedTemplateExpression') {
				// Visit in source order: tag, quasi
				if (node.tag) {
					visit(node.tag);
				}
				if (node.quasi) {
					visit(node.quasi);
				}
				return;
			} else if (node.type === 'ReturnStatement' || node.type === 'ThrowStatement') {
				// Visit argument
				if (node.argument) {
					visit(node.argument);
				}
				return;
			} else if (node.type === 'ExpressionStatement') {
				// Visit expression
				if (node.expression) {
					visit(node.expression);
				}
				return;
			} else if (node.type === 'BlockStatement' || node.type === 'Program') {
				// Visit body statements in order
				if (node.body) {
					for (const statement of node.body) {
						visit(statement);
					}
				}
				return;
			} else if (node.type === 'SwitchStatement') {
				// Visit in source order: discriminant, cases
				if (node.discriminant) {
					visit(node.discriminant);
				}
				if (node.cases) {
					for (const caseNode of node.cases) {
						visit(caseNode);
					}
				}
				return;
			} else if (node.type === 'SwitchCase') {
				// Visit in source order: test, consequent
				if (node.test) {
					visit(node.test);
				}
				if (node.consequent) {
					for (const statement of node.consequent) {
						visit(statement);
					}
				}
				return;
			} else if (node.type === 'ClassDeclaration' || node.type === 'ClassExpression') {
				// Visit in source order: id, superClass, body
				if (node.id) {
					visit(node.id);
				}
				if (node.superClass) {
					visit(node.superClass);
				}
				if (node.body) {
					visit(node.body);
				}
				return;
			} else if (node.type === 'ClassBody') {
				// Visit body in order
				if (node.body) {
					for (const member of node.body) {
						visit(member);
					}
				}
				return;
			} else if (node.type === 'MethodDefinition') {
				// Visit in source order: key, value
				if (node.key) {
					visit(node.key);
				}
				if (node.value) {
					visit(node.value);
				}
				return;
			} else if (node.type === 'SequenceExpression') {
				// Visit expressions in order
				if (node.expressions) {
					for (const expr of node.expressions) {
						visit(expr);
					}
				}
				return;
			} else if (node.type === 'SpreadElement' || node.type === 'RestElement') {
				// Visit the argument
				if (node.argument) {
					visit(node.argument);
					// Visit type annotation if present (for RestElement)
					if (/** @type {AST.Pattern} */ (node.argument).typeAnnotation) {
						visit(/** @type {AST.Pattern} */ (node.argument).typeAnnotation);
					}
				}
				// RestElement itself can have typeAnnotation
				if (node.typeAnnotation) {
					visit(node.typeAnnotation);
				}
				return;
			} else if (node.type === 'YieldExpression' || node.type === 'AwaitExpression') {
				// Visit the argument if present
				if (node.argument) {
					visit(node.argument);
				}
				return;
			} else if (node.type === 'ChainExpression') {
				// Visit the expression
				if (node.expression) {
					visit(node.expression);
				}
				return;
			} else if (node.type === 'Super' || node.type === 'ThisExpression') {
				// Leaf nodes, no children
				return;
			} else if (node.type === 'MetaProperty') {
				// Visit meta and property (e.g., new.target, import.meta)
				if (node.meta) {
					visit(node.meta);
				}
				if (node.property) {
					visit(node.property);
				}
				return;
			} else if (node.type === 'EmptyStatement' || node.type === 'DebuggerStatement') {
				// No children to visit
				return;
			} else if (node.type === 'LabeledStatement') {
				// Visit label and statement
				if (node.label) {
					visit(node.label);
				}
				if (node.body) {
					visit(node.body);
				}
				return;
			} else if (node.type === 'BreakStatement' || node.type === 'ContinueStatement') {
				// Visit label if present
				if (node.label) {
					visit(node.label);
				}
				return;
			} else if (node.type === 'WithStatement') {
				// Visit object and body
				if (node.object) {
					visit(node.object);
				}
				if (node.body) {
					visit(node.body);
				}
				return;
			} else if (node.type === 'JSXFragment') {
				// Visit children in order
				if (node.children) {
					for (const child of node.children) {
						visit(/** @type {AST.Node} */ (child));
					}
				}
				return;
			} else if (
				node.type === 'JSXClosingElement' ||
				node.type === 'JSXClosingFragment' ||
				node.type === 'JSXOpeningFragment'
			) {
				// These are handled by their parent nodes
				return;
			} else if (node.type === 'JSXMemberExpression') {
				// Visit object and property (e.g., <Foo.Bar>)
				if (node.object) {
					visit(node.object);
				}
				if (node.property) {
					visit(node.property);
				}
				return;
			} else if (node.type === 'JSXNamespacedName') {
				// Visit namespace and name (e.g., <svg:circle>)
				if (node.namespace) {
					visit(node.namespace);
				}
				if (node.name) {
					visit(node.name);
				}
				return;
			} else if (node.type === 'JSXEmptyExpression') {
				// No children
				return;
			} else if (node.type === 'TemplateElement') {
				// Leaf node, no children to visit
				return;
			} else if (node.type === 'Literal') {
				// Leaf node - literals have no children to visit
				return;
			} else if (node.type === 'PrivateIdentifier') {
				// Leaf node
				return;
			} else if (node.type === 'PropertyDefinition') {
				// Visit key and value
				if (node.key) {
					visit(node.key);
				}
				if (node.value) {
					visit(node.value);
				}
				return;
			} else if (node.type === 'StaticBlock') {
				// Visit body
				if (node.body) {
					for (const statement of node.body) {
						visit(statement);
					}
				}
				return;
			} else if (node.type === 'ImportExpression') {
				// Visit source
				if (node.source) {
					visit(node.source);
				}
				return;
			} else if (node.type === 'ParenthesizedExpression') {
				// Visit the wrapped expression
				if (node.expression) {
					visit(node.expression);
				}
				return;
			} else if (node.type === 'TSAsExpression' || node.type === 'TSSatisfiesExpression') {
				// Type assertion: value as Type
				if (node.expression) {
					visit(node.expression);
				}
				// Skip typeAnnotation
				return;
			} else if (node.type === 'TSNonNullExpression') {
				// Non-null assertion: value!
				if (node.expression) {
					visit(node.expression);
				}
				return;
			} else if (node.type === 'TSTypeAssertion') {
				// Type assertion: <Type>value
				if (node.expression) {
					visit(node.expression);
				}
				// Skip typeAnnotation
				return;
			} else if (
				node.type === 'TSTypeParameterInstantiation' ||
				node.type === 'TSTypeParameterDeclaration'
			) {
				// Generic type parameters - visit to collect type variable names
				if (node.params) {
					for (const param of node.params) {
						visit(param);
					}
				}
				return;
			} else if (node.type === 'TSTypeParameter') {
				// Type parameter like T in <T> or key in mapped types
				// Note: node.name is a string, not an Identifier node
				if (node.name && node.loc && typeof node.name === 'string') {
					tokens.push({ source: node.name, generated: node.name, loc: node.loc });
				} else if (node.name && typeof node.name === 'object') {
					// In some cases, name might be an Identifier node
					visit(node.name);
				}
				if (node.constraint) {
					visit(node.constraint);
				}
				if (node.default) {
					visit(node.default);
				}
				return;
			} else if (node.type === 'TSTypeAnnotation') {
				// Type annotation - visit the type
				if (node.typeAnnotation) {
					visit(node.typeAnnotation);
				}
				return;
			} else if (node.type === 'TSTypeReference') {
				// Type reference like "string" or "Array<T>"
				if (node.typeName) {
					visit(node.typeName);
				}

				// typeParameters and typeArguments (different parsers use different names)
				// tsTypeParameters is a bug in the estree-typescript
				// but we fixed in the analyzer to typeArguments.

				if (node.typeArguments) {
					visit(node.typeArguments);
				}
				return;
			} else if (node.type === 'TSQualifiedName') {
				// Qualified name (e.g., Foo.Bar in types)
				if (node.left) {
					visit(node.left);
				}
				if (node.right) {
					visit(node.right);
				}
				return;
			} else if (node.type === 'TSArrayType') {
				// Array type like T[]
				if (node.elementType) {
					visit(node.elementType);
				}
				return;
			} else if (node.type === 'TSTupleType') {
				// Tuple type like [string, number]
				if (node.elementTypes) {
					for (const type of node.elementTypes) {
						visit(type);
					}
				}
				return;
			} else if (node.type === 'TSUnionType' || node.type === 'TSIntersectionType') {
				// Union (A | B) or Intersection (A & B) types
				if (node.types) {
					for (const type of node.types) {
						visit(type);
					}
				}
				return;
			} else if (node.type === 'TSFunctionType' || node.type === 'TSConstructorType') {
				// Function or constructor type
				if (node.typeParameters) {
					visit(node.typeParameters);
				}
				if (node.parameters) {
					for (const param of node.parameters) {
						visit(param);
						// Visit type annotation on the parameter
						if (
							/** @type {Exclude<AST.Parameter, AST.TSParameterProperty>} */ (param).typeAnnotation
						) {
							visit(
								/** @type {Exclude<AST.Parameter, AST.TSParameterProperty>} */ (param)
									.typeAnnotation,
							);
						}
					}
				}
				if (node.typeAnnotation) {
					visit(node.typeAnnotation);
				}
				return;
			} else if (node.type === 'TSTypeLiteral') {
				// Object type literal { foo: string }
				if (node.members) {
					for (const member of node.members) {
						visit(member);
					}
				}
				return;
			} else if (node.type === 'TSPropertySignature') {
				// Property signature in type
				if (node.key) {
					visit(node.key);
				}
				if (node.typeAnnotation) {
					visit(node.typeAnnotation);
				}
				return;
			} else if (node.type === 'TSMethodSignature') {
				// Method signature in type
				if (node.key) {
					visit(node.key);
				}
				if (node.typeParameters) {
					visit(node.typeParameters);
				}
				if (node.parameters) {
					for (const param of node.parameters) {
						visit(param);
						// Visit type annotation on the parameter
						if (
							/** @type {Exclude<AST.Parameter, AST.TSParameterProperty>} */ (param).typeAnnotation
						) {
							visit(
								/** @type {Exclude<AST.Parameter, AST.TSParameterProperty>} */ (param)
									.typeAnnotation,
							);
						}
					}
				}
				if (node.typeAnnotation) {
					visit(node.typeAnnotation);
				}
				return;
			} else if (node.type === 'TSIndexSignature') {
				// Index signature [key: string]: Type
				if (node.parameters) {
					for (const param of node.parameters) {
						visit(param);
						// Visit type annotation on the parameter
						if (
							/** @type {Exclude<AST.Parameter, AST.TSParameterProperty>} */ (param).typeAnnotation
						) {
							visit(
								/** @type {Exclude<AST.Parameter, AST.TSParameterProperty>} */ (param)
									.typeAnnotation,
							);
						}
					}
				}
				if (node.typeAnnotation) {
					visit(node.typeAnnotation);
				}
				return;
			} else if (
				node.type === 'TSCallSignatureDeclaration' ||
				node.type === 'TSConstructSignatureDeclaration'
			) {
				// Call or construct signature
				if (node.typeParameters) {
					visit(node.typeParameters);
				}
				if (node.parameters) {
					for (const param of node.parameters) {
						visit(param);
						// Visit type annotation on the parameter
						if (
							/** @type {Exclude<AST.Parameter, AST.TSParameterProperty>} */ (param).typeAnnotation
						) {
							visit(
								/** @type {Exclude<AST.Parameter, AST.TSParameterProperty>} */ (param)
									.typeAnnotation,
							);
						}
					}
				}
				if (node.typeAnnotation) {
					visit(node.typeAnnotation);
				}
				return;
			} else if (node.type === 'TSConditionalType') {
				// Conditional type: T extends U ? X : Y
				if (node.checkType) {
					visit(node.checkType);
				}
				if (node.extendsType) {
					visit(node.extendsType);
				}
				if (node.trueType) {
					visit(node.trueType);
				}
				if (node.falseType) {
					visit(node.falseType);
				}
				return;
			} else if (node.type === 'TSInferType') {
				// Infer type: infer T
				if (node.typeParameter) {
					visit(node.typeParameter);
				}
				return;
			} else if (node.type === 'TSParenthesizedType') {
				// Parenthesized type: (T)
				if (node.typeAnnotation) {
					visit(node.typeAnnotation);
				}
				return;
			} else if (node.type === 'TSTypeOperator') {
				// Type operator: keyof T, readonly T
				if (node.typeAnnotation) {
					visit(node.typeAnnotation);
				}
				return;
			} else if (node.type === 'TSIndexedAccessType') {
				// Indexed access: T[K]
				if (node.objectType) {
					visit(node.objectType);
				}
				if (node.indexType) {
					visit(node.indexType);
				}
				return;
			} else if (node.type === 'TSMappedType') {
				// Mapped type: { [K in keyof T]: ... }
				if (node.typeParameter) {
					visit(node.typeParameter);
				}
				if (node.typeAnnotation) {
					visit(node.typeAnnotation);
				}
				return;
			} else if (node.type === 'TSLiteralType') {
				// Literal type: "foo" | 123 | true
				if (node.literal) {
					visit(node.literal);
				}
				return;
			} else if (node.type === 'TSExpressionWithTypeArguments') {
				// Expression with type arguments: Foo<Bar>
				if (node.expression) {
					visit(node.expression);
				}
				if (node.typeParameters) {
					visit(node.typeParameters);
				}
				return;
			} else if (node.type === 'TSImportType') {
				// Import type: import("module").Type
				if (node.argument) {
					visit(node.argument);
				}
				if (node.qualifier) {
					visit(node.qualifier);
				}
				if (node.typeParameters) {
					visit(node.typeParameters);
				}
				return;
			} else if (node.type === 'TSTypeQuery') {
				// Type query: typeof x
				if (node.exprName) {
					visit(node.exprName);
				}
				if (node.typeArguments) {
					visit(node.typeArguments);
				}
				return;
			} else if (node.type === 'TSInterfaceDeclaration') {
				// Interface declaration
				if (node.id) {
					visit(node.id);
				}
				if (node.typeParameters) {
					visit(node.typeParameters);
				}
				if (node.extends) {
					for (const ext of node.extends) {
						visit(ext);
					}
				}
				if (node.body) {
					visit(node.body);
				}
				return;
			} else if (node.type === 'TSInterfaceBody') {
				// Interface body
				if (node.body) {
					for (const member of node.body) {
						visit(member);
					}
				}
				return;
			} else if (node.type === 'TSTypeAliasDeclaration') {
				// Type alias
				if (node.id) {
					visit(node.id);
				}
				if (node.typeParameters) {
					visit(node.typeParameters);
				}
				if (node.typeAnnotation) {
					visit(node.typeAnnotation);
				}
				return;
			} else if (node.type === 'TSEnumDeclaration') {
				// Visit id and members
				if (node.id) {
					visit(node.id);
				}
				if (node.members) {
					for (const member of node.members) {
						visit(member);
					}
				}
				return;
			} else if (node.type === 'TSEnumMember') {
				// Visit id and initializer
				if (node.id) {
					visit(node.id);
				}
				if (node.initializer) {
					visit(node.initializer);
				}
				return;
			} else if (node.type === 'TSModuleDeclaration') {
				// Namespace/module declaration
				if (node.id) {
					visit(node.id);
				}
				if (node.body) {
					visit(node.body);
				}
				return;
			} else if (node.type === 'TSModuleBlock') {
				// Module body
				if (node.body) {
					for (const statement of node.body) {
						visit(statement);
					}
				}
				return;
			} else if (node.type === 'TSNamedTupleMember') {
				// Named tuple member: [name: Type]
				if (node.label) {
					visit(node.label);
				}
				if (node.elementType) {
					visit(node.elementType);
				}
				return;
			} else if (node.type === 'TSRestType') {
				// Rest type: ...T[]
				if (node.typeAnnotation) {
					visit(node.typeAnnotation);
				}
				return;
			} else if (node.type === 'TSOptionalType') {
				// Optional type: T?
				if (node.typeAnnotation) {
					visit(node.typeAnnotation);
				}
				return;
			} else if (
				node.type === 'TSAnyKeyword' ||
				node.type === 'TSUnknownKeyword' ||
				node.type === 'TSNumberKeyword' ||
				node.type === 'TSObjectKeyword' ||
				node.type === 'TSBooleanKeyword' ||
				node.type === 'TSBigIntKeyword' ||
				node.type === 'TSStringKeyword' ||
				node.type === 'TSSymbolKeyword' ||
				node.type === 'TSVoidKeyword' ||
				node.type === 'TSUndefinedKeyword' ||
				node.type === 'TSNullKeyword' ||
				node.type === 'TSNeverKeyword' ||
				node.type === 'TSThisType' ||
				node.type === 'TSIntrinsicKeyword'
			) {
				// Primitive type keywords - leaf nodes, no children
				return;
			} else if (node.type === 'TSDeclareFunction') {
				// TypeScript declare function: declare function foo(): void;
				// Visit in source order: id, typeParameters, params, returnType
				if (node.id) {
					visit(node.id);
				}
				if (node.typeParameters) {
					visit(node.typeParameters);
				}
				if (node.params) {
					for (const param of node.params) {
						visit(param);
					}
				}
				if (node.returnType) {
					visit(node.returnType);
				}
				return;
			} else if (node.type === 'TSExportAssignment') {
				// TypeScript export assignment: export = foo;
				if (node.expression) {
					visit(node.expression);
				}
				return;
			} else if (node.type === 'TSNamespaceExportDeclaration') {
				// TypeScript namespace export: export as namespace foo;
				if (node.id) {
					visit(node.id);
				}
				return;
			} else if (node.type === 'TSExternalModuleReference') {
				// TypeScript external module reference: import foo = require('bar');
				if (node.expression) {
					visit(node.expression);
				}
				return;
			}

			throw new Error(`Unhandled AST node type in mapping walker: ${node.type}`);
		},
	});

	for (const token of tokens) {
		const source_text = token.source ?? '';
		const gen_text = token.generated;
		const source_start = loc_to_offset(
			token.loc.start.line,
			token.loc.start.column,
			src_line_offsets,
		);
		const source_length = source_text.length;
		const gen_length = gen_text.length;
		const gen_line_col = get_generated_position(
			token.loc.start.line,
			token.loc.start.column,
			src_to_gen_map,
		);
		const gen_start = loc_to_offset(gen_line_col.line, gen_line_col.column, gen_line_offsets);

		/** @type {CustomMappingData} */
		const customData = {
			generatedLengths: [gen_length],
		};

		// Add optional metadata from token if present
		if (token.metadata) {
			if ('wordHighlight' in token.metadata) {
				customData.wordHighlight = token.metadata.wordHighlight;
			}
			if ('suppressedDiagnostics' in token.metadata) {
				customData.suppressedDiagnostics = token.metadata.suppressedDiagnostics;
			}
			if ('hover' in token.metadata) {
				customData.hover = token.metadata.hover;
			}
			if ('definition' in token.metadata) {
				customData.definition = token.metadata.definition;
			}
		}

		mappings.push({
			sourceOffsets: [source_start],
			generatedOffsets: [gen_start],
			lengths: [source_length],
			generatedLengths: [gen_length],
			data: {
				...mapping_data,
				customData,
			},
		});
	}

	// Sort mappings by source offset	// Sort mappings by source offset
	mappings.sort((a, b) => a.sourceOffsets[0] - b.sourceOffsets[0]);

	// Add a mapping for the very beginning of the file to handle import additions
	// This ensures that code actions adding imports at the top work correctly
	if (!isImportDeclarationPresent && mappings.length > 0 && mappings[0].sourceOffsets[0] > 0) {
		mappings.unshift({
			sourceOffsets: [0],
			generatedOffsets: [0],
			lengths: [1],
			generatedLengths: [1],
			data: {
				...mapping_data,
				customData: {
					generatedLengths: [1],
				},
			},
		});
	}

	/** @type {CodeMapping[]} */
	const cssMappings = [];
	for (let i = 0; i < css_regions.length; i++) {
		const region = css_regions[i];
		cssMappings.push({
			sourceOffsets: [region.start],
			generatedOffsets: [0],
			lengths: [region.content.length],
			generatedLengths: [region.content.length],
			data: {
				...mapping_data,
				customData: {
					generatedLengths: [region.content.length],
					embeddedId: region.id,
					content: region.content,
				},
			},
		});
	}

	return {
		code: generated_code,
		mappings,
		cssMappings,
	};
}
