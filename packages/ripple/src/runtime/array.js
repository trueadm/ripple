import { TRACKED_OBJECT } from './internal/client/constants.js';
import { get, increment, scope, set, tracked } from './internal/client/runtime.js';

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
	'with'
];

let init = false;

class RippleArray extends Array {
	#tracked_elements = [];
	#tracked_index;

	constructor(...elements) {
		super(...elements);

		var block = scope();
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

	fill() {
		var block = scope();
		var tracked_elements = this.#tracked_elements;

		super.fill();
		for (var i = 0; i < this.length; i++) {
			increment(tracked_elements[i], block);
		}
	}

	reverse() {
		var block = scope();
		var tracked_elements = this.#tracked_elements;

		super.reverse();
		for (var i = 0; i < this.length; i++) {
			increment(tracked_elements[i], block);
		}
	}

	sort(fn) {
		var block = scope();
		var tracked_elements = this.#tracked_elements;

		super.sort(fn);
		for (var i = 0; i < this.length; i++) {
			increment(tracked_elements[i], block);
		}
	}

	unshift(...elements) {
		var block = scope();
		var tracked_elements = this.#tracked_elements;

		super.unshift(...elements);
		for (var i = 0; i < tracked_elements.length; i++) {
			increment(tracked_elements[i], block);
		}
		tracked_elements.unshift(...elements.map(() => tracked(0, block)));

		set(this.#tracked_index, this.length, block);
	}

	shift() {
		var block = scope();
		var tracked_elements = this.#tracked_elements;

		super.shift();
		for (var i = 0; i < tracked_elements.length; i++) {
			increment(tracked_elements[i], block);
		}
		tracked_elements.shift();

		set(this.#tracked_index, this.length, block);
	}

	push(...elements) {
		var block = scope();
		var start_index = this.length;
		var tracked_elements = this.#tracked_elements;

		super.push(...elements);

		for (var i = 0; i < elements.length; i++) {
			tracked_elements[start_index + i] = tracked(0, block);
		}
		set(this.#tracked_index, this.length, block);
	}

	pop() {
		var block = scope();
		var tracked_elements = this.#tracked_elements;

		super.pop();
		if (tracked_elements.length > 0) {
			increment(tracked_elements[tracked_elements.length - 1], block);
		}
		tracked_elements.pop();

		set(this.#tracked_index, this.length, block);
	}

	splice(start, delete_count, ...elements) {
		var block = scope();
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
        var block = scope();
        var tracked_elements = this.#tracked_elements;

        if (length !== this.$length) {
            for (var i = 0; i < tracked_elements.length; i++) {
                increment(tracked_elements[i], block);
            }
            this.length = length;
            tracked_elements.length = length;

            return true;
        }
		return false;
	}

    set length(_) {
        throw new Error('Cannot set length on RippleArray, use $length instead');
    }

	toJSON() {
		this.$length;
		return get_all_elements(this);
	}
}

export function get_all_elements(array) {
	var tracked_elements = array[TRACKED_OBJECT];
	var arr = [];

	for (var i = 0; i < tracked_elements.length; i++) {
		get(tracked_elements[i]);
		arr.push(array[i]);
	}

	return arr;
}

export function array(...elements) {
	return new RippleArray(...elements);
}
