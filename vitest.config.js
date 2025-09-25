import { configDefaults, defineConfig } from 'vitest/config';
import { ripple } from 'vite-plugin-ripple';

export default defineConfig({
	plugins: [ripple()],
	test: {
		...configDefaults.test,
		projects: [
			{
				name: 'ripple-core',
				test: {
					include: ['packages/ripple/tests/**/*.test.ts', 'packages/ripple/tests/**/*.test.ripple'],
					environment: 'jsdom',
				},
				plugins: [ripple()],
				resolve: process.env.VITEST ? { conditions: ['browser'] } : undefined,
			},
			{
				name: 'prettier-plugin',
				test: {
					include: ['packages/prettier-plugin-ripple/src/*.test.js'],
					environment: 'jsdom',
				},
				plugins: [ripple()],
			},
			{
				name: 'create-ripple',
				test: {
					include: ['packages/create-ripple/tests/**/*.test.js'],
					environment: 'jsdom',
				},
				plugins: [ripple()],
			},
		],
	},
});
