/**
 * Loader module that initializes the Ripple compiler for the parser
 * This should be imported before using the parser
 */

let rippleCompiler: any = null;

/**
 * Initialize the Ripple compiler
 * This should be called once before parsing any files
 */
export async function initializeParser() {
	if (rippleCompiler) {
		return rippleCompiler;
	}

	try {
		const ripple = await import('ripple/compiler');
		rippleCompiler = ripple;

		// Set it globally so the parser can access it
		(globalThis as any).__RIPPLE_COMPILER__ = ripple;

		return ripple;
	} catch (error: any) {
		throw new Error(
			`Failed to load Ripple compiler: ${error.message}. ` +
				'Make sure the "ripple" package is installed.',
		);
	}
}

/**
 * Get the initialized Ripple compiler
 */
export function getRippleCompiler() {
	if (!rippleCompiler) {
		try {
			const ripple = require('ripple/compiler');
			rippleCompiler = ripple;
			(globalThis as any).__RIPPLE_COMPILER__ = ripple;
			return ripple;
		} catch {
			throw new Error(
				'Ripple compiler not initialized. Call initializeParser() first, ' +
					'or make sure ripple/compiler is available.',
			);
		}
	}
	return rippleCompiler;
}
