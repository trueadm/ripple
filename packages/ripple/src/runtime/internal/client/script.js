import { effect } from './blocks.js';
/**
 * @param {Text | Comment} node
 * @param {string} content
 */
export function script(node, content) {
	effect(() => {
		var script = document.createElement('script');
		script.textContent = content;
		node.before(script);

		return () => {
			script.remove();
		};
	});
}
