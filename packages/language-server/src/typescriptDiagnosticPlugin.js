/** @import { LanguageServicePlugin } from '@volar/language-server' */
/** @import { LanguageServicePluginInstance } from '@volar/language-server' */

// @ts-expect-error type-only import from ESM module into CJS is fine
/** @import { CodeMapping } from 'ripple/compiler' */

const { getVirtualCode } = require('./utils.js');

const DEBUG = process.env.RIPPLE_DEBUG === 'true';

/**
 * @param {...unknown} args
 */
function log(...args) {
	if (DEBUG) {
		console.log('[Ripple Typescript Diagnostics]', ...args);
	}
}

/**
 * @param {...unknown} args
 */
function logError(...args) {
	console.error('[Ripple Typescript Diagnostics]', ...args);
}

/**
 * Create a plugin to filter TypeScript diagnostics based on customData in mappings
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

			// Disable typescript-semantic's provideHover so it doesn't merge with ours
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

					const virtualCode = getVirtualCode(document, context);

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

/**
 * Get the mapping at a specific position in the document
 * @param {import('@volar/language-server').LanguageServiceContext} context
 * @param {import('vscode-languageserver-textdocument').TextDocument} document
 * @param {import('@volar/language-server').Position} position
 * @returns {CodeMapping | null}
 */
function getMappingAtPosition(context, document, position) {
	try {
		const { URI } = require('vscode-uri');
		const { RippleVirtualCode } = require('@ripple-ts/typescript-plugin/src/language.js');

		const uri = URI.parse(document.uri);
		const decoded = context.decodeEmbeddedDocumentUri(uri);
		if (!decoded) {
			return null;
		}

		const [sourceUri, virtualCodeId] = decoded;
		const sourceScript = context.language.scripts.get(sourceUri);
		const virtualCode = /** @type {RippleVirtualCode} */ (
			sourceScript?.generated?.embeddedCodes.get(virtualCodeId)
		);

		if (!virtualCode?.mappings) {
			return null;
		}

		// Convert position to offset in the virtual document
		const offset = document.offsetAt(position);

		// Find mapping that contains this offset
		for (const mapping of virtualCode.mappings) {
			const genStart = mapping.generatedOffsets[0];
			const genEnd = genStart + mapping.lengths[0];

			if (offset >= genStart && offset < genEnd) {
				return mapping;
			}
		}

		return null;
	} catch (err) {
		log('Error getting mapping at position:', err);
		return null;
	}
}

module.exports = {
	createTypeScriptDiagnosticFilterPlugin,
};
