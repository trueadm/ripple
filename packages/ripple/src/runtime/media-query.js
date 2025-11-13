import { on } from './internal/client/events.js';
import { get, safe_scope, set, tracked } from './internal/client/index.js';
import { ReactiveValue } from './reactive-value.js';

const parenthesis_regex = /\(.+\)/;
const non_parenthesized_keywords = new Set(['all', 'print', 'screen', 'and', 'or', 'not', 'only']);

/**
 * @constructor
 * @param {string} query
 * @param {boolean | undefined} [fallback]
 * @returns {ReactiveValue<boolean>}
 */
export function MediaQuery(query, fallback) {
	if (!new.target) {
		throw new TypeError('MediaQuery must be called with new');
	}

	var block = safe_scope();

	let final_query =
		parenthesis_regex.test(query) ||
		// we need to use `some` here because technically this `window.matchMedia('random,screen')` still returns true
		query.split(/[\s,]+/).some((keyword) => non_parenthesized_keywords.has(keyword.trim()))
			? query
			: `(${query})`;
	const q = window.matchMedia(final_query);
	const matches = tracked(q.matches, block);

	return new ReactiveValue(
		() => get(matches),
		() =>
			on(
				q,
				'change',
				() => {
					// skip wrapping in untrack as createSubscriber already does it
					if (q.matches !== get(matches)) {
						set(matches, q.matches);
					}
				},
				{ delegated: false },
			),
	);
}
