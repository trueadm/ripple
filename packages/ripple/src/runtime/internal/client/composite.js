/** @import { Block, Component } from '#client' */

import { branch, destroy_block, render } from './blocks.js';
import { COMPOSITE_BLOCK } from './constants.js';
import { active_block } from './runtime.js';

/**
 * @param {() => (anchor: Node, props: Record<string, any>, block: Block | null) => void} get_component
 * @param {Node} node
 * @param {Record<string, any>} props
 * @returns {void}
 */
export function composite(get_component, node, props) {
	var anchor = node;
	/** @type {Block | null} */
	var b = null;

	render(() => {
		var component = get_component();

		if (b !== null) {
			destroy_block(b);
			b = null;
		}

		b = branch(() => {
			var block = active_block;
			component(anchor, props, block);
		});
	}, COMPOSITE_BLOCK);
}
