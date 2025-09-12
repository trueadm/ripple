/** @import * as s from '#style' */
/** @import { AST } from '#style' */

import { hash } from '../../utils.js';

const REGEX_COMMENT_CLOSE = /\*\//;
const REGEX_HTML_COMMENT_CLOSE = /-->/;
const REGEX_PERCENTAGE = /^\d+(\.\d+)?%/;
const REGEX_COMBINATOR = /^(\+|~|>|\|\|)/;
const REGEX_VALID_IDENTIFIER_CHAR = /[a-zA-Z0-9_-]/;
const REGEX_LEADING_HYPHEN_OR_DIGIT = /-?\d/;
const REGEX_WHITESPACE_OR_COLON = /[\s:]/;
const REGEX_NTH_OF =
	/^(even|odd|\+?(\d+|\d*n(\s*[+-]\s*\d+)?)|-\d*n(\s*\+\s*\d+))((?=\s*[,)])|\s+of\s+)/;

const regex_whitespace = /\s/;

class Parser {
	index = 0;

	/**
	 * @param {string} template
	 * @param {boolean} loose
	 */
	constructor(template, loose) {
		if (typeof template !== 'string') {
			throw new TypeError('Template must be a string');
		}

		this.loose = loose;
		this.template_untrimmed = template;
		this.template = template.trimEnd();
	}

	/**
	 * @param {string} str
	 */
	match(str) {
		const length = str.length;
		if (length === 1) {
			// more performant than slicing
			return this.template[this.index] === str;
		}

		return this.template.slice(this.index, this.index + length) === str;
	}

	/**
	 * @param {string} str
	 * @param {boolean} [required]
	 * @param {boolean} [required_in_loose]
	 */
	eat(str, required = false, required_in_loose = true) {
		if (this.match(str)) {
			this.index += str.length;
			return true;
		}

		if (required && (!this.loose || required_in_loose)) {
			throw new Error(`Expected ${str}`);
		}

		return false;
	}

	/**
	 * @param {RegExp} pattern
	 */
	match_regex(pattern) {
		const match = pattern.exec(this.template.slice(this.index));
		if (!match || match.index !== 0) return null;

		return match[0];
	}

	/**
	 * @param {RegExp} pattern
	 */
	read(pattern) {
		const result = this.match_regex(pattern);
		if (result) this.index += result.length;
		return result;
	}

	allow_whitespace() {
		while (this.index < this.template.length && regex_whitespace.test(this.template[this.index])) {
			this.index++;
		}
	}

	/**
	 * @param {RegExp} pattern
	 */
	read_until(pattern) {
		if (this.index >= this.template.length) {
			if (this.loose) return '';
			throw new Error('Unexpected end of input');
		}

		const start = this.index;
		const match = pattern.exec(this.template.slice(start));

		if (match) {
			this.index = start + match.index;
			return this.template.slice(start, this.index);
		}

		this.index = this.template.length;
		return this.template.slice(start);
	}
}

/**
 * @param {string} content
 */
export function parse_style(content) {
	const parser = new Parser(content, false);

	return /** @type {s.StyleBlock} */ ({
		source: content,
		hash: `ripple-${hash(content)}`,
		type: 'StyleSheet',
		body: read_body(parser),
	});
}

/**
 * @param {Parser} parser 
 */
function allow_comment_or_whitespace(parser) {
	parser.allow_whitespace();
	while (parser.match('/*') || parser.match('<!--')) {
		if (parser.eat('/*')) {
			parser.read_until(REGEX_COMMENT_CLOSE);
			parser.eat('*/', true);
		}

		if (parser.eat('<!--')) {
			parser.read_until(REGEX_HTML_COMMENT_CLOSE);
			parser.eat('-->', true);
		}

		parser.allow_whitespace();
	}
}

/**
 * @param {Parser} parser 
 */
