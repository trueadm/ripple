import { is_passive_event } from '../../../utils/events.js';
import {
	active_block,
	active_reaction,
	set_active_block,
	set_active_reaction,
	set_tracking,
	tracking,
} from './runtime.js';
import { array_from, define_property, is_array } from './utils.js';

/** @type {Set<string>} */
var all_registered_events = new Set();

/** @type {Set<(events: Array<string>) => void>} */
var root_event_handles = new Set();

/**
 * @param {EventTarget} element
 * @param {string} type
 * @param {EventListener} handler
 * @param {AddEventListenerOptions} [options]
 */
export function on(element, type, handler, options = {}) {
	var target_handler = create_event(type.toLowerCase(), element, handler, options);

	return () => {
		element.removeEventListener(type, target_handler, options);
	};
}

/**
 * @this {EventTarget}
 * @param {Event} event
 * @returns {void}
 */
export function handle_event_propagation(event) {
	var handler_element = this;
	var owner_document = /** @type {Node} */ (handler_element).ownerDocument;
	var event_name = event.type;
	var path = event.composedPath?.() || [];
	var current_target = /** @type {null | Element} */ (path[0] || event.target);

	// composedPath contains list of nodes the event has propagated through.
	// We check __root to skip all nodes below it in case this is a
	// parent of the __root node, which indicates that there's nested
	// mounted apps. In this case we don't want to trigger events multiple times.
	var path_idx = 0;

	// @ts-expect-error is added below
	var handled_at = event.__root;

	if (handled_at) {
		var at_idx = path.indexOf(handled_at);
		if (
			at_idx !== -1 &&
			(handler_element === document || handler_element === /** @type {any} */ (window))
		) {
			// This is the fallback document listener or a window listener, but the event was already handled
			// -> ignore, but set handle_at to document/window so that we're resetting the event
			// chain in case someone manually dispatches the same event object again.
			// @ts-expect-error
			event.__root = handler_element;
			return;
		}

		// We're deliberately not skipping if the index is higher, because
		// someone could create an event programmatically and emit it multiple times,
		// in which case we want to handle the whole propagation chain properly each time.
		// (this will only be a false negative if the event is dispatched multiple times and
		// the fallback document listener isn't reached in between, but that's super rare)
		var handler_idx = path.indexOf(handler_element);
		if (handler_idx === -1) {
			// handle_idx can theoretically be -1 (happened in some JSDOM testing scenarios with an event listener on the window object)
			// so guard against that, too, and assume that everything was handled at this point.
			return;
		}

		if (at_idx <= handler_idx) {
			path_idx = at_idx;
		}
	}

	current_target = /** @type {Element} */ (path[path_idx] || event.target);
	// there can only be one delegated event per element, and we either already handled the current target,
	// or this is the very first target in the chain which has a non-delegated listener, in which case it's safe
	// to handle a possible delegated event on it later (through the root delegation listener for example).
	if (current_target === handler_element) return;

	// Proxy currentTarget to correct target
	define_property(event, 'currentTarget', {
		configurable: true,
		get() {
			return current_target || owner_document;
		},
	});

	var previous_block = active_block;
	var previous_reaction = active_reaction;
	var previous_tracking = tracking;

	set_active_block(null);
	set_active_reaction(null);
	set_tracking(false);

	try {
		/**
		 * @type {unknown}
		 */
		var throw_error;
		/**
		 * @type {unknown[]}
		 */
		var other_errors = [];

		while (current_target !== null) {
			/** @type {null | Element} */
			var parent_element =
				current_target.assignedSlot ||
				current_target.parentNode ||
				/** @type {any} */ (current_target).host ||
				null;

			try {
				// @ts-expect-error
				var delegated = current_target['__' + event_name];

				if (delegated !== undefined && !(/** @type {any} */ (current_target).disabled)) {
					if (is_array(delegated)) {
						var [fn, block, ...data] = delegated;
						fn.apply(current_target, [event, ...data, block]);
					} else {
						delegated.call(current_target, event);
					}
				}
			} catch (error) {
				if (throw_error) {
					other_errors.push(error);
				} else {
					throw_error = error;
				}
			}
			if (event.cancelBubble || parent_element === handler_element || parent_element === null) {
				break;
			}
			current_target = parent_element;
		}

		if (throw_error) {
			for (let error of other_errors) {
				// Throw the rest of the errors, one-by-one on a microtask
				queueMicrotask(() => {
					throw error;
				});
			}
			throw throw_error;
		}
	} finally {
		set_active_block(previous_block);
		// @ts-expect-error is used above
		event.__root = handler_element;
		// @ts-ignore remove proxy on currentTarget
		delete event.currentTarget;
		set_active_block(previous_block);
		set_active_reaction(previous_reaction);
		set_tracking(previous_tracking);
	}
}

/**
 * @param {string} event_name
 * @param {EventTarget} dom
 * @param {EventListener} [handler]
 * @param {AddEventListenerOptions} [options]
 */
function create_event(event_name, dom, handler, options = {}) {
	/** @this {any} */
	function target_handler(/** @type {Event} */ event) {
		var previous_block = active_block;
		var previous_reaction = active_reaction;
		var previous_tracking = tracking;

		try {
			set_active_block(null);
			set_active_reaction(null);
			set_tracking(false);

			if (!options.capture) {
				// Only call in the bubble phase, else delegated events would be called before the capturing events
				handle_event_propagation.call(dom, event);
			}
			if (!event.cancelBubble) {
				return handler?.call(this, event);
			}
		} finally {
			set_active_block(previous_block);
			set_active_reaction(previous_reaction);
			set_tracking(previous_tracking);
		}
	}

	dom.addEventListener(event_name, target_handler, options);

	return target_handler;
}

/**
 * @param {string} event_name
 * @param {Element} dom
 * @param {EventListener} [handler]
 * @param {boolean} [capture]
 * @param {boolean} [passive]
 * @returns {void}
 */
export function event(event_name, dom, handler, capture, passive) {
	var options = { capture, passive };
	create_event(event_name, dom, handler, options);
}

/**
 * @param {Array<string>} events
 * @returns {void}
 */
export function delegate(events) {
	for (var i = 0; i < events.length; i++) {
		all_registered_events.add(events[i]);
	}

	for (var fn of root_event_handles) {
		fn(events);
	}
}

/** @param {Element} target */
export function handle_root_events(target) {
	var registered_events = new Set();

	/**
	 * @typedef {Object} EventHandleOptions
	 * @property {boolean} [passive]
	 */

	/**
	 * @typedef {(
	 *   events: Array<string>
	 * ) => void} EventHandle
	 */

	/** @type {EventHandle} */
	var event_handle = (/** @type {Array<string>} */ events) => {
		for (var i = 0; i < events.length; i++) {
			var event_name = events[i];

			if (registered_events.has(event_name)) continue;
			registered_events.add(event_name);

			/** @type {boolean} */
			var passive = is_passive_event(event_name);

			/** @type {EventHandleOptions} */
			var options = { passive };

			target.addEventListener(event_name, handle_event_propagation, options);
		}
	};

	event_handle(array_from(all_registered_events));
	root_event_handles.add(event_handle);

	return () => {
		for (var event_name of registered_events) {
			target.removeEventListener(event_name, handle_event_propagation);
		}
		root_event_handles.delete(event_handle);
	};
}
