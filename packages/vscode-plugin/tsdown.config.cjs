const { defineConfig } = require('tsdown');

module.exports = defineConfig({
	entry: ['src/extension.js', 'src/server.js'],
	outDir: 'dist',
	outputOptions: {
		legalComments: 'inline',
		minify: true,
	},
	clean: true,
	format: 'cjs',
	platform: 'node',
	target: 'node20',
	external: ['vscode', 'typescript', '@ripple-ts/ripple', '@ripple-ts/typescript-plugin'],
	noExternal: /.+/,
});
