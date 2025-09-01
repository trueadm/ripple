import { destroy_block, root } from './internal/client/blocks.js';
import { handle_root_events } from './internal/client/events.js';
import { init_operations } from './internal/client/operations.js';
import { active_block } from './internal/client/runtime.js';
import { create_anchor } from './internal/client/utils.js';

// Re-export JSX runtime functions for jsxImportSource: "ripple"
export { jsx, jsxs, Fragment } from '../jsx-runtime.js';

export function mount(component, options) {
	init_operations();

	const props = options.props || {};
	const target = options.target;
	const anchor = create_anchor();
	target.append(anchor);

	const cleanup_events = handle_root_events(target);

	const _root = root(() => {
		component(anchor, props, active_block);
	});

	return () => {
		cleanup_events();
		destroy_block(_root);
		target.removeChild(anchor_node);
	};
}

export { flush_sync as flushSync, untrack, deferred } from './internal/client/runtime.js';

export { array } from './array.js';

export { keyed } from './internal/client/for.js';

export { user_effect as effect } from './internal/client/blocks.js';

export { Portal } from './internal/client/portal.js';

export { ref } from './internal/client/runtime.js';