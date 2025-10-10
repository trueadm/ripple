/** @import { Component, Derived, Tracked } from '#server' */

import { DERIVED, TRACKED, UNINITIALIZED } from './internal/client/constants.js';
import { is_tracked_object } from './internal/client/utils.js';
import { active_component } from './internal/server/index.js';

export { Context } from './internal/server/context.js';

export function effect() {
	// NO-OP
}

var empty_get_set = { get: undefined, set: undefined };

/**
 * @param {Derived | Tracked} tracked
 * @returns {any}
 */
export function get(tracked) {
	if (!is_tracked_object(tracked)) {
		return tracked;
	}

	var g = tracked.a.get;

	return g ? g(tracked.v) : tracked.v;
}

/**
 * @param {Tracked} tracked
 * @param {any} value
 */
export function set(tracked, value) {
	var s = tracked.a.set;

	tracked.v = s ? s(value, tracked.v) : value;
}

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

export const TrackedObject = globalThis.Object;
export const TrackedArray = globalThis.Array;
export const TrackedDate = globalThis.Date;
export const TrackedSet = globalThis.Set;
export const TrackedMap = globalThis.Map;
export const TrackedURL = globalThis.URL;
export const TrackedURLSearchParams = globalThis.URLSearchParams;

/**
 * @param {string} query A media query string
 * @param {boolean} [matches] Fallback value for the server
 */
export function MediaQuery(query, matches = false) {
	if (!new.target) {
		throw new TypeError('MediaQuery must be called with new');
	}

	return matches;
}

/**
 * @param {any} _
 */
export function createSubscriber(_) {
	return () => { /* NO-OP */ };
}
