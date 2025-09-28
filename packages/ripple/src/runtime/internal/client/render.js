/** @import { Block } from '#client' */

import { destroy_block, ref } from './blocks.js';
import { REF_PROP } from './constants.js';
import {
  get_descriptors,
  get_own_property_symbols,
  get_prototype_of,
  is_tracked_object,
} from './utils.js';
import { delegate, event } from './events.js';
import {
  get_attribute_event_name,
  is_delegated,
  is_event_attribute,
} from '../../../utils/events.js';
import { get } from './runtime.js';

/**
 * @param {Text} text
 * @param {any} value
 * @returns {void}
 */
export function set_text(text, value) {
  // For objects, we apply string coercion
  var str = value == null ? '' : typeof value === 'object' ? value + '' : value;
  // @ts-expect-error
  if (str !== (text.__t ??= text.nodeValue)) {
    // @ts-expect-error
    text.__t = str;
    text.nodeValue = str + '';
  }
}

/** @type {Map<string, string[]>} */
var setters_cache = new Map();

/**
 * @param {Element} element
 * @returns {string[]}
 */
function get_setters(element) {
  var setters = setters_cache.get(element.nodeName);
  if (setters) return setters;
  setters_cache.set(element.nodeName, (setters = []));

  var descriptors;
  var proto = element; // In the case of custom elements there might be setters on the instance
  var element_proto = Element.prototype;

  // Stop at Element, from there on there's only unnecessary setters we're not interested in
  // Do not use constructor.name here as that's unreliable in some browser environments
  while (element_proto !== proto) {
    descriptors = get_descriptors(proto);

    for (var key in descriptors) {
      if (descriptors[key].set) {
        setters.push(key);
      }
    }

    proto = get_prototype_of(proto);
  }

  return setters;
}

/**
 * @param {Element} element
 * @param {string} attribute
 * @param {any} value
 * @returns {void}
 */
export function set_attribute(element, attribute, value) {
  // @ts-expect-error
  var attributes = (element.__attributes ??= {});

  if (attributes[attribute] === (attributes[attribute] = value)) return;

  if (attribute === 'style' && '__styles' in element) {
    // reset styles to force style: directive to update
    element.__styles = {};
  }

  if (value == null) {
    element.removeAttribute(attribute);
  } else if (typeof value !== 'string' && get_setters(element).includes(attribute)) {
    /** @type {any} */ (element)[attribute] = value;
  } else {
    element.setAttribute(attribute, value);
  }
}

/**
 * @param {Element} element
 * @param {Record<string, any>} attributes
 * @returns {void}
 */
export function set_attributes(element, attributes) {
  for (const key in attributes) {
    if (key === 'children') continue;

    let value = attributes[key];

    if (is_tracked_object(value)) {
      value = get(value);
    }

    if (key === 'class') {
      const is_html = element.namespaceURI === 'http://www.w3.org/1999/xhtml';
      set_class(/** @type {HTMLElement} */ (element), value, undefined, is_html);
    } else if (key === '#class') {
      // Special case for static class when spreading props
      element.classList.add(value);
    } else if (is_event_attribute(key)) {
      // Handle event handlers in spread props
      const event_name = get_attribute_event_name(key);

      if (is_delegated(event_name)) {
        // Use delegation for delegated events
        /** @type {any} */ (element)['__' + event_name] = value;
        delegate([event_name]);
      } else {
        // Use addEventListener for non-delegated events
        event(event_name, element, value);
      }
    } else {
      set_attribute(element, key, value);
    }
  }
}

/**
 * @template V
 * @param {V} value
 * @param {string} [hash]
 * @returns {string | V}
 */
function to_class(value, hash) {
  return (value == null ? '' : value) + (hash ? ' ' + hash : '');
}

/**
 * @param {HTMLElement} dom
 * @param {string} value
 * @param {string} [hash]
 * @param {boolean} [is_html]
 * @returns {void}
 */
export function set_class(dom, value, hash, is_html = true) {
  // @ts-expect-error need to add __className to patched prototype
  var prev_class_name = dom.__className;
  var next_class_name = to_class(value, hash);

  if (prev_class_name !== next_class_name) {
    // Removing the attribute when the value is only an empty string causes
    // peformance issues vs simply making the className an empty string. So
    // we should only remove the class if the the value is nullish.
    if (value == null && !hash) {
      dom.removeAttribute('class');
    } else {
      if (is_html) {
        dom.className = next_class_name;
      } else {
        dom.setAttribute('class', next_class_name);
      }
    }

    // @ts-expect-error need to add __className to patched prototype
    dom.__className = next_class_name;
  }
}

/**
 * @param {HTMLInputElement | HTMLProgressElement} element
 * @param {any} value
 * @returns {void}
 */
export function set_value(element, value) {
  // @ts-expect-error
  var attributes = (element.__attributes ??= {});

  if (
    attributes.value ===
      (attributes.value =
        // treat null and undefined the same for the initial value
        value ?? undefined) ||
    // `progress` elements always need their value set when it's `0`
    (element.value === value && (value !== 0 || element.nodeName !== 'PROGRESS'))
  ) {
    return;
  }

  element.value = value ?? '';
}

/**
 * @param {HTMLInputElement} element
 * @param {boolean} checked
 * @returns {void}
 */
export function set_checked(element, checked) {
  // @ts-expect-error
  var attributes = (element.__attributes ??= {});

  if (
    attributes.checked ===
    (attributes.checked =
      // treat null and undefined the same for the initial value
      checked ?? undefined)
  ) {
    return;
  }

  element.checked = checked;
}

/**
 * @param {HTMLOptionElement} element
 * @param {boolean} selected
 * @returns {void}
 */
export function set_selected(element, selected) {
  if (selected) {
    // The selected option could've changed via user selection, and
    // setting the value without this check would set it back.
    if (!element.hasAttribute('selected')) {
      element.setAttribute('selected', '');
    }
  } else {
    element.removeAttribute('selected');
  }
}

/**
 * @param {Element} element
 * @param {() => Record<string | symbol, any>} fn
 * @returns {() => void}
 */
export function apply_element_spread(element, fn) {
  /** @type {Record<string | symbol, any> | undefined} */
  var prev;
  /** @type {Record<symbol, Block>} */
  var effects = {};

  return () => {
    var next = fn();

    for (let symbol of get_own_property_symbols(effects)) {
      if (!next[symbol]) {
        destroy_block(effects[symbol]);
      }
    }

    for (const symbol of get_own_property_symbols(next)) {
      var ref_fn = next[symbol];

      if (symbol.description === REF_PROP && (!prev || ref_fn !== prev[symbol])) {
        if (effects[symbol]) {
          destroy_block(effects[symbol]);
        }
        effects[symbol] = ref(element, () => ref_fn);
      }

      next[symbol] = ref_fn;
    }

    set_attributes(element, next);

    prev = next;
  };
}
