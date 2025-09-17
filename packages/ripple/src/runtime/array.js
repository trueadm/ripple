import { TRACKED_OBJECT, ARRAY_SET_INDEX_AT, MAX_ARRAY_LENGTH } from './internal/client/constants.js';
import { get, safe_scope, set, tracked } from './internal/client/runtime.js';
import { is_ripple_array } from './internal/client/utils.js';
/** @import { Block, Tracked } from '#client' */

/** @type {unique symbol} */
const INIT_AFTER_NEW = Symbol();

/** @type {(symbol | string | any)[]} */
const introspect_methods = [
	'concat',
	'entries',
	'every',
	'filter',
	'find',
	'findIndex',
	'findLast',
	'findLastIndex',
	'flat',
	'flatMap',
	'forEach',
	'includes',
	'indexOf',
	'join',
	'keys',
	'lastIndexOf',
	'map',
	'reduce',
	'reduceRight',
	'some',
	'slice',
	'toLocaleString',
	'toReversed',
	'toSorted',
	'toSpliced',
	'toString',
	Symbol.iterator,
	'values',
	'with',
];

let is_proto_set = false;

/**
 * @template T
 * @extends {Array<T>}
 */
export class RippleArray extends Array {
	/** @type {Array<Tracked>} */
	#tracked_elements = [];
	/** @type {Tracked} */
	// @ts-expect-error
	#tracked_index;

    /**
     * @template U
     * @param {ArrayLike<U> | Iterable<U>} arrayLike
     * @param {(v: U, k: number) => any | undefined} [mapFn]
     * @param {any} [thisArg]
     * @returns {RippleArray<U>}
     */
	static from(arrayLike, mapFn, thisArg) {
		var arr = mapFn ?
			Array.from(arrayLike, mapFn, thisArg)
        	: Array.from(arrayLike);

		return get_instance_from_static(arr);
	}

    /**
     * @template U
     * @param {ArrayLike<U> | Iterable<U>} arrayLike
     * @param {(v: U, k: number) => any | undefined} [mapFn]
     * @param {any} [thisArg]
     * @returns {Promise<RippleArray<U>>}
     */
	static async fromAsync(arrayLike, mapFn, thisArg) {
		var block = safe_scope();
		// create empty array to get the right scope
		var result = new RippleArray();

		var arr = mapFn ?
			await Array.fromAsync(arrayLike, mapFn, thisArg)
			: await Array.fromAsync(arrayLike)

		var first = get_first_if_length(arr);

		if (first) {
			result[0] = first;
		} else {
			result.length = arr.length;
			for (let i = 0; i < arr.length; i++) {
				if (i in arr) {
					result[i] = arr[i];
				}
			}
		}

		result[INIT_AFTER_NEW](block);

		return result
	}

    /**
     * @template U
     * @param {...U} elements
     * @returns {RippleArray<U>}
     */
	static of(...elements) {
		var arr = Array.of(...elements);

		return get_instance_from_static(arr);
	}

	/**
	 * @param {...T} elements
	 */
	constructor(...elements) {
		super(...elements);

		this[INIT_AFTER_NEW]();

		if (!is_proto_set) {
			is_proto_set = true;
			this.#set_proto();
		}
	}

	[INIT_AFTER_NEW](block = safe_scope()) {
		if (this.length !== 0) {
			var tracked_elements = this.#tracked_elements;
			for (var i = 0; i < this.length; i++) {
				if (!(i in this)) {
					continue;
				}
				tracked_elements[i] = tracked(this[i], block);
			}
		}

		if (!this.#tracked_index) {
			this.#tracked_index = tracked(this.length, block);
		} else if (this.#tracked_index.v !== this.length) {
			set(this.#tracked_index, this.length, block);
		}
	}

	#set_proto() {
		var proto = RippleArray.prototype;
		var array_proto = Array.prototype;

		for (const method of introspect_methods) {
			if (!(method in array_proto)) {
				continue;
			}

			/** @param {...any} v */
			proto[method] = function (...v) {
				var result = array_proto[method].apply(this, v);

				if (is_ripple_array(result) && this !== result) {
					var tracked_elements = result[TRACKED_OBJECT];
					var block = safe_scope();

					if (tracked_elements.length != result.length) {
						for (var i = 0; i < result.length; i++) {
							if ((i in result) && tracked_elements[i] === undefined) {
								tracked_elements[i] = tracked(result[i], block);
							}
						}
					}
				}

				// the caller reruns on length changes
				this.$length;
				// the caller reruns on element changes
				establish_trackable_deps(this);
				return result;
			};
		}
	}

