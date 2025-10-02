import type { Assertion, AsymmetricMatchersContaining } from 'vitest';

declare module 'vitest' {
	interface Assertion<T = any> {
		toBeWithNewline(expected: string): void;
	}

	interface AsymmetricMatchersContaining {
		toBeWithNewline(expected: string): { pass: boolean; message: () => string };
	}
}