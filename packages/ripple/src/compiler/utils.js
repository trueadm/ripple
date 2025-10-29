/** @import { Identifier, Pattern, Super, FunctionExpression, FunctionDeclaration, ArrowFunctionExpression, MemberExpression, AssignmentExpression, Expression, Node, AssignmentOperator, CallExpression } from 'estree' */
/** @import { Component, Element, Attribute, SpreadAttribute, ScopeInterface, Binding, RippleNode, CompilerState, TransformContext, DelegatedEventResult, TextNode } from '#compiler' */
import { build_assignment_value, extract_paths } from '../utils/ast.js';
import * as b from '../utils/builders.js';
import { get_attribute_event_name, is_delegated, is_event_attribute } from '../utils/events.js';

const regex_return_characters = /\r/g;

const VOID_ELEMENT_NAMES = [
	'area',
	'base',
	'br',
	'col',
	'command',
	'embed',
	'hr',
	'img',
	'input',
	'keygen',
	'link',
	'meta',
	'param',
	'source',
	'track',
	'wbr',
];

/**
 * Returns `true` if `name` is of a void element
 * @param {string} name
 */
/**
 * Returns true if name is a void element
 * @param {string} name
 * @returns {boolean}
 */
export function is_void_element(name) {
	return VOID_ELEMENT_NAMES.includes(name) || name.toLowerCase() === '!doctype';
}

const RESERVED_WORDS = [
	'arguments',
	'await',
	'break',
	'case',
	'catch',
	'class',
	'const',
	'continue',
	'debugger',
	'default',
	'delete',
	'do',
	'else',
	'enum',
	'eval',
	'export',
	'extends',
	'false',
	'finally',
	'for',
	'function',
	'if',
	'implements',
	'import',
	'in',
	'instanceof',
	'interface',
	'let',
	'new',
	'null',
	'package',
	'private',
	'protected',
	'public',
	'return',
	'static',
	'super',
	'switch',
	'this',
	'throw',
	'true',
	'try',
	'typeof',
	'var',
	'void',
	'while',
	'with',
	'yield',
];

/**
 * Returns true if word is a reserved JS keyword
 * @param {string} word
 * @returns {boolean}
 */
export function is_reserved(word) {
	return RESERVED_WORDS.includes(word);
}

/**
 * Attributes that are boolean, i.e. they are present or not present.
 */
const DOM_BOOLEAN_ATTRIBUTES = [
	'allowfullscreen',
	'async',
	'autofocus',
	'autoplay',
	'checked',
	'controls',
	'default',
	'disabled',
	'formnovalidate',
	'hidden',
	'indeterminate',
	'inert',
	'ismap',
	'loop',
	'multiple',
	'muted',
	'nomodule',
	'novalidate',
	'open',
	'playsinline',
	'readonly',
	'required',
	'reversed',
	'seamless',
	'selected',
	'webkitdirectory',
	'defer',
	'disablepictureinpicture',
	'disableremoteplayback',
];

/**
 * Returns true if name is a boolean DOM attribute
 * @param {string} name
 * @returns {boolean}
 */
export function is_boolean_attribute(name) {
	return DOM_BOOLEAN_ATTRIBUTES.includes(name);
}

const DOM_PROPERTIES = [
	...DOM_BOOLEAN_ATTRIBUTES,
	'formNoValidate',
	'isMap',
	'noModule',
	'playsInline',
	'readOnly',
	'value',
	'volume',
	'defaultValue',
	'defaultChecked',
	'srcObject',
	'noValidate',
	'allowFullscreen',
	'disablePictureInPicture',
	'disableRemotePlayback',
];

/**
 * Returns true if name is a DOM property
 * @param {string} name
 * @returns {boolean}
 */
export function is_dom_property(name) {
	return DOM_PROPERTIES.includes(name);
}

/**
 * Determines if an event handler can be delegated
 * @param {string} event_name
 * @param {Expression} handler
 * @param {CompilerState} state
 * @returns {boolean}
 */
export function get_delegated_event(event_name, handler, state) {
	// Handle delegated event handlers. Bail out if not a delegated event.
	if (!handler || !is_delegated(event_name)) {
		return false;
	}
	return true;
}

/**
 * Returns true if context is inside a top-level await
 * @param {TransformContext} context
 * @returns {boolean}
 */
