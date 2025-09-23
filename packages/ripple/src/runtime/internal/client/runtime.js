/** @import { Block, Component, Dependency, Derived, Tracked } from '#client' */

import {
  destroy_block,
  destroy_non_branch_children,
  effect,
  is_destroyed,
  render,
} from './blocks.js';
import {
  ASYNC_BLOCK,
  BLOCK_HAS_RUN,
  BRANCH_BLOCK,
  DERIVED,
  COMPUTED_PROPERTY,
  CONTAINS_TEARDOWN,
  CONTAINS_UPDATE,
  DEFERRED,
  DESTROYED,
  EFFECT_BLOCK,
  PAUSED,
  ROOT_BLOCK,
  TRACKED,
  TRY_BLOCK,
  UNINITIALIZED,
  REF_PROP,
} from './constants.js';
import { capture, suspend } from './try.js';
import { define_property, is_tracked_object } from './utils.js';

const FLUSH_MICROTASK = 0;
const FLUSH_SYNC = 1;

/** @type {null | Block} */
export let active_block = null;
/** @type {null | Block | Derived} */
export let active_reaction = null;
/** @type {null | Block} */
export let active_scope = null;
/** @type {null | Component} */
export let active_component = null;

var old_values = new Map();

// Used for controlling the flush of blocks
let scheduler_mode = FLUSH_MICROTASK;
// Used for handling scheduling
let is_micro_task_queued = false;
let clock = 0;
/** @type {Block[]} */
let queued_root_blocks = [];
/** @type {(() => void)[]} */
let queued_microtasks = [];
let flush_count = 0;
/** @type {null | Dependency} */
let active_dependency = null;

export let tracking = false;
export let teardown = false;

function increment_clock() {
  return ++clock;
}

/**
 * @param {Block | null} block
 */
export function set_active_block(block) {
  active_block = block;
}

/**
 * @param {Block | Derived | null} reaction
 */
export function set_active_reaction(reaction) {
  active_reaction = reaction;
}

/**
 * @param {Component | null} component
 */
export function set_active_component(component) {
  active_component = component;
}

/**
 * @param {boolean} value
 */
export function set_tracking(value) {
  tracking = value;
}

/**
 * @param {Block} block
 */
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

/**
 * @param {Derived} computed
 */
function update_derived(computed) {
  var value = computed.v;

  if (value === UNINITIALIZED || is_tracking_dirty(computed.d)) {
    value = run_derived(computed);

    if (value !== computed.v) {
      computed.v = value;
      computed.c = increment_clock();
    }
  }
}

/**
 * @param {Derived} computed
 */
function destroy_computed_children(computed) {
  var blocks = computed.blocks;

  if (blocks !== null) {
    computed.blocks = null;
    for (var i = 0; i < blocks.length; i++) {
      destroy_block(blocks[i]);
    }
  }
}

/**
 * @param {Derived} computed
 */
