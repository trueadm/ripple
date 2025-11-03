import { render } from './blocks.js';
import { HEAD_BLOCK } from './constants.js';
import { create_text } from './operations.js';

/**
 * @param {(anchor: Node) => void} render_fn
 * @returns {void}
 */
export function head(render_fn) {
	/** @type {Comment | Text} */
	var anchor = document.head.appendChild(create_text());

	render(() => render_fn(anchor), null, HEAD_BLOCK);
}