function read_body(parser) {
	const children = [];

	while (parser.index < parser.template.length) {
		allow_comment_or_whitespace(parser);

		if (parser.match('@')) {
			children.push(read_at_rule(parser));
		} else {
			children.push(read_rule(parser));
		}
	}

	return children;
}

/**
 * @param {Parser} parser 
 * @return {AST.CSS.AtRule}
 */
function read_at_rule(parser) {
	const start = parser.index;
	parser.eat('@', true);

	const name = read_identifier(parser);

	const prelude = read_value(parser);

	/** @type {AST.CSS.Block | null} */
	let block = null;

	if (parser.match('{')) {
		// e.g. `@media (...) {...}`
		block = read_block(parser);
	} else {
		// e.g. `@import '...'`
		parser.eat(';', true);
	}

	return {
		type: 'AtRule',
		start,
		end: parser.index,
		name,
		prelude,
		block
	};
}

/**
 * @param {Parser} parser 
 * @returns {AST.CSS.Rule}
 */
function read_rule(parser) {
	const start = parser.index;

	return {
		type: 'Rule',
		prelude: read_selector_list(parser),
		block: read_block(parser),
		start,
		end: parser.index,
		metadata: {
			parent_rule: null,
			has_local_selectors: false,
			is_global_block: false,
		},
	};
}

/**
 * @param {Parser} parser 
 * @returns {AST.CSS.Block}
 */
function read_block(parser) {
	const start = parser.index;

	parser.eat('{', true);

	/** @type {Array<AST.CSS.Declaration | AST.CSS.Rule | AST.CSS.AtRule>} */
	const children = [];

	while (parser.index < parser.template.length) {
		allow_comment_or_whitespace(parser);

		if (parser.match('}')) {
			break;
		} else {
			children.push(read_block_item(parser));
		}
	}

	parser.eat('}', true);

	return {
		type: 'Block',
		start,
		end: parser.index,
		children,
	};
}

/**
 * @param {Parser} parser 
 * @return {AST.CSS.Declaration | AST.CSS.Rule | AST.CSS.AtRule}
 */
function read_block_item(parser) {
	if (parser.match('@')) {
		return read_at_rule(parser);
	}

	// read ahead to understand whether we're dealing with a declaration or a nested rule.
	// this involves some duplicated work, but avoids a try-catch that would disguise errors
	const start = parser.index;
	read_value(parser);
	const char = parser.template[parser.index];
	parser.index = start;

	return char === '{' ? read_rule(parser) : read_declaration(parser);
}

/**
 * @param {Parser} parser 
 * @return {AST.CSS.Declaration}
 */
function read_declaration(parser) {
	const start = parser.index;

	const property = parser.read_until(REGEX_WHITESPACE_OR_COLON);
	parser.allow_whitespace();
	parser.eat(':');
	let index = parser.index;
	parser.allow_whitespace();

	const value = read_value(parser);

	if (!value && !property.startsWith('--')) {
		e.css_empty_declaration({ start, end: index });
	}

	const end = parser.index;

	if (!parser.match('}')) {
		parser.eat(';', true);
	}

	return {
		type: 'Declaration',
		start,
		end,
		property,
		value,
	};
}

/**
 * @param {Parser} parser 
 */
function read_value(parser) {
	let value = '';
	let escaped = false;
	let in_url = false;

	/** @type {null | '"' | "'"} */
	let quote_mark = null;

	while (parser.index < parser.template.length) {
		const char = parser.template[parser.index];

		if (escaped) {
			value += '\\' + char;
			escaped = false;
		} else if (char === '\\') {
			escaped = true;
		} else if (char === quote_mark) {
			quote_mark = null;
		} else if (char === ')') {
			in_url = false;
		} else if (quote_mark === null && (char === '"' || char === "'")) {
			quote_mark = char;
		} else if (char === '(' && value.slice(-3) === 'url') {
			in_url = true;
		} else if ((char === ';' || char === '{' || char === '}') && !in_url && !quote_mark) {
			return value.trim();
		}

		value += char;

		parser.index++;
	}

	throw new Error('Unexpected end of input');
}

