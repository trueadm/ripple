import { configDefaults, defineConfig } from 'vitest/config';
import { ripple } from 'vite-plugin-ripple';

export default defineConfig({
	plugins: [ripple()],
	test: {
		...configDefaults.test,
		projects: [
			{
				include: ['packages/ripple/tests/**/*.test.ts', 'packages/ripple/tests/**/*.test.ripple'],
				environment: 'jsdom',
				resolve: process.env.VITEST ? { conditions: ['browser'] } : undefined,
			},
			{
				include: [
					'packages/prettier-plugin-ripple/src/*.test.js',
					'packages/create-ripple/tests/**/*.test.js',
				],
			},
		],
	},
});