function run_derived(computed) {
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
    active_component = computed.co;

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

/**
 * @param {unknown} error
 * @param {Block} block
 */
export function handle_error(error, block) {
  /** @type {Block | null} */
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

/**
 * @param {Block} block
 */
export function run_block(block) {
  var previous_block = active_block;
  var previous_reaction = active_reaction;
  var previous_tracking = tracking;
  var previous_dependency = active_dependency;
  var previous_component = active_component;

  try {
    active_block = block;
    active_reaction = block;
    active_component = block.co;

    destroy_non_branch_children(block);
    run_teardown(block);

    tracking = (block.f & (ROOT_BLOCK | BRANCH_BLOCK)) === 0;
    active_dependency = null;
    var res = block.fn();

    if (typeof res === 'function') {
      block.t = res;
      /** @type {Block | null} */
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

/**
 *
 * @param {any} v
 * @param {Block} b
 * @returns {Tracked}
 */
export function tracked(v, b) {
  // TODO: now we expose tracked, we should likely block access in DEV somehow
  return {
    b,
    c: 0,
    f: TRACKED,
    v,
  };
}

/**
 * @param {any} fn
 * @param {any} block
 * @returns {Derived}
 */
export function derived(fn, block) {
  return {
    b: block,
    blocks: null,
    c: 0,
    co: active_component,
    d: null,
    f: TRACKED | DERIVED,
    fn,
    v: UNINITIALIZED,
  };
}

/**
 * @param {Tracked} tracked
 * @returns {Dependency}
 */
function create_dependency(tracked) {
  var reaction = /** @type {Derived | Block} **/ (active_reaction);
  var existing = reaction.d;

  // Recycle tracking entries
  if (existing !== null) {
    reaction.d = existing.n;
    existing.c = tracked.c;
    existing.t = tracked;
    existing.n = null;
    return existing;
  }

  return {
    c: tracked.c,
    t: tracked,
    n: null,
  };
}

/**
 * @param {Dependency | null} tracking
 */
function is_tracking_dirty(tracking) {
  if (tracking === null) {
    return false;
  }
  while (tracking !== null) {
    var tracked = tracking.t;

    if ((tracked.f & DERIVED) !== 0) {
      update_derived(/** @type {Derived} **/ (tracked));
    }

    if (tracked.c > tracking.c) {
      return true;
    }
    tracking = tracking.n;
  }

  return false;
}

/**
 * @param {Block} block
 */
export function is_block_dirty(block) {
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
  // var parent = active_block;
  // var block = active_scope;
  // var res = [UNINITIALIZED];
  // // TODO implement DEFERRED flag on tracked
  // var t = tracked(UNINITIALIZED, block, DEFERRED);
  // var tracked_properties = [t];
  // var prev_value = UNINITIALIZED;
  // define_property(res, TRACKED_OBJECT, {
  //   value: tracked_properties,
  //   enumerable: false,
  // });
  // render(() => {
  //   if (prev_value !== UNINITIALIZED) {
  //     t.v = prev_value;
  //   } else {
  //     prev_value = t.v;
  //   }
  //   var prev_version = t.c;
  //   var value = fn();
  //   res[0] = value;
  //   old_set_property(res, 0, value, block);
  //   if (prev_value !== UNINITIALIZED) {
  //     if ((t.f & DEFERRED) === 0) {
  //       t.f ^= DEFERRED;
  //     }
  //     var is_awaited = flush_deferred_upodates(parent);
  //     if ((t.f & DEFERRED) !== 0) {
  //       t.f ^= DEFERRED;
  //     }
  //     if (is_awaited) {
  //       t.c = prev_version;
  //       t.v = prev_value;
  //       prev_value = value;
  //     }
  //   }
  // });
  // return res;
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

/**
 * @param {Block} block
 */
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

/**
 * @param {Block} root_block
 */
function flush_updates(root_block) {
  /** @type {Block | null} */
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
      /** @type {Block | null} */
      var child = current.first;

      if (child !== null) {
        current = child;
        continue;
      }
    }

    /** @type {Block | null} */
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

/**
 * @param {Block[]} root_blocks
 */
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

/**
 * @param { (() => void) } [fn]
 */
export function queue_microtask(fn) {
  if (!is_micro_task_queued) {
    is_micro_task_queued = true;
    queueMicrotask(flush_microtasks);
  }
  if (fn !== undefined) {
    queued_microtasks.push(fn);
  }
}

/**
 * @param {Block} block
 */
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
    current = /** @type {Block} */ (current.p);
  }

  queued_root_blocks.push(current);
}

/**
 * @param {Tracked} tracked
 */
function register_dependency(tracked) {
  var dependency = active_dependency;

  if (dependency === null) {
    dependency = create_dependency(tracked);
    active_dependency = dependency;
  } else {
    var current = dependency;

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

    dependency = create_dependency(tracked);
    current.n = dependency;
  }
}

/**
 * @param {Derived} computed
 */
export function get_derived(computed) {
  update_derived(computed);
  if (tracking) {
    register_dependency(computed);
  }

  return computed.v;
}

/**
 * @param {Derived | Tracked} tracked
 */
export function get(tracked) {
  return (tracked.f & DERIVED) !== 0
    ? get_derived(/** @type {Derived} */ (tracked))
    : get_tracked(tracked);
}

/**
 * @param {Tracked} tracked
 */
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

/**
 * @param {Derived | Tracked} tracked
 * @param {any} value
 * @param {Block} block
 */
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
    schedule_update(tracked_block);
  }
}

/**
 * @template T
 * @param {() => T} fn
 * @returns {T}
 */
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

/**
 * @template T
 * @param {() => T} [fn]
 * @returns {T}
 */
export function flush_sync(fn) {
  var previous_scheduler_mode = scheduler_mode;
  var previous_queued_root_blocks = queued_root_blocks;

  try {
    /** @type {Block[]} */
    var root_blocks = [];

    scheduler_mode = FLUSH_SYNC;
    queued_root_blocks = root_blocks;
    is_micro_task_queued = false;

    flush_queued_root_blocks(previous_queued_root_blocks);

    var result = fn?.();

    if (queued_root_blocks.length > 0 || root_blocks.length > 0) {
      flush_sync();
    }

    flush_count = 0;

    return /** @type {T} */ (result);
  } finally {
    scheduler_mode = previous_scheduler_mode;
    queued_root_blocks = previous_queued_root_blocks;
  }
}

/**
 * @param {() => Object} fn
 * @param {Block} block
 * @returns {Object}
 */
export function spread_props(fn, block) {
  let computed = derived(fn, block);

  return new Proxy(
    {},
    {
      get(target, property) {
        const obj = get_derived(computed);
        return obj[property];
      },
    },
  );
}

/**
 * @template T
 * @param {() => T} fn
 * @returns {() => T}
 */
export function computed_property(fn) {
  define_property(fn, COMPUTED_PROPERTY, {
    value: true,
    enumerable: false,
  });
  return fn;
}

/**
 * @param {any} obj
 * @param {string | number | symbol} property
 * @param {boolean} chain_obj
 * @param {boolean} chain_prop
 * @param {...any} args
 * @returns {any}
 */
export function call_property(obj, property, chain_obj, chain_prop, ...args) {
  // don't swallow errors if either the object or property is nullish,
  // respect optional chaining as provided
  if (!chain_obj && !chain_prop) {
    return obj[property].call(obj, ...args);
  } else if (chain_obj && chain_prop) {
    return obj?.[property]?.call(obj, ...args);
  } else if (chain_obj) {
    return obj?.[property].call(obj, ...args);
  } else if (chain_prop) {
    return obj[property]?.call(obj, ...args);
  }
}

/**
 * @param {any} obj
 * @param {string | number | symbol} property
 * @param {boolean} [chain=false]
 * @returns {any}
 */
export function get_property(obj, property, chain = false) {
  if (chain && obj == null) {
    return undefined;
  }
  var tracked = obj[property];
  if (tracked == null) {
    return tracked;
  }
  return get(tracked);
}

export function set_property(obj, property, value, block) {
  var tracked = obj[property];
  set(tracked, value, block);
}

/**
 * @param {Tracked} tracked
 * @param {Block} block
 * @param {number} [d]
 * @returns {number}
 */
export function update(tracked, block, d = 1) {
  var value = get(tracked);
  var result = d === 1 ? value++ : value--;
  set(tracked, value, block);
  return result;
}

/**
 * @param {Tracked} tracked
 * @param {Block} block
 * @returns {void}
 */
export function increment(tracked, block) {
  set(tracked, tracked.v + 1, block);
}

/**
 * @param {Tracked} tracked
 * @param {Block} block
 * @returns {void}
 */
export function decrement(tracked, block) {
  set(tracked, tracked.v - 1, block);
}

/**
 * @param {Tracked} tracked
 * @param {Block} block
 * @param {number} [d]
 * @returns {number}
 */
export function update_pre(tracked, block, d = 1) {
  var value = get(tracked);
  var new_value = d === 1 ? ++value : --value;
  set(tracked, new_value, block);
  return new_value;
}

export function update_property(obj, property, block, d = 1) {
  var tracked = obj[property];
  var value = get(tracked);
  var new_value = d === 1 ? value++ : value--;
  set(tracked, value, block);
  return new_value;
}

export function update_pre_property(obj, property, block, d = 1) {
  var tracked = obj[property];
  var value = get(tracked);
  var new_value = d === 1 ? ++value : --value;
  set(tracked, new_value, block);
  return new_value;
}

/**
 * @template T
 * @param {Block} block
 * @param {() => T} fn
 * @returns {T}
 */
export function with_scope(block, fn) {
  var previous_scope = active_scope;
  try {
    active_scope = block;
    return fn();
  } finally {
    active_scope = previous_scope;
  }
}

/**
 * @returns {Block | null}
 */
export function scope() {
  return active_scope;
}

/**
 * @param {string} [err]
 * @returns {Block | never}
 */
export function safe_scope(err = 'Cannot access outside of a component context') {
  if (active_scope === null) {
    throw new Error(err);
  }

  return /** @type {Block} */ (active_scope);
}

export function push_component() {
  var component = {
    c: null,
    e: null,
    m: false,
    p: active_component,
  };
  active_component = component;
}

export function pop_component() {
  var component = /** @type {Component} */ (active_component);
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

export function ref_prop() {
  return Symbol(REF_PROP);
}

/**
 * @template T
 * @param {T | undefined} value
 * @param {T} fallback
 * @returns {T}
 */
export function fallback(value, fallback) {
  return value === undefined ? fallback : value;
}

/**
 * @param {Record<string, unknown>} obj
 * @param {string[]} keys
 * @returns {Record<string, unknown>}
 */
export function exclude_from_object(obj, keys) {
  obj = { ...obj };
  let key;
  for (key of keys) {
    delete obj[key];
  }
  return obj;
}

/**
 * @param {any} v
 */
export async function maybe_tracked(v) {
  var restore = capture();
  let value;

  if (is_tracked_object(v)) {
    if ((v.f & DERIVED) !== 0) {
      value = await async_computed(v.fn, v.b);
    } else {
      value = await async_computed(async () => {
        return await get_tracked(v);
      }, /** @type {Block} */ (active_block));
    }
  } else {
    value = await v;
  }

  return () => {
    restore();
    return value;
  };
}
