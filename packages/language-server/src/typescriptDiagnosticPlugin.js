/** @import { LanguageServicePlugin } from '@volar/language-server' */
/** @import { LanguageServicePluginInstance } from '@volar/language-server' */

const { getVirtualCode, createLogging } = require('./utils.js');

const { log, logError } = createLogging('[Ripple TypeScript Diagnostic Plugin]');

/**
 * @returns {LanguageServicePlugin}
 */
function createTypeScriptDiagnosticFilterPlugin() {
	log('Creating TypeScript diagnostic filter plugin...');

	return {
		name: 'ripple-typescript-diagnostic-filter',
		capabilities: {
			diagnosticProvider: {
				interFileDependencies: false,
				workspaceDiagnostics: false,
			},
		},
		create(context) {
			/** @type {LanguageServicePluginInstance['provideDiagnostics']} */
			let originalProvideDiagnostics;
			/** @type {LanguageServicePluginInstance} */
			let originalInstance;

			// Disable typescript-semantic's provideDiagnostics so it doesn't merge with ours
			for (const [plugin, instance] of context.plugins) {
				if (plugin.name === 'typescript-semantic') {
					originalInstance = instance;
					originalProvideDiagnostics = instance.provideDiagnostics;
					instance.provideDiagnostics = undefined;
					break;
				}
			}

			if (!originalProvideDiagnostics) {
				logError(
					"'typescript-semantic plugin' was not found or has no 'provideDiagnostics'. \
					This plugin must be loaded after Volar's typescript-semantic plugin.",
				);
			}

			return {
				async provideDiagnostics(document, token) {
					let diagnostics;

					if (originalProvideDiagnostics) {
						diagnostics = await originalProvideDiagnostics.call(originalInstance, document, token);
					}

					if (!diagnostics || diagnostics.length === 0) {
						return diagnostics;
					}

					log(`Filtering ${diagnostics.length} TypeScript diagnostics for ${document.uri}`);

					const [virtualCode] = getVirtualCode(document, context);

					const filtered = diagnostics.filter((diagnostic) => {
						const range = diagnostic.range;
						const rangeStart = document.offsetAt(range.start);
						const rangeEnd = document.offsetAt(range.end);
						// Get the mapping at this diagnostic position
						const mapping = virtualCode.findMappingByGeneratedRange(rangeStart, rangeEnd);

						if (!mapping) {
							return true;
						}

						const suppressedCodes = mapping.data.customData?.suppressedDiagnostics;

						if (!suppressedCodes || suppressedCodes.length === 0) {
							return true;
						}

						const diagnosticCode =
							typeof diagnostic.code === 'number'
								? diagnostic.code
								: typeof diagnostic.code === 'string'
									? parseInt(diagnostic.code)
									: null;

						if (diagnosticCode && suppressedCodes.includes(diagnosticCode)) {
							log(`Suppressing diagnostic ${diagnosticCode}: ${diagnostic.message}`);
							return false; // Filter out this diagnostic
						}

						return true; // Keep this diagnostic
					});

					log(`Filtered from ${diagnostics.length} to ${filtered.length} diagnostics`);
					return filtered;
				},
			};
		},
	};
}

module.exports = {
	createTypeScriptDiagnosticFilterPlugin,
};
