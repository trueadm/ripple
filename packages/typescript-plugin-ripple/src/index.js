const { createLanguageServicePlugin } = require('@volar/typescript/lib/quickstart/createLanguageServicePlugin.js')
const { getRippleLanguagePlugin } = require('./language.js')

// This TypeScript plugin is loaded by TypeScript's tsserver when configured in tsconfig.json.
// Note: When using the Ripple VS Code extension, the language server handles everything,
// so this plugin is redundant but harmless (both instances work independently).
// This plugin is useful for non-VS Code editors or when not using the language server.
module.exports = createLanguageServicePlugin(() => ({
	languagePlugins: [getRippleLanguagePlugin()],
}));
