/** @import { Component } from '#client' */

import { active_component } from './runtime.js';

/**
 * @template T
 */
export class Context {
	/**
	 * @param {T} initial_value
	 */
	constructor(initial_value) {
		/** @type {T} */
		this._v = initial_value;
	}

	get() {
		const component = active_component;
		const context = this;

		if (component === null) {
			throw new Error('No active component found, cannot get context');
		}
		/** @type {Component | null} */
		let current_component = component;

		while (current_component !== null) {
			const context_map = current_component.c;

			if (context_map?.has(context)) {
				return context_map.get(context);
			}

			current_component = current_component.p;
		}

		return context._v;
	}

	/**
	 * @template T
	 * @param {T} value
	 */
	set(value) {
		const component = active_component;
		const context = this;

		if (component === null) {
			throw new Error('No active component found, cannot set context');
		}

		let current_context = component.c;

		if (current_context === null) {
			current_context = component.c = new Map();
		}

		current_context.set(context, value);
	}
}