export function is_top_level_await(context) {
	if (!is_inside_component(context)) {
		return false;
	}

	for (let i = context.path.length - 1; i >= 0; i -= 1) {
		const context_node = context.path[i];
		const type = context_node.type;

		if (/** @type {Component} */ (context_node).type === 'Component') {
			return true;
		}

		if (
			type === 'FunctionExpression' ||
			type === 'ArrowFunctionExpression' ||
			type === 'FunctionDeclaration'
		) {
			return false;
		}
	}
	return true;
}

/**
 * Returns true if context is inside a Component node
 * @param {TransformContext} context
 * @param {boolean} [includes_functions=false]
 * @returns {boolean}
 */
export function is_inside_component(context, includes_functions = false) {
	for (let i = context.path.length - 1; i >= 0; i -= 1) {
		const context_node = context.path[i];
		const type = context_node.type;

		if (
			!includes_functions &&
			(type === 'FunctionExpression' ||
				type === 'ArrowFunctionExpression' ||
				type === 'FunctionDeclaration')
		) {
			return false;
		}
		if (/** @type {Component} */ (context_node).type === 'Component') {
			return true;
		}
	}
	return false;
}

/**
 * Returns true if context is inside a component-level function
 * @param {TransformContext} context
 * @returns {boolean}
 */
export function is_component_level_function(context) {
	for (let i = context.path.length - 1; i >= 0; i -= 1) {
		const context_node = context.path[i];
		const type = context_node.type;

		if (type === 'BlockStatement' && context_node.body.find((n) => n.type === 'Component')) {
			return true;
		}

		if (
			type === 'FunctionExpression' ||
			type === 'ArrowFunctionExpression' ||
			type === 'FunctionDeclaration'
		) {
			return false;
		}
	}
	return true;
}

/**
 * Returns true if callee is a Ripple track call
 * @param {Expression | Super} callee
 * @param {TransformContext} context
 * @returns {boolean}
 */
export function is_ripple_track_call(callee, context) {
	// Super expressions cannot be Ripple track calls
	if (callee.type === 'Super') return false;

	return (
		(callee.type === 'Identifier' && (callee.name === 'track' || callee.name === 'trackSplit')) ||
		(callee.type === 'MemberExpression' &&
			callee.object.type === 'Identifier' &&
			callee.property.type === 'Identifier' &&
			(callee.property.name === 'track' || callee.property.name === 'trackSplit') &&
			!callee.computed &&
			is_ripple_import(callee, context))
	);
}

/**
 * Returns true if context is inside a call expression
 * @param {TransformContext} context
 * @returns {boolean}
 */
export function is_inside_call_expression(context) {
	for (let i = context.path.length - 1; i >= 0; i -= 1) {
		const context_node = context.path[i];
		const type = context_node.type;

		if (
			type === 'FunctionExpression' ||
			type === 'ArrowFunctionExpression' ||
			type === 'FunctionDeclaration'
		) {
			return false;
		}
		if (type === 'CallExpression') {
			const callee = context_node.callee;
			if (is_ripple_track_call(callee, context)) {
				return false;
			}
			return true;
		}
	}
	return false;
}

/**
 * Returns true if node is a static value (Literal, ArrayExpression, etc)
 * @param {Node} node
 * @returns {boolean}
 */
export function is_value_static(node) {
	if (node.type === 'Literal') {
		return true;
	}
	if (node.type === 'ArrayExpression') {
		return true;
	}
	if (node.type === 'NewExpression') {
		if (node.callee.type === 'Identifier' && node.callee.name === 'Array') {
			return true;
		}
		return false;
	}

	return false;
}

/**
 * Returns true if callee is a Ripple import
 * @param {Expression} callee
 * @param {TransformContext} context
 * @returns {boolean}
 */
export function is_ripple_import(callee, context) {
	if (callee.type === 'Identifier') {
		const binding = context.state.scope.get(callee.name);

		return (
			binding?.declaration_kind === 'import' &&
			binding.initial !== null &&
			binding.initial.type === 'ImportDeclaration' &&
			binding.initial.source.type === 'Literal' &&
			binding.initial.source.value === 'ripple'
		);
	} else if (
		callee.type === 'MemberExpression' &&
		callee.object.type === 'Identifier' &&
		!callee.computed
	) {
		const binding = context.state.scope.get(callee.object.name);

		return (
			binding?.declaration_kind === 'import' &&
			binding.initial !== null &&
			binding.initial.type === 'ImportDeclaration' &&
			binding.initial.source.type === 'Literal' &&
			binding.initial.source.value === 'ripple'
		);
	}

	return false;
}

/**
 * Returns true if node is a function declared within a component
 * @param {import('estree').Identifier} node
 * @param {TransformContext} context
 * @returns {boolean}
 */
