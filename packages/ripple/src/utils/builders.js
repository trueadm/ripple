/** @import * as AST from 'estree' */
/** @import * as ESTreeJSX from 'estree-jsx' */

import { regex_is_valid_identifier } from './patterns.js';
import { sanitize_template_string } from './sanitize_template_string.js';

/**
 * @param {Array<AST.Expression | AST.SpreadElement | null>} elements
 * @returns {AST.ArrayExpression}
 */
export function array(elements = []) {
	return { type: 'ArrayExpression', elements, metadata: { path: [] } };
}

/**
 * @param {Array<AST.Pattern | null>} elements
 * @returns {AST.ArrayPattern}
 */
export function array_pattern(elements) {
	return { type: 'ArrayPattern', elements, metadata: { path: [] } };
}

/**
 * @param {AST.Pattern} left
 * @param {AST.Expression} right
 * @returns {AST.AssignmentPattern}
 */
export function assignment_pattern(left, right) {
	return { type: 'AssignmentPattern', left, right, metadata: { path: [] } };
}

/**
 * @param {Array<AST.Pattern>} params
 * @param {AST.BlockStatement | AST.Expression} body
 * @returns {AST.ArrowFunctionExpression}
 */
export function arrow(params, body, async = false) {
	return {
		type: 'ArrowFunctionExpression',
		params,
		body,
		expression: body.type !== 'BlockStatement',
		generator: false,
		async,
		metadata: /** @type {any} */ (null), // should not be used by codegen
	};
}

/**
 * @param {AST.Identifier} id
 * @param {AST.Pattern[]} params
 * @param {AST.Node[]} body
 * @returns {AST.Component}
 */
export function component(id, params, body) {
	return {
		type: 'Component',
		id,
		params,
		body,
		css: null,
		metadata: { path: [] },
		default: false,
	};
}

/**
 * @param {AST.AssignmentOperator} operator
 * @param {AST.Pattern} left
 * @param {AST.Expression} right
 * @returns {AST.AssignmentExpression}
 */
export function assignment(operator, left, right) {
	return { type: 'AssignmentExpression', operator, left, right, metadata: { path: [] } };
}

/**
 * @template T
 * @param {T & AST.BaseFunction} func
 * @returns {T & AST.BaseFunction}
 */
export function async(func) {
	return { ...func, async: true };
}

/**
 * @param {AST.Expression} argument
 * @returns {AST.AwaitExpression}
 */
function await_builder(argument) {
	return { type: 'AwaitExpression', argument, metadata: { path: [] } };
}

/**
 * @param {AST.BinaryOperator} operator
 * @param {AST.Expression} left
 * @param {AST.Expression} right
 * @returns {AST.BinaryExpression}
 */
export function binary(operator, left, right) {
	return { type: 'BinaryExpression', operator, left, right, metadata: { path: [] } };
}

/**
 * @param {AST.Statement[]} body
 * @returns {AST.BlockStatement}
 */
export function block(body) {
	return { type: 'BlockStatement', body, metadata: { path: [] } };
}

/**
 * @param {AST.Statement[]} body
 * @param {AST.SourceLocation | null} [loc]
 * @returns {AST.BlockStatement}
 */
export function try_item_block(body, loc) {
	return { type: 'BlockStatement', body, loc, metadata: { path: [] } };
}

/**
 * @param {string} name
 * @param {AST.Statement} body
 * @returns {AST.LabeledStatement}
 */
export function labeled(name, body) {
	return { type: 'LabeledStatement', label: id(name), body, metadata: { path: [] } };
}

/**
 * @param {string | AST.Expression} callee
 * @param {...(AST.Expression | AST.SpreadElement | false | undefined)} args
 * @returns {AST.CallExpression}
 */
export function call(callee, ...args) {
	if (typeof callee === 'string') callee = id(callee);
	args = args.slice();

	// replacing missing arguments with `void(0)`, unless they're at the end in which case remove them
	let i = args.length;
	let popping = true;
	while (i--) {
		if (!args[i]) {
			if (popping) {
				args.pop();
			} else {
				args[i] = void0;
			}
		} else {
			popping = false;
		}
	}

	return {
		type: 'CallExpression',
		callee,
		arguments: /** @type {Array<AST.Expression | AST.SpreadElement>} */ (args),
		optional: false,
		metadata: { path: [] },
	};
}

