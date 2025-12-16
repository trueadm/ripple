/** @import { Block } from '#client' */

import { branch, destroy_block, render } from './blocks.js';
import { SWITCH_BLOCK } from './constants.js';
import { next_sibling } from './operations.js';
import { append } from './template.js';

/**
 * Moves a block's DOM nodes to before an anchor node
 * @param {Block} block
 * @param {ChildNode} anchor
 * @returns {void}
 */
function move(block, anchor) {
	var node = block.s.start;
	var end = block.s.end;
	/** @type {Node | null} */
	var sibling;

	while (node !== null) {
		if (node === end) {
			append(anchor, node);
			break;
		}
		sibling = next_sibling(node);
		append(anchor, node);
		node = sibling;
	}
}

/**
 * @param {ChildNode} anchor
 * @param {() => ((anchor: ChildNode) => void)[] | null} fn
 * @returns {void}
 */
export function switch_block(anchor, fn) {
	/** @type {((anchor: ChildNode) => void)[]} */
	var prev = [];
	/** @type {Map<(anchor: ChildNode) => void, Block>} */
	var blocks = new Map();

	render(
		() => {
			var funcs = fn();
			let same = prev.length === funcs?.length || false;

			for (var i = 0; i < prev.length; i++) {
				var p = prev[i];

				if (!funcs || funcs.indexOf(p) === -1) {
					same = false;
					destroy_block(/** @type {Block} */ (blocks.get(p)));
					blocks.delete(p);
				}
			}

			prev = funcs ?? [];

			if (same || !funcs) {
				return;
			}

			for (var i = 0; i < funcs.length; i++) {
				var n = funcs[i];
				var b = blocks.get(n);
				if (b) {
					move(b, anchor);
					continue;
				}

				blocks.set(
					n,
					branch(() => n(anchor)),
				);
			}
		},
		null,
		SWITCH_BLOCK,
	);
}
