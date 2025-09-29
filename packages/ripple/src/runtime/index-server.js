/** @import { Component, Derived, Tracked } from '#server' */

import { DERIVED, TRACKED, UNINITIALIZED } from './internal/client/constants.js';
import { is_tracked_object } from './internal/client/utils.js';
import { active_component } from './internal/server/index.js';

export { create_context as createContext } from './internal/server/context.js';

export function effect() {
	// NO-OP
}

export const TrackedArray = Array;

var empty_get_set = { get: undefined, set: undefined };

/**
 *
 * @param {any} v
 * @param {Function} [get]
 * @param {Function} [set]
 * @returns {Tracked | Derived}
 */
export function track(v, get, set) {
	var is_tracked = is_tracked_object(v);

	if (is_tracked) {
		return v;
	}

	if (typeof v === 'function') {
		return {
			a: get || set ? { get, set } : empty_get_set,
			co: active_component,
			f: TRACKED | DERIVED,
			fn: v,
			v: UNINITIALIZED,
		};
	}

	return {
		a: get || set ? { get, set } : empty_get_set,
		f: TRACKED,
		v,
	};
}

