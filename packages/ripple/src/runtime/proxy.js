/** @import { Block, Tracked } from '#client' */
/** @import { TrackedArray } from './array.js' */
/** @import { TrackedObject } from './object.js' */

import { get, set, tracked } from './internal/client/runtime.js';
import {
	array_prototype,
	get_descriptor,
	get_prototype_of,
	is_array,
	object_prototype,
} from './internal/client/utils.js';
import {
	MAX_ARRAY_LENGTH,
	TRACKED_ARRAY,
	TRACKED_OBJECT,
	UNINITIALIZED,
} from './internal/client/constants.js';

/**
 * @template T
 * @param {T[] | Record<PropertyKey, any>} value
 * @param {Block} block
 * @returns {TrackedArray<T> | TrackedObject<T>}
 */
export function proxy(value, block) {
	// if non-proxyable, or is already a proxy, return `value`
	if (
		typeof value !== 'object'
		|| value === null
		|| TRACKED_ARRAY in value
		|| TRACKED_OBJECT in value
	) {
		return value;
	}

	const prototype = get_prototype_of(value);

	if (prototype !== object_prototype && prototype !== array_prototype) {
		return value;
	}

	/** @type {Map<any,Tracked>} */
	var tracked_elements = new Map();
	var is_proxied_array = is_array(value);
	/** @type {Tracked} */
	var tracked_len;

	if (is_proxied_array) {
		tracked_len = tracked(value.length, block);
		tracked_elements.set('length', tracked_len);
	}

	return new Proxy(value, {
		/**
		 * @param {PropertyKey} prop
		 */
		get(target, prop, receiver) {
			var t = tracked_elements.get(prop);
			var exists = prop in target;

			if (t === undefined && (!exists || get_descriptor(target, prop)?.writable)) {
				t = tracked(exists ? /** @type {any} */ (target)[prop] : UNINITIALIZED, block);
				tracked_elements.set(prop, t);
			}

			if (t !== undefined) {
				var v = get(t);
				return v === UNINITIALIZED ? undefined : v;
			}

			var result = Reflect.get(target, prop, receiver);

			if (typeof result === 'function') {
				if (methods_returning_arrays.has(prop)) {
					/** @type {(this: any, ...args: any[]) => any} */
					return function (...args) {
						var output = Reflect.apply(result, receiver, args);

						if (Array.isArray(output) && output !== target) {
							return array_proxy({ elements: output, block, use_array: true });
						}

						return output;
					};
				}

				// When generating an iterator, we need to ensure that length is tracked
				if (is_proxied_array && (prop === 'entries' || prop === 'values' || prop === 'keys')) {
					receiver.length;
				}
			}

			return result;
		},

		set(target, prop, value, receiver) {
			var t = tracked_elements.get(prop);
			var exists = prop in target;

			if (is_proxied_array && prop === 'length' && t !== undefined) {
				for (var i = value; i < t.__v; i += 1) {
					var other_t = tracked_elements.get(i + '');
					if (other_t !== undefined) {
						set(other_t, UNINITIALIZED);
					} else if (i in target) {
						// If the item exists in the original, we need to create a uninitialized tracked,
						// else a later read of the property would result in a tracked being created with
						// the value of the original item at that index.
						other_t = tracked(UNINITIALIZED, block);
						tracked_elements.set(i + '', other_t);
					}
				}
			}

			// If we haven't yet created a tracked for this property, we need to ensure
			// we do so otherwise if we read it later, then the write won't be tracked and
			// the heuristics of effects will be different vs if we had read the proxied
			// object property before writing to that property.
			if (t === undefined) {
				if (!exists || get_descriptor(target, prop)?.writable) {
					t = tracked(undefined, block);
					set(t, value);

					tracked_elements.set(prop, t);
				}
			} else {
				exists = t.__v !== UNINITIALIZED;

				set(t, value);
			}

			var descriptor = Reflect.getOwnPropertyDescriptor(target, prop);

			// Set the new value before updating any tracked's so that any listeners get the new value
			if (descriptor?.set) {
				descriptor.set.call(receiver, value);
			}

			if (!exists && is_proxied_array && typeof prop === 'string') {
				// If we have mutated an array directly, we might need to
				// signal that length has also changed. Do it before updating metadata
				// to ensure that iterating over the array as a result of a metadata update
				// will not cause the length to be out of sync.
				var n = Number(prop);

				if (Number.isInteger(n) && n >= tracked_len.__v) {
					set(tracked_len, n + 1);
				}
			}

			return true;
		},

		setPrototypeOf() {
			throw new Error(`Cannot set prototype of ${is_proxied_array ? '\`TrackedArray\`' : '\`TrackedObject\`'}`);
		},

		deleteProperty(target, prop) {
			var t = tracked_elements.get(prop);

			if (t === undefined) {
				if (prop in target) {
					const t = tracked(UNINITIALIZED, block);
					tracked_elements.set(prop, t);
				}
			} else {
				set(t, UNINITIALIZED);
			}

			return Reflect.deleteProperty(target, prop);
		},

		has(target, prop) {
			if (is_proxied_array && prop === TRACKED_ARRAY) {
				return true;
			}

			if (prop === TRACKED_OBJECT) {
				return true;
			}

			var t = tracked_elements.get(prop);
			var exists = (t !== undefined && t.__v !== UNINITIALIZED) || Reflect.has(target, prop);

			if (t !== undefined || !exists || get_descriptor(target, prop)?.writable) {
				if (t === undefined) {
					t = tracked(exists ?  /** @type {any} */ (target)[prop] : UNINITIALIZED, block);

					tracked_elements.set(prop, t);
				}

				var value = get(t);
				if (value === UNINITIALIZED) {
					return false;
				}
			}

			return exists;
		},

		defineProperty(_, prop, descriptor) {
			if (
				!('value' in descriptor) ||
				descriptor.configurable === false ||
				descriptor.enumerable === false ||
				descriptor.writable === false
			) {
				// we disallow non-basic descriptors, because unless they are applied to the
				// target object — which we avoid, so that state can be forked — we will run
				// afoul of the various invariants
				// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/Proxy/getOwnPropertyDescriptor#invariants
				throw new Error(
					'Only basic property descriptors are supported with value and configurable, enumerable, and writable set to true',
				);
			}

			var t = tracked_elements.get(prop);

			if (t === undefined) {
				t = tracked(descriptor.value, block);
				tracked_elements.set(prop, t);
			} else {
				set(t, descriptor.value);
			}

			return true;
		},

		ownKeys(target) {
			var own_keys = Reflect.ownKeys(target).filter((key) => {
				var t = tracked_elements.get(key);
				return t === undefined || t.__v !== UNINITIALIZED;
			});

			for (var [key, t] of tracked_elements) {
				if (t.__v !== UNINITIALIZED && !(key in target)) {
					own_keys.push(key);
				}
			}

			return own_keys;
		},

		getOwnPropertyDescriptor(target, prop) {
			var descriptor = Reflect.getOwnPropertyDescriptor(target, prop);

			if (descriptor && 'value' in descriptor) {
				var t = tracked_elements.get(prop);
				if (t) descriptor.value = get(t);
			} else if (descriptor === undefined) {
				var t = tracked_elements.get(prop);
				var value = t?.__v;

				if (t !== undefined && value !== UNINITIALIZED) {
					return {
						enumerable: true,
						configurable: true,
						value,
						writable: true
					};
				}
			}

			return descriptor;
		},

	});
}

