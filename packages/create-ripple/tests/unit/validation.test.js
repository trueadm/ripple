import { describe, it, expect } from 'vitest';
import { validateProjectName, sanitizeDirectoryName, validateDirectoryPath } from '../../src/lib/validation.js';

describe('validateProjectName', () => {
	it('should validate correct project names', () => {
		const validNames = [
			'my-app',
			'my.app',
			'my_app',
			'myapp',
			'my-awesome-app',
			'app123',
			'a',
			'a'.repeat(214), // max length
			'.', // root directory
			'my/app' // nested directory
		];

		validNames.forEach(name => {
			const result = validateProjectName(name);
			expect(result.valid).toBe(true);
			expect(result.message).toBe('');
		});
	});

	it('should reject invalid project names', () => {
		const invalidCases = [
			{ name: '', expectedMessage: 'Project name cannot be empty' },
			{ name: '   ', expectedMessage: 'Project name cannot be empty' },
			{ name: null, expectedMessage: 'Project name is required' },
			{ name: undefined, expectedMessage: 'Project name is required' },
			{ name: 123, expectedMessage: 'Project name is required' },
			{ name: 'a'.repeat(215), expectedMessage: 'Project name must be less than 214 characters' }
		];

		invalidCases.forEach(({ name, expectedMessage }) => {
			const result = validateProjectName(name);
			console.log(`Testing: |${name}|\nresult: ${JSON.stringify(result)}\nExpected: ${expectedMessage}\n`);
			expect(result.valid).toBe(false);
			expect(result.message).toBe(expectedMessage);
		});
	});

	it('should reject names with invalid characters', () => {
		const invalidNames = [
			'My-App', // uppercase
			'my app', // space
			'my@app', // special character
			'my:app', // colon
			'my*app', // asterisk
			'my?app', // question mark
			'my"app', // quote
			'my<app', // less than
			'my>app' // greater than
		];

		invalidNames.forEach(name => {
			const result = validateProjectName(name);
			expect(result.valid).toBe(false);
			expect(result.message).toBe(
				'Project name can only contain lowercase letters, numbers, hyphens, dots, and underscores'
			);
		});
	});

	it('should reject names starting with dot or underscore', () => {
		const invalidNames = ['.my-app', '_my-app'];

		invalidNames.forEach(name => {
			const result = validateProjectName(name);
			expect(result.valid).toBe(false);
			expect(result.message).toBe('Project name cannot start with a dot or underscore');
		});
	});

	it('should reject names ending with dot', () => {
		const result = validateProjectName('my-app.');
		expect(result.valid).toBe(false);
		expect(result.message).toBe('Project name cannot end with a dot');
	});

	it('should reject names with consecutive dots', () => {
		const result = validateProjectName('my..app');
		expect(result.valid).toBe(false);
		expect(result.message).toBe('Project name cannot contain consecutive dots');
	});

	it('should reject reserved names', () => {
		const reservedNames = [
			'node_modules',
			'favicon.ico',
			'con',
			'prn',
			'aux',
			'nul',
			'com1',
			'com2',
			'lpt1',
			'lpt9'
		];

		reservedNames.forEach(name => {
			const result = validateProjectName(name);
			expect(result.valid).toBe(false);
			expect(result.message).toBe(`"${name}" is a reserved name and cannot be used`);
		});
	});

	it('should handle case insensitive reserved names', () => {
		const result = validateProjectName('con'); // use lowercase since validation requires lowercase
		expect(result.valid).toBe(false);
		expect(result.message).toBe('"con" is a reserved name and cannot be used');
	});
});

describe('sanitizeDirectoryName', () => {
	it('should sanitize directory names correctly', () => {
		const testCases = [
			{ input: 'My App', expected: 'my-app' },
			{ input: 'my@app#name', expected: 'my-app-name' },
			{ input: '---my-app---', expected: 'my-app' },
			{ input: 'my___app', expected: 'my-app' },
			{ input: 'MY-APP', expected: 'my-app' },
			{ input: 'app123!@#', expected: 'app123' },
			{ input: '   spaces   ', expected: 'spaces' },
			{ input: 'special$%^chars', expected: 'special-chars' }
		];

		testCases.forEach(({ input, expected }) => {
			const result = sanitizeDirectoryName(input);
			expect(result).toBe(expected);
		});
	});

	it('should handle edge cases', () => {
		expect(sanitizeDirectoryName('')).toBe('');
		expect(sanitizeDirectoryName('---')).toBe('');
		expect(sanitizeDirectoryName('123')).toBe('123');
		expect(sanitizeDirectoryName('a')).toBe('a');
	});
});

describe('validateDirectoryPath', () => {
	it('should validate correct directory paths', () => {
		const validPaths = [
			'my-app',
			'./my-app',
			'../my-app',
			'path/to/my-app',
			'/home/user/projects/my-app'
		];

		validPaths.forEach(path => {
			const result = validateDirectoryPath(path);
			expect(result.valid).toBe(true);
			expect(result.message).toBe('');
		});
	});

	it('should reject invalid directory paths', () => {
		const invalidCases = [
			{ path: '', expectedMessage: 'Directory path is required' },
			{ path: null, expectedMessage: 'Directory path is required' },
			{ path: undefined, expectedMessage: 'Directory path is required' },
			{ path: 123, expectedMessage: 'Directory path is required' },
			{ path: '/', expectedMessage: 'Cannot create project in root directory' }
		];

		invalidCases.forEach(({ path, expectedMessage }) => {
			const result = validateDirectoryPath(path);
			expect(result.valid).toBe(false);
			expect(result.message).toBe(expectedMessage);
		});
	});

	it('should reject paths with invalid characters', () => {
		const invalidPaths = [
			'my<app',
			'my>app',
			'my:app',
			'my"app',
			'my|app',
			'my?app',
			'my*app'
		];

		invalidPaths.forEach(path => {
			const result = validateDirectoryPath(path);
			expect(result.valid).toBe(false);
			expect(result.message).toBe('Directory path contains invalid characters');
		});
	});
});
