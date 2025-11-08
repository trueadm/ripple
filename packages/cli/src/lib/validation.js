import { basename, resolve } from 'node:path';

/**
 * Validation utilities for project creation
 */

/**
 * Validates a project name according to npm package naming rules
 * @param {string} inputName - The project name to validate
 * @returns {{valid: boolean, message: string}} - Object with valid boolean and message string
 */
export function validateProjectName(inputName) {
	if (typeof inputName !== 'string' || inputName === null || inputName === undefined) {
		return {
			valid: false,
			message: 'Project name is required',
		};
	}

	if (typeof inputName === 'string' && inputName.trim().length === 0) {
		return {
			valid: false,
			message: 'Project name cannot be empty',
		};
	}

	const name = basename(resolve(process.cwd(), inputName.trim()));

	// Check length (npm package names have a 214 character limit)
	if (name.length > 214) {
		return {
			valid: false,
			message: 'Project name must be less than 214 characters',
		};
	}

	// Check for valid characters (npm allows lowercase letters, numbers, hyphens, and dots)
	if (!/^[a-z0-9._-]+$/.test(name)) {
		return {
			valid: false,
			message:
				'Project name can only contain lowercase letters, numbers, hyphens, dots, and underscores',
		};
	}

	// Cannot start with dot or underscore
	if (name.startsWith('.') || name.startsWith('_')) {
		return {
			valid: false,
			message: 'Project name cannot start with a dot or underscore',
		};
	}

	// Cannot end with dot
	if (name.endsWith('.')) {
		return {
			valid: false,
			message: 'Project name cannot end with a dot',
		};
	}

	// Cannot contain consecutive dots
	if (name.includes('..')) {
		return {
			valid: false,
			message: 'Project name cannot contain consecutive dots',
		};
	}

	// Reserved names
	const reservedNames = [
		'node_modules',
		'favicon.ico',
		'con',
		'prn',
		'aux',
		'nul',
		'com1',
		'com2',
		'com3',
		'com4',
		'com5',
		'com6',
		'com7',
		'com8',
		'com9',
		'lpt1',
		'lpt2',
		'lpt3',
		'lpt4',
		'lpt5',
		'lpt6',
		'lpt7',
		'lpt8',
		'lpt9',
	];

	if (reservedNames.includes(name.toLowerCase())) {
		return {
			valid: false,
			message: `"${name}" is a reserved name and cannot be used`,
		};
	}

	return {
		valid: true,
		message: '',
	};
}

/**
 * Converts a project name to a valid directory name
 * @param {string} name - The project name
 * @returns {string} - A valid directory name
 */
export function sanitizeDirectoryName(name) {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9-]/g, '-')
		.replace(/^-+|-+$/g, '')
		.replace(/-+/g, '-');
}

/**
 * Validates directory path and checks if it's writable
 * @param {string} path - The directory path to validate
 * @returns {object} - Object with valid boolean and message string
 */
export function validateDirectoryPath(path) {
	if (!path || typeof path !== 'string') {
		return {
			valid: false,
			message: 'Directory path is required',
		};
	}

	// Check if path is absolute or relative
	if (path.startsWith('/') && path.length < 2) {
		return {
			valid: false,
			message: 'Cannot create project in root directory',
		};
	}

	// Check for invalid characters in path
	if (/[<>:"|?*]/.test(path)) {
		return {
			valid: false,
			message: 'Directory path contains invalid characters',
		};
	}

	return {
		valid: true,
		message: '',
	};
}
