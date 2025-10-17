const { defineConfig } = require('tsdown');

module.exports = defineConfig({
	entry: ['src/extension.js', 'src/server.js'],
	outputOptions: {
		legalComments: 'inline',
		minify: true,
	},
	format: 'cjs',
	platform: 'node',
	target: 'node20',
	external: ['vscode', 'typescript', 'ripple'],
	noExternal: /.+/,
});
