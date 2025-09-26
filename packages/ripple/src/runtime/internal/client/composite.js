import { branch, destroy_block, render } from './blocks.js';
import { COMPOSITE_BLOCK } from './constants.js';
import { active_block } from './runtime.js';

export function composite(get_component, node, props) {
	var anchor = node;
	var b = null;

	render(() => {
		var component = get_component();

    if (b !== null) {
      destroy_block(b);
      b = null;
    }

		b = branch(() => {
			var block = active_block;
			component(anchor, props, block);
		});
	}, COMPOSITE_BLOCK);
}
