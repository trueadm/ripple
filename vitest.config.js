import { configDefaults, defineConfig } from 'vitest/config';
import { ripple } from '@ripple-ts/vite-plugin';

export default defineConfig({
	plugins: [ripple({ excludeRippleExternalModules: true })],
	test: {
		...configDefaults,
		projects: [
			{
				test: {
					name: 'ripple-client',
					include: ['packages/ripple/tests/client/**/*.test.ripple'],
					environment: 'jsdom',
					setupFiles: ['packages/ripple/tests/setup-client.js'],
					globals: true,
				},
				plugins: [ripple({ excludeRippleExternalModules: true })],
				resolve: process.env.VITEST ? { conditions: ['browser'] } : undefined,
			},
			{
				test: {
					name: 'ripple-server',
					include: ['packages/ripple/tests/server/**/*.test.ripple'],
					environment: 'node',
				},
				plugins: [ripple({ excludeRippleExternalModules: true })],
				resolve: process.env.VITEST ? { conditions: ['default'] } : undefined,
			},
			{
				test: {
					name: 'prettier-plugin',
					include: ['packages/prettier-plugin/src/*.test.js'],
					environment: 'jsdom',
				},
				plugins: [ripple({ excludeRippleExternalModules: true })],
			},
			{
				test: {
					name: 'eslint-plugin',
					include: ['packages/eslint-plugin/tests/**/*.test.ts'],
					environment: 'jsdom',
					globals: true,
				},
				plugins: [ripple({ excludeRippleExternalModules: true })],
			},
			{
				test: {
					name: 'eslint-parser',
					include: ['packages/eslint-parser/tests/**/*.test.ts'],
					environment: 'jsdom',
					globals: true,
				},
				plugins: [ripple({ excludeRippleExternalModules: true })],
			},
			{
				test: {
					name: 'cli',
					include: ['packages/cli/tests/**/*.test.js'],
					environment: 'jsdom',
				},
				plugins: [ripple({ excludeRippleExternalModules: true })],
			},
			{
				test: {
          name: 'mcp-server',
					include: ['packages/mcp-server/tests/**/*.test.ts'],
					environment: 'node',
          globals: true,
				},
        plugins: [],
			},
			{
				test: {
					name: 'utils',
					include: ['packages/ripple/tests/utils/**/*.test.js'],
					environment: 'node',
					globals: true,
				},
				plugins: [],
			},
			{
				test: {
					name: 'compat-react',
					include: ['packages/compat-react/tests/**/*.test.ripple'],
					environment: 'jsdom',
					setupFiles: ['packages/compat-react/tests/setup.js'],
					globals: true,
				},
				plugins: [ripple({ excludeRippleExternalModules: true })],
				resolve: process.env.VITEST ? { conditions: ['browser'] } : undefined,
			},
		],
	},
});
