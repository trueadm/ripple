import { configDefaults, defineConfig } from 'vitest/config';
import { ripple } from '@ripple-ts/vite-plugin';

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
					setupFiles: ['packages/ripple/tests/setup-client.js'],
					globals: true,
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
					include: ['packages/prettier-plugin/src/*.test.js'],
					environment: 'jsdom',
				},
				plugins: [ripple()],
			},
			{
				name: 'eslint-plugin',
				test: {
					include: ['packages/eslint-plugin/tests/**/*.test.ts'],
					environment: 'jsdom',
					globals: true,
				},
				plugins: [ripple()],
			},
			{
				name: 'eslint-parser',
				test: {
					include: ['packages/eslint-parser/tests/**/*.test.ts'],
					environment: 'jsdom',
					globals: true,
				},
				plugins: [ripple()],
			},
			{
				name: 'cli',
				test: {
					include: ['packages/cli/tests/**/*.test.js'],
					environment: 'jsdom',
				},
				plugins: [ripple()],
			},
			{
				name: 'mcp-server',
				test: {
					include: ['packages/mcp-server/tests/**/*.test.ts'],
					environment: 'node',
				},
			},
			{
				name: 'utils',
				test: {
					include: ['packages/ripple/tests/utils/**/*.test.js'],
					environment: 'node',
					globals: true,
				},
			},
			{
				name: 'compat-react',
				test: {
					include: ['packages/compat-react/tests/**/*.test.ripple'],
					environment: 'jsdom',
					setupFiles: ['packages/compat-react/tests/setup.js'],
					globals: true,
				},
				plugins: [ripple()],
				resolve: process.env.VITEST ? { conditions: ['browser'] } : undefined,
			},
		],
	},
});
