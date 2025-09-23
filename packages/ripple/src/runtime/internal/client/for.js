import { IS_CONTROLLED } from '../../../constants.js';
import { branch, destroy_block, destroy_block_children, render } from './blocks.js';
import { FOR_BLOCK, TRACKED_ARRAY } from './constants.js';
import { create_text } from './operations.js';
import { active_block, untrack } from './runtime.js';
import { array_from, is_array } from './utils.js';

function create_item(anchor, value, render_fn) {
  var b = branch(() => {
    render_fn(anchor, value);
  });
  return b;
}

function move(block, anchor) {
  var node = block.s.start;
  var end = block.s.end;

  if (node === end) {
    anchor.before(node);
    return;
  }
  while (node !== end) {
    var next_node = /** @type {TemplateNode} */ (get_next_sibling(node));
    anchor.before(node);
    node = next_node;
  }
}

export function for_block(node, get_collection, render_fn, flags) {
  var is_controlled = (flags & IS_CONTROLLED) !== 0;
  var anchor = node;

  if (is_controlled) {
    anchor = node.appendChild(create_text());
  }

  render(() => {
    var block = active_block;
    var collection = get_collection();
    var array = is_array(collection)
      ? collection
      : collection == null
        ? []
        : array_from(collection);

    // If we are working with a tracked array, then we need to get a copy of
	// the elements, as the array itself is proxied, and not useful in diffing
    if (TRACKED_ARRAY in array) {
      array = array_from(array);
    }

    untrack(() => reconcile(anchor, block, array, render_fn, is_controlled));
  }, FOR_BLOCK);
}

function reconcile_fast_clear(anchor, block, array) {
  var state = block.s;
  var parent_node = anchor.parentNode;
  parent_node.textContent = '';
  destroy_block_children(block);
  parent_node.append(anchor);
  state.array = array;
  state.blocks = [];
}

function reconcile(anchor, block, b, render_fn, is_controlled) {
  var state = block.s;

  if (state === null) {
    state = block.s = {
      array: [],
      blocks: [],
    };
  }

  var a = state.array;
  var a_length = a.length;
  var b_length = b.length;
  var j = 0;

  // Fast-path for clear
  if (is_controlled && b_length === 0) {
    if (a_length > 0) {
      reconcile_fast_clear(anchor, block, b);
    }
    return;
  }
  var b_blocks = Array(b_length);

  // Fast-path for create
  if (a_length === 0) {
    for (; j < b_length; j++) {
      b_blocks[j] = create_item(anchor, b[j], render_fn);
    }
    state.array = b;
    state.blocks = b_blocks;
    return;
  }

  var a_blocks = state.blocks;
  var a_val = a[j];
  var b_val = b[j];
  var a_end = a_length - 1;
  var b_end = b_length - 1;

  outer: {
    while (a_val === b_val) {
      a[j] = b_val;
      b_blocks[j] = a_blocks[j];
      ++j;
      if (j > a_end || j > b_end) {
        break outer;
      }
      a_val = a[j];
      b_val = b[j];
    }

    a_val = a[a_end];
    b_val = b[b_end];

    while (a_val === b_val) {
      a[a_end] = b_val;
      b_blocks[b_end] = a_blocks[a_end];
      a_end--;
      b_end--;
      if (j > a_end || j > b_end) {
        break outer;
      }
      a_val = a[a_end];
      b_val = b[b_end];
    }
  }

  if (j > a_end) {
    if (j <= b_end) {
      while (j <= b_end) {
        b_val = b[j];
        var target = j >= a_length ? anchor : a_blocks[j].s.start;
        b_blocks[j++] = create_item(target, b_val, render_fn);
      }
    }
  } else if (j > b_end) {
    while (j <= a_end) {
      destroy_block(a_blocks[j++]);
    }
  } else {
    var a_start = j;
    var b_start = j;
    var a_left = a_end - j + 1;
    var b_left = b_end - j + 1;
    var fast_path_removal = is_controlled && a_left === a_length;
    var sources = new Int32Array(b_left + 1);
    var moved = false;
    var pos = 0;
    var patched = 0;
    var i = 0;

    // When sizes are small, just loop them through
    if (b_length < 4 || (a_left | b_left) < 32) {
      for (i = a_start; i <= a_end; ++i) {
        a_val = a[i];
        if (patched < b_left) {
          for (j = b_start; j <= b_end; j++) {
            b_val = b[j];
            if (a_val === b_val) {
              sources[j - b_start] = i + 1;
              if (fast_path_removal) {
                fast_path_removal = false;
                // while (a_start < i) {
                //     debugger
                //     destroy_block(a_blocks[a_start++]);
                // }
              }
              if (pos > j) {
                moved = true;
              } else {
                pos = j;
              }
              b_blocks[j] = a_blocks[i];
              ++patched;
              break;
            }
          }
          if (!fast_path_removal && j > b_end) {
            destroy_block(a_blocks[i]);
          }
        } else if (!fast_path_removal) {
          destroy_block(a_blocks[i]);
        }
      }
    } else {
      var map = new Map();

      for (i = b_start; i <= b_end; ++i) {
        map.set(b[i], i);
      }

      for (i = a_start; i <= a_end; ++i) {
        a_val = a[i];

        if (patched < b_left) {
          j = map.get(a_val);

          if (j !== undefined) {
            if (fast_path_removal) {
              fast_path_removal = false;
              // while (i > aStart) {
              //     remove(a[aStart++], dom, animations);
              // }
            }
            sources[j - b_start] = i + 1;
            if (pos > j) {
              moved = true;
            } else {
              pos = j;
            }
            b_val = b[j];
            b_blocks[j] = a_blocks[i];
            ++patched;
          } else if (!fast_path_removal) {
            destroy_block(a_blocks[i]);
          }
        } else if (!fast_path_removal) {
          destroy_block(a_blocks[i]);
        }
      }
    }
  }

  if (fast_path_removal) {
    reconcile_fast_clear(anchor, block, []);
    reconcile(anchor, block, b, render_fn, is_controlled);
    return;
  } else if (moved) {
    var next_pos = 0;
    var seq = lis_algorithm(sources);
    j = seq.length - 1;

    for (i = b_left - 1; i >= 0; i--) {
      if (sources[i] === 0) {
        pos = i + b_start;
        b_val = b[pos];
        next_pos = pos + 1;

        var target = next_pos < b_length ? b_blocks[next_pos].s.start : anchor;
        b_blocks[pos] = create_item(target, b_val, render_fn);
      } else if (j < 0 || i !== seq[j]) {
        pos = i + b_start;
        b_val = b[pos];
        next_pos = pos + 1;

        var target = next_pos < b_length ? b_blocks[next_pos].s.start : anchor;
        move(b_blocks[pos], target);
      } else {
        j--;
      }
    }
  } else if (patched !== b_left) {
    for (i = b_left - 1; i >= 0; i--) {
      if (sources[i] === 0) {
        pos = i + b_start;
        b_val = b[pos];
        next_pos = pos + 1;

        var target = next_pos < b_length ? b_blocks[next_pos].s.start : anchor;
        b_blocks[pos] = create_item(target, b_val, render_fn);
      }
    }
  }

  state.array = b;
  state.blocks = b_blocks;
}