/**
 * @param {string | AST.Expression} callee
 * @param {...AST.Expression} args
 * @returns {AST.ChainExpression}
 */
export function maybe_call(callee, ...args) {
	const expression = /** @type {AST.SimpleCallExpression} */ (call(callee, ...args));
	expression.optional = true;

	return {
		type: 'ChainExpression',
		expression,
		metadata: { path: [] },
	};
}

/**
 * @param {AST.UnaryOperator} operator
 * @param {AST.Expression} argument
 * @returns {AST.UnaryExpression}
 */
export function unary(operator, argument) {
	return { type: 'UnaryExpression', argument, operator, prefix: true, metadata: { path: [] } };
}

/**
 * @param {AST.Expression} test
 * @param {AST.Expression} consequent
 * @param {AST.Expression} alternate
 * @returns {AST.ConditionalExpression}
 */
export function conditional(test, consequent, alternate) {
	return { type: 'ConditionalExpression', test, consequent, alternate, metadata: { path: [] } };
}

/**
 * @param {AST.LogicalOperator} operator
 * @param {AST.Expression} left
 * @param {AST.Expression} right
 * @returns {AST.LogicalExpression}
 */
export function logical(operator, left, right) {
	return { type: 'LogicalExpression', operator, left, right, metadata: { path: [] } };
}

/**
 * @param {'const' | 'let' | 'var'} kind
 * @param {AST.VariableDeclarator[]} declarations
 * @returns {AST.VariableDeclaration}
 */
export function declaration(kind, declarations) {
	return {
		type: 'VariableDeclaration',
		kind,
		declarations,
		metadata: { path: [] },
	};
}

/**
 * @param {AST.Pattern | string} pattern
 * @param {AST.Expression} [init]
 * @returns {AST.VariableDeclarator}
 */
export function declarator(pattern, init) {
	if (typeof pattern === 'string') pattern = id(pattern);
	return { type: 'VariableDeclarator', id: pattern, init, metadata: { path: [] } };
}

/** @type {AST.EmptyStatement} */
export const empty = {
	type: 'EmptyStatement',
	metadata: { path: [] },
};

/**
 * @param {AST.Expression | AST.MaybeNamedClassDeclaration | AST.MaybeNamedFunctionDeclaration} declaration
 * @returns {AST.ExportDefaultDeclaration}
 */
export function export_default(declaration) {
	return { type: 'ExportDefaultDeclaration', declaration, metadata: { path: [] } };
}

/**
 * @param {AST.Declaration | null} declaration
 * @param {AST.ExportSpecifier[]} [specifiers]
 * @param {AST.ImportAttribute[]} [attributes]
 * @param {AST.ExportNamedDeclaration['exportKind']} [exportKind]
 * @param {AST.Literal | null} [source]
 * @returns {AST.ExportNamedDeclaration}
 */
export function export_builder(
	declaration,
	specifiers = [],
	attributes = [],
	exportKind = 'value',
	source = null,
) {
	return {
		type: 'ExportNamedDeclaration',
		declaration,
		specifiers,
		attributes,
		exportKind,
		source,
		metadata: { path: [] },
	};
}

/**
 * @param {AST.Identifier} id
 * @param {AST.Pattern[]} params
 * @param {AST.BlockStatement} body
 * @returns {AST.FunctionDeclaration}
 */
export function function_declaration(id, params, body, async = false) {
	return {
		type: 'FunctionDeclaration',
		id,
		params,
		body,
		generator: false,
		async,
		metadata: { path: [] },
	};
}

/**
 * @param {string} name
 * @param {AST.Statement[]} body
 * @returns {AST.Property & { value: AST.FunctionExpression}}}
 */
export function get(name, body) {
	return /** @type {AST.Property & { value: AST.FunctionExpression}} */ (
		prop('get', key(name), function_builder(null, [], block(body)))
	);
}

/**
 * @param {string} name
 * @returns {AST.Identifier}
 */
export function id(name) {
	return { type: 'Identifier', name, metadata: { path: [] } };
}

/**
 * @param {string} name
 * @returns {AST.PrivateIdentifier}
 */
export function private_id(name) {
	return { type: 'PrivateIdentifier', name, metadata: { path: [] } };
}

