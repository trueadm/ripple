/** @import { CompatApi } from '#client' */

import { ROOT_BLOCK } from "./constants.js";
import { active_block } from "./runtime.js";

/**
 * @param {string} kind
 * @returns {CompatApi | null}
 */
function get_compat_from_root(kind)  {
	var current = active_block;

	while (current !== null) {
		if ((current.f & ROOT_BLOCK) !== 0) {
			var api = current.s.compat[kind];

			if (api != null) {
				return api;
			}
		}
		current = current.p;
	}

	return null;
}

/**
 * @param {string} kind
 * @param {Node} node
 * @param {() => JSX.Element[]} children_fn
 */
export function tsx_compat(kind, node, children_fn) {
	var compat = get_compat_from_root(kind);

	if (compat == null) {
		throw new Error(`No compat API found for kind "${kind}"`);
	}

	compat.createComponent(node, children_fn);
}
