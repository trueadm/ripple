/** @import { Block } from '#client' */

import { TRACKED_OBJECT } from './internal/client/constants.js';
import { get, increment, safe_scope, set, tracked } from './internal/client/runtime.js';

var symbol_iterator = Symbol.iterator;

const introspect_methods = [
	'entries',
	'every',
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
	symbol_iterator,
	'values',
	'with',
];

let init = false;
export class RippleArray extends Array {
	#tracked_elements = [];
	#tracked_index;

	static from(arrayLike, mapFn, thisArg) {
		return new RippleArray(Array.from(arrayLike, mapFn, thisArg));
	}

	static of(...elements) {
		return new RippleArray(...elements);
	}

	constructor(...elements) {
		super(...elements);

		var block = safe_scope();
		var tracked_elements = this.#tracked_elements;

		for (var i = 0; i < this.length; i++) {
			tracked_elements[i] = tracked(0, block);
		}
		this.#tracked_index = tracked(this.length, block);

		if (!init) {
			init = true;
			this.#init();
		}
	}

	#init() {
		var proto = RippleArray.prototype;
		var array_proto = Array.prototype;

		for (const method of introspect_methods) {
			proto[method] = function (...v) {
				this.$length;
				get_all_elements(this);
				return array_proto[method].apply(this, v);
			};
		}
	}

	fill(val, start, end) {
		var block = safe_scope();
		var tracked_elements = this.#tracked_elements;

		super.fill(val, start, end);
		for (var i = 0; i < this.length; i++) {
			increment(tracked_elements[i], block);
		}
	}

	reverse() {
		var block = safe_scope();
		var tracked_elements = this.#tracked_elements;

		super.reverse();
		for (var i = 0; i < this.length; i++) {
			increment(tracked_elements[i], block);
		}
	}

	sort(fn) {
		var block = safe_scope();
		var tracked_elements = this.#tracked_elements;

		super.sort(fn);
		for (var i = 0; i < this.length; i++) {
			increment(tracked_elements[i], block);
		}
	}

	/**
	 * @param {...any} elements
	 * @returns {number}
	 */
	unshift(...elements) {
		var block = safe_scope();
		var tracked_elements = this.#tracked_elements;

		super.unshift(...elements);
		for (var i = 0; i < tracked_elements.length; i++) {
			increment(tracked_elements[i], block);
		}
		tracked_elements.unshift(...elements.map(() => tracked(0, block)));

		var length = this.length;
		set(this.#tracked_index, length, block);
		return length;
	}

	shift() {
		var block = safe_scope();
		var tracked_elements = this.#tracked_elements;

		super.shift();
		for (var i = 0; i < tracked_elements.length; i++) {
			increment(tracked_elements[i], block);
		}
		tracked_elements.shift();

		set(this.#tracked_index, this.length, block);
	}

	/**
	 * @param {...any} elements
	 * @returns {number}
	 */
	push(...elements) {
		var block = safe_scope();
		var start_index = this.length;
		var tracked_elements = this.#tracked_elements;

		super.push(...elements);

		for (var i = 0; i < elements.length; i++) {
			tracked_elements[start_index + i] = tracked(0, block);
		}
		var length = this.length;
		set(this.#tracked_index, this.length, block);
		return length;
	}

	pop() {
		var block = safe_scope();
		var tracked_elements = this.#tracked_elements;

		super.pop();
		if (tracked_elements.length > 0) {
			increment(tracked_elements[tracked_elements.length - 1], block);
		}
		tracked_elements.pop();

		set(this.#tracked_index, this.length, block);
	}

	/**
	 * @param {number} start
	 * @param {number} [delete_count]
	 * @param {...any} elements
	 * @returns {any[]}
	 */
	splice(start, delete_count, ...elements) {
		var block = safe_scope();
		var tracked_elements = this.#tracked_elements;

		super.splice(start, delete_count, ...elements);
		for (var i = 0; i < tracked_elements.length; i++) {
			increment(tracked_elements[i], block);
		}
		tracked_elements.splice(start, delete_count, ...elements.map(() => tracked(0, block)));

		set(this.#tracked_index, this.length, block);
	}

	get [TRACKED_OBJECT]() {
		return this.#tracked_elements;
	}

	get $length() {
		return get(this.#tracked_index);
	}

	set $length(length) {
		var block = safe_scope();
		var tracked_elements = this.#tracked_elements;

		if (length !== this.length) {
			for (var i = 0; i < tracked_elements.length; i++) {
				increment(tracked_elements[i], block);
			}
			this.length = length;
			set(this.#tracked_index, length, block);
			tracked_elements.length = length;
		}
	}

	/** @param {number} _ */
	set length(_) {
		throw new Error('Cannot set length on RippleArray, use $length instead');
	}

	toJSON() {
		this.$length;
		return get_all_elements(this);
	}
}

/**
 * @param {RippleArray} array
 * @returns {any[]}
 */
export function get_all_elements(array) {
	var tracked_elements = array[TRACKED_OBJECT];
	var arr = [];

	for (var i = 0; i < tracked_elements.length; i++) {
		get(tracked_elements[i]);
		arr.push(array[i]);
	}

	return arr;
}

