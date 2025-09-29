import { configDefaults, defineConfig } from 'vitest/config';
import { ripple } from 'vite-plugin-ripple';

export default defineConfig({
	plugins: [ripple()],
	test: {
		...configDefaults.test,
		projects: [
			{
				name: 'ripple-client',
				test: {
					include: ['packages/ripple/tests/client/**/*.test.ripple'],
					environment: 'jsdom',
				},
				plugins: [ripple()],
				resolve: process.env.VITEST ? { conditions: ['browser'] } : undefined,
			},
			{
				name: 'ripple-server',
				test: {
					include: ['packages/ripple/tests/server/**/*.test.ripple'],
					environment: 'node',
				},
				plugins: [ripple()],
				resolve: process.env.VITEST ? { conditions: ['default'] } : undefined,
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
