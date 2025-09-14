import { configDefaults, defineConfig } from 'vitest/config';
import { ripple } from 'vite-plugin-ripple';

export default defineConfig({
	plugins: [ripple()],
	test: {
		include: [
			'packages/ripple/tests/*.test.ts',
			'packages/prettier-plugin-ripple/src/*.test.js',
			'packages/ripple/tests/*.test.ripple',
			'packages/create-ripple/tests/**/*.test.js',
		],
		environment: 'jsdom',
		...configDefaults.test,
	},
});
