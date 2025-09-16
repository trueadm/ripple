import { TRACKED_OBJECT } from './constants.js';

export var get_descriptor = Object.getOwnPropertyDescriptor;
export var get_descriptors = Object.getOwnPropertyDescriptors;
export var array_from = Array.from;
export var is_array = Array.isArray;
export var define_property = Object.defineProperty;
export var get_prototype_of = Object.getPrototypeOf;
export var object_values = Object.values;
export var object_entries = Object.entries;
export var object_keys = Object.keys;
export var get_own_property_symbols = Object.getOwnPropertySymbols;
export var structured_clone = structuredClone;

export function create_anchor() {
	var t = document.createTextNode('');
	t.__t = '';
	return t;
}

/**
 * @param {any} obj
 * @returns {boolean}
 */
export function is_ripple_array(obj) {
	return is_array(obj) && TRACKED_OBJECT in obj && '$length' in obj;
}

/**
 * @param {any} value
 * @returns {boolean}
 */
export function is_positive_integer(value) {
	return Number.isInteger(value) && /**@type {number} */ (value) >= 0;
}
