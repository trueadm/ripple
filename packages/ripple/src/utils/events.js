/** @import { AddEventObject } from '#public'*/

const NON_DELEGATED_EVENTS = new Set([
	'abort',
	'afterprint',
	'beforeprint',
	'beforetoggle',
	'beforeunload',
	'blur',
	'close',
	'command',
	'contextmenu',
	'cuechange',
	'DOMContentLoaded',
	'error',
	'focus',
	'invalid',
	'load',
	'loadend',
	'loadstart',
	'mouseenter',
	'mouseleave',
	'pointerenter',
	'pointerleave',
	'progress',
	'readystatechange',
	'resize',
	'scroll',
	'scrollend',
	'toggle',
	'unload',
	'visibilitychange',
	// Media Events
	'canplay',
	'canplaythrough',
	'durationchange',
	'emptied',
	'encrypted',
	'ended',
	'loadeddata',
	'loadedmetadata',
	'loadstart',
	'pause',
	'play',
	'playing',
	'progress',
	'ratechange',
	'seeked',
	'seeking',
	'stalled',
	'suspend',
	'timeupdate',
	'volumechange',
	'waiting',
	'waitingforkey',
]);

/**
 * Checks if an event should be delegated
 * @param {string} event_name - The event name (e.g., 'click', 'focus')
 * @returns {boolean}
 */
export function is_non_delegated(event_name) {
	return NON_DELEGATED_EVENTS.has(event_name);
}

/**
 * Determines if an attribute is an event attribute (e.g., 'onClick').
 * @param {string} attr - The attribute name.
 * @returns {boolean}
 */
export function is_event_attribute(attr) {
	return attr.startsWith('on') && attr.length > 2;
}

/**
 * Checks if the provided handler is a valid event handler.
 * @param {EventListener | AddEventObject | any} handler
 * @returns {boolean}
 */
export function is_event_handler_function(handler) {
	return typeof handler === 'function' || typeof handler?.handleEvent === 'function';
}

/**
 * @param {string} event_name
 * @param {EventListener | AddEventObject} handler
 * @returns {string}
 */
export function get_attribute_event_name(event_name, handler) {
	event_name = event_name.slice(2); // strip "on"
	return typeof handler === 'function' || !handler?.custom ? event_name.toLowerCase() : event_name;
}

const PASSIVE_EVENTS = ['touchstart', 'touchmove', 'wheel', 'mousewheel'];

/**
 * Checks if an event is passive (e.g., 'touchstart', 'touchmove').
 * @param {string} name - The event name.
 * @returns {boolean}
 */
export function is_passive_event(name) {
	return PASSIVE_EVENTS.includes(name);
}
