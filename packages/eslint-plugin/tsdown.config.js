import { defineConfig } from 'tsdown';

export default defineConfig({
	entry: 'src/index.ts',
	format: ['esm'],
	dts: true,
	// Mark peer dependencies as external so they're not bundled
	external: [
		'eslint',
		'@typescript-eslint/parser',
		'@ripple-ts/eslint-parser',
	],
	outputOptions: {
		legalComments: 'inline',
	},
});
