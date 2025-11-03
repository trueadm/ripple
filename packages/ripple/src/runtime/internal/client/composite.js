/** @import { Block } from '#client' */

import { branch, destroy_block, render, render_spread } from './blocks.js';
import { COMPOSITE_BLOCK, NAMESPACE_URI, DEFAULT_NAMESPACE } from './constants.js';
import { active_block, active_namespace, with_ns } from './runtime.js';
import { top_element_to_ns } from './utils.js';

/**
 * @typedef {((anchor: Node, props: Record<string, any>, block: Block | null) => void)} ComponentFunction
 * @param {() => ComponentFunction | keyof HTMLElementTagNameMap | keyof SVGElementTagNameMap | keyof MathMLElementTagNameMap} get_component
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
				var run = () => {
					var block = /** @type {Block} */ (active_block);

					var element =
						active_namespace !== DEFAULT_NAMESPACE
							? document.createElementNS(
									NAMESPACE_URI[active_namespace],
									/** @type {keyof HTMLElementTagNameMap} */ (component),
								)
							: document.createElement(/** @type {keyof HTMLElementTagNameMap} */ (component));

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
				};

				const ns = top_element_to_ns(component, active_namespace);

				if (ns !== active_namespace) {
					// support top-level dynamic element svg/math <@tag />
					b = branch(() => with_ns(ns, run));
				} else {
					b = branch(run);
				}
			}
		},
		null,
		COMPOSITE_BLOCK,
	);
}
