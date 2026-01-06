/**
@import * as AST from 'estree';
@import {AnalysisContext} from '#compiler';
@import { RippleCompileError } from 'ripple/compiler';
 */

import { error } from '../../errors.js';

const invalid_nestings = {
	// <p> cannot contain block-level elements
	p: new Set([
		'address',
		'article',
		'aside',
		'blockquote',
		'details',
		'div',
		'dl',
		'fieldset',
		'figcaption',
		'figure',
		'footer',
		'form',
		'h1',
		'h2',
		'h3',
		'h4',
		'h5',
		'h6',
		'header',
		'hgroup',
		'hr',
		'main',
		'menu',
		'nav',
		'ol',
		'p',
		'pre',
		'section',
		'table',
		'ul',
	]),
	// <span> cannot contain block-level elements
	span: new Set([
		'address',
		'article',
		'aside',
		'blockquote',
		'details',
		'div',
		'dl',
		'fieldset',
		'figcaption',
		'figure',
		'footer',
		'form',
		'h1',
		'h2',
		'h3',
		'h4',
		'h5',
		'h6',
		'header',
		'hgroup',
		'hr',
		'main',
		'menu',
		'nav',
		'ol',
		'p',
		'pre',
		'section',
		'table',
		'ul',
	]),
	// Interactive elements cannot be nested
	a: new Set(['a', 'button']),
	button: new Set(['a', 'button']),
	// Form elements
	label: new Set(['label']),
	form: new Set(['form']),
	// Headings cannot be nested within each other
	h1: new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']),
	h2: new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']),
	h3: new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']),
	h4: new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']),
	h5: new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']),
	h6: new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']),
	// Table structure
	table: new Set(['table', 'tr', 'td', 'th']), // Can only contain caption, colgroup, thead, tbody, tfoot
	thead: new Set(['caption', 'colgroup', 'thead', 'tbody', 'tfoot', 'td', 'th']), // Can only contain tr
	tbody: new Set(['caption', 'colgroup', 'thead', 'tbody', 'tfoot', 'td', 'th']), // Can only contain tr
	tfoot: new Set(['caption', 'colgroup', 'thead', 'tbody', 'tfoot', 'td', 'th']), // Can only contain tr
	tr: new Set(['caption', 'colgroup', 'thead', 'tbody', 'tfoot', 'tr']), // Can only contain td and th
	td: new Set(['td', 'th']), // Cannot nest td/th elements
	th: new Set(['td', 'th']), // Cannot nest td/th elements
	// Media elements
	picture: new Set(['picture']),
	// Main landmark - only one per document, cannot be nested
	main: new Set(['main']),
	// Other semantic restrictions
	figcaption: new Set(['figcaption']),
	dt: new Set([
		'header',
		'footer',
		'article',
		'aside',
		'nav',
		'section',
		'h1',
		'h2',
		'h3',
		'h4',
		'h5',
		'h6',
	]),
	// No interactive content inside summary
	summary: new Set(['summary']),
};

/**
 * @param {AST.Element} element
 * @returns {string | null}
 */
function get_element_tag(element) {
	return element.id.type === 'Identifier' ? element.id.name : null;
}

/**
 * @param {AST.Element} element
 * @param {AnalysisContext} context
 * @param {RippleCompileError[]} [errors]
 */
export function validate_nesting(element, context, errors) {
	const tag = get_element_tag(element);

	if (tag === null) {
		return;
	}

	for (let i = context.path.length - 1; i >= 0; i--) {
		const parent = context.path[i];
		if (parent.type === 'Element') {
			const parent_tag = get_element_tag(parent);
			if (parent_tag === null) {
				continue;
			}

			if (parent_tag in invalid_nestings) {
				const validation_set =
					invalid_nestings[/** @type {keyof typeof invalid_nestings} */ (parent_tag)];
				if (validation_set.has(tag)) {
					error(
						`Invalid HTML nesting: <${tag}> cannot be a descendant of <${parent_tag}>.`,
						context.state.analysis.module.filename,
						element,
						errors,
					);
				} else {
					// if my parent has a set of invalid children
					// and i'm not in it, then i'm valid
					return;
				}
			}
		}
	}
}
