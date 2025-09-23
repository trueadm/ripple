import {
  TEMPLATE_FRAGMENT,
  TEMPLATE_USE_IMPORT_NODE,
  TEMPLATE_SVG_NAMESPACE,
  TEMPLATE_MATHML_NAMESPACE,
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
 * @param {boolean} use_mathml_namespace - Whether to use MathML namespace.
 * @returns {DocumentFragment}
 */
function create_fragment_from_html(html, use_svg_namespace = false, use_mathml_namespace = false) {
  if (use_svg_namespace) {
    return from_namespace(html, 'svg');
  }
  if (use_mathml_namespace) {
    return from_namespace(html, 'math');
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
  var use_mathml_namespace = (flags & TEMPLATE_MATHML_NAMESPACE) !== 0;
  var node;
  var has_start = !content.startsWith('<!>');

  return () => {
    if (node === undefined) {
      node = create_fragment_from_html(
        has_start ? content : '<!>' + content,
        use_svg_namespace,
        use_mathml_namespace,
      );
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

/**
 * Create fragment with proper namespace using Svelte's wrapping approach
 * @param {string} content
 * @param {'svg' | 'math'} ns
 * @returns {DocumentFragment}
 */
function from_namespace(content, ns = 'svg') {
  // Wrap content in namespace element (like Svelte does)
  var wrapped = `<${ns}>${content}</${ns}>`;

  // Create fragment from wrapped HTML
  var elem = document.createElement('template');
  elem.innerHTML = wrapped;
  var fragment = elem.content;

  // Extract content from inside the wrapper
  var root = /** @type {Element} */ (first_child(fragment));
  var result = document.createDocumentFragment();

  while (first_child(root)) {
    result.appendChild(/** @type {Node} */ (first_child(root)));
  }

  return result;
}
