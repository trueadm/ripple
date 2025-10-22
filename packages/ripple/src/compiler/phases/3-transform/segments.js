import { walk } from 'zimmerframe';
import { build_source_to_generated_map, get_generated_position } from '../../source-map-utils.js';

export const mapping_data = {
	verification: true,
	completion: true,
	semantic: true,
	navigation: true,
	rename: true,
	codeActions: false, // set to false to disable auto import when importing yourself
	formatting: false, // not doing formatting through Volar, using Prettier.
	// these 3 below will be true by default
	// leaving for reference
	// hover: true,
	// definition: true,
	// references: true,
};

/**
 * @import { PostProcessingChanges } from './client/index.js';
 */

/**
 * Create Volar mappings by walking the transformed AST
 * @param {any} ast - The transformed AST
 * @param {string} source - Original source code
 * @param {string} generated_code - Generated code (returned in output, not used for searching)
 * @param {object} esrap_source_map - Esrap source map for accurate position lookup
 * @param {PostProcessingChanges } post_processing_changes - Optional post-processing changes
 * @param {number[]} line_offsets - Pre-computed line offsets array for generated code
 * @returns {{ code: string, mappings: Array<{sourceOffsets: number[], generatedOffsets: number[], lengths: number[], data: any}> }}
 */
export function convert_source_map_to_mappings(ast, source, generated_code, esrap_source_map, post_processing_changes, line_offsets) {
	/** @type {Array<{sourceOffsets: number[], generatedOffsets: number[], lengths: number[], data: any}>} */
	const mappings = [];

	// Build line offset maps for source and generated code
	// This allows us to convert line/column positions to byte offsets
	const build_line_offsets = (text) => {
		const offsets = [0]; // Line 1 starts at offset 0
		for (let i = 0; i < text.length; i++) {
			if (text[i] === '\n') {
				offsets.push(i + 1);
			}
		}
		return offsets;
	};
	const source_line_offsets = build_line_offsets(source);

	/**
	 * Convert line/column to byte offset
	 * @param {number} line
	 * @param {number} column
	 * @param {number[]} line_offsets
	 * @returns {number | null}
	 */
	const loc_to_offset = (line, column, line_offsets) => {
		if (line < 1 || line > line_offsets.length) return null;
		return line_offsets[line - 1] + column;
	};

	/**
	 * Convert generated line/column to byte offset using pre-computed line_offsets
	 * @param {number} line
	 * @param {number} column
	 * @returns {number}
	 */
	const gen_loc_to_offset = (line, column) => {
		if (line === 1) return column;
		return line_offsets[line - 1] + column;
	};

	const adjusted_source_map = build_source_to_generated_map(
		esrap_source_map,
		post_processing_changes,
		line_offsets
	);

	// Collect text tokens from AST nodes
	// All tokens must have source/generated text and loc property for accurate positioning
	/** @type {Array<{
		source: string,
		generated: string,
		is_import_statement?: boolean,
		loc: {start: {line: number, column: number}, end: {line: number, column: number}}
	}>} */
	const tokens = [];

	// We have to visit everything in generated order to maintain correct indices
	walk(ast, null, {
		_(node, { visit }) {
			// Collect key node types: Identifiers, Literals, and JSX Elements
			if (node.type === 'Identifier') {
				// Only create mappings for identifiers with location info (from source)
				// Synthesized identifiers (created by builders) don't have .loc and are skipped
				if (node.name && node.loc) {
					// Check if this identifier has tracked_shorthand metadata (e.g., TrackedMap -> #Map)
					if (node.metadata?.tracked_shorthand) {
						tokens.push({ source: node.metadata.tracked_shorthand, generated: node.name, loc: node.loc });
					} else if (node.metadata?.is_capitalized) {
						// This identifier was capitalized during transformation
						// Map the original lowercase name to the capitalized generated name
						tokens.push({ source: node.metadata.original_name, generated: node.name, loc: node.loc });
					} else {
						// No transformation - source and generated names are the same
						tokens.push({ source: node.name, generated: node.name, loc: node.loc });
					}
				}
				return; // Leaf node, don't traverse further
			} else if (node.type === 'JSXIdentifier') {
				// JSXIdentifiers can also be capitalized (for dynamic components)
				if (node.loc && node.name) {
					if (node.metadata?.is_capitalized) {
						tokens.push({ source: node.metadata.original_name, generated: node.name, loc: node.loc });
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
				// Add import declaration as a special token for full-statement mapping
				// TypeScript reports unused imports with diagnostics covering the entire statement
				if (node.loc) {
					tokens.push({
						source: '',
						generated: '',
						loc: node.loc,
						is_import_statement: true
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
				if (node.imported && node.local && node.imported.name !== node.local.name) {
					visit(node.imported);
					visit(node.local);
				} else if (node.local) {
					visit(node.local);
				}
				return;
			} else if (node.type === 'ImportDefaultSpecifier' || node.type === 'ImportNamespaceSpecifier') {
				// Just visit local
				if (node.local) {
					visit(node.local);
				}
				return;
			} else if (node.type === 'ExportSpecifier') {
				// If local and exported are the same, only visit local to avoid duplicates
				// Otherwise visit both in order
				if (node.local && node.exported && node.local.name !== node.exported.name) {
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
					visit(node.declaration);
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
					if (node.name) {
						visit(node.name);
					}
					if (node.value) {
						visit(node.value);
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
					visit(node.openingElement);
				}

				// 2. Visit children in order
				if (node.children) {
					for (const child of node.children) {
						visit(child);
					}
				}

				// 3. Push closing tag name (not visited by AST walker)
				if (!node.openingElement?.selfClosing && node.closingElement?.name?.type === 'JSXIdentifier') {
					const closingNameNode = node.closingElement.name;
					if (closingNameNode.metadata?.is_capitalized) {
						tokens.push({ source: closingNameNode.metadata.original_name, generated: closingNameNode.name, loc: closingNameNode.loc });
					} else {
						tokens.push({ source: closingNameNode.name, generated: closingNameNode.name, loc: closingNameNode.loc });
					}
				}

				return;
			} else if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') {
				// Add function/component keyword token
				if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression') {
					const source_keyword = node.metadata?.was_component ? 'component' : 'function';
					// Add token for the keyword - esrap already mapped it via context.write('function', node)
					tokens.push({
						source: source_keyword,
						generated: 'function',
						loc: {
							start: { line: node.loc.start.line, column: node.loc.start.column },
							end: { line: node.loc.start.line, column: node.loc.start.column + source_keyword.length }
						}
					});
				}

				// Visit in source order: id, params, body
				if (node.id) {
					visit(node.id);
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
				if (node.index) {
					visit(node.index);
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
				// Visit in source order: block, handler, finalizer
				if (node.block) {
					visit(node.block);
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
				if (!node.computed && node.property) {
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
					if (node.argument.typeAnnotation) {
						visit(node.argument.typeAnnotation);
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
						visit(child);
					}
				}
				return;
			} else if (node.type === 'JSXClosingElement' || node.type === 'JSXClosingFragment' || node.type === 'JSXOpeningFragment') {
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
			} else if (node.type === 'TSTypeParameterInstantiation' || node.type === 'TSTypeParameterDeclaration') {
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
				// Check both typeParameters and typeArguments (different parsers use different names)
				if (node.typeParameters) {
					visit(node.typeParameters);
				}
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
						if (param.typeAnnotation) {
							visit(param.typeAnnotation);
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
						if (param.typeAnnotation) {
							visit(param.typeAnnotation);
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
						if (param.typeAnnotation) {
							visit(param.typeAnnotation);
						}
					}
				}
				if (node.typeAnnotation) {
					visit(node.typeAnnotation);
				}
				return;
			} else if (node.type === 'TSCallSignatureDeclaration' || node.type === 'TSConstructSignatureDeclaration') {
				// Call or construct signature
				if (node.typeParameters) {
					visit(node.typeParameters);
				}
				if (node.parameters) {
					for (const param of node.parameters) {
						visit(param);
						// Visit type annotation on the parameter
						if (param.typeAnnotation) {
							visit(param.typeAnnotation);
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
			} else if (node.type === 'TSAnyKeyword' || node.type === 'TSUnknownKeyword' || node.type === 'TSNumberKeyword' || node.type === 'TSObjectKeyword' || node.type === 'TSBooleanKeyword' || node.type === 'TSBigIntKeyword' || node.type === 'TSStringKeyword' || node.type === 'TSSymbolKeyword' || node.type === 'TSVoidKeyword' || node.type === 'TSUndefinedKeyword' || node.type === 'TSNullKeyword' || node.type === 'TSNeverKeyword' || node.type === 'TSThisType' || node.type === 'TSIntrinsicKeyword') {
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
		}
	});

	// Process each token in order
	// All tokens now have .loc property - no need for fallback logic
	for (const token of tokens) {
		const source_text = token.source;

		// Handle import statement full-statement mapping
		if (token.is_import_statement) {
			// Get source position from start
			const source_start = loc_to_offset(token.loc.start.line, token.loc.start.column, source_line_offsets);
			const source_end = loc_to_offset(token.loc.end.line, token.loc.end.column, source_line_offsets);

			// Get generated positions using source map
			const gen_start_pos = get_generated_position(token.loc.start.line, token.loc.start.column, adjusted_source_map);
			const gen_end_pos = get_generated_position(token.loc.end.line, token.loc.end.column, adjusted_source_map);

			if (source_start !== null && source_end !== null && gen_start_pos && gen_end_pos) {
				// Convert generated line:col to byte offsets
				const gen_start = gen_loc_to_offset(gen_start_pos.line, gen_start_pos.column);
				const gen_end = gen_loc_to_offset(gen_end_pos.line, gen_end_pos.column);

				const source_length = source_end - source_start;
				const gen_length = gen_end - gen_start;

				mappings.push({
					sourceOffsets: [source_start],
					generatedOffsets: [gen_start],
					lengths: [Math.min(source_length, gen_length)],
					data: {
						// only verification (diagnostics) to avoid duplicate hover/completion
						verification: true
					},
				});
			}
			continue;
		}

		// Use .loc to get the exact source position
		const source_pos = loc_to_offset(token.loc.start.line, token.loc.start.column, source_line_offsets);

		// Get generated position using source map
		const gen_line_col = get_generated_position(token.loc.start.line, token.loc.start.column, adjusted_source_map);
		let gen_pos = null;
		if (gen_line_col) {
			// Convert generated line:col to byte offset
			gen_pos = gen_loc_to_offset(gen_line_col.line, gen_line_col.column);
		} else {
			// No mapping found in source map - this shouldn't happen since all tokens should have mappings
			console.warn(`[segments.js] No source map entry for token "${source_text}" at ${token.loc.start.line}:${token.loc.start.column}`);
		}

		if (source_pos !== null && gen_pos !== null) {
			mappings.push({
				sourceOffsets: [source_pos],
				generatedOffsets: [gen_pos],
				lengths: [source_text.length],
				data: mapping_data,
			});
		}
	}

	// Sort mappings by source offset	// Sort mappings by source offset
	mappings.sort((a, b) => a.sourceOffsets[0] - b.sourceOffsets[0]);

	// Add a mapping for the very beginning of the file to handle import additions
	// This ensures that code actions adding imports at the top work correctly
	if (mappings.length > 0 && mappings[0].sourceOffsets[0] > 0) {
		mappings.unshift({
			sourceOffsets: [0],
			generatedOffsets: [0],
			lengths: [1],
			data: {
				...mapping_data,
				codeActions: true, // auto-import
				rename: false, // avoid rename for a “dummy” mapping
			}
		});
	}

	return {
		code: generated_code,
		mappings,
	};
}