/**
 * @param {string} local
 * @returns {AST.ImportNamespaceSpecifier}
 */
function import_namespace(local) {
	return {
		type: 'ImportNamespaceSpecifier',
		local: id(local),
		metadata: { path: [] },
	};
}

/**
 * @param {string} name
 * @param {AST.Expression} value
 * @returns {AST.Property}
 */
export function init(name, value) {
	return prop('init', key(name), value);
}

/**
 * @param {boolean | string | number | bigint | false | RegExp | null | undefined} value
 * @returns {AST.Literal}
 */
export function literal(value) {
	return /** @type {AST.Literal} */ ({ type: 'Literal', value, metadata: { path: [] } });
}

/**
 * @param {AST.Expression | AST.Super} object
 * @param {string | AST.Expression | AST.PrivateIdentifier} property
 * @param {boolean} computed
 * @param {boolean} optional
 * @returns {AST.MemberExpression}
 */
export function member(object, property, computed = false, optional = false) {
	if (typeof property === 'string') {
		property = id(property);
	}

	return { type: 'MemberExpression', object, property, computed, optional, metadata: { path: [] } };
}

/**
 * @param {string} path
 * @returns {AST.Identifier | AST.MemberExpression}
 */
export function member_id(path) {
	const parts = path.split('.');

	/** @type {AST.Identifier | AST.MemberExpression} */
	let expression = id(parts[0]);

	for (let i = 1; i < parts.length; i += 1) {
		expression = member(expression, id(parts[i]));
	}
	return expression;
}

/**
 * @param {Array<AST.Property | AST.SpreadElement>} properties
 * @returns {AST.ObjectExpression}
 */
export function object(properties) {
	return { type: 'ObjectExpression', properties, metadata: { path: [] } };
}

/**
 * @param {Array<AST.RestElement | AST.AssignmentProperty>} properties
 * @returns {AST.ObjectPattern}
 */
export function object_pattern(properties) {
	return { type: 'ObjectPattern', properties, metadata: { path: [] } };
}

/**
 * @template {AST.Expression} Value
 * @param {AST.Property['kind']} kind
 * @param {AST.Expression } key
 * @param {Value} value
 * @param {boolean} computed
 * @returns {AST.Property}
 */
export function prop(kind, key, value, computed = false) {
	return {
		type: 'Property',
		kind,
		key,
		value,
		method: false,
		shorthand: false,
		computed,
		metadata: { path: [] },
	};
}

/**
 * @param {AST.Expression | AST.PrivateIdentifier} key
 * @param {AST.Expression | null | undefined} value
 * @param {boolean} computed
 * @param {boolean} is_static
 * @returns {AST.PropertyDefinition}
 */
export function prop_def(key, value, computed = false, is_static = false) {
	return {
		type: 'PropertyDefinition',
		key,
		value,
		computed,
		static: is_static,
		metadata: { path: [] },
	};
}

/**
 * @param {string} cooked
 * @param {boolean} tail
 * @returns {AST.TemplateElement}
 */
export function quasi(cooked, tail = false) {
	const raw = sanitize_template_string(cooked);
	return { type: 'TemplateElement', value: { raw, cooked }, tail, metadata: { path: [] } };
}

/**
 * @param {AST.Pattern} argument
 * @returns {AST.RestElement}
 */
export function rest(argument) {
	return { type: 'RestElement', argument, metadata: { path: [] } };
}

/**
 * @param {AST.Expression[]} expressions
 * @returns {AST.SequenceExpression}
 */
export function sequence(expressions) {
	return { type: 'SequenceExpression', expressions, metadata: { path: [] } };
}

/**
 * @param {string} name
 * @param {AST.Statement[]} body
 * @returns {AST.Property & { value: AST.FunctionExpression}}
 */
export function set(name, body) {
	return /** @type {AST.Property & { value: AST.FunctionExpression}} */ (
		prop('set', key(name), function_builder(null, [id('$$value')], block(body)))
	);
}

/**
 * @param {AST.Expression} argument
 * @returns {AST.SpreadElement}
 */
export function spread(argument) {
	return { type: 'SpreadElement', argument, metadata: { path: [] } };
}

/**
 * @param {AST.Expression} expression
 * @returns {AST.ExpressionStatement}
 */
export function stmt(expression) {
	return { type: 'ExpressionStatement', expression, metadata: { path: [] } };
}

