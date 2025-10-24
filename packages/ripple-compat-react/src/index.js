/** @import { Tsx } from '../types' */
/** @import { ReactNode } from 'react' */

import { jsx, jsxs, Fragment } from 'react/jsx-runtime';
import { useSyncExternalStore, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { branch, with_block, proxy_tracked, set, render, tracked } from 'ripple/internal/client';

/** @type {Tsx} */
const tsx = {
	jsx,
	jsxs,
	Fragment,
};

export function createReactCompat() {
	const portals = new Map();

	return {
		/**
		 * @param {HTMLElement} node
		 * @param {(tsx: Tsx) => ReactNode} children_fn
		 */
		createComponent(node, children_fn) {
			const target_element = document.createElement('span');
			target_element.style.display = 'contents';
			node.before(target_element);

			/** @type {(() => void) | undefined} */
			let trigger;
			/** @type {(() => void) | undefined} */
			let teardown;
			/** @type {ReactNode} */
			let react_node;

			const e = render(() => {
				react_node = children_fn(tsx);
				trigger?.();
			});
			// @ts-ignore
			target_element.__ripple_block = e;

			/**
			 * @param {() => void} callback
			 */
			function subscribe(callback) {
				trigger = callback;

				return () => {
					teardown?.();
				};
			}

			function ReactCompat() {
				return useSyncExternalStore(subscribe, () => react_node);
			}

			const key = Math.random().toString(36).substring(2, 9);
			portals.set(target_element, { component: ReactCompat, key });
		},

		createRoot() {
			const root_element = document.createElement('span');

			function CompatRoot() {
				return Array.from(portals.entries()).map(([el, { component, key }], i) => {
					return createPortal(jsx(component, {}, key), el);
				});
			}

			const root = createRoot(root_element);
			root.render(jsx(CompatRoot, {}));

			return () => {
				root.unmount();
			};
		},
	};
}

/**
 * @param {HTMLSpanElement} node
 */
function get_block_from_dom(node) {
	/** @type {null | ParentNode} */
	let current = node;
	while (current) {
		const b = /** @type {any} */ (current).__ripple_block;
		if (b) {
			return /** @type {any} */ (b);
		}
		current = current.parentNode;
	}
	return null;
}

/**
 * @template P
 * @param {{ component: (anchor: Node, props: any) => void; props?: P }} props
 * @returns {React.JSX.Element}
 */
export function Ripple({ component, props }) {
	const ref = useRef(null);
	const tracked_props_ref = useRef(/** @type {any} */ (null));

	useLayoutEffect(() => {
		const span = /** @type {HTMLSpanElement | null} */ (ref.current);
		if (span === null) {
			return;
		}
		const frag = document.createDocumentFragment();
		const anchor = document.createTextNode('');
		const block = get_block_from_dom(span);
		const tracked_props = (tracked_props_ref.current = tracked(props || {}, block));
		const proxied_props = proxy_tracked(/** @type {any} */ (tracked_props));
		frag.append(anchor);

		const b = with_block(block, () =>
			branch(() => {
				component(anchor, proxied_props);
			}),
		);

		span.append(frag);

		return () => {
			anchor.remove();
		};
	}, [component]);

	useLayoutEffect(() => {
		set(/** @type {any} */ (tracked_props_ref.current), props || {});
	}, [props]);

	return jsx('span', { ref, style: { display: 'contents' } });
}
