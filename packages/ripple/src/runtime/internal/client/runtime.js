import {
	destroy_block,
	destroy_non_branch_children,
	effect,
	is_destroyed,
	render
} from './blocks.js';
import {
	ASYNC_BLOCK,
	BLOCK_HAS_RUN,
	BRANCH_BLOCK,
	COMPUTED,
	COMPUTED_PROPERTY,
	CONTAINS_TEARDOWN,
	CONTAINS_UPDATE,
	DEFERRED,
	DESTROYED,
	EFFECT_BLOCK,
	PAUSED,
	ROOT_BLOCK,
	TRACKED,
	TRACKED_OBJECT,
	TRY_BLOCK,
	UNINITIALIZED
} from './constants';
import { capture, suspend } from './try.js';
import { define_property, is_array } from './utils';
import {
	object_keys as original_object_keys,
	object_values as original_object_values,
	object_entries as original_object_entries,
	structured_clone as original_structured_clone
} from './utils.js';

const FLUSH_MICROTASK = 0;
const FLUSH_SYNC = 1;

export let active_block = null;
export let active_reaction = null;
export let active_scope = null;
export let active_component = null;

var old_values = new Map();

// Used for controlling the flush of blocks
let scheduler_mode = FLUSH_MICROTASK;
// Used for handling scheduling
let is_micro_task_queued = false;
let clock = 0;
let queued_root_blocks = [];
let queued_microtasks = [];
let flush_count = 0;
let active_dependency = null;

export let tracking = false;
export let teardown = false;

function increment_clock() {
	return ++clock;
}

export function set_active_block(block) {
	active_block = block;
}

export function set_active_reaction(reaction) {
	active_reaction = reaction;
}

export function set_active_component(component) {
	active_component = component;
}

export function set_tracking(value) {
	tracking = value;
}

export function run_teardown(block) {
	var fn = block.t;
	if (fn !== null) {
		var previous_block = active_block;
		var previous_reaction = active_reaction;
		var previous_tracking = tracking;
		var previous_teardown = teardown;

		try {
			active_block = null;
			active_reaction = null;
			tracking = false;
			teardown = true;
			fn.call(null);
		} finally {
			active_block = previous_block;
			active_reaction = previous_reaction;
			tracking = previous_tracking;
			teardown = previous_teardown;
		}
	}
}

function update_computed(computed) {
	var value = computed.v;

	if (value === UNINITIALIZED || is_tracking_dirty(computed.d)) {
		value = run_computed(computed);

		if (value !== computed.v) {
			computed.v = value;
			computed.c = increment_clock();
		}
	}
}

function destroy_computed_children(computed) {
	var blocks = computed.blocks;

	if (blocks !== null) {
		computed.blocks = null;
		for (var i = 0; i < blocks.length; i++) {
			destroy_block(blocks[i]);
		}
	}
}

function run_computed(computed) {
	var previous_block = active_block;
	var previous_reaction = active_reaction;
	var previous_tracking = tracking;
	var previous_dependency = active_dependency;
	var previous_component = active_component;

	try {
		active_block = computed.b;
		active_reaction = computed;
		tracking = true;
		active_dependency = null;
		active_component = active_block.c;

		destroy_computed_children(computed);

		var value = computed.fn();

		computed.d = active_dependency;

		return value;
	} finally {
		active_block = previous_block;
		active_reaction = previous_reaction;
		tracking = previous_tracking;
		active_dependency = previous_dependency;
		active_component = previous_component;
	}
}

export function handle_error(error, block) {
	var current = block;

	while (current !== null) {
		var state = current.s;
		if ((current.f & TRY_BLOCK) !== 0 && state.c !== null) {
			state.c(error);
			return;
		}
		current = current.p;
	}

	throw error;
}

