/** @import {PackageManager} from '../lib/project-creator.js' */

/**
 * Detect the package manager used to run the current process
 * @returns {PackageManager}
 */
export function getCurrentPackageManager() {
	// Check npm_config_user_agent first (most reliable for all package managers)
	const userAgent = process.env.npm_config_user_agent;
	if (userAgent) {
		if (userAgent.startsWith('pnpm/')) {
			return 'pnpm';
		}
		if (userAgent.startsWith('yarn/')) {
			return 'yarn';
		}
		if(userAgent.startsWith('bun/')){
			return 'bun';
		}
		if (userAgent.startsWith('npm/')) {
			return 'npm';
		}
	}

	// Fallback to npm_execpath analysis
	const execPath = process.env.npm_execpath;
	if (execPath) {
		// Normalize path separators for cross-platform compatibility
		const normalizedPath = execPath.toLowerCase().replace(/\\/g, '/');

		if (normalizedPath.includes('pnpm')) {
			return 'pnpm';
		}
		if (normalizedPath.includes('yarn')) {
			return 'yarn';
		}
		if(normalizedPath.includes('bun')){
			return 'bun';
		}
	}

	// Additional fallback: check for pnpm-specific environment variables
	if (process.env.PNPM_HOME || process.env.PNPM_SCRIPT_SRC_DIR) {
		return 'pnpm';
	}

	// Additional fallback: check for yarn-specific environment variables
	if (process.env.YARN_WRAP_OUTPUT || process.env.npm_config_yarn) {
		return 'yarn';
	}

	// Default to npm if detection fails
	return 'npm';
}