/**
 * @param {AST.TemplateElement[]} elements
 * @param {AST.Expression[]} expressions
 * @returns {AST.TemplateLiteral}
 */
export function template(elements, expressions) {
	return { type: 'TemplateLiteral', quasis: elements, expressions, metadata: { path: [] } };
}

/**
 * @param {AST.Expression | AST.BlockStatement} expression
 * @param {boolean} [async]
 * @returns {ReturnType<typeof unthunk>}
 */
export function thunk(expression, async = false) {
	const fn = arrow([], expression);
	if (async) fn.async = true;
	return unthunk(fn);
}

/**
 * Replace "(arg) => func(arg)" to "func"
 * @param {AST.Expression} expression
 * @returns {AST.Expression}
 */
export function unthunk(expression) {
	if (
		expression.type === 'ArrowFunctionExpression' &&
		expression.async === false &&
		expression.body.type === 'CallExpression' &&
		expression.body.callee.type === 'Identifier' &&
		expression.params.length === expression.body.arguments.length &&
		expression.params.every((param, index) => {
			const arg = /** @type {AST.SimpleCallExpression} */ (expression.body).arguments[index];
			return param.type === 'Identifier' && arg.type === 'Identifier' && param.name === arg.name;
		})
	) {
		return expression.body.callee;
	}
	return expression;
}

/**
 *
 * @param {string | AST.Expression} expression
 * @param  {...AST.Expression} args
 * @returns {AST.NewExpression}
 */
function new_builder(expression, ...args) {
	if (typeof expression === 'string') expression = id(expression);

	return {
		callee: expression,
		arguments: args,
		type: 'NewExpression',
		metadata: { path: [] },
	};
}

/**
 * @param {AST.UpdateOperator} operator
 * @param {AST.Expression} argument
 * @param {boolean} prefix
 * @returns {AST.UpdateExpression}
 */
export function update(operator, argument, prefix = false) {
	return { type: 'UpdateExpression', operator, argument, prefix, metadata: { path: [] } };
}

/**
 * @param {AST.Expression} test
 * @param {AST.Statement} body
 * @returns {AST.DoWhileStatement}
 */
export function do_while(test, body) {
	return { type: 'DoWhileStatement', test, body, metadata: { path: [] } };
}

const true_instance = literal(true);
const false_instance = literal(false);
const null_instance = literal(null);

/** @type {AST.DebuggerStatement} */
const debugger_builder = {
	type: 'DebuggerStatement',
	metadata: { path: [] },
};

/** @type {AST.ThisExpression} */
const this_instance = {
	type: 'ThisExpression',
	metadata: { path: [] },
};

/**
 * @param {string | AST.Pattern} pattern
 * @param { AST.Expression} [init]
 * @returns {AST.VariableDeclaration}
 */
function let_builder(pattern, init) {
	return declaration('let', [declarator(pattern, init)]);
}

/**
 * @param {string | AST.Pattern} pattern
 * @param { AST.Expression} init
 * @returns {AST.VariableDeclaration}
 */
function const_builder(pattern, init) {
	return declaration('const', [declarator(pattern, init)]);
}

/**
 * @param {string | AST.Pattern} pattern
 * @param { AST.Expression} [init]
 * @returns {AST.VariableDeclaration}
 */
function var_builder(pattern, init) {
	return declaration('var', [declarator(pattern, init)]);
}

/**
 *
 * @param {AST.VariableDeclaration | AST.Expression | null} init
 * @param {AST.Expression} test
 * @param {AST.Expression} update
 * @param {AST.Statement} body
 * @returns {AST.ForStatement}
 */
function for_builder(init, test, update, body) {
	return { type: 'ForStatement', init, test, update, body, metadata: { path: [] } };
}

/**
 * @param {AST.VariableDeclaration | AST.Pattern} left
 * @param {AST.Expression} right
 * @param {AST.Statement} body
 * @param {boolean} [await_flag]
 * @returns {AST.ForOfStatement}
 */
export function for_of(left, right, body, await_flag = false) {
	return { type: 'ForOfStatement', left, right, body, await: await_flag, metadata: { path: [] } };
}

