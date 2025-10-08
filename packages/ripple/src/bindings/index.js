/** @import {Block, Tracked} from '#client' */

import { active_block, get, set, tick } from '../runtime/internal/client';
import { on } from '../runtime/internal/client/events';
import { is_tracked_object } from '../runtime/internal/client/utils';

/**
 * @param {string} value
 */
function to_number(value) {
	return value === '' ? null : +value;
}

/**
 * @param {HTMLInputElement} input
 */
function is_numberlike_input(input) {
	var type = input.type;
	return type === 'number' || type === 'range';
}

/**
 * @param {unknown} maybe_tracked
 * @returns {(node: HTMLInputElement) => void}
 */
export function value(maybe_tracked) {
	if (!is_tracked_object(maybe_tracked)) {
		throw new TypeError('value() argument is not a tracked object');
	}

	const block = /** @type {Block} */ (active_block);
	const tracked = /** @type {Tracked} */ (maybe_tracked);

	return (input) => {
		const clear_event = on(input, 'input', async () => {
			/** @type {any} */
			var value = input.value;
			value = is_numberlike_input(input) ? to_number(value) : value;
			set(tracked, value, block);

			await tick();

			if (value !== (value = get(tracked))) {
				var start = input.selectionStart;
				var end = input.selectionEnd;
				input.value = value ?? '';

				// Restore selection
				if (end !== null) {
					input.selectionStart = start;
					input.selectionEnd = Math.min(end, input.value.length);
				}
			}
		});

		return clear_event;
	};
}

/**
 * @param {unknown} maybe_tracked
 * @returns {(node: HTMLInputElement) => void}
 */
export function checked(maybe_tracked) {
  if (!is_tracked_object(maybe_tracked)) {
    throw new TypeError('checked() argument is not a tracked object');
  }

  const block = /** @type {any} */ (active_block);
  const tracked = /** @type {Tracked<any>} */ (maybe_tracked);

  return (input) => {
    const clear_event = on(input, 'change', () => {
      set(tracked, input.checked, block);
    });

    return clear_event;
  };
}