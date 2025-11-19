/**
 * @typedef {import('@volar/language-server').LanguageServicePlugin} LanguageServicePlugin
 */

const DEBUG = process.env.RIPPLE_DEBUG === 'true';

/**
 * @param {...unknown} args
 */
function log(...args) {
	if (DEBUG) {
		console.log('[Ripple Auto-Insert]', ...args);
	}
}

/**
 * List of HTML void/self-closing elements that don't need closing tags
 * https://developer.mozilla.org/en-US/docs/Glossary/Void_element
 */
const VOID_ELEMENTS = new Set([
	'area',
	'base',
	'br',
	'col',
	'embed',
	'hr',
	'img',
	'input',
	'link',
	'meta',
	'param',
	'source',
	'track',
	'wbr',
]);

/**
 * Auto-insert plugin for Ripple
 * Handles auto-closing tags when typing '>' after a tag name
 * @returns {LanguageServicePlugin}
 */
function createAutoInsertPlugin() {
	return {
		name: 'ripple-auto-insert',
		capabilities: {
			autoInsertionProvider: {
				triggerCharacters: ['>'],
				// Must match length of triggerCharacters - empty string means no config needed
				configurationSections: [''],
			},
		},
		create(context) {
			return {
				/**
				 * @param {import('vscode-languageserver-textdocument').TextDocument} document
				 * @param {import('@volar/language-server').Position} position
				 * @param {{ rangeOffset: number; rangeLength: number; text: string }} lastChange
				 * @param {import('@volar/language-server').CancellationToken} _token
				 * @returns {Promise<string | null>}
				 */
				async provideAutoInsertSnippet(document, position, lastChange, _token) {
					if (!document.uri.endsWith('.ripple')) {
						return null;
					}

					// Get the line up to the cursor position
					const line = document.getText({
						start: { line: position.line, character: 0 },
						end: position,
					});

					log('Auto-insert triggered at:', {
						position: `${position.line}:${position.character}`,
						line,
						lastChange,
					});

					// Check if we just typed '>' after a tag name
					// Match patterns like: <div> or <Component> but not <div /> or <Component/>
					const tagMatch = line.match(/<([@\w][\w.-]*)>$/);
					if (!tagMatch) {
						log('No tag match found');
						return null;
					}

					const tagName = tagMatch[1];
					log('Tag matched:', tagName);

					// Don't auto-close void elements (self-closing HTML tags)
					if (VOID_ELEMENTS.has(tagName.toLowerCase())) {
						log('Void element, skipping auto-close:', tagName);
						return null;
					}

					// Don't auto-close if it's a dynamic component/element (@Component or @tag)
					// These might be self-closing in some contexts
					if (tagName.startsWith('@')) {
						log('Dynamic component/element, skipping auto-close:', tagName);
						return null;
					}

					// Check if there's already a closing tag ahead
					const restOfLine = document.getText({
						start: position,
						end: { line: position.line, character: position.character + 100 },
					});
					if (restOfLine.startsWith(`</${tagName}>`)) {
						log('Closing tag already exists, skipping');
						return null;
					}

					// Insert the closing tag
					const closingTag = `</${tagName}>`;
					log('Inserting closing tag:', closingTag);

					// Return a snippet with $0 to place cursor between the tags
					return `$0${closingTag}`;
				},
			};
		},
	};
}

module.exports = {
	createAutoInsertPlugin,
};
