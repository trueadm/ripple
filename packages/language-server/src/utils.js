/** @import { TextDocument } from 'vscode-languageserver-textdocument' */
/** @import { LanguageServiceContext } from '@volar/language-server' */
/** @import {RippleVirtualCode} from '@ripple-ts/typescript-plugin/src/language.js' */

const { URI } = require('vscode-uri');

/**
 * Get virtual code from the encoded document URI
 * @param {LanguageServiceContext} context
 * @param {TextDocument} document
 * @returns {RippleVirtualCode}
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

	return virtualCode;
}

module.exports = {
	getVirtualCode,
};
