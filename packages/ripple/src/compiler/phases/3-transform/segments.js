	import { walk } from 'zimmerframe';

export const mapping_data = {
	verification: true,
	completion: true,
	semantic: true,
	navigation: true,
};

/**
 * Create Volar mappings by walking the transformed AST
 * @param {any} ast - The transformed AST
 * @param {string} source - Original source code
 * @param {string} generated_code - Generated code from esrap
 * @returns {object}
 */
export function convert_source_map_to_mappings(ast, source, generated_code) {
	/** @type {Array<{sourceOffsets: number[], generatedOffsets: number[], lengths: number[], data: any}>} */
	const mappings = [];

	// Maintain indices that walk through source and generated code
	let sourceIndex = 0;
	let generatedIndex = 0;

	/**
	 * Find text in source string, searching character by character from sourceIndex
	 * @param {string} text - Text to find
	 * @returns {number|null} - Source position or null
	 */
	const findInSource = (text) => {
		for (let i = sourceIndex; i <= source.length - text.length; i++) {
			let match = true;
			for (let j = 0; j < text.length; j++) {
				if (source[i + j] !== text[j]) {
					match = false;
					break;
				}
			}
			if (match) {
				sourceIndex = i + text.length;
				return i;
			}
		}
		return null;
	};

	/**
	 * Find text in generated code, searching character by character from generatedIndex
	 * @param {string} text - Text to find
	 * @returns {number|null} - Generated position or null
	 */
	const findInGenerated = (text) => {
		for (let i = generatedIndex; i <= generated_code.length - text.length; i++) {
			let match = true;
			for (let j = 0; j < text.length; j++) {
				if (generated_code[i + j] !== text[j]) {
					match = false;
					break;
				}
			}
			if (match) {
				generatedIndex = i + text.length;
				return i;
			}
		}
		return null;
	};

	// Collect text tokens from AST nodes
	/** @type {string[]} */
	const tokens = [];
	
	walk(ast, null, {
		_(node, { next, visit }) {
			// Collect key node types: Identifiers, Literals, and JSX Elements
			if (node.type === 'Identifier' && node.name) {
				tokens.push(node.name);
			} else if (node.type === 'JSXIdentifier' && node.name) {
				tokens.push(node.name);
			} else if (node.type === 'Literal' && node.raw) {
				tokens.push(node.raw);
			} else if (node.type === 'ImportDeclaration') {
				// Visit specifiers in source order
				if (node.specifiers) {
					for (const specifier of node.specifiers) {
						visit(specifier);
					}
				}
				// Skip source (just a string literal)
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
			} else if (node.type === 'ExportNamedDeclaration') {
				// Visit in source order: declaration, specifiers
				if (node.declaration) {
					visit(node.declaration);
				}
				if (node.specifiers) {
					for (const specifier of node.specifiers) {
						visit(specifier);
					}
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
					tokens.push(node.closingElement.name.name);
				}
				
				return;
			} else if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') {
				// Visit in source order: id, params, body
				if (node.id) {
					visit(node.id);
				}
				if (node.params) {
					for (const param of node.params) {
						visit(param);
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
				// Visit in source order: id, init
				if (node.id) {
					visit(node.id);
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
				// Visit in source order: left, right, body
				if (node.left) {
					visit(node.left);
				}
				if (node.right) {
					visit(node.right);
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
				// Visit in source order: left, right
				if (node.left) {
					visit(node.left);
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
				if (node.key) {
					visit(node.key);
				}
				if (node.value) {
					visit(node.value);
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
			}

			next();
		}
	});

	// Process each token in order
	for (const text of tokens) {
		const sourcePos = findInSource(text);
		const genPos = findInGenerated(text);
		
		if (sourcePos !== null && genPos !== null) {
			mappings.push({
				sourceOffsets: [sourcePos],
				generatedOffsets: [genPos],
				lengths: [text.length],
				data: mapping_data,
			});
		}
	}

	// Sort mappings by source offset
	mappings.sort((a, b) => a.sourceOffsets[0] - b.sourceOffsets[0]);

	return {
		code: generated_code,
		mappings,
	};
}