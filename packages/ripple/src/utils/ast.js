import * as b from './builders.js';

export function object(expression) {
  while (expression.type === 'MemberExpression') {
    expression = /** @type {ESTree.MemberExpression | ESTree.Identifier} */ (expression.object);
  }

  if (expression.type !== 'Identifier') {
    return null;
  }

  return expression;
}

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

export function extract_identifiers(pattern) {
  return unwrap_pattern(pattern, []).filter((node) => node.type === 'Identifier');
}

export function extract_paths(param) {
  return _extract_paths(
    [],
    param,
    (node) => /** @type {ESTree.Identifier | ESTree.MemberExpression} */ (node),
    (node) => /** @type {ESTree.Identifier | ESTree.MemberExpression} */ (node),
    false,
  );
}

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
            /** @type {ESTree.Expression[]} */
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

export function build_fallback(expression, fallback) {
  return b.call('_$_.fallback', expression, fallback);
}

/**
 * @param {ESTree.AssignmentOperator} operator
 * @param {ESTree.Identifier | ESTree.MemberExpression} left
 * @param {ESTree.Expression} right
 */
export function build_assignment_value(operator, left, right) {
  return operator === '='
    ? right
    : // turn something like x += 1 into x = x + 1
      b.binary(/** @type {ESTree.BinaryOperator} */ (operator.slice(0, -1)), left, right);
}
