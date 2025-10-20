/** @import { Tsx } from '../types' */
/** @import { ReactNode } from 'react' */

import { effect } from 'ripple';
import { jsx, jsxs, Fragment } from 'react/jsx-runtime';
import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { createRoot } from 'react-dom/client';

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

			effect(() => {
				react_node = children_fn(tsx);
				trigger?.();
			});

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
			const root_element = document.createElement('div');

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
