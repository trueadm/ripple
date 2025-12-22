/**
 @import {
	LanguageServicePlugin,
	LanguageServicePluginInstance,
	LanguageServiceContext,
	Diagnostic,
} from '@volar/language-server';
@import {TextDocument} from 'vscode-languageserver-textdocument';
 */

const { getVirtualCode, createLogging } = require('./utils.js');

const { log, logError } = createLogging('[Ripple TypeScript Diagnostic Plugin]');

/**
 * Filter and adjust diagnostics based on mappings.
 * - Filters out diagnostics with suppressed codes
 * - Adjusts diagnostic ranges when source length differs from generated length
 *   (e.g., multiline imports in source become single-line in generated)
 * @param {TextDocument} document
 * @param {LanguageServiceContext} context
 * @param {Diagnostic[]} diagnostics
 * @returns {Diagnostic[]}
 */
function filterDiagnostics(document, context, diagnostics) {
	if (!diagnostics || diagnostics.length === 0) {
		return diagnostics;
	}

	log(`Filtering ${diagnostics.length} TypeScript diagnostics for ${document.uri}`);

	const [virtualCode] = getVirtualCode(document, context);

	if (!virtualCode) {
		return diagnostics;
	}

	/** @type {Diagnostic[]} */
	const result = [];

	for (const diagnostic of diagnostics) {
		const range = diagnostic.range;
		const rangeStart = document.offsetAt(range.start);
		const rangeEnd = document.offsetAt(range.end);

		log(
			`Diagnostic: code=${diagnostic.code}, range=[${range.start.line}:${range.start.character}-${range.end.line}:${range.end.character}], offsets=[${rangeStart}-${rangeEnd}]`,
		);

		const mapping = virtualCode.findMappingByGeneratedRange(rangeStart, rangeEnd);

		if (!mapping) {
			log(`No mapping found for range, passing through`);
			result.push(diagnostic);
			continue;
		}

		log(
			`Found mapping: sourceOffsets=${mapping.sourceOffsets}, lengths=${mapping.lengths}, genOffsets=${mapping.generatedOffsets}, genLengths=${mapping.data.customData?.generatedLengths}`,
		);

		if (!mapping) {
			result.push(diagnostic);
			continue;
		}

		// Check if this diagnostic should be suppressed
		const suppressedCodes = mapping.data.customData?.suppressedDiagnostics;
		if (suppressedCodes && suppressedCodes.length > 0) {
			const diagnosticCode =
				typeof diagnostic.code === 'number'
					? diagnostic.code
					: typeof diagnostic.code === 'string'
						? parseInt(diagnostic.code)
						: null;

			if (diagnosticCode && suppressedCodes.includes(diagnosticCode)) {
				log(`Suppressing diagnostic ${diagnosticCode}: ${diagnostic.message}`);
				continue;
			}
		}

		// Check if we need to adjust the range due to length mismatch
		// This happens with multiline imports: source has newlines/tabs, generated is single-line
		const sourceLength = mapping.lengths[0];
		const generatedLength = mapping.data.customData?.generatedLengths?.[0];

		if (generatedLength !== undefined && sourceLength !== generatedLength) {
			const diffLength = sourceLength - generatedLength;
			log(
				`Adjusting diagnostic range: source=${sourceLength}, generated=${generatedLength}, diff=${diffLength}`,
			);


			// diagnostic.range.end.character = diagnostic.range.end.character + diffLength;
			result.push(diagnostic);
			// Create adjusted diagnostic with corrected end position
			// result.push({
			// 	...diagnostic,
			// 	range: {
			// 		start: range.start,
			// 		end: {
			// 			line: range.end.line,
			// 			character: range.end.character + diffLength,
			// 		},
			// 	},
			// });
		} else {
			result.push(diagnostic);
		}
	}

	log(`Processed ${diagnostics.length} diagnostics, returning ${result.length}`);
	return result;
}

/**
 * Creates a plugin that wraps typescript-semantic's provideDiagnostics
 * to filter out suppressed diagnostics while maintaining the original
 * plugin association. This is crucial for code actions (like "Add import")
 * to work correctly, as volar matches diagnostics by pluginIndex.
 * @returns {LanguageServicePlugin}
 */
function createTypeScriptDiagnosticFilterPlugin() {
	log('Creating TypeScript diagnostic filter plugin...');

	return {
		name: 'ripple-typescript-diagnostic-filter',
		// No capabilities - this plugin only wraps typescript-semantic
		capabilities: {},
		create(context) {
			/** @type {LanguageServicePluginInstance['provideDiagnostics'] | undefined} */
			let originalProvider;
			/** @type {LanguageServicePluginInstance | undefined} */
			let originalInstance;

			for (const [plugin, instance] of context.plugins) {
				if (plugin.name === 'typescript-semantic') {
					originalInstance = instance;
					originalProvider = instance.provideDiagnostics;

					// Wrap the original function to filter diagnostics
					// This maintains the plugin association for code actions
					instance.provideDiagnostics = async function (document, token) {
						const diagnostics = await originalProvider?.call(originalInstance, document, token);
						return filterDiagnostics(document, context, diagnostics ?? []);
					};

					log('Successfully wrapped typescript-semantic provideDiagnostics');

					break;
				}
			}

			if (!originalProvider) {
				logError(
					"'typescript-semantic plugin' was not found or has no 'provideDiagnostics'. \
					This plugin must be loaded after Volar's typescript-semantic plugin.",
				);
			}

			// This plugin doesn't provide any functionality itself,
			// it only wraps typescript-semantic
			return {};
		},
	};
}

module.exports = {
	createTypeScriptDiagnosticFilterPlugin,
};
