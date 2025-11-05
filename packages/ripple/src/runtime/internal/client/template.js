/** @import { Block } from '#client' */

import {
	TEMPLATE_FRAGMENT,
	TEMPLATE_USE_IMPORT_NODE,
	TEMPLATE_SVG_NAMESPACE,
	TEMPLATE_MATHML_NAMESPACE,
} from '../../../constants.js';
import { first_child, is_firefox } from './operations.js';
import { active_block, active_namespace } from './runtime.js';

/**
 * Assigns start and end nodes to the active block's state.
 * @param {Node} start - The start node.
 * @param {Node} end - The end node.
 */
export function assign_nodes(start, end) {
	var block = /** @type {Block} */ (active_block);
	var s = block.s;
	if (s === null) {
		block.s = {
			start,
			end,
		};
	} else if (s.start === null) {
		s.start = start;
		s.end = end;
	}
}

/**
 * Creates a DocumentFragment from an HTML string.
 * @param {string} html - The HTML string.
 * @param {boolean} use_svg_namespace - Whether to use SVG namespace.
 * @param {boolean} use_mathml_namespace - Whether to use MathML namespace.
 * @returns {DocumentFragment}
 */
export function create_fragment_from_html(
	html,
	use_svg_namespace = false,
	use_mathml_namespace = false,
) {
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
 * @returns {() => Node}
 */
export function template(content, flags) {
	var is_fragment = (flags & TEMPLATE_FRAGMENT) !== 0;
	var use_import_node = (flags & TEMPLATE_USE_IMPORT_NODE) !== 0;
	var use_svg_namespace = (flags & TEMPLATE_SVG_NAMESPACE) !== 0;
	var use_mathml_namespace = (flags & TEMPLATE_MATHML_NAMESPACE) !== 0;
	/** @type {Node | DocumentFragment | undefined} */
	var node;
	var is_comment = content === '<!>';
	var has_start = !is_comment && !content.startsWith('<!>');

	return () => {
		// If using runtime namespace, check active_namespace
		var svg = !is_comment && (use_svg_namespace || active_namespace === 'svg');
		var mathml = !is_comment && (use_mathml_namespace || active_namespace === 'mathml');

		if (node === undefined) {
			node = create_fragment_from_html(has_start ? content : '<!>' + content, svg, mathml);
			if (!is_fragment) node = /** @type {Node} */ (first_child(node));
		}

		var clone =
			use_import_node || is_firefox
				? document.importNode(/** @type {Node} */ (node), true)
				: /** @type {Node} */ (node).cloneNode(true);

		if (is_fragment) {
			var start = first_child(clone);
			var end = clone.lastChild;

			assign_nodes(/** @type {Node} */ (start), /** @type {Node} */ (end));
		} else {
			assign_nodes(clone, clone);
		}

		return clone;
	};
}

/**
 * Appends a DOM node before the anchor node.
 * @param {ChildNode} anchor - The anchor node.
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
	var wrapped = `<${ns}>${content}</${ns}>`;

	var elem = document.createElement('template');
	elem.innerHTML = wrapped;
	var fragment = elem.content;

	var root = /** @type {Element} */ (first_child(fragment));
	var result = document.createDocumentFragment();

	var first;
	while ((first = first_child(root))) {
		result.appendChild(/** @type {Node} */ (first));
	}

	return result;
}
