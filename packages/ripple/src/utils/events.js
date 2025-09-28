/** List of Element events that will be delegated */
const DELEGATED_EVENTS = [
  'beforeinput',
  'click',
  'change',
  'dblclick',
  'contextmenu',
  'focusin',
  'focusout',
  'input',
  'keydown',
  'keyup',
  'mousedown',
  'mousemove',
  'mouseout',
  'mouseover',
  'mouseup',
  'pointerdown',
  'pointermove',
  'pointerout',
  'pointerover',
  'pointerup',
  'touchend',
  'touchmove',
  'touchstart',
];

/**
 * Checks if an event should be delegated
 * @param {string} event_name - The event name (e.g., 'click', 'focus')
 * @returns {boolean}
 */
export function is_delegated(event_name) {
  return DELEGATED_EVENTS.includes(event_name);
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
 * @param {string} name
 */
export function is_capture_event(name) {
  return (
    name.endsWith('Capture') &&
    name.toLowerCase() !== 'gotpointercapture' &&
    name.toLowerCase() !== 'lostpointercapture'
  );
}

/**
 * @param {string} event_name
 */
export function get_attribute_event_name(event_name) {
  event_name = event_name.slice(2); // strip "on"
  if (is_capture_event(event_name)) {
    event_name = event_name.slice(0, -7); // strip "Capture"
  }
  return event_name.toLowerCase();
}

const PASSIVE_EVENTS = ['touchstart', 'touchmove'];

/**
 * Checks if an event is passive (e.g., 'touchstart', 'touchmove').
 * @param {string} name - The event name.
 * @returns {boolean}
 */
export function is_passive_event(name) {
  return PASSIVE_EVENTS.includes(name);
}
