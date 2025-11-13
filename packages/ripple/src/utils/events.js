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
	return attr.startsWith('on') && attr.length > 2 && attr[2] === attr[2].toUpperCase();
}

/**
 * Checks if the event is a capture event.
 * @param {string} event_name - The event name.
 * @returns {boolean}
 */
export function is_capture_event(event_name) {
	var lowered = event_name.toLowerCase();
	return (
		event_name.endsWith('Capture') &&
		lowered !== 'gotpointercapture' &&
		lowered !== 'lostpointercapture'
	);
}

/**
 * Retrieves the original event name from an event attribute.
 * @param {string} name
 * @returns {string}
 */
export function get_original_event_name(name) {
	return name.slice(2);
}

/**
 * Normalizes the event name to lowercase.
 * @param {string} name
 * @returns {string}
 */
export function normalize_event_name(name) {
	return extract_event_name(name).toLowerCase();
}

/**
 * Extracts the base event name from an event attribute.
 * @param {string} name
 * @returns {string}
 */
function extract_event_name(name) {
	name = get_original_event_name(name);

	if (is_capture_event(name)) {
		return event_name_from_capture(name);
	}
	return name;
}

/**
 * Converts a capture event name to its base event name.
 * @param {string} event_name
 * @returns {string}
 */
export function event_name_from_capture(event_name) {
	return event_name.slice(0, -7); // strip "Capture"
}

/**
 * Converts an event attribute name to the actual event name.
 * @param {string} name
 * @param {EventListener | AddEventObject} handler
 * @returns {string}
 */
export function get_attribute_event_name(name, handler) {
	name = extract_event_name(name);

	return typeof handler === 'object' && handler.customName
		? handler.customName
		: name.toLowerCase();
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
