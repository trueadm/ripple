/**
 * @typedef {import('@volar/language-server').LanguageServicePlugin} LanguageServicePlugin
 * @typedef {import('@volar/language-server').LanguageServicePluginInstance} LanguageServicePluginInstance
 */

const { RippleVirtualCode } = require('@ripple-ts/typescript-plugin/src/language.js');
const { URI } = require('vscode-uri');

const DEBUG = process.env.RIPPLE_DEBUG === 'true';

/**
 * @param {...unknown} args
 */
function log(...args) {
	if (DEBUG) {
		console.log('[Ripple Hover]', ...args);
	}
}

/**
 * @param {...unknown} args
 */
function logError(...args) {
	console.error('[Ripple Hover]', ...args);
}

/**
 * @returns {LanguageServicePlugin}
 */
function createHoverPlugin() {
	return {
		name: 'ripple-hover',
		capabilities: {
			hoverProvider: true,
		},
		create(context) {
			/** @type {LanguageServicePluginInstance['provideHover']} */
			let originalProvideHover;
			/** @type {LanguageServicePluginInstance} */
			let originalInstance;

			// Disable typescript-semantic's provideHover so it doesn't merge with ours
			for (const [plugin, instance] of context.plugins) {
				if (plugin.name === 'typescript-semantic') {
					originalInstance = instance;
					originalProvideHover = instance.provideHover;
					instance.provideHover = undefined;
					break;
				}
			}

			if (!originalProvideHover) {
				logError(
					"'typescript-semantic plugin' was not found or has no 'provideHover'. \
					This plugin must be loaded after Volar's typescript-semantic plugin.",
				);
			}
			return {
				async provideHover(document, position, token) {
					const uri = URI.parse(document.uri);
					const decoded = context.decodeEmbeddedDocumentUri(uri);

					// Get TypeScript hover from typescript-semantic service
					let tsHover = null;
					if (originalProvideHover) {
						tsHover = await originalProvideHover.call(originalInstance, document, position, token);
					}

					// If no TypeScript hover, nothing to modify
					if (!tsHover) {
						return;
					}

					// If not in a Ripple embedded context, just return TypeScript results
					if (!decoded) {
						return tsHover;
					}

					const [sourceUri, virtualCodeId] = decoded;
					const sourceScript = context.language.scripts.get(sourceUri);
					const virtualCode = sourceScript?.generated?.embeddedCodes.get(virtualCodeId);

					if (!(virtualCode instanceof RippleVirtualCode) || !virtualCode.mappings) {
						return tsHover;
					}

					// If there's no range to adjust, return as-is
					if (!tsHover.range) {
						return tsHover;
					}

					const range = tsHover.range;
					const rangeStart = document.offsetAt(range.start);
					const rangeEnd = document.offsetAt(range.end);

					// Find the mapping using the exact token range for O(1) lookup
					const mapping = virtualCode.findMappingByGeneratedRange(rangeStart, rangeEnd);

					if (!mapping) {
						return tsHover;
					}

					log('Found mapping for hover at range', 'start: ', rangeStart, 'end: ', rangeEnd);

					// Check if source length is greater than generated length (component -> function)
					const customData = mapping.data.customData;
					const sourceLength = mapping.lengths[0];
					const generatedLength = customData.generatedLengths[0];

					// If no generatedLengths, or source and generated are same length, no transformation
					if (sourceLength <= generatedLength) {
						return tsHover;
					}

					const diffLength = sourceLength - generatedLength;

					// Adjust the hover range to highlight the full "component" keyword
					tsHover.range = {
						start: range.start,
						end: {
							line: range.end.line,
							character: range.end.character + diffLength,
						},
					};

					return tsHover;
				},
			};
		},
	};
}

module.exports = {
	createHoverPlugin,
};
