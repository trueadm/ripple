/** @import * as AST from 'estree' */

/**
 * Represents the path of a destructured assignment from either a declaration
 * or assignment expression. For example, given `const { foo: { bar: baz } } = quux`,
 * the path of `baz` is `foo.bar`
 * @typedef {{
 *   node: AST.Identifier | AST.MemberExpression;
 *   is_rest: boolean;
 *   has_default_value: boolean;
 *   expression: (object: AST.Identifier | AST.CallExpression) => AST.Expression;
 *   update_expression: (object: AST.Identifier) => AST.Expression;
 * }} DestructuredAssignment
 * - `node`: The node the destructuring path ends in. Can be a member expression only for assignment expressions
 * - `is_rest`: `true` if this is a `...rest` destructuring
 * - `has_default_value`: `true` if this has a fallback value like `const { foo = 'bar' } = ..`
 * - `expression`: The value of the current path. Will be a call expression if a rest element or default is involved — e.g. `const { foo: { bar: baz = 42 }, ...rest } = quux` — since we can't represent `baz` or `rest` purely as a path. Will be an await expression in case of an async default value (`const { foo = await bar } = ...`)
 * - `update_expression`: Like `expression` but without default values.
 */

import * as b from './builders.js';

/**
 * Gets the left-most identifier of a member expression or identifier.
 * @param {AST.MemberExpression | AST.Identifier} expression
 * @returns {AST.Identifier | null}
 */
export function object(expression) {
	while (expression.type === 'MemberExpression') {
		expression = /** @type {AST.MemberExpression | AST.Identifier} */ (expression.object);
	}

	if (expression.type !== 'Identifier') {
		return null;
	}

	return expression;
}

/**
 * Extracts all identifiers and member expressions from a pattern.
 * @param {AST.Pattern} pattern
 * @param {Array<AST.Identifier | AST.MemberExpression>} [nodes]
 * @returns {Array<AST.Identifier | AST.MemberExpression>}
 */
export function unwrap_pattern(pattern, nodes = []) {
	switch (pattern.type) {
		case 'Identifier':
			nodes.push(pattern);
			break;

		case 'MemberExpression':
			// member expressions can be part of an assignment pattern, but not a binding pattern
			// see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment#binding_and_assignment
			nodes.push(pattern);
			break;

		case 'ObjectPattern':
			for (const prop of pattern.properties) {
				if (prop.type === 'RestElement') {
					unwrap_pattern(prop.argument, nodes);
				} else {
					unwrap_pattern(prop.value, nodes);
				}
			}

			break;

		case 'ArrayPattern':
			for (const element of pattern.elements) {
				if (element) unwrap_pattern(element, nodes);
			}

			break;

		case 'RestElement':
			unwrap_pattern(pattern.argument, nodes);
			break;

		case 'AssignmentPattern':
			unwrap_pattern(pattern.left, nodes);
			break;
	}

	return nodes;
}

/**
 * Extracts all identifiers from a pattern.
 * @param {AST.Pattern} pattern
 * @returns {AST.Identifier[]}
 */
export function extract_identifiers(pattern) {
	return unwrap_pattern(pattern, []).filter((node) => node.type === 'Identifier');
}

/**
 * Extracts all destructured assignments from a pattern.
 * @param {AST.Node} param
 * @returns {DestructuredAssignment[]}
 */
export function extract_paths(param) {
	return _extract_paths(
		[],
		param,
		/** @param {AST.Identifier | AST.MemberExpression | AST.CallExpression} node */
		(node) => node,
		/** @param {AST.Identifier | AST.MemberExpression} node */
		(node) => node,
		false,
	);
}

/**
 * @param {DestructuredAssignment[]} assignments
 * @param {AST.Node} param
 * @param {DestructuredAssignment['expression']} expression
 * @param {DestructuredAssignment['update_expression']} update_expression
 * @param {boolean} has_default_value
 * @returns {DestructuredAssignment[]}
 */
function _extract_paths(assignments = [], param, expression, update_expression, has_default_value) {
	switch (param.type) {
		case 'Identifier':
		case 'MemberExpression':
			assignments.push({
				node: param,
				is_rest: false,
				has_default_value,
				expression,
				update_expression,
			});
			break;

		case 'ObjectPattern':
			for (const prop of param.properties) {
				if (prop.type === 'RestElement') {
					/** @type {DestructuredAssignment['expression']} */
					const rest_expression = (object) => {
						/** @type {AST.Expression[]} */
						const props = [];

						for (const p of param.properties) {
							if (p.type === 'Property' && p.key.type !== 'PrivateIdentifier') {
								if (p.key.type === 'Identifier' && !p.computed) {
									props.push(b.literal(p.key.name));
								} else if (p.key.type === 'Literal') {
									props.push(b.literal(String(p.key.value)));
								} else {
									props.push(b.call('String', p.key));
								}
							}
						}

						return b.call('_$_.exclude_from_object', expression(object), b.array(props));
					};

					if (prop.argument.type === 'Identifier') {
						assignments.push({
							node: prop.argument,
							is_rest: true,
							has_default_value,
							expression: rest_expression,
							update_expression: rest_expression,
						});
					} else {
						_extract_paths(
							assignments,
							prop.argument,
							rest_expression,
							rest_expression,
							has_default_value,
						);
					}
				} else {
					/** @type {DestructuredAssignment['expression']} */
					const object_expression = (object) =>
						b.member(expression(object), prop.key, prop.computed || prop.key.type !== 'Identifier');
					_extract_paths(
						assignments,
						prop.value,
						object_expression,
						object_expression,
						has_default_value,
					);
				}
			}

			break;

		case 'ArrayPattern':
			for (let i = 0; i < param.elements.length; i += 1) {
				const element = param.elements[i];
				if (element) {
					if (element.type === 'RestElement') {
						/** @type {DestructuredAssignment['expression']} */
						const rest_expression = (object) =>
							b.call(b.member(expression(object), 'slice'), b.literal(i));
						if (element.argument.type === 'Identifier') {
							assignments.push({
								node: element.argument,
								is_rest: true,
								has_default_value,
								expression: rest_expression,
								update_expression: rest_expression,
							});
						} else {
							_extract_paths(
								assignments,
								element.argument,
								rest_expression,
								rest_expression,
								has_default_value,
							);
						}
					} else {
						/** @type {DestructuredAssignment['expression']} */
						const array_expression = (object) => b.member(expression(object), b.literal(i), true);
						_extract_paths(
							assignments,
							element,
							array_expression,
							array_expression,
							has_default_value,
						);
					}
				}
			}

			break;

		case 'AssignmentPattern': {
			/** @type {DestructuredAssignment['expression']} */
			const fallback_expression = (object) => build_fallback(expression(object), param.right);

			if (param.left.type === 'Identifier') {
				assignments.push({
					node: param.left,
					is_rest: false,
					has_default_value: true,
					expression: fallback_expression,
					update_expression,
				});
			} else {
				_extract_paths(assignments, param.left, fallback_expression, update_expression, true);
			}

			break;
		}
	}

	return assignments;
}

/**
 * @param {AST.Expression} expression
 * @param {AST.Expression} fallback
 */
export function build_fallback(expression, fallback) {
	return b.call('_$_.fallback', expression, fallback);
}

/**
 * @param {AST.AssignmentOperator} operator
 * @param {AST.Identifier | AST.MemberExpression} left
 * @param {AST.Expression} right
 */
export function build_assignment_value(operator, left, right) {
	return operator === '='
		? right
		: // turn something like x += 1 into x = x + 1
			b.binary(/** @type {AST.BinaryOperator} */ (operator.slice(0, -1)), left, right);
}
