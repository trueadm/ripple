/**
@import { Component, Dependency, Derived, Tracked } from '#server';
@import { render, renderToStream, SSRComponent } from 'ripple/server';
*/

import { Readable } from 'stream';
import { DERIVED, UNINITIALIZED } from '../client/constants.js';
import { is_tracked_object } from '../client/utils.js';
import { escape } from '../../../utils/escaping.js';
import { is_boolean_attribute } from '../../../compiler/utils.js';
import { clsx } from 'clsx';
import { normalize_css_property_name } from '../../../utils/normalize_css_property_name.js';

export { escape };
export { register_component_css as register_css } from './css-registry.js';

/** @type {null | Component} */
export let active_component = null;

/** @type {number} */
let clock = 0;

/** @type {null | Dependency} */
let active_dependency = null;

export let tracking = false;

/**
 * @returns {number}
 */
function increment_clock() {
	return ++clock;
}

/**
 * @param {Tracked | Derived} tracked
 * @returns {Dependency}
 */
function create_dependency(tracked) {
	return {
		c: tracked.c,
		t: tracked,
		n: null,
	};
}

/**
 * @param {Tracked | Derived} tracked
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
function run_derived(computed) {
	var previous_tracking = tracking;
	var previous_dependency = active_dependency;
	var previous_component = active_component;

	try {
		active_component = computed.co;
		tracking = true;
		active_dependency = null;

		var value = computed.fn();

		computed.d = active_dependency;

		return value;
	} finally {
		tracking = previous_tracking;
		active_dependency = previous_dependency;
		active_component = previous_component;
	}
}

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

class Output {
	head = '';
	body = '';
	/** @type {Set<string>} */
	css = new Set();
	/** @type {Promise<any>[]} */
	promises = [];
	/** @type {Output | null} */
	#parent = null;
	/** @type {import('stream').Readable | null} */
	#stream = null;

	/**
	 * @param {Output | null} parent
	 * @param {import('stream').Readable | null} stream
	 */
	constructor(parent, stream = null) {
		this.#parent = parent;
		this.#stream = stream;
	}

	/**
	 * @param {string} str
	 * @returns {void}
	 */
	push(str) {
		if (this.#stream) {
			this.#stream.push(str);
		} else {
			this.body += str;
		}
	}

	/**
	 * @param {string} hash
	 * @returns {void}
	 */
	register_css(hash) {
		this.css.add(hash);
	}
}

/** @type {render} */
export async function render(component) {
	const output = new Output(null, null);
	let head = '';
	let body = '';
	let css = new Set();

	try {
		if (component.async) {
			await component(output, {});
		} else {
			component(output, {});
		}
		if (output.promises.length > 0) {
			await Promise.all(output.promises);
		}

		head = output.head;
		body = output.body;
		css = output.css;
	} catch (error) {
		console.log(error);
	}
	return { head, body, css };
}

/** @type {renderToStream} */
export function renderToStream(component) {
	const stream = new Readable({
		read() {},
	});
	const output = new Output(null, stream);
	render_in_chunks(component, stream, output);
	return stream;
}
/**
 *
 * @param {SSRComponent} component
 * @param {Readable} stream
 * @param {Output} output
 */
async function render_in_chunks(component, stream, output) {
	try {
		if (component.async) {
			await component(output, {});
		} else {
			component(output, {});
		}
		if (output.promises.length > 0) {
			await Promise.all(output.promises);
		}
		stream.push(null);
	} catch (error) {
		console.error(error);
		stream.emit('error', error);
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
	active_component = component.p;
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
 * @param {any} tracked
 * @returns {any}
 */
export function get(tracked) {
	if (!is_tracked_object(tracked)) {
		return tracked;
	}

	if ((tracked.f & DERIVED) !== 0) {
		update_derived(/** @type {Derived} **/ (tracked));
		if (tracking) {
			register_dependency(tracked);
		}
	} else if (tracking) {
		register_dependency(tracked);
	}

	var g = tracked.a.get;
	return g ? g(tracked.v) : tracked.v;
}

/**
 * @param {Derived | Tracked} tracked
 * @param {any} value
 */
export function set(tracked, value) {
	var old_value = tracked.v;

	if (value !== old_value) {
		var s = tracked.a.set;
		tracked.v = s ? s(value, tracked.v) : value;
		tracked.c = increment_clock();
	}
}

/**
 * @param {Tracked} tracked
 * @param {number} [d]
 * @returns {number}
 */
export function update(tracked, d = 1) {
	var value = get(tracked);
	var result = d === 1 ? value++ : value--;
	set(tracked, value);
	return result;
}

/**
 * @param {Tracked} tracked
 * @param {number} [d]
 * @returns {number}
 */
export function update_pre(tracked, d = 1) {
	var value = get(tracked);
	var new_value = d === 1 ? ++value : --value;
	set(tracked, new_value);
	return new_value;
}

/**
 * @param {any} obj
 * @param {string | number | symbol} property
 * @param {any} value
 * @returns {void}
 */
export function set_property(obj, property, value) {
	var tracked = obj[property];
	set(tracked, value);
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

/**
 * @param {any} obj
 * @param {string | number | symbol} property
 * @param {number} [d=1]
 * @returns {number}
 */
export function update_property(obj, property, d = 1) {
	var tracked = obj[property];
	var value = get(tracked);
	var new_value = d === 1 ? value++ : value--;
	set(tracked, value);
	return new_value;
}

/**
 * @param {any} obj
 * @param {string | number | symbol} property
 * @param {number} [d=1]
 * @returns {number}
 */
export function update_pre_property(obj, property, d = 1) {
	var tracked = obj[property];
	var value = get(tracked);
	var new_value = d === 1 ? ++value : --value;
	set(tracked, new_value);
	return new_value;
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
	let value_to_escape = name === 'class' ? clsx(normalized) : normalized;
	value_to_escape =
		name === 'style'
			? typeof value !== 'string'
				? get_styles(value)
				: String(normalized).trim()
			: value_to_escape;
	const assignment = is_boolean ? '' : `="${escape(value_to_escape, true)}"`;
	return ` ${name}${assignment}`;
}

/**
 * @param {Record<string, string | number>} styles
 * @returns {string}
 */
function get_styles(styles) {
	var result = '';
	for (const key in styles) {
		const css_prop = normalize_css_property_name(key);
		const value = String(styles[key]).trim();
		result += `${css_prop}: ${value}; `;
	}
	return result.trim();
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
