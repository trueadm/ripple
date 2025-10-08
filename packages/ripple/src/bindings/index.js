/** @import {Block, Tracked} from '#client' */

import { effect } from '../runtime/index-client.js';
import { active_block, get, render, set, tick } from '../runtime/internal/client/index.js';
import { on } from '../runtime/internal/client/events.js';
import { is_array, is_tracked_object } from '../runtime/internal/client/utils.js';

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

/** @param {HTMLOptionElement} option */
function get_option_value(option) {
	return option.value;
}

/**
 * Selects the correct option(s) (depending on whether this is a multiple select)
 * @template V
 * @param {HTMLSelectElement} select
 * @param {V} value
 * @param {boolean} mounting
 */
function select_option(select, value, mounting = false) {
	if (select.multiple) {
		// If value is null or undefined, keep the selection as is
		if (value == undefined) {
			return;
		}

		// If not an array, warn and keep the selection as is
		if (!is_array(value)) {
			// TODO
		}

		// Otherwise, update the selection
		for (var option of select.options) {
			option.selected = /** @type {string[]} */ (value).includes(get_option_value(option));
		}

		return;
	}

	for (option of select.options) {
		var option_value = get_option_value(option);
		if (option_value === value) {
			option.selected = true;
			return;
		}
	}

	if (!mounting || value !== undefined) {
		select.selectedIndex = -1; // no option should be selected
	}
}

/**
 * @param {unknown} maybe_tracked
 * @returns {(node: HTMLInputElement | HTMLSelectElement) => void}
 */
export function bindValue(maybe_tracked) {
	if (!is_tracked_object(maybe_tracked)) {
		throw new TypeError('bindValue() argument is not a tracked object');
	}

	var block = /** @type {Block} */ (active_block);
	var tracked = /** @type {Tracked} */ (maybe_tracked);

	return (node) => {
		var clear_event;

		if (node.tagName === 'SELECT') {
			var select = /** @type {HTMLSelectElement} */ (node);
			var mounting = true;

			clear_event = on(select, 'change', async () => {
				var query = ':checked';
				/** @type {unknown} */
				var value;

				if (select.multiple) {
					value = [].map.call(select.querySelectorAll(query), get_option_value);
				} else {
					/** @type {HTMLOptionElement | null} */
					var selected_option =
						select.querySelector(query) ??
						// will fall back to first non-disabled option if no option is selected
						select.querySelector('option:not([disabled])');
					value = selected_option && get_option_value(selected_option);
				}

				set(tracked, value, block);
			});

			effect(() => {
				var value = get(tracked);
				select_option(select, value, mounting);

				// Mounting and value undefined -> take selection from dom
				if (mounting && value === undefined) {
					/** @type {HTMLOptionElement | null} */
					var selected_option = select.querySelector(':checked');
					if (selected_option !== null) {
						value = get_option_value(selected_option);
						set(tracked, value, block);
					}
				}

				mounting = false;
			});
		} else {
			var input = /** @type {HTMLInputElement} */ (node);

			clear_event = on(input, 'input', async () => {
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

			render(() => {
				var value = get(tracked);

				if (is_numberlike_input(input) && value === to_number(input.value)) {
					return;
				}

				if (input.type === 'date' && !value && !input.value) {
					return;
				}

				if (value !== input.value) {
					input.value = value ?? '';
				}
			});

			return clear_event;
		}
	};
}

/**
 * @param {unknown} maybe_tracked
 * @returns {(node: HTMLInputElement) => void}
 */
export function bindChecked(maybe_tracked) {
	if (!is_tracked_object(maybe_tracked)) {
		throw new TypeError('bindChecked() argument is not a tracked object');
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
