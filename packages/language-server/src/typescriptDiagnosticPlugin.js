/**
 @import {
	LanguageServicePlugin,
	LanguageServicePluginInstance,
	LanguageServiceContext,
	Diagnostic,
} from '@volar/language-server';
@import {TextDocument} from 'vscode-languageserver-textdocument';
 */

const { getVirtualCode, createLogging, deobfuscateIdentifiers } = require('./utils.js');

const { log, logError } = createLogging('[Ripple TypeScript Diagnostic Plugin]');

/**
 * @param {Diagnostic} diagnostic
 * @param {Diagnostic[]} items
 */
function process(diagnostic, items) {
	diagnostic.message = deobfuscateIdentifiers(diagnostic.message);
	items.push(diagnostic);
}

/**
 * Filter diagnostics based on suppressed diagnostic codes in mappings.
 * @param {TextDocument} document
 * @param {LanguageServiceContext} context
 * @param {Diagnostic[]} diagnostics
 * @returns {Diagnostic[]}
 */
function processDiagnostics(document, context, diagnostics) {
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
		const mapping = virtualCode.findMappingByGeneratedRange(rangeStart, rangeEnd);

		if (!mapping) {
			process(diagnostic, result);
			continue;
		}

		const suppressedCodes = mapping.data.customData?.suppressedDiagnostics;

		if (!suppressedCodes || suppressedCodes.length === 0) {
			process(diagnostic, result);
			continue;
		}

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

		process(diagnostic, result);
	}

	log(`Filtered from ${diagnostics.length} to ${result.length} diagnostics`);
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
						return processDiagnostics(document, context, diagnostics ?? []);
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
