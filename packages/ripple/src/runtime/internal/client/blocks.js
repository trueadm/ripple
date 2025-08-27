import {
	BLOCK_HAS_RUN,
	BRANCH_BLOCK,
	COMPUTED,
	CONTAINS_TEARDOWN,
	DESTROYED,
	EFFECT_BLOCK,
	PAUSED,
	RENDER_BLOCK,
	ROOT_BLOCK,
	TRY_BLOCK
} from './constants';
import { next_sibling } from './operations';
import {
	active_block,
	active_component,
	active_reaction,
	run_block,
	run_teardown,
	schedule_update
} from './runtime';
import { suspend } from './try';

export function user_effect(fn) {
	if (active_block === null) {
		throw new Error('effect() must be called within an active context, such as a component or effect');
	}

	var component = active_component;
	if (component !== null && !component.m) {
		var e = (component.e ??= []);
		e.push({
			b: active_block,
			fn,
			r: active_reaction
		});

		return;
	}

	return block(EFFECT_BLOCK, fn);
}

export function effect(fn) {
	return block(EFFECT_BLOCK, fn);
}

export function render(fn, flags = 0) {
	return block(RENDER_BLOCK | flags, fn);
}

export function branch(fn, flags = 0) {
	return block(BRANCH_BLOCK | flags, fn);
}

export function async(fn) {
	return block(BRANCH_BLOCK, async () => {
		const unsuspend = suspend();
		await fn();
		unsuspend();
	});
}

export function root(fn) {
	return block(ROOT_BLOCK, fn);
}

export function create_try_block(fn, state) {
	return block(TRY_BLOCK, fn, state);
}

function push_block(block, parent_block) {
	var parent_last = parent_block.last;
	if (parent_last === null) {
		parent_block.last = parent_block.first = block;
	} else {
		parent_last.next = block;
		block.prev = parent_last;
		parent_block.last = block;
	}
}

export function block(flags, fn, state = null) {
	var block = {
		c: active_component,
		d: null,
		first: null,
		f: flags,
		fn,
		last: null,
		next: null,
		p: active_block,
		prev: null,
		s: state,
		t: null
	};

	if (active_reaction !== null && (active_reaction.f & COMPUTED) !== 0) {
		(active_reaction.blocks ??= []).push(block);
	}

	if (active_block !== null) {
		push_block(block, active_block);
	}

	if ((flags & EFFECT_BLOCK) !== 0) {
		schedule_update(block);
	} else {
		run_block(block);
		block.f ^= BLOCK_HAS_RUN;
	}

	return block;
}

export function destroy_block_children(parent, remove_dom = false) {
	var block = parent.first;
	parent.first = parent.last = null;

	if ((parent.f & CONTAINS_TEARDOWN) !== 0) {
		while (block !== null) {
			var next = block.next;
			destroy_block(block, remove_dom);
			block = next;
		}
	}
}

export function destroy_non_branch_children(parent, remove_dom = false) {
	var block = parent.first;

	if (
		(parent.f & CONTAINS_TEARDOWN) === 0 &&
		parent.first !== null &&
		(parent.first.f & BRANCH_BLOCK) === 0
	) {
		parent.first = parent.last = null;
	} else {
		while (block !== null) {
			var next = block.next;
			if ((block.f & BRANCH_BLOCK) === 0) {
				destroy_block(block, remove_dom);
			}
			block = next;
		}
	}
}

export function unlink_block(block) {
	var parent = block.p;
	var prev = block.prev;
	var next = block.next;

	if (prev !== null) prev.next = next;
	if (next !== null) next.prev = prev;

	if (parent !== null) {
		if (parent.first === block) parent.first = next;
		if (parent.last === block) parent.last = prev;
	}
}

export function pause_block(block) {
	if ((block.f & PAUSED) !== 0) {
		return;
	}
	block.f ^= PAUSED;

	var child = block.first;

	while (child !== null) {
		var next = child.next;
		pause_block(child);
		child = next;
	}

	run_teardown(block);
}

export function resume_block(block) {
	if ((block.f & PAUSED) === 0) {
		return;
	}
	block.f ^= PAUSED;

	if (is_block_dirty(block)) {
		schedule_update(block);
	}

	var child = block.first;

	while (child !== null) {
		var next = child.next;
		resume_block(child);
		child = next;
	}
}

export function is_destroyed(target_block) {
	var block = target_block;

	while (block !== null) {
		var flags = block.f;

		if ((flags & DESTROYED) !== 0) {
			return true;
		}
		if ((flags & ROOT_BLOCK) !== 0) {
			return false;
		}
		block = block.p;
	}
	return true;
}

export function destroy_block(block, remove_dom = true) {
	block.f ^= DESTROYED;

	var removed = false;

	if (remove_dom && (block.f & (BRANCH_BLOCK | ROOT_BLOCK)) !== 0) {
		var node = block.s.start;
		var end = block.s.end;

		while (node !== null) {
			var next = node === end ? null : next_sibling(node);

			node.remove();
			node = next;
		}

		removed = true;
	}

	destroy_block_children(block, remove_dom && !removed);

	run_teardown(block);

	var parent = block.p;

	// If the parent doesn't have any children, then skip this work altogether
	if (parent !== null && parent.first !== null) {
		unlink_block(block);
	}

	block.fn = block.s = block.d = block.p = null;
}