export function run_block(block) {
	var previous_block = active_block;
	var previous_reaction = active_reaction;
	var previous_tracking = tracking;
	var previous_dependency = active_dependency;
	var previous_component = active_component;

	try {
		active_block = block;
		active_reaction = block;
		active_component = block.c;

		destroy_non_branch_children(block);
		run_teardown(block);

		tracking = (block.f & (ROOT_BLOCK | BRANCH_BLOCK)) === 0;
		active_dependency = null;
		var res = block.fn();

		if (typeof res === 'function') {
			block.t = res;
			let current = block;

			while (current !== null && (current.f & CONTAINS_TEARDOWN) === 0) {
				current.f ^= CONTAINS_TEARDOWN;
				current = current.p;
			}
		}

		block.d = active_dependency;
	} catch (error) {
		handle_error(error, block);
	} finally {
		active_block = previous_block;
		active_reaction = previous_reaction;
		tracking = previous_tracking;
		active_dependency = previous_dependency;
		active_component = previous_component;
	}
}

export function tracked(v, b) {
	return {
		b,
		c: 0,
		f: TRACKED,
		v
	};
}

export function computed(fn, b) {
	return {
		b,
		blocks: null,
		c: 0,
		d: null,
		f: TRACKED | COMPUTED,
		fn,
		v: UNINITIALIZED
	};
}

function create_dependency(tracked) {
	var existing = active_reaction.d;

	// Recycle tracking entries
	if (existing !== null) {
		active_reaction.d = existing.n;
		existing.c = tracked.c;
		existing.t = tracked;
		existing.n = null;
		return existing;
	}

	return {
		c: tracked.c,
		t: tracked,
		n: null
	};
}

function is_tracking_dirty(tracking) {
	if (tracking === null) {
		return false;
	}
	while (tracking !== null) {
		var tracked = tracking.t;

		if ((tracked.f & COMPUTED) !== 0) {
			update_computed(tracked);
		}

		if (tracked.c > tracking.c) {
			return true;
		}
		tracking = tracking.n;
	}

	return false;
}

function is_block_dirty(block) {
	var flags = block.f;

	if ((flags & (ROOT_BLOCK | BRANCH_BLOCK)) !== 0) {
		return false;
	}
	if ((flags & BLOCK_HAS_RUN) === 0) {
		block.f ^= BLOCK_HAS_RUN;
		return true;
	}

	return is_tracking_dirty(block.d);
}

export function async_computed(fn, block) {
	let parent = active_reaction;
	var t = tracked(UNINITIALIZED, block);
	var promise;
	var new_values = new Map();

	render(() => {
		var [current, deferred] = capture_deferred(() => (promise = fn()));

		var restore = capture();
		var unuspend;

		if (deferred === null) {
			unuspend = suspend();
		} else {
			for (var i = 0; i < deferred.length; i++) {
				var tracked = deferred[i];
				new_values.set(tracked, { v: tracked.v, c: tracked.c });
			}
		}

		promise.then((v) => {
			if (is_destroyed(parent)) {
				return;
			}
			if (promise === current && t.v !== v) {
				restore();

				if (t.v === UNINITIALIZED) {
					t.v = v;
				} else {
					set(t, v, block);
				}
			}

			if (deferred === null) {
				unuspend();
			} else if (promise === current) {
				for (var i = 0; i < deferred.length; i++) {
					var tracked = deferred[i];
					var { v, c } = new_values.get(tracked);
					tracked.v = v;
					tracked.c = c;
					schedule_update(tracked.b);
				}
				new_values.clear();
			}
		});
	}, ASYNC_BLOCK);

	return new Promise(async (resolve) => {
		var p;
		while (p !== (p = promise)) await p;
		return resolve(t);
	});
}

export function deferred(fn) {
	var parent = active_block;
	var block = active_scope;
	var res = [UNINITIALIZED];
	var t = tracked(UNINITIALIZED, block, DEFERRED);
	var tracked_properties = [t];
	var prev_value = UNINITIALIZED;

	define_property(res, TRACKED_OBJECT, {
		value: tracked_properties,
		enumerable: false
	});

	render(() => {
		if (prev_value !== UNINITIALIZED) {
			t.v = prev_value;
		} else {
			prev_value = t.v;
		}
		var prev_version = t.c;
		var value = fn();

		res[0] = value;
		set_property(res, 0, value, block);

		if (prev_value !== UNINITIALIZED) {
			if ((t.f & DEFERRED) === 0) {
				t.f ^= DEFERRED;
			}

			var is_awaited = flush_deferred_upodates(parent);
			if ((t.f & DEFERRED) !== 0) {
				t.f ^= DEFERRED;
			}

			if (is_awaited) {
				t.c = prev_version;
				t.v = prev_value;
				prev_value = value;
			}
		}
	});

	return res;
}

