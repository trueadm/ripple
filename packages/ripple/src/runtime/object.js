/** @import { Block } from '#client' */
import { safe_scope } from './internal/client/runtime.js';
import { object_proxy } from './proxy.js';

/**
 * @template {object} T
 * @constructor
 * @param {T} obj
 * @returns {TrackedObject<T>}
 */
export function TrackedObject(obj) {
  if (!new.target) {
    throw new Error("TrackedObject must be called with 'new'");
  }

  var block = safe_scope();

  return object_proxy(obj, block);
}

/**
 * @template {object} T
 * @param {T} obj
 * @param {Block} block
 * @returns {TrackedObject<T>}
 */
export function tracked_object(obj, block) {
  return object_proxy(obj, block);
}