/**
 * @param {Parser} parser 
 * @param {boolean} [inside_pseudo_class]
 * @returns {AST.CSS.SelectorList}
 */
function read_selector_list(parser, inside_pseudo_class = false) {
	/** @type {AST.CSS.ComplexSelector[]} */
	const children = [];

	allow_comment_or_whitespace(parser);

	const start = parser.index;

	while (parser.index < parser.template.length) {
		children.push(read_selector(parser, inside_pseudo_class));

		const end = parser.index;

		allow_comment_or_whitespace(parser);

		if (inside_pseudo_class ? parser.match(')') : parser.match('{')) {
			return {
				type: 'SelectorList',
				start,
				end,
				children,
			};
		} else {
			parser.eat(',', true);
			allow_comment_or_whitespace(parser);
		}
	}

	throw new Error('Unexpected end of input');
}

/**
 * @param {Parser} parser 
 * @returns {AST.CSS.Combinator | null}
 */
function read_combinator(parser) {
	const start = parser.index;
	parser.allow_whitespace();

	const index = parser.index;
	const name = parser.read(REGEX_COMBINATOR);

	if (name) {
		const end = parser.index;
		parser.allow_whitespace();

		return {
			type: 'Combinator',
			name,
			start: index,
			end,
		};
	}

	if (parser.index !== start) {
		return {
			type: 'Combinator',
			name: ' ',
			start,
			end: parser.index,
		};
	}

	return null;
}

/**
 * @param {Parser} parser 
 * @param {boolean} [inside_pseudo_class]
 * @return {AST.CSS.ComplexSelector}
 */
