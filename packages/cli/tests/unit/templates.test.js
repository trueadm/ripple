import { describe, it, expect, beforeEach, vi } from 'vitest';
import { existsSync } from 'node:fs';
import {
	getTemplate,
	getTemplateNames,
	getTemplateChoices,
	validateTemplate,
	getLocalTemplatePath,
	isLocalDevelopment,
	downloadTemplate,
} from '../../src/lib/templates.js';

// Mock the constants
vi.mock('../../src/constants.js', () => ({
	TEMPLATES: [
		{
			name: 'basic',
			display: 'Basic Ripple App',
			description: 'A minimal Ripple application with Vite and TypeScript',
		},
		{
			name: 'advanced',
			display: 'Advanced Ripple App',
			description: 'A full-featured Ripple application',
		},
	],
	TEMPLATES_DIR: '/mock/templates',
}));

// Mock fs.existsSync - ensure consistent behavior across environments
vi.mock('node:fs', () => {
	const mockFn = vi.fn();
	return {
		default: {
			existsSync: mockFn,
		},
		existsSync: mockFn,
	};
});

describe('getTemplate', () => {
	it('should return template by name', () => {
		const template = getTemplate('basic');
		expect(template).toEqual({
			name: 'basic',
			display: 'Basic Ripple App',
			description: 'A minimal Ripple application with Vite and TypeScript',
		});
	});

	it('should return null for non-existent template', () => {
		const template = getTemplate('non-existent');
		expect(template).toBeNull();
	});

	it('should return null for undefined template name', () => {
		const template = getTemplate(undefined);
		expect(template).toBeNull();
	});
});

describe('getTemplateNames', () => {
	it('should return array of template names', () => {
		const names = getTemplateNames();
		expect(names).toEqual(['basic', 'advanced']);
	});

	it('should return array even if no templates exist', () => {
		const names = getTemplateNames();
		expect(Array.isArray(names)).toBe(true);
	});
});

describe('getTemplateChoices', () => {
	it('should return formatted choices for prompts', () => {
		const choices = getTemplateChoices();
		expect(choices).toEqual([
			{
				title: 'Basic Ripple App',
				description: 'A minimal Ripple application with Vite and TypeScript',
				value: 'basic',
			},
			{
				title: 'Advanced Ripple App',
				description: 'A full-featured Ripple application',
				value: 'advanced',
			},
		]);
	});

	it('should return array even if templates are defined', () => {
		const choices = getTemplateChoices();
		expect(Array.isArray(choices)).toBe(true);
		expect(choices.length).toBeGreaterThan(0);
	});
});

describe('validateTemplate', () => {
	it('should return true for valid template', () => {
		const isValid = validateTemplate('basic');
		expect(isValid).toBe(true);
	});

	it('should return false for invalid template name', () => {
		const isValid = validateTemplate('non-existent');
		expect(isValid).toBe(false);
	});

	it('should return false for undefined template name', () => {
		const isValid = validateTemplate(undefined);
		expect(isValid).toBe(false);
	});

	it('should return false for null template name', () => {
		const isValid = validateTemplate(null);
		expect(isValid).toBe(false);
	});

	it('should return false for empty string template name', () => {
		const isValid = validateTemplate('');
		expect(isValid).toBe(false);
	});
});

describe('getLocalTemplatePath', () => {
	// Windows uses backslashes in paths
	/** @param {string} path */
	function normalizePath(path) {
		return path.replaceAll('\\', '/');
	}

	it('should return correct local template path', () => {
		const path = getLocalTemplatePath('basic');
		expect(normalizePath(path)).toContain('templates/basic');
	});

	it('should return path even for non-existent template', () => {
		const path = getLocalTemplatePath('non-existent');
		expect(normalizePath(path)).toContain('templates/non-existent');
	});

	it('should handle special characters in template name', () => {
		const path = getLocalTemplatePath('my-template.name');
		expect(normalizePath(path)).toContain('templates/my-template.name');
	});
});

describe('isLocalDevelopment', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should return true when templates directory exists', () => {
		const mockExistsSync = vi.mocked(existsSync);
		mockExistsSync.mockReturnValue(true);
		const isDev = isLocalDevelopment();
		expect(isDev).toBe(true);
	});

	it('should return false when templates directory does not exist', () => {
		const mockExistsSync = vi.mocked(existsSync);
		mockExistsSync.mockReturnValue(false);
		const isDev = isLocalDevelopment();
		expect(isDev).toBe(false);
	});
});
