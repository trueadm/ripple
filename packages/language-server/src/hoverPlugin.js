/** @import { LanguageServicePlugin } from '@volar/language-server' */
/** @import { LanguageServicePluginInstance } from '@volar/language-server' */

const { getVirtualCode, createLogging } = require('./utils.js');

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

					// If no TypeScript hover, nothing to modify
					if (!tsHover || !tsHover.range) {
						return;
					}

					const virtualCode = getVirtualCode(document, context);

					if (!virtualCode) {
						return tsHover;
					}

					const range = tsHover.range;
					const rangeStart = document.offsetAt(range.start);
					const rangeEnd = document.offsetAt(range.end);

					const mapping = virtualCode.findMappingByGeneratedRange(rangeStart, rangeEnd);

					if (!mapping) {
						return tsHover;
					}

					const customHover = mapping?.data?.customData?.hover;
					if (customHover) {
						log('Found custom hover data in mapping');
						return {
							contents: {
								kind: 'markdown',
								value: customHover.contents,
							},
							range: {
								start: position,
								end: position,
							},
						};
					} else if (customHover === false) {
						log(
							`Hover explicitly suppressed in mapping at range start: ${rangeStart}, end: ${rangeEnd}`,
						);
						return null;
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
