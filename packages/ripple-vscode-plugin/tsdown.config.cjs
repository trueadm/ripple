const { defineConfig } = require('tsdown');

module.exports = defineConfig({
	entry: ['src/extension.js', 'src/server.js'],
	outputOptions: {
		legalComments: 'inline',
		minify: true,
	},
	platform: 'node',
	target: 'node20',
	external: ['vscode', 'typescript'],
});
