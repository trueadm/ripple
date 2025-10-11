/** @import { Component, Derived } from '#server' */
import { DERIVED, UNINITIALIZED } from '../client/constants.js';
import { is_tracked_object } from '../client/utils.js';
import { escape } from '../../../utils/escaping.js';
import { is_boolean_attribute } from '../../../compiler/utils.js';
import { clsx } from 'clsx';

export { escape };
export { register_component_css as register_css } from './css-registry.js';

/** @type {Component | null} */
export let active_component = null;

/**
 * `<div translate={false}>` should be rendered as `<div translate="no">` and _not_
 * `<div translate="false">`, which is equivalent to `<div translate="yes">`. There
 * may be other odd cases that need to be added to this list in future
 * @type {Record<string, Map<any, string>>}
 */
const replacements = {
	translate: new Map([
		[true, 'yes'],
		[false, 'no'],
	]),
};

export let active_output = null;

class Output {
	head = '';
	body = '';
	/** @type {Set<string>} */
	css = new Set();
	/** @type {Promise<any>[]} */
	promises = [];
	/** @type {Output | null} */
	#parent = null;

	/**
	 * @param {Output | null} parent
	 */
	constructor(parent) {
		this.#parent = parent;
	}

	/**
	 * @param {string} str
	 * @returns {void}
	 */
	push(str) {
		this.body += str;
	}

	/**
	 * @param {string} hash
	 * @returns {void}
	 */
	register_css(hash) {
		this.css.add(hash);
	}
}

/**
 * @param {((output: Output, props: Record<string, any>) => void | Promise<void>) & { async?: boolean }} component
 * @returns {Promise<{head: string, body: string, css: Set<string>}>}
 */
export async function render(component) {
	const output = new Output(null);
	active_output = output;

	try {
		if (component.async) {
			await component(output, {});
		} else {
			component(output, {});
		}

		if (output.promises.length > 0) {
			await Promise.all(output.promises);
			// Re-execute component after promises are resolved
			output.body = '';
			output.css = new Set();
			if (component.async) {
				await component(output, {});
			} else {
				component(output, {});
			}
		}

		const { head, body, css } = output;

		return { head, body, css };
	} finally {
		active_output = null;
	}
}

/**
 * @returns {void}
 */
export function push_component() {
	var component = {
		c: null,
		p: active_component,
	};
	active_component = component;
}

/**
 * @returns {void}
 */
export function pop_component() {
	var component = /** @type {Component} */ (active_component);
	active_component = component;
}

/**
 * @param {() => any} fn
 * @returns {Promise<void>}
 */
export async function async(fn) {
	await fn();
}

/**
 * @returns {boolean}
 */
export function aborted() {
	// For SSR, we don't abort rendering
	return false;
}

/**
 * @param {Derived} tracked
 * @returns {any}
 */
function get_derived(tracked) {
	let v = tracked.v;

	if (v === UNINITIALIZED) {
		v = tracked.fn();
		tracked.v = v;
	}
	return v;
}

/**
 * @param {any} tracked
 * @returns {any}
 */
export function get(tracked) {
	// reflect back the value if it's not boxed
	if (!is_tracked_object(tracked)) {
		return tracked;
	}

	return (tracked.f & DERIVED) !== 0 ? get_derived(/** @type {Derived} */(tracked)) : tracked.v;
}

/**
 * @template V
 * @param {string} name
 * @param {V} value
 * @param {boolean} [is_boolean]
 * @returns {string}
 */
export function attr(name, value, is_boolean = false) {
	if (name === 'hidden' && value !== 'until-found') {
		is_boolean = true;
	}
	if (value == null || (!value && is_boolean)) return '';
	const normalized = (name in replacements && replacements[name].get(value)) || value;
	const value_to_escape = name === 'class' ? clsx(normalized) : normalized;
	const assignment = is_boolean ? '' : `="${escape(value_to_escape, true)}"`;
	return ` ${name}${assignment}`;
}

/**
 * @param {Record<string, any>} attrs
 * @param {string | undefined} css_hash
 * @returns {string}
 */
export function spread_attrs(attrs, css_hash) {
	let attr_str = '';
	let name;

	for (name in attrs) {
		var value = attrs[name];

		if (typeof value === 'function') continue;

		if (is_tracked_object(value)) {
			value = get(value);
		}

		if (name === 'class' && css_hash) {
			value = value == null ? css_hash : [value, css_hash];
		}

		attr_str += attr(name, value, is_boolean_attribute(name));
	}

	return attr_str;
}
