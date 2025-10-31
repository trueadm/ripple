/** @import { NAMESPACE_URI } from './constants.js' */

/** @type {typeof Object.getOwnPropertyDescriptor} */
export var get_descriptor = Object.getOwnPropertyDescriptor;
/** @type {typeof Object.getOwnPropertyDescriptors} */
export var get_descriptors = Object.getOwnPropertyDescriptors;
/** @type {typeof Array.from} */
export var array_from = Array.from;
/** @type {typeof Array.isArray} */
export var is_array = Array.isArray;
/** @type {typeof Object.defineProperty} */
export var define_property = Object.defineProperty;
/** @type {typeof Object.getPrototypeOf} */
export var get_prototype_of = Object.getPrototypeOf;
/** @type {typeof Object.values} */
export var object_values = Object.values;
/** @type {typeof Object.entries} */
export var object_entries = Object.entries;
/** @type {typeof Object.keys} */
export var object_keys = Object.keys;
/** @type {typeof Object.getOwnPropertySymbols} */
export var get_own_property_symbols = Object.getOwnPropertySymbols;
/** @type {typeof structuredClone} */
export var structured_clone = structuredClone;
/** @type {typeof Object.prototype} */
export var object_prototype = Object.prototype;
/** @type {typeof Array.prototype} */
export var array_prototype = Array.prototype;

/**
 * Creates a text node that serves as an anchor point in the DOM.
 * @returns {Text}
 */
export function create_anchor() {
	var t = document.createTextNode('');
	/** @type {any} */ (t).__t = '';
	return t;
}

/**
 * Checks if an object is a tracked object (has a numeric 'f' property).
 * @param {any} v - The object to check.
 * @returns {boolean}
 */
export function is_tracked_object(v) {
	return typeof v === 'object' && v !== null && typeof (/** @type {any} */ (v).f) === 'number';
}

/**
 * Converts a tag name to its corresponding namespace.
 * @param {keyof SVGElementTagNameMap | keyof MathMLElementTagNameMap | keyof HTMLElementTagNameMap} element
 * @param {keyof typeof NAMESPACE_URI} current_namespace
 * @returns {keyof typeof NAMESPACE_URI}
 */
export function top_element_to_ns(element, current_namespace) {
	if (element === 'svg') {
		return 'svg';
	} else if (element === 'math') {
		return 'mathml';
	} else {
		return current_namespace;
	}
}
