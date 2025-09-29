/** @import { Block } from '#client' */
import { safe_scope } from './internal/client/runtime.js';
import { array_proxy } from './proxy.js';

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
  return array_proxy({ elements, block });
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
  return array_proxy({ elements, block, from_static: true });
};

/**
 * @template T
 * @param {...T} items
 * @returns {TrackedArray<T>}
 */
TrackedArray.of = function (...items) {
  var block = safe_scope();
  var elements = Array.of(...items);
  return array_proxy({ elements, block, from_static: true });
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
  return array_proxy({ elements, block, from_static: true });
};

/**
 * @template T
 * @param {Array<T>} elements
 * @param {Block} block
 * @returns {TrackedArray<T>}
 */
export function tracked_array(elements, block) {
  return array_proxy({ elements, block, from_static: true });
}