/**
 *
 * @param {'constructor' | 'method' | 'get' | 'set'} kind
 * @param {AST.Expression | AST.PrivateIdentifier} key
 * @param {AST.Pattern[]} params
 * @param {AST.Statement[]} body
 * @param {boolean} computed
 * @param {boolean} is_static
 * @returns {AST.MethodDefinition}
 */
export function method(kind, key, params, body, computed = false, is_static = false) {
	return {
		type: 'MethodDefinition',
		key,
		kind,
		value: function_builder(null, params, block(body)),
		computed,
		static: is_static,
		metadata: { path: [] },
	};
}

/**
 *
 * @param {AST.Identifier | null} id
 * @param {AST.Pattern[]} params
 * @param {AST.BlockStatement} body
 * @param {boolean} async
 * @returns {AST.FunctionExpression}
 */
function function_builder(id, params, body, async = false) {
	return {
		type: 'FunctionExpression',
		id,
		params,
		body,
		generator: false,
		async,
		metadata: { path: [] },
	};
}

/**
 * @param {AST.Expression} test
 * @param {AST.Statement} consequent
 * @param {AST.Statement | null} [alternate]
 * @returns {AST.IfStatement}
 */
function if_builder(test, consequent, alternate) {
	return { type: 'IfStatement', test, consequent, alternate, metadata: { path: [] } };
}

/**
 * @param {string} as
 * @param {string} source
 * @param {Array<AST.ImportAttribute>} attributes
 * @param {AST.ImportDeclaration['importKind']} importKind
 * @returns {AST.ImportDeclaration}
 */
export function import_all(as, source, attributes = [], importKind = 'value') {
	return {
		type: 'ImportDeclaration',
		source: literal(source),
		specifiers: [import_namespace(as)],
		attributes,
		importKind,
		metadata: { path: [] },
	};
}

/**
 * @param {Array<[string, string, AST.ImportDeclaration['importKind']]>} parts
 * @param {string} source
 * @param {Array<AST.ImportAttribute>} attributes
 * @param {AST.ImportDeclaration['importKind']} importKind
 * @returns {AST.ImportDeclaration}
 */
export function imports(parts, source, attributes = [], importKind = 'value') {
	return {
		type: 'ImportDeclaration',
		source: literal(source),
		attributes,
		specifiers: parts.map((p) => ({
			type: 'ImportSpecifier',
			imported: id(p[0]),
			local: id(p[1]),
			importKind: p.length > 2 ? p[2] : 'value',
			metadata: { path: [] },
		})),
		importKind,
		metadata: { path: [] },
	};
}

/**
 * @param {AST.Expression | null} argument
 * @returns {AST.ReturnStatement}
 */
function return_builder(argument = null) {
	return { type: 'ReturnStatement', argument, metadata: { path: [] } };
}

/**
 * @param {string} str
 * @returns {AST.ThrowStatement}
 */
export function throw_error(str) {
	return {
		type: 'ThrowStatement',
		argument: new_builder('Error', literal(str)),
		metadata: { path: [] },
	};
}

/**
 * @param {AST.BlockStatement} block
 * @param {AST.CatchClause | null} handler
 * @param {AST.BlockStatement | null} finalizer
 * @param {AST.BlockStatement | null} pending
 * @returns {AST.TryStatement}
 */
export function try_builder(block, handler = null, finalizer = null, pending = null) {
	return {
		type: 'TryStatement',
		block,
		handler,
		finalizer,
		pending,
		metadata: { path: [] },
	};
}

/**
 * @param {AST.Pattern | null} param
 * @param {AST.BlockStatement} body
 * @return {AST.CatchClause}
 */
export function catch_clause_builder(param, body) {
	return {
		type: 'CatchClause',
		param,
		body,
		metadata: { path: [] },
	};
}

export { catch_clause_builder as catch_clause };

/**
 * @param {string} name
 * @returns {AST.Expression}
 */
export function key(name) {
	return regex_is_valid_identifier.test(name) ? id(name) : literal(name);
}

/**
 * @param {ESTreeJSX.JSXIdentifier | ESTreeJSX.JSXNamespacedName} name
 * @param {AST.Literal | ESTreeJSX.JSXExpressionContainer | null} value
 * @returns {ESTreeJSX.JSXAttribute}
 */
export function jsx_attribute(name, value = null) {
	return {
		type: 'JSXAttribute',
		name,
		value,
		shorthand: false,
		metadata: { path: [] },
	};
}

