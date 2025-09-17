import { branch, destroy_block, render } from './blocks';
import { UNINITIALIZED } from './constants';
import { handle_root_events } from './events';
import { create_text } from './operations';
import { old_get_property } from './runtime';

export function Portal(_, props) {
	let $target = UNINITIALIZED;
	let children = UNINITIALIZED;
	var b = null;
	var anchor = null;

	render(() => {
		if ($target === ($target = old_get_property(props, '$target'))) return;
		if (children === (children = old_get_property(props, 'children'))) return;

		if (b !== null) {
			destroy_block(b);
		}

		anchor = create_text();
		$target.append(anchor);

		const cleanup_events = handle_root_events($target);

		b = branch(() => children(anchor));

		return () => {
			cleanup_events();
			anchor.remove();
		};
	});
}
