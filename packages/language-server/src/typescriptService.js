/**
 * @typedef {import('@volar/language-server').LanguageServiceContext} LanguageServiceContext
 * @typedef {import('vscode-languageserver-textdocument').TextDocument} TextDocument
 */

// Monkey-patch getUserPreferences before requiring the main module
const getUserPreferencesModule = require('volar-service-typescript/lib/configs/getUserPreferences');
const originalGetUserPreferences = getUserPreferencesModule.getUserPreferences;

/**
 * Enhanced getUserPreferences to add all ts and ripple preferences
 * Specifically makes preferTypeOnlyAutoImports true if not set
 * @param {LanguageServiceContext} context
 * @param {TextDocument} document
 */
getUserPreferencesModule.getUserPreferences = async function (context, document) {
	const origPreferences = await originalGetUserPreferences.call(this, context, document);

	const [tsConfig, rippleConfig] = await Promise.all([
		context.env.getConfiguration?.('typescript'),
		context.env.getConfiguration?.('ripple'),
	]);

	return {
		preferTypeOnlyAutoImports: true,
		...tsConfig?.preferences,
		...rippleConfig?.preferences,
		...origPreferences,
	};
};

// Now require the main module which will use our patched getUserPreferences
const { create } = require('volar-service-typescript');

/**
 * Create TypeScript services with Ripple-specific enhancements.
 * @param {typeof import('typescript')} ts
 * @returns {ReturnType<typeof create>}
 */
function createTypeScriptServices(ts) {
	return create(ts);
}

module.exports = {
	createTypeScriptServices,
};