export function is_declared_function_within_component(node, context) {
	const component = context.path?.find(/** @param {RippleNode} n */ (n) => n.type === 'Component');

	if (node.type === 'Identifier' && component) {
		const binding = context.state.scope.get(node.name);
		const component_scope = context.state.scopes.get(component);

		if (binding !== null && component_scope !== null) {
			if (
				binding.declaration_kind !== 'function' &&
				binding.initial?.type !== 'FunctionDeclaration' &&
				binding.initial?.type !== 'ArrowFunctionExpression' &&
				binding.initial?.type !== 'FunctionExpression'
			) {
				return false;
			}
			let scope = binding.scope;

			while (scope !== null) {
				if (scope === component_scope) {
					return true;
				}
				scope = scope.parent;
			}
		}
	}

	return false;
}
/**
 * Visits and transforms an assignment expression
 * @param {AssignmentExpression} node
 * @param {TransformContext} context
 * @param {Function} build_assignment
 * @returns {Expression | AssignmentExpression | null}
 */
export function visit_assignment_expression(node, context, build_assignment) {
	if (
		node.left.type === 'ArrayPattern' ||
		node.left.type === 'ObjectPattern' ||
		node.left.type === 'RestElement'
	) {
		const value = /** @type {Expression} */ (context.visit(node.right));
		const should_cache = value.type !== 'Identifier';
		const rhs = should_cache ? b.id('$$value') : value;

		let changed = false;

		const assignments = extract_paths(node.left).map((path) => {
			const value = path.expression?.(rhs);

			let assignment = build_assignment('=', path.node, value, context);
			if (assignment !== null) changed = true;

			return (
				assignment ??
				b.assignment(
					'=',
					/** @type {Pattern} */ (context.visit(path.node)),
					/** @type {Expression} */ (context.visit(value)),
				)
			);
		});

		if (!changed) {
			// No change to output -> nothing to transform -> we can keep the original assignment
			return null;
		}

		const is_standalone = context.path.at(-1).type.endsWith('Statement');
		const sequence = b.sequence(assignments);

		if (!is_standalone) {
			// this is part of an expression, we need the sequence to end with the value
			sequence.expressions.push(rhs);
		}

		if (should_cache) {
			// the right hand side is a complex expression, wrap in an IIFE to cache it
			const iife = b.arrow([rhs], sequence);

			return b.call(iife, value);
		}

		return sequence;
	}

	if (node.left.type !== 'Identifier' && node.left.type !== 'MemberExpression') {
		throw new Error(`Unexpected assignment type ${node.left.type}`);
	}

	const transformed = build_assignment(node.operator, node.left, node.right, context);

	if (transformed === node.left) {
		return node;
	}

	return transformed;
}

/**
 * Builds an assignment node, possibly transforming for reactivity
 * @param {AssignmentOperator} operator
 * @param {Pattern | MemberExpression | Identifier} left
 * @param {Expression} right
 * @param {TransformContext} context
 * @returns {Expression|null}
 */
export function build_assignment(operator, left, right, context) {
	let object = left;

	while (object.type === 'MemberExpression') {
		// @ts-expect-error
		object = object.object;
	}

	if (object.type !== 'Identifier') {
		return null;
	}

	const binding = context.state.scope.get(object.name);
	if (!binding) return null;

	const transform = binding.transform;

	// reassignment
	if (object === left || (left.type === 'MemberExpression' && left.computed && operator === '=')) {
		const assign_fn = transform?.assign || transform?.assign_tracked;
		if (assign_fn) {
			let value = /** @type {Expression} */ (
				context.visit(build_assignment_value(operator, left, right))
			);

			return assign_fn(
				object,
				value,
				left.type === 'MemberExpression' && left.computed
					? context.visit(left.property)
					: undefined,
			);
		}
	}

	// mutation
	if (transform?.mutate) {
		return transform.mutate(
			object,
			b.assignment(
				operator,
				/** @type {Pattern} */ (context.visit(left)),
				/** @type {Expression} */ (context.visit(right)),
			),
		);
	}

	return null;
}

