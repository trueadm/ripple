/** @import { Derived } from '#client' */
import { createSubscriber } from './create-subscriber.js';
import { safe_scope, derived } from './internal/client/runtime.js';

/**
 * @template V
 * @constructor
 * @param {() => V} fn
 * @param {() => void | (() => void)} start
 * @returns {Derived}
 */
export function ReactiveValue(fn, start) {
	if (!new.target) {
		throw new TypeError('`ReactiveValue` must be called with new');
	}

	const s = createSubscriber(start);
	const block = safe_scope();

	return (derived(fn, block, () => { s(); return fn(); }, (_, prev) => prev));
}
