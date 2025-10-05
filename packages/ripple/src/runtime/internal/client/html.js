/** @import { Block } from '#client' */

import { remove_block_dom, render } from './blocks.js';
import { first_child } from './operations.js';
import { active_block } from './runtime.js';
import { assign_nodes, create_fragment_from_html } from './template.js';

/**
 * Renders dynamic HTML content into the DOM by inserting it before the anchor node.
 * Manages the lifecycle of HTML blocks, removing old content and inserting new content.
 * @param {ChildNode} node
 * @param {() => string} get_html
 * @returns {void}
 */
export function html(node, get_html, svg = false, mathml = false) {
	/** @type {ChildNode} */
	var anchor = node;
	/** @type {string} */
	var html = '';

	render(() => {
		var block = /** @type {Block} */ (active_block);
		html = get_html() + '';

		if (svg) html = `<svg>${html}</svg>`;
		else if (mathml) html = `<math>${html}</math>`;

		if (block.s !== null && block.s.start !== null) {
			remove_block_dom(block.s.start, /** @type {Node} */ (block.s.end));
			block.s.start = block.s.end = null;
		}

		if (html === '') return;
		/** @type {DocumentFragment | Element} */
		var node = create_fragment_from_html(html);

		if (svg || mathml) {
			node = /** @type {Element} */ (first_child(node));
		}

		assign_nodes(
			/** @type {Element} */ (first_child(node)),
			/** @type {Element} */ (node.lastChild),
		);

		if (svg || mathml) {
			while (first_child(node)) {
				anchor.before(/** @type {Element} */ (first_child(node)));
			}
		} else {
			anchor.before(node);
		}
	});
}