	/**
	 * @param {number} target
	 * @param {number} start
	 * @param {number} [end]
	 * @returns {this}
	 */
	copyWithin(target, start, end) {
		var block = safe_scope();
		var tracked_elements = this.#tracked_elements;
		var length = this.length;

		super.copyWithin(target, start, end);

		if (!target && !start) {
			return this;
		} else if (!target && start) {
			target = 0;
		} else if (target && !start) {
			start = 0;
		}

		if (target < 0) {
			target = Math.max(length + target, 0);
		} else {
			target = Math.min(target, length);
		}

		if (start < 0) {
			start = Math.max(length + start, 0);
		} else {
			start = Math.min(start, length);
		}

		if (end === undefined) {
			end = length;
		} else if (end < 0) {
			end = Math.max(length + end, 0);
		} else {
			end = Math.min(end, length);
		}

		if (target >= length) {
			return this;
		}

		const copyCount = Math.min(end - start, length - target);

		// If no elements are copied (start >= end or copyCount <= 0), return early
		if (start >= end || copyCount <= 0) {
			return this;
		}

		for (let i = 0; i < copyCount; i++) {
			const index = target + i;
			// Only update if source and target are different positions
			// to avoid unnecessary updates when copying onto itself
			if (index !== start + i) {
				this.#update_tracked_at_index({array: this, i: index, block, tracked_elements});
			}
		}

		return this;
	}

	/**
	 * @param {T} value
	 * @param {number} [start]
	 * @param {number} [end]
	 * @returns {this}
	 */
	fill(value, start, end) {
		var block = safe_scope();
		var tracked_elements = this.#tracked_elements;
		var length = this.length;

		// avoid unexpected behavior with method args being undefined
		if (value === undefined && start === undefined && end === undefined) {
			// @ts-ignore
			super.fill();
		} else if (start === undefined && end === undefined) {
			super.fill(value);
		} else if (end === undefined) {
			super.fill(value, start);
		} else {
			super.fill(value, start, end);
		}

		let actual_start = 0;
		if (start !== undefined) {
			if (start < 0) {
				actual_start = Math.max(length + start, 0);
			} else {
				actual_start = Math.min(start, length);
			}
		}

		let actual_end = length;
		if (end !== undefined) {
			if (end < 0) {
				actual_end = Math.max(length + end, 0);
			} else {
				actual_end = Math.min(end, length);
			}
		}

		for (let i = actual_start; i < actual_end; i++) {
			if (tracked_elements[i] === undefined) {
				tracked_elements[i] = tracked(this[i], block);
			} else {
				set(tracked_elements[i], this[i], block);
			}
		}

		return this;
	}

	reverse() {
		var result = /** @type {RippleArray<T>} */ (super.reverse());
		this.#update_all_tracked_from_array(result);
		return result;
	}

    /**
	 * @param {(a: T, b: T) => number} [fn]
     * @returns {this}
	 */
	sort(fn) {
		var result = super.sort(fn);
		this.#update_all_tracked_from_array(result);
		return result;
	}

	/**
	 * @param {RippleArray<T>} array
	 * @returns {RippleArray<T>}
	 */
	#update_all_tracked_from_array(array) {
		var block = safe_scope();
		var tracked_elements = this.#tracked_elements;

