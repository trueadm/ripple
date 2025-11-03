/** @import { Block } from '#client' */

import { branch, destroy_block, render } from './blocks.js';
import { IF_BLOCK, UNINITIALIZED } from './constants.js';

/**
 * @param {Node} node
 * @param {(set_branch: (fn: (anchor: Node) => void, flag?: boolean) => void) => void} fn
 * @returns {void}
 */
export function if_block(node, fn) {
	var anchor = node;
	var has_branch = false;
	/** @type {any} */
	var condition = UNINITIALIZED;
	/** @type {Block | null} */
	var b = null;

	/** @type {(fn: (anchor: Node) => void, flag?: boolean) => void} */
	var set_branch = (fn, flag = true) => {
		has_branch = true;
		update_branch(flag, fn);
	};

	/** @type {(new_condition: any, fn: ((anchor: Node) => void) | null) => void} */
	var update_branch = (new_condition, fn) => {
		if (condition === (condition = new_condition)) return;

		if (b !== null) {
			destroy_block(b);
			b = null;
		}

		if (fn !== null) {
			b = branch(() => fn(anchor));
		}
	};

	render(
		() => {
			has_branch = false;
			fn(set_branch);
			if (!has_branch) {
				update_branch(null, null);
			}
		},
		null,
		IF_BLOCK,
	);
}
