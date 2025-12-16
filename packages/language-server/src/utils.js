/** @import { TextDocument } from 'vscode-languageserver-textdocument' */
/** @import { LanguageServiceContext } from '@volar/language-server' */
/** @import {RippleVirtualCode} from '@ripple-ts/typescript-plugin/src/language.js' */

const { URI } = require('vscode-uri');
const { createLogging, DEBUG } = require('@ripple-ts/typescript-plugin/src/utils.js');
const wordRegex = /\w/;

/**
 * @param  {...string} contents
 * @returns string
 */
function concatMarkdownContents(...contents) {
	return contents.join('\n\n<br>\n\n---\n\n<br><br>\n\n');
}

/**
 * Get virtual code from the encoded document URI
 * @param {LanguageServiceContext} context
 * @param {TextDocument} document
 * @returns {[RippleVirtualCode, URI]}
 */
function getVirtualCode(document, context) {
	const uri = URI.parse(document.uri);
	const decoded = /** @type {[documentUri: URI, embeddedCodeId: string]} */ (
		context.decodeEmbeddedDocumentUri(uri)
	);
	const [sourceUri, virtualCodeId] = decoded;
	const sourceScript = context.language.scripts.get(sourceUri);
	const virtualCode = /** @type {RippleVirtualCode} */ (
		sourceScript?.generated?.embeddedCodes.get(virtualCodeId)
	);

	return [virtualCode, sourceUri];
}

/**
 * Get the word at a specific position in the text
 * @param {string} text
 * @param {number} start
 * @returns {{word: string, start: number, end: number}}
 */
function getWordFromPosition(text, start) {
	let wordStart = start;
	let wordEnd = start;
	while (wordStart > 0 && wordRegex.test(text[wordStart - 1])) {
		wordStart--;
	}
	while (wordEnd < text.length && wordRegex.test(text[wordEnd])) {
		wordEnd++;
	}

	const word = text.substring(wordStart, wordEnd);

	return {
		word,
		start: wordStart,
		end: wordEnd,
	};
}

module.exports = {
	getVirtualCode,
	getWordFromPosition,
	createLogging,
	concatMarkdownContents,
	DEBUG,
};
