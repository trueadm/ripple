import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['tests/**/*.test.js'],
		environment: 'node',
		globals: true,
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			exclude: [
				'node_modules/',
				'tests/',
				'coverage/',
				'**/*.test.js',
				'**/*.config.js'
			]
		},
		testTimeout: 60000, // 60 seconds for integration tests
		hookTimeout: 10000 // 10 seconds for setup/teardown
	}
});
