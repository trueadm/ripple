const { RippleVirtualCode } = require('@ripple-ts/typescript-plugin/src/language.js');
const { URI } = require('vscode-uri');

/**
 * @typedef {import('@volar/language-server').LanguageServicePlugin} LanguageServicePlugin
 * @typedef {import('@volar/language-server').LanguageServiceContext} LanguageServiceContext
 */

const DEBUG = process.env.RIPPLE_DEBUG === 'true';

/**
 * @param {...unknown} args
 */
function log(...args) {
	if (DEBUG) {
		console.log('[Ripple Definition]', ...args);
	}
}

/**
 * @returns {LanguageServicePlugin}
 */
function createDefinitionPlugin() {
	return {
		name: 'ripple-definition',
		capabilities: {
			definitionProvider: true,
		},
		create(context) {
			return {
				async provideDefinition(document, position, token) {
					const uri = URI.parse(document.uri);
					const decoded = context.decodeEmbeddedDocumentUri(uri);

					// Get TypeScript definition from typescript-semantic service
					let tsDefinitions = [];
					for (const [plugin, instance] of context.plugins) {
						if (plugin.name === 'typescript-semantic' && instance.provideDefinition) {
							const result = await instance.provideDefinition(document, position, token);
							if (result) {
								tsDefinitions.push(...(Array.isArray(result) ? result : [result]));
							}
							break;
						}
					}

					// If no TypeScript definitions, nothing to modify
					// Volar will let the next ts plugin handle it
					if (tsDefinitions.length === 0) {
						return;
					}

					// If not in a Ripple embedded context, just return TypeScript results
					if (!decoded) {
						return tsDefinitions;
					}

					const [sourceUri, virtualCodeId] = decoded;
					const sourceScript = context.language.scripts.get(sourceUri);
					const virtualCode = sourceScript?.generated?.embeddedCodes.get(virtualCodeId);

					if (!(virtualCode instanceof RippleVirtualCode) || !virtualCode.mappings) {
						return tsDefinitions;
					}

					// Get the range from TypeScript's definition to find the exact token
					// This gives us the precise start and end of the token (e.g., "function")
					const firstDefinition = tsDefinitions[0];
					if (!firstDefinition?.originSelectionRange) {
						return tsDefinitions;
					}

					const range = firstDefinition.originSelectionRange;
					const rangeStart = document.offsetAt(range.start);
					const rangeEnd = document.offsetAt(range.end);

					// Find the mapping using the exact token range for O(1) lookup
					const mapping = virtualCode.findMappingByGeneratedRange(rangeStart, rangeEnd);

					if (!mapping) {
						return tsDefinitions;
					}

					log('Found mapping for definition at range', 'start: ', rangeStart, 'end: ', rangeEnd);

					// Check if source length is greater than generated length (component -> function)
					const customData = mapping.data.customData;
					const sourceLength = mapping.lengths[0];
					const generatedLength = customData.generatedLengths[0];

					// If no generatedLengths, or source and generated are same length, no transformation
					if (sourceLength <= generatedLength) {
						return tsDefinitions;
					}

					const diffLength = sourceLength - generatedLength;

					for (const definition of tsDefinitions) {
						const tsRange = definition.originSelectionRange;
						if (!tsRange) {
							continue;
						}

						definition.originSelectionRange = {
							start: tsRange.start,
							end: {
								line: tsRange.end.line,
								character: tsRange.end.character + diffLength,
							},
						};
					}
					return tsDefinitions;
				},
			};
		},
	};
}

module.exports = {
	createDefinitionPlugin,
};
