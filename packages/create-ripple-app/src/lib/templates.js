import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { TEMPLATES, TEMPLATES_DIR } from '../constants';

/**
 * Get template by name
 * @param {string} templateName - The template name
 * @returns {object|null} - Template object or null if not found
 */
export function getTemplate(templateName) {
	return TEMPLATES.find((template) => template.name === templateName) || null;
}

/**
 * Get all available template names
 * @returns {string[]} - Array of template names
 */
export function getTemplateNames() {
	return TEMPLATES.map((template) => template.name);
}

/**
 * Get template choices for prompts
 * @returns {object[]} - Array of choice objects for prompts
 */
export function getTemplateChoices() {
	return TEMPLATES.map((template) => ({
		title: template.display,
		description: template.description,
		value: template.name
	}));
}

/**
 * Validate if template exists
 * @param {string} templateName - The template name to validate
 * @returns {boolean} - True if template exists
 */
export function validateTemplate(templateName) {
	if (!templateName) return false;

	const template = getTemplate(templateName);
	if (!template) return false;

	const templatePath = join(TEMPLATES_DIR, templateName);
	return existsSync(templatePath);
}

/**
 * Get template directory path
 * @param {string} templateName - The template name
 * @returns {string} - Absolute path to template directory
 */
export function getTemplatePath(templateName) {
	return join(TEMPLATES_DIR, templateName);
}

/**
 * Get templates directory path
 * @returns {string} - Absolute path to templates directory
 */
export function getTemplatesDir() {
	return TEMPLATES_DIR;
}