/**
 * @param {ESTreeJSX.JSXOpeningElement['name']} name
 * @param {AST.Element} node
 * @param {ESTreeJSX.JSXOpeningElement['attributes']} attributes
 * @param {ESTreeJSX.JSXElement['children']} children
 * @param {ESTreeJSX.JSXClosingElement['name']} [closing_name]
 * @returns {ESTreeJSX.JSXElement}
 */
export function jsx_element(name, node, attributes = [], children = [], closing_name = name) {
	/** @type {ESTreeJSX.JSXOpeningElement} */
	const opening_element = {
		type: 'JSXOpeningElement',
		name,
		attributes,
		selfClosing: node.selfClosing ?? false,
		loc: node.loc,
		metadata: { path: [] },
	};

	/** @type {ESTreeJSX.JSXElement} */
	const element = {
		type: 'JSXElement',
		openingElement: opening_element,
		children,
		closingElement:
			node.selfClosing || node.unclosed
				? null
				: {
						type: 'JSXClosingElement',
						name: closing_name,
						loc: node.loc,
						metadata: { path: [] },
					},
		metadata: { path: [] },
	};

	return element;
}

/**
 * @param {ESTreeJSX.JSXFragment['children']} children
 * @param {ESTreeJSX.JSXOpeningFragment['attributes']} [attributes]
 * @returns {ESTreeJSX.JSXFragment}
 */
export function jsx_fragment(children = [], attributes = []) {
	return {
		type: 'JSXFragment',
		openingFragment: {
			type: 'JSXOpeningFragment',
			attributes,
			metadata: { path: [] },
		},
		closingFragment: {
			type: 'JSXClosingFragment',
			metadata: { path: [] },
		},
		children,
		metadata: { path: [] },
	};
}

/**
 * @param {AST.Expression | ESTreeJSX.JSXEmptyExpression} expression
 * @returns {ESTreeJSX.JSXExpressionContainer}
 */
export function jsx_expression_container(expression) {
	return {
		type: 'JSXExpressionContainer',
		expression,
		metadata: { path: [] },
	};
}

/**
 * @param {string} name
 * @returns {ESTreeJSX.JSXIdentifier}
 */
export function jsx_id(name) {
	return {
		type: 'JSXIdentifier',
		name,
		metadata: { path: [] },
	};
}

/**
 * @param {ESTreeJSX.JSXIdentifier | ESTreeJSX.JSXMemberExpression} object
 * @param {ESTreeJSX.JSXIdentifier} property
 * @returns {ESTreeJSX.JSXMemberExpression}
 */
export function jsx_member(object, property) {
	return {
		type: 'JSXMemberExpression',
		object,
		property,
		metadata: { path: [] },
	};
}

/**
 * @param {AST.Expression} argument
 * @returns {ESTreeJSX.JSXSpreadAttribute}
 */
export function jsx_spread_attribute(argument) {
	return {
		type: 'JSXSpreadAttribute',
		argument,
		metadata: { path: [] },
	};
}

/**
 * @param {AST.Expression} discriminant
 * @param {AST.SwitchCase[]} cases
 * @returns {AST.SwitchStatement}
 */
export function switch_builder(discriminant, cases) {
	return {
		type: 'SwitchStatement',
		discriminant,
		cases,
		metadata: { path: [] },
	};
}

/**
 * @param {AST.Expression | null} test
 * @param {AST.Statement[]} consequent
 * @returns {AST.SwitchCase}
 */
export function switch_case(test = null, consequent = []) {
	return {
		type: 'SwitchCase',
		test,
		consequent,
		metadata: { path: [] },
	};
}

export const void0 = unary('void', literal(0));

/**
 * @type {AST.BreakStatement}
 */
export const break_statement = {
	type: 'BreakStatement',
	label: null,
	metadata: { path: [] },
};

export {
	await_builder as await,
	let_builder as let,
	const_builder as const,
	var_builder as var,
	export_builder as export,
	true_instance as true,
	false_instance as false,
	break_statement as break,
	for_builder as for,
	switch_builder as switch,
	function_builder as function,
	return_builder as return,
	if_builder as if,
	this_instance as this,
	null_instance as null,
	debugger_builder as debugger,
	try_builder as try,
	new_builder as new,
};