const ATTR_REGEX = /[&"<]/g;
const CONTENT_REGEX = /[&<]/g;

/**
 * Escapes HTML special characters in a string
 * @param {string} value
 * @param {boolean} [is_attr=false]
 * @returns {string}
 */
export function escape_html(value, is_attr = false) {
	const str = String(value ?? '');

	const pattern = is_attr ? ATTR_REGEX : CONTENT_REGEX;
	pattern.lastIndex = 0;

	let escaped = '';
	let last = 0;

	while (pattern.test(str)) {
		const i = pattern.lastIndex - 1;
		const ch = str[i];
		escaped += str.substring(last, i) + (ch === '&' ? '&amp;' : ch === '"' ? '&quot;' : '&lt;');
		last = i + 1;
	}

	return escaped + str.substring(last);
}

/**
 * Hashes a string to a base36 value
 * @param {string} str
 * @returns {string}
 */
export function hash(str) {
	str = str.replace(regex_return_characters, '');
	let hash = 5381;
	let i = str.length;

	while (i--) hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
	return (hash >>> 0).toString(36);
}

/**
 * Returns true if node is a DOM element (not a component)
 * @param {Element} node
 * @returns {boolean}
 */
export function is_element_dom_element(node) {
	return (
		node.id.type === 'Identifier' &&
		node.id.name[0].toLowerCase() === node.id.name[0] &&
		node.id.name !== 'children' &&
		!node.id.tracked
	);
}

/**
 * Normalizes children nodes (merges adjacent text, removes empty)
 * @param {RippleNode[]} children
 * @param {TransformContext} context
 * @returns {RippleNode[]}
 */
export function normalize_children(children, context) {
	/** @type {RippleNode[]} */
	const normalized = [];

	for (const node of children) {
		normalize_child(node, normalized, context);
	}

	for (let i = normalized.length - 1; i >= 0; i--) {
		const child = normalized[i];
		const prev_child = normalized[i - 1];

		if (child.type === 'Text' && prev_child?.type === 'Text') {
			if (child.expression.type === 'Literal' && prev_child.expression.type === 'Literal') {
				prev_child.expression = b.literal(
					prev_child.expression.value + String(child.expression.value),
				);
			} else {
				prev_child.expression = b.binary(
					'+',
					prev_child.expression,
					b.call('String', child.expression),
				);
			}
			normalized.splice(i, 1);
		}
	}

	return normalized;
}

/**
 * @param {RippleNode} node
 * @param {RippleNode[]} normalized
 * @param {TransformContext} context
 */
function normalize_child(node, normalized, context) {
	if (node.type === 'EmptyStatement') {
		return;
	} else if (
		node.type === 'Element' &&
		node.id.type === 'Identifier' &&
		((node.id.name === 'style' && !context.state.inside_head) ||
			node.id.name === 'head' ||
			(node.id.name === 'title' && context.state.inside_head))
	) {
		return;
	} else {
		normalized.push(node);
	}
}

/**
 * @param {TransformContext} context
 */
export function get_parent_block_node(context) {
	const path = context.path;

	for (let i = path.length - 1; i >= 0; i -= 1) {
		const context_node = path[i];
		if (
			context_node.type === 'IfStatement' ||
			context_node.type === 'ForOfStatement' ||
			context_node.type === 'SwitchStatement' ||
			context_node.type === 'TryStatement' ||
			context_node.type === 'Component'
		) {
			return context_node;
		}
		if (
			context_node.type === 'FunctionExpression' ||
			context_node.type === 'ArrowFunctionExpression' ||
			context_node.type === 'FunctionDeclaration'
		) {
			return null;
		}
	}
	return null;
}

/**
 * Builds a getter for a tracked identifier
 * @param {Identifier} node
 * @param {TransformContext} context
 * @returns {Expression | Identifier}
 */
export function build_getter(node, context) {
	const state = context.state;

	if (!context.path) return node;

	for (let i = context.path.length - 1; i >= 0; i -= 1) {
		const binding = state.scope.get(node.name);
		const transform = binding?.transform;

		// don't transform the declaration itself
		if (node !== binding?.node) {
			const read_fn = transform?.read;

			if (read_fn) {
				return read_fn(node, context.state?.metadata?.spread, context.visit);
			}
		}
	}

	return node;
}

/**
 * Determines the namespace for child elements
 * @param {string} element_name
 * @param {string} current_namespace
 * @returns {string}
 */
export function determine_namespace_for_children(element_name, current_namespace) {
	if (element_name === 'foreignObject') {
		return 'html';
	}

	if (element_name === 'svg') {
		return 'svg';
	}

	if (element_name === 'math') {
		return 'mathml';
	}

	return current_namespace;
}

/**
 * Converts and index to a key string, where the starting character is a
 * letter.
 * @param {number} index
 */
export function index_to_key(index) {
	const letters = 'abcdefghijklmnopqrstuvwxyz';
	let key = '';

	do {
		key = letters[index % 26] + key;
		index = Math.floor(index / 26) - 1;
	} while (index >= 0);

	return key;
}