function read_selector(parser, inside_pseudo_class = false) {
	const list_start = parser.index;

	/** @type {AST.CSS.RelativeSelector[]} */
	const children = [];

	/**
	 * @param {AST.CSS.Combinator | null} combinator
	 * @param {number} start
	 * @returns {AST.CSS.RelativeSelector}
	 */
	function create_selector(combinator, start) {
		return {
			type: 'RelativeSelector',
			combinator,
			selectors: [],
			start,
			end: -1,
			metadata: {
				is_global: false,
				is_global_like: false,
				scoped: false,
			},
		};
	}

	/** @type {AST.CSS.RelativeSelector} */
	let relative_selector = create_selector(null, parser.index);

	while (parser.index < parser.template.length) {
		let start = parser.index;

		if (parser.eat('&')) {
			relative_selector.selectors.push({
				type: 'NestingSelector',
				name: '&',
				start,
				end: parser.index,
			});
		} else if (parser.eat('*')) {
			let name = '*';

			if (parser.eat('|')) {
				// * is the namespace (which we ignore)
				name = read_identifier(parser);
			}

			relative_selector.selectors.push({
				type: 'TypeSelector',
				name,
				start,
				end: parser.index,
			});
		} else if (parser.eat('#')) {
			relative_selector.selectors.push({
				type: 'IdSelector',
				name: read_identifier(parser),
				start,
				end: parser.index,
			});
		} else if (parser.eat('.')) {
			relative_selector.selectors.push({
				type: 'ClassSelector',
				name: read_identifier(parser),
				start,
				end: parser.index,
			});
		} else if (parser.eat('::')) {
			relative_selector.selectors.push({
				type: 'PseudoElementSelector',
				name: read_identifier(parser),
				start,
				end: parser.index,
			});
			// We read the inner selectors of a pseudo element to ensure it parses correctly,
			// but we don't do anything with the result.
			if (parser.eat('(')) {
				read_selector_list(parser, true);
				parser.eat(')', true);
			}
		} else if (parser.eat(':')) {
			const name = read_identifier(parser);

			/** @type {null | AST.CSS.SelectorList} */
			let args = null;

			if (parser.eat('(')) {
				args = read_selector_list(parser, true);
				parser.eat(')', true);
			}

			relative_selector.selectors.push({
				type: 'PseudoClassSelector',
				name,
				args,
				start,
				end: parser.index,
			});
		} else if (parser.eat('[')) {
			parser.allow_whitespace();
			const name = read_identifier(parser);
			parser.allow_whitespace();

			/** @type {string | null} */
			let value = null;

			const matcher = parser.read(REGEX_MATCHER);

			if (matcher) {
				parser.allow_whitespace();
				value = read_attribute_value(parser);
			}

			parser.allow_whitespace();

			const flags = parser.read(REGEX_ATTRIBUTE_FLAGS);

			parser.allow_whitespace();
			parser.eat(']', true);

			relative_selector.selectors.push({
				type: 'AttributeSelector',
				start,
				end: parser.index,
				name,
				matcher,
				value,
				flags,
			});
		} else if (inside_pseudo_class && parser.match_regex(REGEX_NTH_OF)) {
			// nth of matcher must come before combinator matcher to prevent collision else the '+' in '+2n-1' would be parsed as a combinator

			relative_selector.selectors.push({
				type: 'Nth',
				value: /**@type {string} */ (parser.read(REGEX_NTH_OF)),
				start,
				end: parser.index,
			});
		} else if (parser.match_regex(REGEX_PERCENTAGE)) {
			relative_selector.selectors.push({
				type: 'Percentage',
				value: /** @type {string} */ (parser.read(REGEX_PERCENTAGE)),
				start,
				end: parser.index,
			});
		} else if (!parser.match_regex(REGEX_COMBINATOR)) {
			let name = read_identifier(parser);

			if (parser.eat('|')) {
				// we ignore the namespace when trying to find matching element classes
				name = read_identifier(parser);
			}

			relative_selector.selectors.push({
				type: 'TypeSelector',
				name,
				start,
				end: parser.index,
			});
		}

		const index = parser.index;
		allow_comment_or_whitespace(parser);

		if (parser.match(',') || (inside_pseudo_class ? parser.match(')') : parser.match('{'))) {
			// rewind, so we know whether to continue building the selector list
			parser.index = index;

			relative_selector.end = index;
			children.push(relative_selector);

			return {
				type: 'ComplexSelector',
				start: list_start,
				end: index,
				children,
				metadata: {
					rule: null,
					used: false,
				},
			};
		}

		parser.index = index;
		const combinator = read_combinator(parser);

		if (combinator) {
			if (relative_selector.selectors.length > 0) {
				relative_selector.end = index;
				children.push(relative_selector);
			}

			// ...and start a new one
			relative_selector = create_selector(combinator, combinator.start);

			parser.allow_whitespace();

			if (parser.match(',') || (inside_pseudo_class ? parser.match(')') : parser.match('{'))) {
				e.css_selector_invalid(parser.index);
			}
		}
	}

	throw new Error('Unexpected end of input');
}

/**
 * @param {Parser} parser 
 */
function read_identifier(parser) {
	const start = parser.index;

	let identifier = '';

	if (parser.match_regex(REGEX_LEADING_HYPHEN_OR_DIGIT)) {
		throw new Error('Unexpected CSS identifier');
	}

	let escaped = false;

	while (parser.index < parser.template.length) {
		const char = parser.template[parser.index];
		if (escaped) {
			identifier += '\\' + char;
			escaped = false;
		} else if (char === '\\') {
			escaped = true;
		} else if (
			/** @type {number} */ (char.codePointAt(0)) >= 160 ||
			REGEX_VALID_IDENTIFIER_CHAR.test(char)
		) {
			identifier += char;
		} else {
			break;
		}

		parser.index++;
	}

	if (identifier === '') {
		throw new Error('Expected identifier');
	}

	return identifier;
}
