import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'node:fs';
import {
	getTemplate,
	getTemplateNames,
	getTemplateChoices,
	validateTemplate,
	getTemplatePath,
} from '../../src/lib/templates.js';

// Mock the constants
vi.mock('../../src/constants.js', () => ({
	TEMPLATES: [
		{
			name: 'basic',
			display: 'Basic Ripple App',
			description: 'A minimal Ripple application with Vite and TypeScript'
		},
		{
			name: 'advanced',
			display: 'Advanced Ripple App',
			description: 'A full-featured Ripple application'
		}
	],
	TEMPLATES_DIR: '/mock/templates'
}));

// Mock fs.existsSync
vi.mock('node:fs', () => ({
	default: {
		existsSync: vi.fn()
	},
	existsSync: vi.fn()
}));

describe('getTemplate', () => {
	it('should return template by name', () => {
		const template = getTemplate('basic');
		expect(template).toEqual({
			name: 'basic',
			display: 'Basic Ripple App',
			description: 'A minimal Ripple application with Vite and TypeScript'
		});
	});

	it('should return null for non-existent template', () => {
		const template = getTemplate('non-existent');
		expect(template).toBeNull();
	});

	it('should return null for undefined template name', () => {
		const template = getTemplate();
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
				value: 'basic'
			},
			{
				title: 'Advanced Ripple App',
				description: 'A full-featured Ripple application',
				value: 'advanced'
			}
		]);
	});

	it('should return array even if templates are defined', () => {
		const choices = getTemplateChoices();
		expect(Array.isArray(choices)).toBe(true);
		expect(choices.length).toBeGreaterThan(0);
	});
});

describe('validateTemplate', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should return true for valid existing template', () => {
		const mockExistsSync = vi.mocked(fs.existsSync);
		mockExistsSync.mockReturnValue(true);
		const isValid = validateTemplate('basic');
		expect(isValid).toBe(true);
		expect(mockExistsSync).toHaveBeenCalledWith('/mock/templates/basic');
	});

	it('should return false for valid template that does not exist on filesystem', () => {
		const mockExistsSync = vi.mocked(fs.existsSync);
		mockExistsSync.mockReturnValue(false);
		const isValid = validateTemplate('basic');
		expect(isValid).toBe(false);
	});

	it('should return false for invalid template name', () => {
		const mockExistsSync = vi.mocked(fs.existsSync);
		const isValid = validateTemplate('non-existent');
		expect(isValid).toBe(false);
		expect(mockExistsSync).not.toHaveBeenCalled();
	});

	it('should return false for undefined template name', () => {
		const mockExistsSync = vi.mocked(fs.existsSync);
		const isValid = validateTemplate();
		expect(isValid).toBe(false);
		expect(mockExistsSync).not.toHaveBeenCalled();
	});

	it('should return false for null template name', () => {
		const mockExistsSync = vi.mocked(fs.existsSync);
		const isValid = validateTemplate(null);
		expect(isValid).toBe(false);
		expect(mockExistsSync).not.toHaveBeenCalled();
	});

	it('should return false for empty string template name', () => {
		const mockExistsSync = vi.mocked(fs.existsSync);
		const isValid = validateTemplate('');
		expect(isValid).toBe(false);
		expect(mockExistsSync).not.toHaveBeenCalled();
	});
});

describe('getTemplatePath', () => {
	it('should return correct template path', () => {
		const path = getTemplatePath('basic');
		expect(path).toBe('/mock/templates/basic');
	});

	it('should return path even for non-existent template', () => {
		const path = getTemplatePath('non-existent');
		expect(path).toBe('/mock/templates/non-existent');
	});

	it('should handle special characters in template name', () => {
		const path = getTemplatePath('my-template.name');
		expect(path).toBe('/mock/templates/my-template.name');
	});
});
