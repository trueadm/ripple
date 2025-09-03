/** @import { Context, Component } from '#client' */

import { active_component } from './runtime';

/**
 * @template T
 * @param {T} initial_value
 * @returns {Context<T>}
 */
export function create_context(initial_value) {
	return {
		v: initial_value,
	};
}

/**
 * @template T
 * @param {Context<T>} context
 * @returns {T}
 */
export function get_context(context) {
	const component = active_component;

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
  
  return context.v;
}

/**
 * @template T
 * @param {Context<T>} context
 * @param {T} value
 */
export function set_context(context, value) {
	const component = active_component;

	if (component === null) {
		throw new Error('No active component found, cannot set context');
	}

	let current_context = component.c;

	if (current_context === null) {
		current_context = component.c = new Map();
	}

	current_context.set(context, value);
}
