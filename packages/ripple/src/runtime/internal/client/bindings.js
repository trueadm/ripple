/** @import { Tracked } from '#client' */

import { effect, render } from './blocks.js';
import { on } from './events.js';
import { get, set, tick, untrack } from './runtime.js';
import { is_array, is_tracked_object } from './utils.js';

/**
 * @param {string} name
 * @returns {TypeError}
 */
function not_tracked_type_error(name) {
	return new TypeError(`${name} argument is not a tracked object`);
}

/**
 * Resize observer singleton.
 * One listener per element only!
 * https://groups.google.com/a/chromium.org/g/blink-dev/c/z6ienONUb5A/m/F5-VcUZtBAAJ
 */
class ResizeObserverSingleton {
	/** */
	#listeners = new WeakMap();

	/** @type {ResizeObserver | undefined} */
	#observer;

	/** @type {ResizeObserverOptions} */
	#options;

	/** @static */
	static entries = new WeakMap();

	/** @param {ResizeObserverOptions} options */
	constructor(options) {
		this.#options = options;
	}

	/**
	 * @param {Element} element
	 * @param {(entry: ResizeObserverEntry) => any} listener
	 */
	observe(element, listener) {
		var listeners = this.#listeners.get(element) || new Set();
		listeners.add(listener);

		this.#listeners.set(element, listeners);
		this.#getObserver().observe(element, this.#options);

		return () => {
			var listeners = this.#listeners.get(element);
			listeners.delete(listener);

			if (listeners.size === 0) {
				this.#listeners.delete(element);
				/** @type {ResizeObserver} */ (this.#observer).unobserve(element);
			}
		};
	}

	#getObserver() {
		return (
			this.#observer ??
			(this.#observer = new ResizeObserver(
				/** @param {any} entries */ (entries) => {
					for (var entry of entries) {
						ResizeObserverSingleton.entries.set(entry.target, entry);
						for (var listener of this.#listeners.get(entry.target) || []) {
							listener(entry);
						}
					}
				},
			))
		);
	}
}

var resize_observer_content_box = /* @__PURE__ */ new ResizeObserverSingleton({
	box: 'content-box',
});

var resize_observer_border_box = /* @__PURE__ */ new ResizeObserverSingleton({
	box: 'border-box',
});

