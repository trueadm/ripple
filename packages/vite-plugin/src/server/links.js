/**
 * Anchor extraction for build-time crawling. A small single-pass tokenizer
 * rather than a regex: quoted attribute values may contain `>`, the content of
 * a comment or of a raw-text element is text rather than markup, and the
 * standard escapes in an `href` have to be decoded before the URL is resolved.
 */

// The elements whose content is raw text or RCDATA in HTML: markup inside
// them is text, not elements, so an anchor there is not a link.
const RAW_TEXT_ELEMENTS = new Set([
	'script',
	'style',
	'textarea',
	'title',
	'xmp',
	'iframe',
	'noembed',
	'noframes',
	'noscript',
	'plaintext',
]);

// The five escapes HTML defines for markup characters, in the spellings HTML
// defines them with, alongside the numeric forms; an `href` carries anything
// else percent-encoded.
/** @type {Record<string, string>} */
const NAMED_CHARACTER_REFERENCES = {
	amp: '&',
	AMP: '&',
	lt: '<',
	LT: '<',
	gt: '>',
	GT: '>',
	quot: '"',
	QUOT: '"',
	apos: "'",
};

/**
 * The same-origin pathnames a rendered page links to: the `href` of every
 * anchor element, resolved against the page URL, without query or fragment.
 * Links to other origins and to other schemes such as `mailto:` are left out.
 * @param {string} html
 * @param {URL} page_url
 * @returns {string[]}
 */
export function get_linked_pathnames(html, page_url) {
	const { hrefs, base } = read_document_links(html);
	// A `<base>` element moves the document base URL, and a browser resolves
	// the page's links against it rather than against the page's own URL.
	let base_url = page_url;
	if (base !== undefined) {
		try {
			base_url = new URL(base, page_url);
		} catch {
			base_url = page_url;
		}
	}

	/** @type {string[]} */
	const pathnames = [];
	for (const href of hrefs) {
		let url;
		try {
			url = new URL(href, base_url);
		} catch {
			continue;
		}
		if (url.origin !== page_url.origin) continue;
		pathnames.push(url.pathname);
	}
	return pathnames;
}

/**
 * Walks the markup once and collects the `href` attribute of every `<a>`
 * start tag, plus the document base URL of the first `<base href>`, skipping
 * comments and raw-text elements.
 * @param {string} html
 * @returns {{ hrefs: string[], base: string | undefined }}
 */
function read_document_links(html) {
	/** @type {string[]} */
	const hrefs = [];
	/** @type {string | undefined} */
	let base;
	let i = 0;
	while ((i = html.indexOf('<', i)) !== -1) {
		if (html.startsWith('<!--', i)) {
			const end = html.indexOf('-->', i + 4);
			i = end === -1 ? html.length : end + 3;
			continue;
		}
		const name_match = /^[a-zA-Z][^\s/>]*/.exec(html.slice(i + 1, i + 64));
		if (!name_match) {
			i += 1;
			continue;
		}
		const name = name_match[0].toLowerCase();
		const tag = read_start_tag(html, i + 1 + name.length);
		i = tag.end;
		if (RAW_TEXT_ELEMENTS.has(name)) {
			// `plaintext` has no end tag: the rest of the document is text.
			if (name === 'plaintext') break;
			// An end tag closes it only when the name is followed by a space,
			// a slash or the closing bracket: `</script-x>` is still text.
			const close = new RegExp(`</${name}(?=[\\s/>])`, 'ig');
			close.lastIndex = i;
			const match = close.exec(html);
			i = match ? match.index : html.length;
			continue;
		}
		if (name === 'a') {
			const href = tag.attributes.get('href');
			if (href !== undefined) hrefs.push(href);
		} else if (name === 'base' && base === undefined) {
			base = tag.attributes.get('href');
		}
	}
	return { hrefs, base };
}

/**
 * Reads the attributes of a start tag from `from`, just after the tag name,
 * up to and including its closing `>`, honouring quoted values.
 * @param {string} html
 * @param {number} from
 * @returns {{ attributes: Map<string, string>, end: number }}
 */
function read_start_tag(html, from) {
	/** @type {Map<string, string>} */
	const attributes = new Map();
	let i = from;
	while (i < html.length) {
		const char = html[i];
		if (char === '>') return { attributes, end: i + 1 };
		if (/[\s/]/.test(char)) {
			i += 1;
			continue;
		}
		let name_end = i;
		while (name_end < html.length && !/[\s=>/]/.test(html[name_end])) name_end += 1;
		const name = html.slice(i, name_end).toLowerCase();
		i = name_end;
		while (i < html.length && /\s/.test(html[i])) i += 1;
		let value = '';
		if (html[i] === '=') {
			i += 1;
			while (i < html.length && /\s/.test(html[i])) i += 1;
			const quote = html[i];
			if (quote === '"' || quote === "'") {
				const close = html.indexOf(quote, i + 1);
				value = html.slice(i + 1, close === -1 ? html.length : close);
				i = close === -1 ? html.length : close + 1;
			} else {
				let value_end = i;
				while (value_end < html.length && !/[\s>]/.test(html[value_end])) value_end += 1;
				value = html.slice(i, value_end);
				i = value_end;
			}
		}
		attributes.set(name, decode_character_references(value));
	}
	return { attributes, end: html.length };
}

/**
 * @param {string} value
 * @returns {string}
 */
function decode_character_references(value) {
	return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (reference, body) => {
		if (body[0] === '#') {
			const code =
				body[1] === 'x' || body[1] === 'X'
					? parseInt(body.slice(2), 16)
					: parseInt(body.slice(1), 10);
			if (!Number.isFinite(code)) return reference;
			// Outside the code points, or half of a surrogate pair, it stands
			// for the replacement character.
			if (code === 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return '\uFFFD';
			return String.fromCodePoint(code);
		}
		// Own keys only: a name this table does not define, `constructor`
		// among them, is not a character reference and stays as written.
		return Object.hasOwn(NAMED_CHARACTER_REFERENCES, body)
			? NAMED_CHARACTER_REFERENCES[body]
			: reference;
	});
}
