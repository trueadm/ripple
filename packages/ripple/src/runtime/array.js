/** @import { Block } from '#client' */
import { MAX_ARRAY_LENGTH, TRACKED_ARRAY, UNINITIALIZED } from './internal/client/constants.js';
import { get, safe_scope, set, tracked } from './internal/client/runtime.js';
import { get_descriptor } from './internal/client/utils.js';

/**
 * @template T
 * @constructor
 * @param {...T} elements
 * @returns {TrackedArray<T>}
 */
export function TrackedArray(...elements) {
  if (!new.target) {
    throw new Error("TrackedArray must be called with 'new'");
  }

  var block = safe_scope();

  return proxy({ elements, block });
}

/**
 * @template T
 * @param {ArrayLike<T> | Iterable<T>} arrayLike
 * @param {(v: T, k: number) => any | undefined} [mapFn]
 * @param {*} [thisArg]
 * @returns {TrackedArray<T>}
 */
TrackedArray.from = function (arrayLike, mapFn, thisArg) {
  var block = safe_scope();
  var elements = mapFn ? Array.from(arrayLike, mapFn, thisArg) : Array.from(arrayLike);
  return proxy({ elements, block, from_static: true });
};

/**
 * @template T
 * @param {...T} items
 * @returns {TrackedArray<T>}
 */
TrackedArray.of = function (...items) {
  var block = safe_scope();
  var elements = Array.of(...items);
  return proxy({ elements, block, from_static: true });
};

/**
 * @template T
 * @param {ArrayLike<T> | Iterable<T>} arrayLike
 * @param {(v: T, k: number) => any | undefined} [mapFn]
 * @param {any} [thisArg]
 * @returns {Promise<TrackedArray<T>>}
 */
TrackedArray.fromAsync = async function (arrayLike, mapFn, thisArg) {
  var block = safe_scope();
  var elements = mapFn
    ? await Array.fromAsync(arrayLike, mapFn, thisArg)
    : await Array.fromAsync(arrayLike);
  return proxy({ elements, block, from_static: true });
};

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
function proxy({ elements, block, from_static = false, use_array = false }) {
  var arr;
  var first;

  if (
    from_static &&
    (first = get_first_if_length(/** @type {Array<T>} */ (elements))) !== undefined
  ) {
    arr = new Array();
    arr[0] = first;
  } else if (use_array) {
    arr = elements;
  } else {
    arr = new Array(...elements);
  }

  var tracked_elements = new Map();
  var tracked_len = tracked(arr.length, block);
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

      var result = Reflect.get(target, prop, receiver);

      if (typeof result === "function" && methods_returning_arrays.has(prop)) {
        /** @type {(this: any, ...args: any[]) => any} */
        return function (...args) {
          var output = Reflect.apply(result, receiver, args)

          if (Array.isArray(output) && output !== target) {
            return proxy({ elements: output, block, use_array: true });
          }

          return output;
        };
      }

      return result;
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

      var result = Reflect.set(target, prop, value, receiver);

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
      if (prop === TRACKED_ARRAY) {
        return true;
      }
      var t = tracked_elements.get(prop);
      var exists = (t !== undefined && t.v !== UNINITIALIZED) || Reflect.has(target, prop);

      if (t !== undefined || !exists || get_descriptor(target, prop)?.writable) {
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
        throw new Error('Only basic property descriptors are supported with value and configurable, enumerable, and writable set to true');
      }

      var t = tracked_elements.get(prop);

      if (t === undefined) {
          t = tracked(descriptor.value, block);
          tracked_elements.set(prop, t);
      } else {
        set(t, descriptor.value, block);
      }

      return true;
    },
  });
}

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

const methods_returning_arrays = new Set([
  "concat",
  "filter",
  "flat",
  "flatMap",
  "map",
  "slice",
  "splice",
  "toReversed",
  "toSorted",
  "toSpliced",
  "with",
]);
