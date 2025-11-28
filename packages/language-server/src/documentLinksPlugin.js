/** @import { LanguageServicePlugin, DocumentLink } from '@volar/language-server' */
/** @import { RippleVirtualCode } from '@ripple-ts/typescript-plugin/src/language.js') */

const { URI } = require('vscode-uri');

const DEBUG = process.env.RIPPLE_DEBUG === 'true';

/**
 * @param {...unknown} args
 */
function log(...args) {
	if (DEBUG) {
		console.log('[Ripple Document Links]', ...args);
	}
}

/**
 * @returns {LanguageServicePlugin}
 */
function createDocumentLinksPlugin() {
	return {
		name: 'ripple-document-links',
		capabilities: {
			documentLinkProvider: {},
		},
		create(context) {
			return {
				async provideDocumentLinks(document) {
					const uri = URI.parse(document.uri);
					const decoded = context.decodeEmbeddedDocumentUri(uri);
					if (!decoded) {
						return;
					}
					const [sourceUri, virtualCodeId] = decoded;
					if (virtualCodeId !== 'root') {
						return;
					}
					const sourceScript = context.language.scripts.get(sourceUri);
					const virtualCode = /** @type {RippleVirtualCode } */ (
						sourceScript?.generated?.embeddedCodes.get(virtualCodeId)
					);

					/** @type {DocumentLink[]} */
					const documentLinks = [];

					// Add document link for class names
					const scopedClasses = virtualCode.scopedClasses ?? [];
					scopedClasses.forEach((scopedClass, styleIndex) => {
						const styleVirtualCode = virtualCode.embeddedCodes?.find(
							({ id }) => id === 'style_' + styleIndex,
						);
						if (!styleVirtualCode) {
							return;
						}
						const styleDocumentUri = context.encodeEmbeddedDocumentUri(
							sourceUri,
							'style_' + styleIndex,
						);
						const styleDocument = context.documents.get(
							styleDocumentUri,
							styleVirtualCode.languageId,
							styleVirtualCode.snapshot,
						);
						const cssClasses = virtualCode.cssClasses[styleIndex];
						/** @type {Map<string, string[]>} */
						const cssClassesMap = new Map();
						for (const { text, offset } of cssClasses) {
							const start = styleDocument.positionAt(offset);
							const end = styleDocument.positionAt(offset + text.length);
							const target =
								styleDocumentUri +
								`#L${start.line + 1},${start.character + 1}-L${end.line + 1},${end.character + 1}`;
							if (!cssClassesMap.has(text)) {
								cssClassesMap.set(text, []);
							}
							// @ts-ignore
							// CSS might have class names with the same name.
							cssClassesMap.get(text).push(target);
						}

						for (const { className, offset } of scopedClass) {
							const rangeStart = document.positionAt(offset);
							const rangeEnd = document.positionAt(offset + className.length);

							log('Found mapping for document link at generated offset:', offset);

							const cssClassTargets = cssClassesMap.get('.' + className) ?? [];
							cssClassTargets.forEach((styleTarget) => {
								documentLinks.push({
									range: {
										start: rangeStart,
										end: rangeEnd,
									},
									target: styleTarget,
								});
							});
						}
					});

					return documentLinks;
				},
			};
		},
	};
}

module.exports = {
	createDocumentLinksPlugin,
};
