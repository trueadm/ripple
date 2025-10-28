/** @import { Block, Component } from '#client' */

import { branch, destroy_block, render, render_spread } from './blocks.js';
import { COMPOSITE_BLOCK } from './constants.js';
import { active_block } from './runtime.js';

/**
 * @typedef {((anchor: Node, props: Record<string, any>, block: Block | null) => void)} ComponentFunction
 * @param {() => ComponentFunction | keyof HTMLElementTagNameMap} get_component
 * @param {Node} node
 * @param {Record<string, any>} props
 * @returns {void}
 */
export function composite(get_component, node, props) {
	var anchor = node;
	/** @type {Block | null} */
	var b = null;

	render(
		() => {
			var component = get_component();

			if (b !== null) {
				destroy_block(b);
				b = null;
			}

			if (typeof component === 'function') {
				// Handle as regular component
				b = branch(() => {
					var block = active_block;
					/** @type {ComponentFunction} */ (component)(anchor, props, block);
				});
			} else {
				// Custom element
				b = branch(() => {
					var block = /** @type {Block} */ (active_block);

					var element = document.createElement(
						/** @type {keyof HTMLElementTagNameMap} */ (component),
					);
					/** @type {ChildNode} */ (anchor).before(element);

					if (block.s === null) {
						block.s = {
							start: element,
							end: element,
						};
					}

					render_spread(element, () => props || {});

					if (typeof props?.children === 'function') {
						var child_anchor = document.createComment('');
						element.appendChild(child_anchor);

						props?.children?.(child_anchor, {}, block);
					}
				});
			}
		},
		null,
		COMPOSITE_BLOCK,
	);
}