function capture_deferred(fn) {
	var value = fn();
	var deferred = null;
	var depedency = active_dependency;

	while (depedency !== null) {
		var tracked = depedency.t;
		if ((tracked.f & DEFERRED) !== 0) {
			deferred ??= [];
			deferred.push(tracked);
			break;
		}
		depedency = depedency.n;
	}

	return [value, deferred];
}

function flush_deferred_upodates(block) {
	var current = block.first;
	var is_awaited = false;

	main_loop: while (current !== null) {
		var flags = current.f;

		if ((flags & ASYNC_BLOCK) !== 0 && is_block_dirty(current)) {
			is_awaited = true;
			run_block(current);
		}

		var parent = current.p;
		current = current.next;

		while (current === null && parent !== null) {
			if (parent === block) {
				break main_loop;
			}
			current = parent.next;
			parent = parent.p;
		}
	}

	return is_awaited;
}

function flush_updates(root_block) {
	var current = root_block;
	var containing_update = null;
	var effects = [];

	while (current !== null) {
		var flags = current.f;

		if ((flags & CONTAINS_UPDATE) !== 0) {
			current.f ^= CONTAINS_UPDATE;
			containing_update = current;
		}

		if ((flags & PAUSED) === 0 && containing_update !== null) {
			if ((flags & EFFECT_BLOCK) !== 0) {
				effects.push(current);
			} else {
				try {
					if (is_block_dirty(current)) {
						run_block(current);
					}
				} catch (error) {
					handle_error(error, current);
				}
			}
			var child = current.first;

			if (child !== null) {
				current = child;
				continue;
			}
		}

		var parent = current.p;
		current = current.next;

		while (current === null && parent !== null) {
			if (parent === containing_update) {
				containing_update = null;
			}
			current = parent.next;
			parent = parent.p;
		}
	}

	var length = effects.length;

	for (var i = 0; i < length; i++) {
		var effect = effects[i];
		var flags = effect.f;

		try {
			if ((flags & (PAUSED | DESTROYED)) === 0 && is_block_dirty(effect)) {
				run_block(effect);
			}
		} catch (error) {
			handle_error(error, effect);
		}
	}
}

function flush_queued_root_blocks(root_blocks) {
	for (let i = 0; i < root_blocks.length; i++) {
		flush_updates(root_blocks[i]);
	}
}

function flush_microtasks() {
	is_micro_task_queued = false;

	if (queued_microtasks.length > 0) {
		var microtasks = queued_microtasks;
		queued_microtasks = [];
		for (var i = 0; i < microtasks.length; i++) {
			microtasks[i]();
		}
	}

	if (flush_count > 1001) {
		return;
	}
	var previous_queued_root_blocks = queued_root_blocks;
	queued_root_blocks = [];
	flush_queued_root_blocks(previous_queued_root_blocks);

	if (!is_micro_task_queued) {
		flush_count = 0;
	}
	old_values.clear();
}

export function queue_microtask(fn) {
	if (!is_micro_task_queued) {
		is_micro_task_queued = true;
		queueMicrotask(flush_microtasks);
	}
	if (fn !== undefined) {
		queued_microtasks.push(fn);
	}
}

export function schedule_update(block) {
	if (scheduler_mode === FLUSH_MICROTASK) {
		queue_microtask();
	}
	let current = block;

	while (current !== null) {
		var flags = current.f;
		if ((flags & CONTAINS_UPDATE) !== 0) return;
		current.f ^= CONTAINS_UPDATE;
		if ((flags & ROOT_BLOCK) !== 0) {
			break;
		}
		current = current.p;
	}

	queued_root_blocks.push(current);
}

