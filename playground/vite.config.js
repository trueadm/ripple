import { defineConfig } from 'vite';
import { ripple } from 'vite-plugin-ripple';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	build: {
		minify: false,
	},

	plugins: [ripple(), tailwindcss()],

	optimizeDeps: {
		// ripple is a local workspace package, optimizing it would require dev server restarts with --force for every change
		exclude: ['ripple'],
	},

	test: {
		include: ['**/*.ripple'],
	},
});
