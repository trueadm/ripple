/** @import { Block, Tracked } from '#client' */
import { MAX_ARRAY_LENGTH, UNINITIALIZED } from './internal/client/constants.js';
import { get, safe_scope, set, tracked } from './internal/client/runtime.js';
import { get_descriptor } from './internal/client/utils.js';

export function TrackedArray(...elements) {
	if (!new.target) {
		throw new Error("TrackedArray must be called with 'new'");
	}

	var block = safe_scope();

	return proxy(elements, block);
}

// Static methods
TrackedArray.from = function(...args) {
	var block = safe_scope();
	var elements = Array.from(...args);
	return proxy(elements, block, true);
}

TrackedArray.of = function(...args) {
	var block = safe_scope();
	var elements = Array.of(...args);
	return proxy(elements, block, true);
}

TrackedArray.fromAsync = async function(...args) {
	var block = safe_scope();
	var elements = await Array.fromAsync(...args);
	return proxy(elements, block, true);
}

/**
 *
 * @param {any} elements
 * @param {Block} block
 * @returns {Proxy<any[]>}
 */
function proxy(elements, block, is_from_static = false) {
	var arr;
	var first;

	if (is_from_static && (first = get_first_if_length(elements)) !== undefined) {
		arr = new Array();
		arr[0] = first;
	} else {
		arr = new Array(...elements);
	}

	var tracked_elements = new Map();
	var tracked_len =  tracked(arr.length, block)
	tracked_elements.set('length', tracked_len);

    return new Proxy(arr, {
		get(target, prop, receiver) {
			var t = tracked_elements.get(prop);
			var exists = prop in target;

			if (t === undefined && (!exists || get_descriptor(target, prop)?.writable)) {
				t = tracked(exists ? target[prop] : UNINITIALIZED, block);
				tracked_elements.set(prop, t);
			}

			if (t !== undefined) {
				var v = get(t);
				return v === UNINITIALIZED ? undefined : v;
			}

			return Reflect.get(target, prop, receiver);
		},

		set(target, prop, value, receiver) {
			var t = tracked_elements.get(prop);
			var exists = prop in target;

			if (prop === 'length') {
				for (var i = value; i < tracked_len.v; i += 1) {
					var other_t = tracked_elements.get(i + '');
					if (other_t !== undefined) {
						set(other_t, UNINITIALIZED, block);
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
					set(t, value, block);

					tracked_elements.set(prop, t);
				}
			} else {
				exists = t.v !== UNINITIALIZED;

				set(t, value, block);
			}

			var result = Reflect.set(target, prop, value, receiver)

			if (!exists) {
				// If we have mutated an array directly, we might need to
				// signal that length has also changed. Do it before updating metadata
				// to ensure that iterating over the array as a result of a metadata update
				// will not cause the length to be out of sync.
				if (typeof prop === 'string') {
					var n = Number(prop);

					if (Number.isInteger(n) && n >= tracked_len.v) {
						set(tracked_len, n + 1, block);
					}
				}
			}

			return result;
		},

		setPrototypeOf() {
			throw new Error(`Cannot set prototype of \`TrackedArray\``);
		},

		deleteProperty(target, prop) {
			var t = tracked_elements.get(prop);

			if (t === undefined) {
				if (prop in target) {
					const t = tracked(UNINITIALIZED, block);
					tracked_elements.set(prop, t);
				}
			} else {
				set(t, UNINITIALIZED, block);
			}

			return Reflect.deleteProperty(target, prop);
		},

		has(target, prop) {
			var t = tracked_elements.get(prop);
			var exists = (t !== undefined && t.v !== UNINITIALIZED) || Reflect.has(target, prop);

			if (t !== undefined || (!exists || get_descriptor(target, prop)?.writable)) {
				if (t === undefined) {
					t = tracked(exists ? target[prop] : UNINITIALIZED, block);

					tracked_elements.set(prop, t);
				}

				var value = get(t);
				if (value === UNINITIALIZED) {
					return false;
				}
			}

			return exists;
		},
    });
}

function get_first_if_length(array) {
  var first = array[0];

  if (
	array.length === 1 &&
	0 in array &&
	Number.isInteger(first) &&
	/** @type {number} */ (first) >= 0 &&
	/** @type {number} */ (first) <= MAX_ARRAY_LENGTH
  ) {
	return first;
  }
}

