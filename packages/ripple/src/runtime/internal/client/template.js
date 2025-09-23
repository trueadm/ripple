import { TEMPLATE_FRAGMENT, TEMPLATE_USE_IMPORT_NODE } from '../../../constants.js';
import { first_child, is_firefox } from './operations.js';
import { active_block } from './runtime.js';

export function assign_nodes(start, end) {
  var block = /** @type {Effect} */ (active_block);
  if (block.s === null) {
    block.s = {
      start,
      end,
    };
  }
}

function create_fragment_from_html(html) {
  if (is_svg_template(html)) {
    return create_svg_fragment_from_html(html);
  }

  var elem = document.createElement('template');
  elem.innerHTML = html;
  return elem.content;
}

export function template(content, flags) {
  var is_fragment = (flags & TEMPLATE_FRAGMENT) !== 0;
  var use_import_node = (flags & TEMPLATE_USE_IMPORT_NODE) !== 0;
  var node;
  var has_start = !content.startsWith('<!>');

  return () => {
    if (node === undefined) {
      node = create_fragment_from_html(has_start ? content : '<!>' + content);
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

export function append(anchor, dom) {
  anchor.before(/** @type {Node} */ (dom));
}

const SVG_ELEMENTS = new Set([
  'svg',
  'g',
  'defs',
  'symbol',
  'use',
  'switch',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'path',
  'text',
  'tspan',
  'textPath',
  'linearGradient',
  'radialGradient',
  'pattern',
  'stop',
  'clipPath',
  'mask',
  'filter',
  'feBlend',
  'feColorMatrix',
  'feComponentTransfer',
  'feComposite',
  'feConvolveMatrix',
  'feDiffuseLighting',
  'feDisplacementMap',
  'feDistantLight',
  'feDropShadow',
  'feFlood',
  'feFuncA',
  'feFuncR',
  'feFuncG',
  'feFuncB',
  'feGaussianBlur',
  'feImage',
  'feMerge',
  'feMergeNode',
  'feMorphology',
  'feOffset',
  'fePointLight',
  'feSpecularLighting',
  'feSpotLight',
  'feTile',
  'feTurbulence',
  'image',
  'foreignObject',
  'a',
  'view',
  'animate',
  'animateMotion',
  'animateTransform',
  'set',
  'mpath',
  'title',
  'desc',
  'metadata',
  'marker',
  'script',
  'style',
]);

function is_svg_template(html) {
  const match = html.match(/<(\w+)/);
  return match && SVG_ELEMENTS.has(match[1].toLowerCase());
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
