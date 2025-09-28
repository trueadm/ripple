/** @import { Block } from '#client' */

import { branch, destroy_block, render } from './blocks.js';
import { UNINITIALIZED } from './constants.js';
import { handle_root_events } from './events.js';
import { create_text } from './operations.js';

/**
 * @param {any} _ 
 * @param {{ target: Element, children: (anchor: Node) => void }} props
 * @returns {void}
 */
export function Portal(_, props) {
  /** @type {Element | symbol} */
  let target = UNINITIALIZED;
  /** @type {((anchor: Node) => void) | symbol} */
  let children = UNINITIALIZED;
  /** @type {Block | null} */
  var b = null;
  /** @type {Text | null} */
  var anchor = null;

  render(() => {
    if (target === (target = props.target)) return;
    if (children === (children = props.children)) return;

    if (b !== null) {
      destroy_block(b);
    }

    anchor = create_text();
    /** @type {Element} */ (target).append(anchor);

    const cleanup_events = handle_root_events(/** @type {Element} */ (target));

    b = branch(() => /** @type {(anchor: Node) => void} */ (children)(/** @type {Text} */ (anchor)));

    return () => {
      cleanup_events();
      /** @type {Text} */ (anchor).remove();
    };
  });
}