function register_dependency(tracked) {
	var depedency = active_dependency;

	if (depedency === null) {
		depedency = create_dependency(tracked);
		active_dependency = depedency;
	} else {
		var current = depedency;

		while (current !== null) {
			if (current.t === tracked) {
				current.c = tracked.c;
				return;
			}
			var next = current.n;
			if (next === null) {
				break;
			}
			current = next;
		}

		depedency = create_dependency(tracked);
		current.n = depedency;
	}
}

export function get_computed(computed) {
	update_computed(computed);
	if (tracking) {
		register_dependency(computed);
	}

	return computed.v;
}

export function get(tracked) {
	return (tracked.f & COMPUTED) !== 0 ? get_computed(tracked) : get_tracked(tracked);
}

export function get_tracked(tracked) {
	var value = tracked.v;
	if (tracking) {
		register_dependency(tracked);
	}
	if (teardown && old_values.has(tracked)) {
		return old_values.get(tracked);
	}
	return value;
}

export function set(tracked, value, block) {
	var old_value = tracked.v;

	if (value !== old_value) {
		var tracked_block = tracked.b;

		if ((block.f & CONTAINS_TEARDOWN) !== 0) {
			if (teardown) {
				old_values.set(tracked, value);
			} else {
				old_values.set(tracked, old_value);
			}
		}

		tracked.v = value;
		tracked.c = increment_clock();

		if (tracked_block !== block) {
			throw new Error(
				'Tracked state can only be updated within the same component context that it was created in (that includes effects or event handler within that component).'
			);
		}
		schedule_update(tracked_block);
	}
}

export function untrack(fn) {
	var previous_tracking = tracking;
	var previous_dependency = active_dependency;
	tracking = false;
	active_dependency = null;
	try {
		return fn();
	} finally {
		tracking = previous_tracking;
		active_dependency = previous_dependency;
	}
}

export function flush_sync(fn) {
	var previous_scheduler_mode = scheduler_mode;
	var previous_queued_root_blocks = queued_root_blocks;

	try {
		const root_blocks = [];

		scheduler_mode = FLUSH_SYNC;
		queued_root_blocks = root_blocks;
		is_micro_task_queued = false;

		flush_queued_root_blocks(previous_queued_root_blocks);

		var result = fn?.();

		if (queued_root_blocks.length > 0 || root_blocks.length > 0) {
			flush_sync();
		}

		flush_count = 0;

		return result;
	} finally {
		scheduler_mode = previous_scheduler_mode;
		queued_root_blocks = previous_queued_root_blocks;
	}
}

export function tracked_object(obj, properties, block) {
	var tracked_properties = obj[TRACKED_OBJECT];

	if (tracked_properties === undefined) {
		tracked_properties = {};
		define_property(obj, TRACKED_OBJECT, {
			value: tracked_properties,
			enumerable: false
		});
	}

	for (var i = 0; i < properties.length; i++) {
		var property = properties[i];
		var initial = obj[property];
		var tracked_property;

		if (typeof initial === 'function' && initial[COMPUTED_PROPERTY] === true) {
			tracked_property = computed(initial, block);
			initial = run_computed(tracked_property);
			obj[property] = initial;
			// TODO If nothing is tracked in the computed function, we can make it a standard tracked
			// however this is more allocations, so we probably want to minimize this
			// if (tracked_property.d === null) {
			// 	tracked_property = tracked(initial, block);
			// }
		} else {
			tracked_property = tracked(initial, block);
		}
		tracked_properties[property] = tracked_property;
	}

	return obj;
}

export function computed_property(fn) {
	define_property(fn, COMPUTED_PROPERTY, {
		value: true,
		enumerable: false
	});
	return fn;
}

export function get_property(obj, property, chain = false) {
	if (chain && obj == null) {
		return undefined;
	}
	var value = obj[property];
	var tracked_properties = obj[TRACKED_OBJECT];
	var tracked_property = tracked_properties?.[property];

	if (tracked_property !== undefined) {
		value = obj[property] = get(tracked_property);
	}

	return value;
}

