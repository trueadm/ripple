/**
 @import {
 	LanguageServicePlugin,
	LanguageServicePluginInstance,
	MarkupContent,
} from '@volar/language-server'; */

const {
	getVirtualCode,
	createLogging,
	getWordFromPosition,
	concatMarkdownContents,
	deobfuscateImportDefinitions,
} = require('./utils.js');

const { log, logError } = createLogging('[Ripple Hover Plugin]');

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
					// Get TypeScript hover from typescript-semantic service
					let tsHover = null;
					if (originalProvideHover) {
						tsHover = await originalProvideHover.call(originalInstance, document, position, token);
					}

					if (tsHover && tsHover.contents) {
						/** @type {MarkupContent} **/ (tsHover.contents).value = deobfuscateImportDefinitions(
							/** @type {MarkupContent} **/ (tsHover.contents).value,
						);
					}

					const [virtualCode] = getVirtualCode(document, context);

					if (!virtualCode) {
						return tsHover;
					}

					/** @type {number} */
					let starOffset;
					/** @type {number} */
					let endOffset;

					if (tsHover && tsHover.range) {
						starOffset = document.offsetAt(tsHover.range.start);
						endOffset = document.offsetAt(tsHover.range.end);
					} else {
						const offset = document.offsetAt(position);
						const text = document.getText();
						// Find word boundaries
						const { word, start, end } = getWordFromPosition(text, offset);
						starOffset = start;
						endOffset = end;

						log(`Cursor position in generated code for word '${word}':`, position);
						log(`Cursor offset in generated code for word '${word}':`, offset);
					}

					if (virtualCode.languageId !== 'ripple') {
						log(`Skipping hover processing in the '${virtualCode.languageId}' context`);
						return tsHover;
					}

					const mapping = virtualCode.findMappingByGeneratedRange(starOffset, endOffset);

					if (!mapping) {
						return tsHover;
					}

					const customHover = mapping?.data?.customData?.hover;
					if (customHover) {
						const contents = tsHover
							? concatMarkdownContents(
									/** @type {MarkupContent} **/ (tsHover.contents).value,
									customHover.contents,
								)
							: customHover.contents;
						log('Found custom hover data in mapping');
						return {
							contents: {
								kind: 'markdown',
								value: contents,
							},
							range: {
								start: position,
								end: position,
							},
						};
					} else if (customHover === false) {
						log(
							`Hover explicitly suppressed in mapping at range start: ${starOffset}, end: ${endOffset}`,
						);
						return null;
					}

					log('Found mapping for hover at range', 'start: ', starOffset, 'end: ', endOffset);

					if (tsHover && tsHover.range) {
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
							start: tsHover.range.start,
							end: {
								line: tsHover.range.end.line,
								character: tsHover.range.end.character + diffLength,
							},
						};
					}

					return tsHover;
				},
			};
		},
	};
}

module.exports = {
	createHoverPlugin,
};
