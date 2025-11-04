import { defineConfig } from 'tsdown'

export default defineConfig({
	entry: 'src/index.js',
	outputOptions: {
		legalComments: 'inline',
		minify: true,
	},
})