export function set_property(obj, property, value, block) {
	var res = (obj[property] = value);
	var tracked_properties = obj[TRACKED_OBJECT];
	var tracked = tracked_properties?.[property];

	if (tracked === undefined) {
		return res;
	}

	set(tracked, value, block);
}

export function update(tracked, block, d = 1) {
	var value = get(tracked);
	var result = d === 1 ? value++ : value--;

	set(tracked, value, block);

	return result;
}

export function increment(tracked, block) {
	set(tracked, tracked.v + 1, block);
}

export function update_pre(tracked, block, d = 1) {
	var value = get(tracked);

	return set(tracked, d === 1 ? ++value : --value, block);
}

export function update_property(obj, property, block, d = 1) {
	var tracked_properties = obj[TRACKED_OBJECT];
	var tracked = tracked_properties?.[property];

	if (tracked === undefined) {
		return d === 1 ? obj[property]++ : obj[property]--;
	}

	var value = get(tracked);
	var result = d === 1 ? value++ : value--;

	increment(tracked, block);
	return result;
}

export function update_pre_property(obj, property, block, d = 1) {
	var tracked_properties = obj[TRACKED_OBJECT];
	var tracked = tracked_properties?.[property];

	if (tracked === undefined) {
		return d === 1 ? ++obj[property] : --obj[property];
	}

	var value = get(tracked);
	var result = d === 1 ? ++value : --value;

	increment(tracked, block);
	return result;
}

export function structured_clone(val, options) {
	if (typeof val === 'object' && val !== null) {
		var tracked_properties = val[TRACKED_OBJECT];
		if (tracked_properties !== undefined) {
			if (is_array(val)) {
				val.$length;
			}
			return structured_clone(object_values(val), options);
		}
	}
	return original_structured_clone(val, options);
}

export function object_keys(obj) {
	if (is_array(obj) && TRACKED_OBJECT in obj) {
		obj.$length;
	}
	return original_object_keys(obj);
}

export function object_values(obj) {
	var tracked_properties = obj[TRACKED_OBJECT];

	if (tracked_properties === undefined) {
		return original_object_values(obj);
	}
	if (is_array(obj)) {
		obj.$length;
	}
	var keys = original_object_keys(obj);
	var values = [];

	for (var i = 0; i < keys.length; i++) {
		values.push(get_property(obj, keys[i]));
	}

	return values;
}

export function object_entries(obj) {
	var tracked_properties = obj[TRACKED_OBJECT];

	if (tracked_properties === undefined) {
		return original_object_entries(obj);
	}
	if (is_array(obj)) {
		obj.$length;
	}
	var keys = original_object_keys(obj);
	var entries = [];

	for (var i = 0; i < keys.length; i++) {
		var key = keys[i];
		entries.push([key, get_property(obj, key)]);
	}

	return entries;
}

export function spread_object(obj) {
	var tracked_properties = obj[TRACKED_OBJECT];

	if (tracked_properties === undefined) {
		return { ...obj };
	}
	var keys = original_object_keys(obj);
	const values = {};

	for (var i = 0; i < keys.length; i++) {
		var key = keys[i];
		values[key] = get_property_computed(obj, key);
	}

	return values;
}

export function with_scope(block, fn) {
	var previous_scope = active_scope;
	try {
		active_scope = block;
		return fn();
	} finally {
		active_scope = previous_scope;
	}
}

export function scope() {
	return active_scope;
}

export function push_component() {
	var component = {
		e: null,
		m: false,
		p: active_component
	};
	active_component = component;
}

export function pop_component() {
	var component = active_component;
	component.m = true;
	var effects = component.e;
	if (effects !== null) {
		var length = effects.length;
		for (var i = 0; i < length; i++) {
			var { b: block, fn, r: reaction } = effects[i];
			var previous_block = active_block;
			var previous_reaction = active_reaction;

			try {
				active_block = block;
				active_reaction = reaction;
				effect(fn);
			} finally {
				active_block = previous_block;
				active_reaction = previous_reaction;
			}
		}
	}
	active_component = component.p;
}
