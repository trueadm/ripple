import { branch, create_try_block, destroy_block, is_destroyed, resume_block } from './blocks.js';
import { TRY_BLOCK } from './constants.js';
import { next_sibling } from './operations.js';
import {
  active_block,
  active_component,
  active_reaction,
  queue_microtask,
  set_active_block,
  set_active_component,
  set_active_reaction,
  set_tracking,
  tracking,
} from './runtime.js';

export function try_block(node, fn, catch_fn, pending_fn = null) {
  var anchor = node;
  var b = null;
  var suspended = null;
  var pending_count = 0;
  var offscreen_fragment = null;

  function move_block(block, fragment) {
    var state = block.s;
    var node = state.start;
    var end = state.end;

    while (node !== null) {
      var next = node === end ? null : next_sibling(node);

      fragment.append(node);
      node = next;
    }
  }

  function handle_await() {
    if (pending_count++ === 0) {
      queue_microtask(() => {
        if (b !== null) {
          suspended = b;
          offscreen_fragment = document.createDocumentFragment();
          move_block(b, offscreen_fragment);

          b = branch(() => {
            pending_fn(anchor);
          });
        }
      });
    }

    return () => {
      if (--pending_count === 0) {
        if (b !== null) {
          destroy_block(b);
        }
        anchor.before(offscreen_fragment);
        offscreen_fragment = null;
        resume_block(suspended);
        b = suspended;
        suspended = null;
      }
    };
  }

  function handle_error(error) {
    if (b !== null) {
      destroy_block(b);
    }

    b = branch(() => {
      catch_fn(anchor, error);
    });
  }

  var state = {
    a: pending_fn !== null ? handle_await : null,
    c: catch_fn !== null ? handle_error : null,
  };

  create_try_block(() => {
    b = branch(() => {
      fn(anchor);
    });
  }, state);
}

export function suspend() {
  var current = active_block;

  while (current !== null) {
    var state = current.s;
    if ((current.f & TRY_BLOCK) !== 0 && state.a !== null) {
      return state.a();
    }
    current = current.p;
  }

  throw new Error('Missing parent `try { ... } pending { ... }` statement');
}

function exit() {
  set_tracking(false);
  set_active_reaction(null);
  set_active_block(null);
  set_active_component(null);
}

export function capture() {
  var previous_tracking = tracking;
  var previous_block = active_block;
  var previous_reaction = active_reaction;
  var previous_component = active_component;

  return () => {
    set_tracking(previous_tracking);
    set_active_block(previous_block);
    set_active_reaction(previous_reaction);
    set_active_component(previous_component);

    queue_microtask(exit);
  };
}

export function aborted() {
  if (active_block === null) {
    return true;
  }
  return is_destroyed(active_block);
}

export async function resume_context(promise) {
  var restore = capture();
  var value = await promise;

  return () => {
    restore();
    return value;
  };
}
