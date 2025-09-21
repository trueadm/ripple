import { branch, destroy_block, render } from './blocks.js';
import { IF_BLOCK, UNINITIALIZED } from './constants.js';

export function if_block(node, fn) {
  var anchor = node;
  var has_branch = false;
  var condition = UNINITIALIZED;
  var b = null;

  var set_branch = (fn, flag = true) => {
    has_branch = true;
    update_branch(flag, fn);
  };

  var update_branch = (new_condition, fn) => {
    if (condition === (condition = new_condition)) return;

    if (b !== null) {
      destroy_block(b);
      b = null;
    }

    if (fn !== null) {
      b = branch(() => fn(anchor));
    }
  };

  render(() => {
    has_branch = false;
    fn(set_branch);
    if (!has_branch) {
      update_branch(null, null);
    }
  }, IF_BLOCK);
}
