import { ripple } from '@ripple-ts/vite-plugin';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [ripple()],
	resolve: {
		conditions: ['browser', 'module', 'import', 'default'],
	},
	server: {
		port: 3000,
	},
	build: {
		target: 'esnext',
	},
});
