import { get_descriptor } from './utils.js';

/** @type {() => Node | null} */
var first_child_getter;
/** @type {() => Node | null} */
var next_sibling_getter;

/** @type {Document} */
export var document;

/** @type {boolean} */
export var is_firefox;

export function init_operations() {
	var node_prototype = Node.prototype;
	var element_prototype = Element.prototype;
	var event_target_prototype = EventTarget.prototype;

	is_firefox = /Firefox/.test(navigator.userAgent);
	document = window.document;

	// @ts-ignore
	first_child_getter = get_descriptor(node_prototype, 'firstChild').get;
	// @ts-ignore
	next_sibling_getter = get_descriptor(node_prototype, 'nextSibling').get;

	// the following assignments improve perf of lookups on DOM nodes
	// @ts-expect-error
	element_prototype.__click = undefined;
	// @ts-expect-error
	event_target_prototype.__root = undefined;
}

/**
 * @template {Node} N
 * @param {N} node
 * @returns {Node | null}
 */
export function first_child(node) {
	return first_child_getter.call(node);
}

/**
 * @template {Node} N
 * @param {N} node
 * @returns {Node | null}
 */
export function child_frag(node) {
	var child = /** @type {Text} */ (first_child(node));

	if (child.nodeType === 8 && child.data === '') {
		return next_sibling(child);
	}
	return child;
}

/**
 * @template {Node} N
 * @param {N} node
 * @returns {Node | null}
 */
/*@__NO_SIDE_EFFECTS__*/
export function next_sibling(node) {
	return next_sibling_getter.call(node);
}

export function create_text(value = '') {
	return document.createTextNode(value);
}
