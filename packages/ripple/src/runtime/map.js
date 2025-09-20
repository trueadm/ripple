/** @import { Block, Tracked } from '#client' */
import { get, increment, safe_scope, set, tracked } from './internal/client/runtime.js';

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

  #init() {
    var proto = TrackedMap.prototype;
    var map_proto = Map.prototype;

    for (const method of introspect_methods) {
      proto[method] = function (...v) {
        this.size;
        this.#read_all();

        return map_proto[method].apply(this, v);
      };
    }
  }

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

  set(key, value) {
    var block = this.#block;
    var tracked_items = this.#tracked_items;
    var t = tracked_items.get(key);
    var prev_res = super.get(key);

    super.set(key, value);

    if (!t) {
      tracked_items.set(key, tracked(0, block));
      set(this.#tracked_size, super.size, block);
    } else if (prev_res !== value) {
      increment(t, block);
    }

    return this;
  }

  delete(key) {
    var block = this.#block;
    var tracked_items = this.#tracked_items;
    var t = tracked_items.get(key);
    var result = super.delete(key);

    if (t) {
      increment(t, block);
      tracked_items.delete(key);
      set(this.#tracked_size, super.size, block);
    }

    return result;
  }

  clear() {
    var block = this.#block;

    if (super.size === 0) {
      return;
    }

    for (var [_, t] of this.#tracked_items) {
      increment(t, block);
    }

    super.clear();
    this.#tracked_items.clear();
    set(this.#tracked_size, 0, block);
  }

  keys() {
    this.size;
    return super.keys();
  }

  #read_all() {
    for (const [, t] of this.#tracked_items) {
      get(t);
    }
  }

  get size() {
    return get(this.#tracked_size);
  }

  toJSON() {
    this.size;
    this.#read_all();

    return [...this];
  }
}
