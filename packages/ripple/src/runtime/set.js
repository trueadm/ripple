/** @import { Block, Tracked } from '#client' */
import { get, increment, safe_scope, set, tracked, with_scope } from './internal/client/runtime.js';

const introspect_methods = ['entries', 'forEach', 'keys', 'values', Symbol.iterator];

const compare_other_methods = ['isDisjointFrom', 'isSubsetOf', 'isSupersetOf'];

const new_other_methods = ['difference', 'intersection', 'symmetricDifference', 'union'];

let init = false;

/**
 * @template T
 * @extends {Set<T>}
 * @returns {TrackedSet<T>}
 */
export class TrackedSet extends Set {
	/** @type {Tracked} */
	#tracked_size;
	/** @type {Map<T, Tracked>} */
	#tracked_items = new Map();
	/** @type {Block} */
	#block;

	/**
	 * @param {Iterable<T>} [iterable]
	 */
	constructor(iterable) {
		super();

		var block = this.#block = safe_scope();

		if (iterable) {
			for (var item of iterable) {
				super.add(item);
				this.#tracked_items.set(item, tracked(0, block));
			}
		}

		this.#tracked_size = tracked(super.size, block);

		if (!init) {
			init = true;
			this.#init();
		}
	}

	/**
	 * @returns {void}
	 */
	#init() {
		var proto = TrackedSet.prototype;
		var set_proto = Set.prototype;

		for (const method of introspect_methods) {
			if (!(method in set_proto)) {
				continue;
			}

      /** @type {any} */ (proto)[method] = function (/** @type {...any} */ ...v) {
				this.size;

				return /** @type {any} */ (set_proto)[method].apply(this, v);
			};
		}

		for (const method of compare_other_methods) {
			if (!(method in set_proto)) {
				continue;
			}

      /** @type {any} */ (proto)[method] = function (/** @type {any} */ other, /** @type {...any} */ ...v) {
				this.size;

				if (other instanceof TrackedSet) {
					other.size;
				}

				return /** @type {any} */ (set_proto)[method].apply(this, [other, ...v]);
			};
		}

		for (const method of new_other_methods) {
			if (!(method in set_proto)) {
				continue;
			}

      /** @type {any} */ (proto)[method] = function (/** @type {any} */ other, /** @type {...any} */ ...v) {
				this.size;

				if (other instanceof TrackedSet) {
					other.size;
				}

				return new TrackedSet(/** @type {any} */(set_proto)[method].apply(this, [other, ...v]));
			};
		}
	}

	/**
	 * @param {T} value
	 * @returns {this}
	 */
	add(value) {
		var block = this.#block;

		if (!super.has(value)) {
			super.add(value);
			this.#tracked_items.set(value, tracked(0, block));
			set(this.#tracked_size, super.size);
		}

		return this;
	}

	/**
	 * @param {T} value
	 * @returns {boolean}
	 */
	delete(value) {
		var block = this.#block;

		if (!super.delete(value)) {
			return false;
		}

		var t = this.#tracked_items.get(value);

		if (t) {
			increment(t);
		}
		this.#tracked_items.delete(value);
		set(this.#tracked_size, super.size);

		return true;
	}

	/**
	 * @param {T} value
	 * @return {boolean}
	*/
	has(value) {

		var has = super.has(value);
		var tracked_items = this.#tracked_items;
		var t = tracked_items.get(value);

		if (t === undefined) {
			// if no tracked it also means super didn't have it
			// It's not possible to have a disconnect, we track each value
			// If the value doesn't exist, track the size in case it's added later
			// but don't create tracked entries willy-nilly to track all possible values
			this.size;
		} else {
			get(t);
		}

		return has;
	}

	/**
	 * @returns {void}
	 */
	clear() {
		var block = this.#block;

		if (super.size === 0) {
			return;
		}

		for (var [_, t] of this.#tracked_items) {
			increment(t);
		}

		super.clear();
		this.#tracked_items.clear();
		set(this.#tracked_size, 0);
	}

	/**
	 * @returns {number}
	 */
	get size() {
		return get(this.#tracked_size);
	}

	/**
	 * @returns {T[]}
	 */
	toJSON() {
		this.size;

		return [...this];
	}
}

/**
 * @template V
 * @param {Block} block
 * @param {...any} args
 * @returns {TrackedSet<V>}
 */
export function tracked_set(block, ...args) {
	return with_scope(block, () => new TrackedSet(...args));
}
