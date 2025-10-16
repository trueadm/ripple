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
					name: "ripple-client",
					include: ['packages/ripple/tests/client/**/*.test.ripple'],
					environment: 'jsdom',
					setupFiles: ['packages/ripple/tests/setup-client.js'],
					globals: true,
				},
				plugins: [ripple()],
				resolve: process.env.VITEST ? { conditions: ['browser'] } : undefined,
			},
			{
				name: 'ripple-server',
				test: {
					name: "ripple-server",
					include: ['packages/ripple/tests/server/**/*.test.ripple'],
					environment: 'node',
				},
				plugins: [ripple()],
				resolve: process.env.VITEST ? { conditions: ['default'] } : undefined,
			},
			{
				name: 'prettier-plugin',
				test: {
					name: "prettier-plugin",
					include: ['packages/prettier-plugin-ripple/src/*.test.js'],
					environment: 'jsdom',
				},
				plugins: [ripple()],
			},
			{
				name: 'eslint-plugin',
				test: {
					name: "eslint-plugin",
					include: ['packages/eslint-plugin-ripple/tests/**/*.test.ts'],
					environment: 'jsdom',
					globals: true,
				},
				plugins: [ripple()],
			},
			{
				name: 'eslint-parser',
				test: {
					name: 'eslint-parser',
					include: ['packages/eslint-parser-ripple/tests/**/*.test.ts'],
					environment: 'jsdom',
					globals: true,
				},
				plugins: [ripple()],
			},
			{
				name: 'create-ripple',
				test: {
					name: 'create-ripple',
					include: ['packages/create-ripple/tests/**/*.test.js'],
					environment: 'jsdom',
				},
				plugins: [ripple()],
			},
			{
				name: 'ripple-utils',
				test: {
					name: 'ripple-utils',
					include: ['packages/ripple/tests/utils/**/*.test.js'],
					environment: 'node',
					globals: true,
				},
			},
		],
	},
});
