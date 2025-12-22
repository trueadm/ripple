/** @import { LanguageServicePlugin } from '@volar/language-server' */

const { getVirtualCode, createLogging } = require('./utils.js');

const { log } = createLogging('[Ripple Auto-Insert Plugin]');

/**
 * List of HTML void/self-closing elements that don't need closing tags
 * https://developer.mozilla.org/en-US/docs/Glossary/Void_element
 */
const VOID_ELEMENTS = new Set([
	'area',
	'base',
	'br',
	'col',
	'command',
	'embed',
	'hr',
	'img',
	'input',
	'keygen',
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
				configurationSections: ['ripple.autoClosingTags'],
			},
			documentOnTypeFormattingProvider: {
				triggerCharacters: ['>'],
			},
		},
		// leaving context for future use
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

					// Only checking for '>' insertions
					if (!lastChange.text.endsWith('>')) {
						return null;
					}

					const [virtualCode] = getVirtualCode(document, context);

					if (virtualCode.languageId !== 'ripple') {
						log(`Skipping auto-insert processing in the '${virtualCode.languageId}' context`);
						return null;
					}

					// Map position back to source
					const offset = document.offsetAt(position);
					const mapping = virtualCode.findMappingByGeneratedRange(lastChange.rangeOffset, offset);

					if (!mapping) {
						return null;
					}

					const sourceOffset = mapping.sourceOffsets[0];

					// search backwards from sourceOffset to find the line tag
					const sourceCode = virtualCode.originalCode;
					if (sourceCode[sourceOffset - 1] === '/') {
						// self-closing tag '/>'
						return null;
					}

					let attempts = 0;
					let found = false;
					let i = sourceOffset - 1;
					for (; i >= 0; i--) {
						const char = sourceCode[i];
						if (char === '<') {
							attempts++;
							// Confirm that it's definitely the start of the tag
							// We have `<` and `>` in source maps
							if (virtualCode.findMappingBySourceRange(i, i + 1)) {
								found = true;
								break;
							}
						}

						if (attempts === 3) {
							break;
						}
					}

					if (!found) {
						// This shouldn't happen in reality
						log(`No opening tag position found from source position ${sourceOffset}`);
						return null;
					}

					const line = sourceCode.slice(i, sourceOffset + 1);

					log('Auto-insert triggered at:', {
						selection: `${position.line}:${position.character}`,
						line,
						change: lastChange,
						sourceOffset,
					});

					// Check if we just typed '>' after a tag name
					// Match patterns like: <div> or <Component> but not <div /> or <Component/>
					const tagMatch = line.match(/<([@$\w][\w.-]*)[^>]*?(?<!\/)>$/);
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
