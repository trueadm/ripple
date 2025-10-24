/** @import { Block, Tracked } from '#client' */
import { get, increment, safe_scope, set, tracked, with_scope } from './internal/client/runtime.js';

const introspect_methods = ['entries', 'forEach', 'values', Symbol.iterator];

let init = false;

/**
 * @template K, V
 * @extends {Map<K, V>}
 * @returns {TrackedMap<K, V>}
 */
export class TrackedMap extends Map {
	/** @type {Tracked} */
	#tracked_size;
	/** @type {Map<K, Tracked>} */
	#tracked_items = new Map();
	/** @type {Block} */
	#block;

	/**
	 * @param {Iterable<readonly [K, V]>} [iterable]
	 */
	constructor(iterable) {
		super();

		var block = this.#block = safe_scope();

		if (iterable) {
			for (var [key, value] of iterable) {
				super.set(key, value);
				this.#tracked_items.set(key, tracked(0, block));
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
		var proto = TrackedMap.prototype;
		var map_proto = Map.prototype;

		for (const method of introspect_methods) {
      /** @type {any} */ (proto)[method] = function (/** @type {...any} */ ...v) {
				this.size;
				this.#read_all();

				return /** @type {any} */ (map_proto)[method].apply(this, v);
			};
		}
	}

	/**
	 * @param {K} key
	 * @returns {V | undefined}
	 */
	get(key) {
		var tracked_items = this.#tracked_items;
		var t = tracked_items.get(key);

		if (t === undefined) {
			// same logic as has
			this.size;
		} else {
			get(t);
		}

		return super.get(key);
	}

	/**
	 * @param {K} key
	 * @returns {boolean}
	 */
	has(key) {
		var has = super.has(key);
		var tracked_items = this.#tracked_items;
		var t = tracked_items.get(key);

		if (t === undefined) {
			// if no tracked it also means super didn't have it
			// It's not possible to have a disconnect, we tract each key
			// If the key doesn't exist, track the size in case it's added later
			// but don't create tracked entries willy-nilly to track all possible keys
			this.size;
		} else {
			get(t);
		}

		return has;
	}

	/**
	 * @param {K} key
	 * @param {V} value
	 * @returns {this}
	 */
	set(key, value) {
		var block = this.#block;
		var tracked_items = this.#tracked_items;
		var t = tracked_items.get(key);
		var prev_res = super.get(key);

		super.set(key, value);

		if (!t) {
			tracked_items.set(key, tracked(0, block));
			set(this.#tracked_size, super.size);
		} else if (prev_res !== value) {
			increment(t);
		}

		return this;
	}

	/**
	 * @param {K} key
	 * @returns {boolean}
	 */
	delete(key) {
		var block = this.#block;
		var tracked_items = this.#tracked_items;
		var t = tracked_items.get(key);
		var result = super.delete(key);

		if (t) {
			increment(t);
			tracked_items.delete(key);
			set(this.#tracked_size, super.size);
		}

		return result;
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
	 * @returns {MapIterator<K>}
	 */
	keys() {
		this.size;
		return super.keys();
	}

	/**
	 * @returns {void}
	 */
	#read_all() {
		for (const [, t] of this.#tracked_items) {
			get(t);
		}
	}

	/**
	 * @returns {number}
	 */
	get size() {
		return get(this.#tracked_size);
	}

	/**
	 * @returns {Array<[K, V]>}
	 */
	toJSON() {
		this.size;
		this.#read_all();

		return [...this];
	}
}

/**
 * @template K, V
 * @param {Block} block
 * @param {...any} args
 * @returns {TrackedMap<K, V>}
 */
export function tracked_map(block, ...args) {
	return with_scope(block, () => new TrackedMap(...args));
}