var resize_observer_device_pixel_content_box = /* @__PURE__ */ new ResizeObserverSingleton({
	box: 'device-pixel-content-box',
});

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
		throw not_tracked_type_error('bindValue()');
	}

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
					// @ts-ignore
					var selected_option =
						select.querySelector(query) ??
						// will fall back to first non-disabled option if no option is selected
						select.querySelector('option:not([disabled])');
					value = selected_option && get_option_value(selected_option);
				}

				set(tracked, value);
			});

			effect(() => {
				var value = get(tracked);
				select_option(select, value, mounting);

				// Mounting and value undefined -> take selection from dom
				if (mounting && value === undefined) {
					/** @type {HTMLOptionElement | null} */
					// @ts-ignore
					var selected_option = select.querySelector(':checked');
					if (selected_option !== null) {
						value = get_option_value(selected_option);
						set(tracked, value);
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
				set(tracked, value);

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
		throw not_tracked_type_error('bindChecked()');
	}

	const tracked = /** @type {Tracked} */ (maybe_tracked);

	return (input) => {
		const clear_event = on(input, 'change', () => {
			set(tracked, input.checked);
		});

		return clear_event;
	};
}

/**
 * @param {unknown} maybe_tracked
 * @param {'clientWidth' | 'clientHeight' | 'offsetWidth' | 'offsetHeight'} type
 */
function bind_element_size(maybe_tracked, type) {
	if (!is_tracked_object(maybe_tracked)) {
		throw not_tracked_type_error(`bind${type.charAt(0).toUpperCase() + type.slice(1)}()`);
	}

	var tracked = /** @type {Tracked<any>} */ (maybe_tracked);

	return (/** @type {HTMLElement} */ element) => {
		var unsubscribe = resize_observer_border_box.observe(element, () =>
			set(tracked, element[type]),
		);

		effect(() => {
			untrack(() => set(tracked, element[type]));
			return unsubscribe;
		});
	};
}

/**
 * @param {unknown} maybe_tracked
 * @returns {(node: HTMLElement) => void}
 */
export function bindClientWidth(maybe_tracked) {
	return bind_element_size(maybe_tracked, 'clientWidth');
}

/**
 * @param {unknown} maybe_tracked
 * @returns {(node: HTMLElement) => void}
 */
export function bindClientHeight(maybe_tracked) {
	return bind_element_size(maybe_tracked, 'clientHeight');
}

/**
 * @param {unknown} maybe_tracked
 * @returns {(node: HTMLElement) => void}
 */
export function bindOffsetWidth(maybe_tracked) {
	return bind_element_size(maybe_tracked, 'offsetWidth');
}

/**
 * @param {unknown} maybe_tracked
 * @returns {(node: HTMLElement) => void}
 */
export function bindOffsetHeight(maybe_tracked) {
	return bind_element_size(maybe_tracked, 'offsetHeight');
}

/**
 * @param {unknown} maybe_tracked
 * @param {'contentRect' | 'contentBoxSize' | 'borderBoxSize' | 'devicePixelContentBoxSize'} type
 */
function bind_element_rect(maybe_tracked, type) {
	if (!is_tracked_object(maybe_tracked)) {
		throw not_tracked_type_error(`bind${type.charAt(0).toUpperCase() + type.slice(1)}()`);
	}

	var tracked = /** @type {Tracked<any>} */ (maybe_tracked);
	var observer =
		type === 'contentRect' || type === 'contentBoxSize'
			? resize_observer_content_box
			: type === 'borderBoxSize'
				? resize_observer_border_box
				: resize_observer_device_pixel_content_box;

	return (/** @type {HTMLElement} */ element) => {
		var unsubscribe = observer.observe(
			element,
			/** @param {any} entry */ (entry) => set(tracked, entry[type]),
		);

		effect(() => unsubscribe);
	};
}

/**
 * @param {unknown} maybe_tracked
 * @returns {(node: HTMLElement) => void}
 */
export function bindContentRect(maybe_tracked) {
	return bind_element_rect(maybe_tracked, 'contentRect');
}

/**
 * @param {unknown} maybe_tracked
 * @returns {(node: HTMLElement) => void}
 */
export function bindContentBoxSize(maybe_tracked) {
	return bind_element_rect(maybe_tracked, 'contentBoxSize');
}

/**
 * @param {unknown} maybe_tracked
 * @returns {(node: HTMLElement) => void}
 */
export function bindBorderBoxSize(maybe_tracked) {
	return bind_element_rect(maybe_tracked, 'borderBoxSize');
}

/**
 * @param {unknown} maybe_tracked
 * @returns {(node: HTMLElement) => void}
 */
export function bindDevicePixelContentBoxSize(maybe_tracked) {
	return bind_element_rect(maybe_tracked, 'devicePixelContentBoxSize');
}

/**
 * @param {unknown} maybe_tracked
 * @param {'innerHTML' | 'innerText' | 'textContent'} property
 * @returns {(node: HTMLElement) => void}
 */
export function bind_content_editable(maybe_tracked, property) {
	if (!is_tracked_object(maybe_tracked)) {
		throw not_tracked_type_error(`bind${property.charAt(0).toUpperCase() + property.slice(1)}()`);
	}

	const tracked = /** @type {Tracked} */ (maybe_tracked);

	return (element) => {
		const clear_event = on(element, 'input', () => {
			set(tracked, element[property]);
		});

		render(() => {
			var value = get(tracked);

			if (element[property] !== value) {
				if (value == null) {
					// @ts-ignore
					var non_null_value = element[property];
					set(tracked, non_null_value);
				} else {
					// @ts-ignore
					element[property] = value + '';
				}
			}
		});

		return clear_event;
	};
}

/**
 * @param {unknown} maybe_tracked
 * @returns {(node: HTMLElement) => void}
 */
export function bindInnerHTML(maybe_tracked) {
	return bind_content_editable(maybe_tracked, 'innerHTML');
}

/**
 * @param {unknown} maybe_tracked
 * @returns {(node: HTMLElement) => void}
 */
export function bindInnerText(maybe_tracked) {
	return bind_content_editable(maybe_tracked, 'innerText');
}

/**
 * @param {unknown} maybe_tracked
 * @returns {(node: HTMLElement) => void}
 */
export function bindTextContent(maybe_tracked) {
	return bind_content_editable(maybe_tracked, 'textContent');
}

/**
 * Syntactic sugar for binding a HTMLElement with {ref fn}
 * @param {unknown} maybe_tracked
 * @returns {(node: HTMLElement) => void}
 */
export function bindNode(maybe_tracked) {
	if (!is_tracked_object(maybe_tracked)) {
		throw not_tracked_type_error('bindNode()');
	}

	const tracked = /** @type {Tracked} */ (maybe_tracked);

	/** @param {HTMLElement} node */
	return (node) => {
		set(tracked, node);
	};
}