/**
 * @template T
 * @param {{
 *  elements: Iterable<T>,
 *  block: Block,
 *  from_static?: boolean,
 *  use_array?: boolean
 * }} params
 * @returns {TrackedArray<T>}
 */
export function array_proxy({ elements, block, from_static = false, use_array = false }) {
	var arr;
	var first;

	if (
		from_static &&
		(first = get_first_if_length(/** @type {Array<T>} */(elements))) !== undefined
	) {
		arr = new Array();
		arr[0] = first;
	} else if (use_array) {
		arr = elements;
	} else {
		arr = new Array(...elements);
	}

	return proxy(arr, block);
}

/**
 * @template {object} T
 * @param {T} obj
 * @param {Block} block
 * @returns {TrackedObject<T>}
 */
export function object_proxy(obj, block) {
	return proxy(obj, block);
}

/** @type {Set<PropertyKey>} */
const methods_returning_arrays = new Set([
	'concat',
	'filter',
	'flat',
	'flatMap',
	'map',
	'slice',
	'splice',
	'toReversed',
	'toSorted',
	'toSpliced',
	'with',
]);

/**
 * @template T
 * @param {Array<T>} array
 * @returns {number | void}
 */
function get_first_if_length(array) {
	var first = array[0];

	if (
		array.length === 1 &&
		0 in array &&
		Number.isInteger(first) &&
    /** @type {number} */ (first) >= 0 &&
    /** @type {number} */ (first) <= MAX_ARRAY_LENGTH
	) {
		return /** @type {number} */ (first);
	}
}
