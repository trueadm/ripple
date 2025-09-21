import { branch, destroy_block, render } from './blocks.js';
import { UNINITIALIZED } from './constants.js';
import { handle_root_events } from './events.js';
import { create_text } from './operations.js';

export function Portal(_, props) {
  let target = UNINITIALIZED;
  let children = UNINITIALIZED;
  var b = null;
  var anchor = null;

  render(() => {
    if (target === (target = props.target)) return;
    if (children === (children = props.children)) return;

    if (b !== null) {
      destroy_block(b);
    }

    anchor = create_text();
    target.append(anchor);

    const cleanup_events = handle_root_events(target);

    b = branch(() => children(anchor));

    return () => {
      cleanup_events();
      anchor.remove();
    };
  });
}
