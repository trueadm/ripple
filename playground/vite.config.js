import { defineConfig } from 'vite';
import { ripple } from '@ripple-ts/vite-plugin';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	define: {
		'import.meta.env.TEST': process.env.VITEST ? 'true' : 'false',
	},

	build: {
		minify: false,
	},

	plugins: [ripple({ excludeRippleExternalModules: true }), tailwindcss()],

	optimizeDeps: {
		// ripple is a local workspace package, optimizing it would require dev server restarts with --force for every change
		exclude: ['ripple'],
	},

	test: {
		include: ['**/*.ripple'],
	},
});
