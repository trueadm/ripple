import {
  TEMPLATE_FRAGMENT,
  TEMPLATE_USE_IMPORT_NODE,
  TEMPLATE_SVG_NAMESPACE,
} from '../../../constants.js';
import { first_child, is_firefox } from './operations.js';
import { active_block } from './runtime.js';

/**
 * Assigns start and end nodes to the active block's state.
 * @param {Node} start - The start node.
 * @param {Node} end - The end node.
 */
export function assign_nodes(start, end) {
  var block = /** @type {Effect} */ (active_block);
  if (block.s === null) {
    block.s = {
      start,
      end,
    };
  }
}

/**
 * Creates a DocumentFragment from an HTML string.
 * @param {string} html - The HTML string.
 * @param {boolean} use_svg_namespace - Whether to use SVG namespace.
 * @returns {DocumentFragment}
 */
function create_fragment_from_html(html, use_svg_namespace = false) {
  if (use_svg_namespace) {
    return create_svg_fragment_from_html(html);
  }
  var elem = document.createElement('template');
  elem.innerHTML = html;
  return elem.content;
}

/**
 * Creates a template node or fragment from content and flags.
 * @param {string} content - The template content.
 * @param {number} flags - Flags for template type.
 * @returns {Node}
 */
export function template(content, flags) {
  var is_fragment = (flags & TEMPLATE_FRAGMENT) !== 0;
  var use_import_node = (flags & TEMPLATE_USE_IMPORT_NODE) !== 0;
  var use_svg_namespace = (flags & TEMPLATE_SVG_NAMESPACE) !== 0;
  var node;
  var has_start = !content.startsWith('<!>');

  return () => {
    if (node === undefined) {
      node = create_fragment_from_html(has_start ? content : '<!>' + content, use_svg_namespace);
      if (!is_fragment) node = first_child(node);
    }

    var clone =
      use_import_node || is_firefox ? document.importNode(node, true) : node.cloneNode(true);

    if (is_fragment) {
      var start = first_child(clone);
      var end = clone.lastChild;

      assign_nodes(start, end);
    } else {
      assign_nodes(clone, clone);
    }

    return clone;
  };
}

/**
 * Appends a DOM node before the anchor node.
 * @param {Node} anchor - The anchor node.
 * @param {Node} dom - The DOM node to append.
 */
export function append(anchor, dom) {
  anchor.before(/** @type {Node} */ (dom));
}

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

function create_svg_fragment_from_html(html) {
  var svgContainer = document.createElementNS(SVG_NAMESPACE, 'svg');
  svgContainer.innerHTML = html;

  var fragment = document.createDocumentFragment();
  while (svgContainer.firstChild) {
    fragment.appendChild(svgContainer.firstChild);
  }
  return fragment;
}