		for (var i = 0; i < array.length; i++) {
			this.#update_tracked_at_index({array, i, block, tracked_elements});
		}
		return array;
	}

	/**
	 * @param {Object} param0
	 * @param {RippleArray<T>} param0.array
	 * @param {number} param0.i
	 * @param {Block} param0.block
	 * @param {Tracked[]} param0.tracked_elements
	 */
	#update_tracked_at_index({
		array,
		i,
		block = safe_scope(),
		tracked_elements = this.#tracked_elements
	}) {
		if ((i in array)) {
			if (tracked_elements[i] === undefined) {
				tracked_elements[i] = tracked(array[i], block);
			} else {
				set(tracked_elements[i], array[i], block);
			}
		} else {
			if (tracked_elements[i] !== undefined) {
				set(tracked_elements[i], undefined, block);
			}
			delete tracked_elements[i];
		}
	}

    /**
	 * @param {...T} elements
     * @returns {number}
	 */
	unshift(...elements) {
		var block = safe_scope();
		var tracked_elements = this.#tracked_elements;
		var length = this.length;
		var shift_len = elements.length;
		var new_len = length + shift_len;

		super.unshift(...elements);

		// extend the array to fit the new elements
		tracked_elements.push(...(elements.map(() => tracked(undefined, block))));

		// copy the existing ones to the end
		for (let i = length - 1; i >= 0; i--) {
			set(tracked_elements[i + shift_len], tracked_elements[i].v, block);
		}

		// set new values at the start
		for (let i = shift_len - 1; i >= 0; i--) {
			set(tracked_elements[i], elements[i], block);
		}

		set(this.#tracked_index, new_len, block);
		return new_len;
	}

	shift() {
		var block = safe_scope();
		var tracked_elements = this.#tracked_elements;

		var result = super.shift();
		for (var i = 0; i < tracked_elements.length; i++) {
			// the last must be set to undefined
			set(tracked_elements[i], tracked_elements[i + 1]?.v, block);
		}
		tracked_elements.pop();

		set(this.#tracked_index, this.length, block);
		return result;
	}

	/**
	 * @param {...T} elements
	 * @returns {number}
	 */
	push(...elements) {
		var block = safe_scope();
		var start_index = this.length;
		var tracked_elements = this.#tracked_elements;

		super.push(...elements);

		for (var i = 0; i < elements.length; i++) {
			if (!(i in elements)) {
				continue;
			}
			tracked_elements[start_index + i] = tracked(elements[i], block);
		}
		var length = this.length;
		set(this.#tracked_index, this.length, block);
		return length;
	}

	pop() {
		var block = safe_scope();
		var tracked_elements = this.#tracked_elements;
		var length = tracked_elements.length;
		var result = super.pop();

		if (length > 0 && tracked_elements[length - 1] !== undefined) {
			set(tracked_elements[length - 1], undefined, block);
		}
		tracked_elements.pop();

		set(this.#tracked_index, this.length, block);
		return result;
	}

	/**
	 * Assigns value at index
	 * Same as bracket [] assignment
	 * Supports negative index to count back from the end
	 * @param {number} index
	 * @param {T} value
	 * @returns {T}
	 */
	[ARRAY_SET_INDEX_AT](index, value) {
		var block = safe_scope();
		var tracked_elements = this.#tracked_elements;
		var length = this.length;
		var init_index = index;

		if (!Number.isInteger(index)) {
			throw new TypeError('Provided index must be a valid integer');
		}

		if (init_index < -length) {
			throw new RangeError('Provided negative index out of bounds');
		}

		index = index < 0 ? index + length : index;

		super[index] = value;

		if (tracked_elements[index] === undefined) {
			tracked_elements[index] = tracked(value, block);
		} else {
			set(tracked_elements[index], value, block);
		}

		if (this.length > length) {
			set(this.#tracked_index, this.length, block);
		}

		return value;
	}

	/**
	 * @param {number} index
	 * @returns {T | undefined}
	 */
	at(index) {
		var tracked_elements = this.#tracked_elements;
		var normalized = index < 0 ? index + this.length : index;

		if (tracked_elements[normalized] !== undefined) {
			get(tracked_elements[normalized]);
		}
		this.$length;

		return super.at(index);
	}

	/**
	 * @param {number} start
	 * @param {number} [delete_count]
	 * @param {...T} elements
	 * @returns {Array<T>}
	 */
	splice(start, delete_count, ...elements) {
        var block = safe_scope();
        var tracked_elements = this.#tracked_elements;
        var tracked_len = tracked_elements.length;
        var before_len = this.length;
		var el_len = elements.length;
        var result;

        if (start !== undefined && delete_count === undefined && !el_len) {
            // we can't just call super.splice(start, delete_count, ...elements)
            // delete_count if undefined will be converted to 0 and nothing will be removed
            result = super.splice(start);
        } else if (start === undefined && delete_count === undefined && !el_len) {
            // If start is undefined the native code will get converted to 0
            // which would cause to remove all elements.
            // Typically no sense to `.splice()` with no args as it does nothing
            // since we get args as undefined, we need to handle this case

            // @ts-ignore
            result = super.splice();
        } else {
            // @ts-ignore
            result = super.splice(start, delete_count, ...elements);
        }

        var after_len = this.length;
        delete_count = result.length;

        if (delete_count === 0 && !el_len) {
            return result;
        }

        if (start < 0) {
            start = Math.max(before_len + start, 0);
        } else {
            start = Math.min(start, before_len);
        }

        var range_end = el_len - delete_count === 0
			? start + el_len
			: Math.max(after_len, tracked_len);

		for (let i = start; i < range_end; i++) {
			this.#update_tracked_at_index({array: this, i, block, tracked_elements});
		}

		tracked_elements.length = after_len;

        set(this.#tracked_index, this.length, block);
        return result;
    }

	get [TRACKED_OBJECT]() {
		return this.#tracked_elements;
	}

	get $length() {
		return get(this.#tracked_index);
	}

	/** @param {number} length */
	set $length(length) {
		if (length === this.length) {
			return;
		}

		var block = safe_scope();
		var tracked_elements = this.#tracked_elements;
		var tracked_len = tracked_elements.length;

		if (length < tracked_len) {
			for (var i = length; i < tracked_len; i++) {
				if (tracked_elements[i] !== undefined) {
					set(tracked_elements[i], undefined, block);
				}
			}
		}

		this.length = length;
		tracked_elements.length = length;
		set(this.#tracked_index, length, block);
	}

	/** @param {number} _ */
	set length(_) {
		// This doesn't actually work because length cannot be overridden.
		// This error is now moved to runtime to catch direct assignments to length
		throw new Error('Cannot set length on RippleArray, use $length instead');
	}

	toJSON() {
		this.$length;
		return get_all_elements(this);
	}
}

/**
 * @template T
 * @param {RippleArray<T>} array
 * @returns {T[]}
 */
export function get_all_elements(array) {
	/** @type {Tracked[]} */
	var tracked_elements = /** @type {Tracked[]} */ (array[TRACKED_OBJECT]);
	// pre-allocate to support holey arrays
	var result = new Array(array.length);

	for (var i = 0; i < array.length; i++) {
		if (tracked_elements[i] !== undefined) {
			get(tracked_elements[i]);
		}

		if (i in array) {
			result[i] = array[i];
		}
	}

	return result;
}

/**
 * @template T
 * @param {RippleArray<T>} array
 * @returns {void}
 */
function establish_trackable_deps (array) {
	var tracked_elements = array[TRACKED_OBJECT];

	for (var i = 0; i < tracked_elements.length; i++) {
		if (tracked_elements[i] !== undefined) {
			get(tracked_elements[i]);
		}
	}
}

/**
 * @template T
 * @param {T[]} array
 * @returns {RippleArray<T>}
 */
function get_instance_from_static(array) {
	/** @type RippleArray<T> */
	var result;
	/** @type {T | void} */
	var first = get_first_if_length(array);

	if (first) {
		result = new RippleArray();
		result[0] = first;
		result[INIT_AFTER_NEW]();
	} else {
		result = new RippleArray(...array);
	}

	return result;
}

/**
 * @template T
 * @param {T[]} array
 * @returns {T | void}
 */
function get_first_if_length (array) {
	var first = array[0];

	if (
		array.length === 1 && (0 in array) && Number.isInteger(first)
		&& /** @type {number} */ (first) >= 0
		&& /** @type {number} */ (first) <= MAX_ARRAY_LENGTH
	) {
		return first;
	}
}