let result;
let p;
let maxLen = 0;
// https://en.wikipedia.org/wiki/Longest_increasing_subsequence
function lis_algorithm(arr) {
  let arrI = 0;
  let i = 0;
  let j = 0;
  let k = 0;
  let u = 0;
  let v = 0;
  let c = 0;
  var len = arr.length;

  if (len > maxLen) {
    maxLen = len;
    result = new Int32Array(len);
    p = new Int32Array(len);
  }

  for (; i < len; ++i) {
    arrI = arr[i];

    if (arrI !== 0) {
      j = result[k];
      if (arr[j] < arrI) {
        p[i] = j;
        result[++k] = i;
        continue;
      }

      u = 0;
      v = k;

      while (u < v) {
        c = (u + v) >> 1;
        if (arr[result[c]] < arrI) {
          u = c + 1;
        } else {
          v = c;
        }
      }

      if (arrI < arr[result[u]]) {
        if (u > 0) {
          p[i] = result[u - 1];
        }
        result[u] = i;
      }
    }
  }

  u = k + 1;
  var seq = new Int32Array(u);
  v = result[u - 1];

  while (u-- > 0) {
    seq[u] = v;
    v = p[v];
    result[u] = 0;
  }

  return seq;
}

export function keyed(collection, key_fn) {
  var block = active_block;
  if (block === null || (block.f & FOR_BLOCK) === 0) {
    throw new Error('keyed() must be used inside a for block');
  }
  var state = block.s;

  if (state === null) {
    return collection;
  }

  var a_array = state.array;
  var a_keys = a_array.map(key_fn);
  var a = new Map();

  for (let i = 0; i < a_keys.length; i++) {
    a.set(a_keys[i], i);
  }

  if (a.size !== a_keys.length) {
    throw new Error('Duplicate keys are not allowed');
  }

  var b_array = is_array(collection)
    ? collection
    : collection == null
      ? []
      : array_from(collection);
  var b_keys = b_array.map(key_fn);

  // We only need to do this in DEV
  var b = new Set(b_keys);
  if (b.size !== b_keys.length) {
    throw new Error('Duplicate keys are not allowed');
  }

  for (let i = 0; i < b_keys.length; i++) {
    var b_val = b_keys[i];
    var index = a.get(b_val);

    if (index !== undefined) {
      b_array[i] = a_array[index];
    }
  }

  return b_array;
}
