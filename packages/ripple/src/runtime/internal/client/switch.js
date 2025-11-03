/** @import { Block } from '#client' */

import { branch, destroy_block, render } from './blocks.js';
import { SWITCH_BLOCK } from './constants.js';

/**
 * @param {Node} node
 * @param {() => ((anchor: Node) => void)} fn
 * @returns {void}
 */
export function switch_block(node, fn) {
	var anchor = node;
	/** @type {any} */
	var current_branch = null;
	/** @type {Block | null} */
	var b = null;

	render(
		() => {
			const branch_fn = fn() ?? null;
			if (current_branch === branch_fn) return;
			current_branch = branch_fn;

			if (b !== null) {
				destroy_block(b);
				b = null;
			}

			if (branch_fn !== null) {
				b = branch(() => branch_fn(anchor));
			}
		},
		null,
		SWITCH_BLOCK,
	);
}
