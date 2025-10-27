/** @import { Block, CompatOptions } from '#client' */

import { destroy_block, root } from './internal/client/blocks.js';
import { handle_root_events } from './internal/client/events.js';
import { init_operations } from './internal/client/operations.js';
import { active_block } from './internal/client/runtime.js';
import { create_anchor } from './internal/client/utils.js';
import { remove_ssr_css } from './internal/client/css.js';

// Re-export JSX runtime functions for jsxImportSource: "ripple"
export { jsx, jsxs, Fragment } from '../jsx-runtime.js';

/**
 * @param {(anchor: Node, props: Record<string, any>, active_block: Block | null) => void} component
 * @param {{ props?: Record<string, any>, target: HTMLElement, compat?: CompatOptions }} options
 * @returns {() => void}
 */
export function mount(component, options) {
	init_operations();
	remove_ssr_css();

	const props = options.props || {};
	const target = options.target;
	const anchor = create_anchor();

	// Clear target content in case of SSR
	if (target.firstChild) {
		target.textContent = '';
	}

	target.append(anchor);

	const cleanup_events = handle_root_events(target);

	const _root = root(() => {
		component(anchor, props, active_block);
	}, options.compat);

	return () => {
		cleanup_events();
		destroy_block(_root);
	};
}

export { Context } from './internal/client/context.js';

export {
	flush_sync as flushSync,
	track,
	track_split as trackSplit,
	untrack,
	tick,
} from './internal/client/runtime.js';

export { TrackedArray } from './array.js';

export { TrackedObject } from './object.js';

export { TrackedSet } from './set.js';

export { TrackedMap } from './map.js';

export { TrackedDate } from './date.js';

export { TrackedURL } from './url.js';

export { TrackedURLSearchParams } from './url-search-params.js';

export { createSubscriber } from './create-subscriber.js';

export { MediaQuery } from './media-query.js';

export { user_effect as effect } from './internal/client/blocks.js';

export { Portal } from './internal/client/portal.js';

export { ref_prop as createRefKey, get, public_set as set } from './internal/client/runtime.js';

export { on } from './internal/client/events.js';

export {
	bindValue,
	bindChecked,
	bindClientWidth,
	bindClientHeight,
	bindContentRect,
	bindContentBoxSize,
	bindBorderBoxSize,
	bindDevicePixelContentBoxSize,
	bindInnerHTML,
	bindInnerText,
	bindTextContent,
	bindNode,
} from './internal/client/bindings.js';
