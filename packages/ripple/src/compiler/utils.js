import { build_assignment_value } from '../utils/ast.js';
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

export function is_dom_property(name) {
	return DOM_PROPERTIES.includes(name);
}

const unhoisted = { hoisted: false };

export function get_delegated_event(event_name, handler, state) {
	// Handle delegated event handlers. Bail out if not a delegated event.
	if (!handler || !is_delegated(event_name)) {
		return null;
	}

	/** @type {FunctionExpression | FunctionDeclaration | ArrowFunctionExpression | null} */
	let target_function = null;
	let binding = null;

	if (handler.type === 'ArrowFunctionExpression' || handler.type === 'FunctionExpression') {
		target_function = handler;
	} else if (handler.type === 'Identifier') {
		binding = state.scope.get(handler.name);

		if (state.analysis.module.scope.references.has(handler.name)) {
			// If a binding with the same name is referenced in the module scope (even if not declared there), bail out
			return unhoisted;
		}

		if (binding != null) {
			for (const { path } of binding.references) {
				const parent = path.at(-1);
				if (parent === undefined) return unhoisted;

				const grandparent = path.at(-2);

				/** @type {AST.RegularElement | null} */
				let element = null;
				/** @type {string | null} */
				let event_name = null;
				if (
					parent.type === 'ExpressionTag' &&
					grandparent?.type === 'Attribute' &&
					is_event_attribute(grandparent)
				) {
					element = /** @type {AST.RegularElement} */ (path.at(-3));
					const attribute = /** @type {AST.Attribute} */ (grandparent);
					event_name = get_attribute_event_name(attribute.name);
				}

				if (element && event_name) {
					if (
						element.type !== 'Element' ||
						element.metadata.has_spread ||
						!is_delegated(event_name)
					) {
						return unhoisted;
					}
				} else if (parent.type !== 'FunctionDeclaration' && parent.type !== 'VariableDeclarator') {
					return unhoisted;
				}
			}
		}

		// If the binding is exported, bail out
		if (state.analysis.exports.find((node) => node.name === handler.name)) {
			return unhoisted;
		}

		if (binding !== null && binding.initial !== null && !binding.updated && !binding.is_called) {
			const binding_type = binding.initial.type;

			if (
				binding_type === 'ArrowFunctionExpression' ||
				binding_type === 'FunctionDeclaration' ||
				binding_type === 'FunctionExpression'
			) {
				target_function = binding.initial;
			}
		}
	}

	// If we can't find a function, or the function has multiple parameters, bail out
	if (target_function == null || target_function.params.length > 1) {
		return unhoisted;
	}

	const visited_references = new Set();
	const scope = target_function.metadata.scope;
	for (const [reference] of scope.references) {
		// Bail out if the arguments keyword is used or $host is referenced
		if (reference === 'arguments') return unhoisted;

		const binding = scope.get(reference);
		const local_binding = state.scope.get(reference);

		// If we are referencing a binding that is shadowed in another scope then bail out.
		if (local_binding !== null && binding !== null && local_binding.node !== binding.node) {
			return unhoisted;
		}

		if (
			binding !== null &&
			// Bail out if the the binding is a rest param
			(binding.declaration_kind === 'rest_param' || // or any normal not reactive bindings that are mutated.
				// Bail out if we reference anything from the EachBlock (for now) that mutates in non-runes mode,
				(binding.kind === 'normal' && binding.updated))
		) {
			return unhoisted;
		}
		visited_references.add(reference);
	}

	return { hoisted: true, function: target_function };
}

function get_hoisted_params(node, context) {
	const scope = context.state.scope;

	/** @type {Identifier[]} */
	const params = [];

	/**
	 * We only want to push if it's not already present to avoid name clashing
	 * @param {Identifier} id
	 */
	function push_unique(id) {
		if (!params.find((param) => param.name === id.name)) {
			params.push(id);
		}
	}

	for (const [reference] of scope.references) {
		let binding = scope.get(reference);

		if (binding !== null && !scope.declarations.has(reference) && binding.initial !== node) {
			if (binding.kind === 'prop') {
				push_unique(b.id('__props'));
			} else if (binding.kind === 'prop_fallback') {
				push_unique(b.id(binding.node.name));
			} else if (
				// imports don't need to be hoisted
				binding.declaration_kind !== 'import'
			) {
				// create a copy to remove start/end tags which would mess up source maps
				push_unique(b.id(binding.node.name));
			}
		}
	}
	return params;
}

export function build_hoisted_params(node, context) {
	const hoisted_params = get_hoisted_params(node, context);
	node.metadata.hoisted_params = hoisted_params;

	/** @type {Pattern[]} */
	const params = [];

	if (node.params.length === 0) {
		if (hoisted_params.length > 0) {
			// For the event object
			params.push(b.id(context.state.scope.generate('_')));
		}
	} else {
		for (const param of node.params) {
			params.push(/** @type {Pattern} */ (context.visit(param)));
		}
	}

	params.push(...hoisted_params, b.id('__block'));
	return params;
}

export function is_top_level_await(context) {
	if (!is_inside_component(context)) {
		return false;
	}

	for (let i = context.path.length - 1; i >= 0; i -= 1) {
		const context_node = context.path[i];
		const type = context_node.type;

		if (type === 'Component') {
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
		if (type === 'Component') {
			return true;
		}
	}
	return false;
}

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

export function is_ripple_track_call(callee, context) {
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

export function is_ripple_import(callee, context) {
	if (callee.type === 'Identifier') {
		const binding = context.state.scope.get(callee.name);

		return (
			binding?.declaration_kind === 'import' &&
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
			binding.initial.source.type === 'Literal' &&
			binding.initial.source.value === 'ripple'
		);
	}

	return false;
}

export function is_declared_function_within_component(node, context) {
	const component = context.path.find((n) => n.type === 'Component');

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

function is_non_coercive_operator(operator) {
	return ['=', '||=', '&&=', '??='].includes(operator);
}

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

		const is_standalone = /** @type {Node} */ (context.path.at(-1)).type.endsWith('Statement');
		const sequence = b.sequence(assignments);

		if (!is_standalone) {
			// this is part of an expression, we need the sequence to end with the value
			sequence.expressions.push(rhs);
		}

		if (should_cache) {
			// the right hand side is a complex expression, wrap in an IIFE to cache it
			const iife = b.arrow([rhs], sequence);

			const iife_is_async =
				is_expression_async(value) ||
				assignments.some((assignment) => is_expression_async(assignment));

			return iife_is_async ? b.await(b.call(b.async(iife), value)) : b.call(iife, value);
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

export function hash(str) {
	str = str.replace(regex_return_characters, '');
	let hash = 5381;
	let i = str.length;

	while (i--) hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
	return (hash >>> 0).toString(36);
}

export function is_element_dom_element(node) {
	return (
		node.id.type === 'Identifier' &&
		node.id.name[0].toLowerCase() === node.id.name[0] &&
		node.id.name !== 'children' &&
		!node.id.tracked
	);
}

export function normalize_children(children, context) {
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

export function build_getter(node, context) {
	const state = context.state;

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
