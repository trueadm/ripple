/** @import { TextDocument } from 'vscode-languageserver-textdocument' */
/** @import { LanguageServiceContext } from '@volar/language-server' */
/** @import {RippleVirtualCode} from '@ripple-ts/typescript-plugin/src/language.js' */
// @ts-expect-error: ESM type import is fine
/** @import {is_identifier_obfuscated, deobfuscate_identifier, IDENTIFIER_OBFUSCATION_PREFIX} from 'ripple/compiler/internal/identifier/utils' */

const { URI } = require('vscode-uri');
const { createLogging, DEBUG } = require('@ripple-ts/typescript-plugin/src/utils.js');
// Matches valid JS/CSS identifier characters: word chars, dashes (CSS), $, and # (Ripple shorthands)
const charAllowedWordRegex = /[\w\-$#]/;
const IMPORT_EXPORT_REGEX = {
	import: {
		findBefore: /import\s+(?:\{[^}]*|\*\s+as\s+\w*|\w*)$/s,
		sameLine: /^import\s/,
	},
	export: {
		findBefore: /export\s+(?:\{[^}]*|\*\s+as\s+\w*|\w*)$/s,
		sameLine: /^export\s/,
	},
	from: /from\s*['"][^'"]*['"]\s*;?/,
};

/** @type {is_identifier_obfuscated}  */
let is_identifier_obfuscated;
/** @type {deobfuscate_identifier} */
let deobfuscate_identifier;
/** @type {IDENTIFIER_OBFUSCATION_PREFIX} */
let IDENTIFIER_OBFUSCATION_PREFIX;
/** @type {RegExp} */
let obfuscatedImportRegex;

import('ripple/compiler/internal/identifier/utils').then((imports) => {
	is_identifier_obfuscated = imports.is_identifier_obfuscated;
	deobfuscate_identifier = imports.deobfuscate_identifier;
	IDENTIFIER_OBFUSCATION_PREFIX = imports.IDENTIFIER_OBFUSCATION_PREFIX;
	obfuscatedImportRegex = new RegExp(
		escapeRegExp(IDENTIFIER_OBFUSCATION_PREFIX) + charAllowedWordRegex.source + '+',
		'gm',
	);
});

/**
 * @param {string} source
 * @returns {string}
 */
function escapeRegExp(source) {
	// $& means the whole matched source
	return source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @param {string} text
 * @returns {string}
 */
function deobfuscateImportDefinitions(text) {
	return text.replace(obfuscatedImportRegex, (match) => deobfuscate_identifier(match));
}

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
	while (wordStart > 0 && charAllowedWordRegex.test(text[wordStart - 1])) {
		wordStart--;
	}
	while (wordEnd < text.length && charAllowedWordRegex.test(text[wordEnd])) {
		wordEnd++;
	}

	const word = text.substring(wordStart, wordEnd);

	return {
		word,
		start: wordStart,
		end: wordEnd,
	};
}

/**
 * @param {'import' | 'export'} type
 * @param {string} text
 * @param {number} start
 * @returns {boolean}
 */
function isInsideImportOrExport(type, text, start) {
	const textBeforeCursor = text.slice(0, start);

	// Find the last 'import' keyword before cursor
	const lastImportMatch = textBeforeCursor.match(IMPORT_EXPORT_REGEX[type].findBefore);
	if (!lastImportMatch) {
		// Check if we're on a line that starts with import
		const lineStart = textBeforeCursor.lastIndexOf('\n') + 1;
		const lineBeforeCursor = textBeforeCursor.slice(lineStart);
		return IMPORT_EXPORT_REGEX[type].sameLine.test(lineBeforeCursor.trim());
	}

	// We found an import - check if it's been closed with 'from'
	const importStart = textBeforeCursor.lastIndexOf(type);
	const textFromImport = text.slice(importStart);

	// Find the end of this import statement (semicolon or newline after 'from "..."')
	const fromMatch = textFromImport.match(IMPORT_EXPORT_REGEX.from);
	if (!fromMatch || fromMatch.index === undefined) {
		// No 'from' found yet - we're inside an incomplete import
		return true;
	}

	const importEndOffset = importStart + fromMatch.index + fromMatch[0].length;

	// If cursor is before the import ends, we're inside it
	return start < importEndOffset;
}

/**
 * @param {string} text
 * @param {number} start
 * @returns {boolean}
 */
function isInsideImport(text, start) {
	return isInsideImportOrExport('import', text, start);
}

/**
 * @param {string} text
 * @param {number} start
 * @returns {boolean}
 */
function isInsideExport(text, start) {
	return isInsideImportOrExport('export', text, start);
}

module.exports = {
	getVirtualCode,
	getWordFromPosition,
	isInsideImport,
	isInsideExport,
	createLogging,
	concatMarkdownContents,
	deobfuscateImportDefinitions,
	DEBUG,
};
