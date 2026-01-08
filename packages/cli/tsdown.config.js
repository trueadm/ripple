import { defineConfig } from 'tsdown';

export default defineConfig({
	entry: 'src/index.js',
	outputOptions: {
		legalComments: 'inline',
		minify: true,
	},
	clean: true,
	format: ['esm'],
	platform: 'node',
	target: 'node20',
	outDir: 'dist',
	noExternal: /.+/,
	external: ['vite', 'polka'],
});
