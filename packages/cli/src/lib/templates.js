import { join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import degit from 'degit';
import { GITHUB_REPO, GITHUB_TEMPLATES_DIRECTORY, TEMPLATES } from '../constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Get template by name
 * @param {string} templateName - The template name
 * @returns {typeof TEMPLATES[number] | null} - Template object or null if not found
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
 * @returns {{title: string, description: string, value: string}[]} - Array of choice objects for prompts
 */
export function getTemplateChoices() {
	return TEMPLATES.map((template) => ({
		title: template.display,
		description: template.description,
		value: template.name,
	}));
}

/**
 * Validate if template exists in our template list
 * @param {string} templateName - The template name to validate
 * @returns {boolean} - True if template exists in TEMPLATES list
 */
export function validateTemplate(templateName) {
	if (!templateName) return false;
	const template = getTemplate(templateName);
	return template !== null;
}

/**
 * Download template from GitHub repository
 * @param {string} templateName - The template name to download
 * @returns {Promise<string>} - Path to downloaded template directory
 */
export async function downloadTemplate(templateName) {
	if (!validateTemplate(templateName)) {
		throw new Error(`Template "${templateName}" not found`);
	}

	// Create a temporary directory for the template
	const tempDir = join(tmpdir(), `ripple-template-${templateName}-${Date.now()}`);
	mkdirSync(tempDir, { recursive: true });

	// Use degit to download the specific template from GitHub
	const repoUrl = `${GITHUB_REPO}/${GITHUB_TEMPLATES_DIRECTORY}/${templateName}`;
	const emitter = degit(repoUrl, {
		cache: false,
		force: true,
		verbose: false,
	});

	try {
		await emitter.clone(tempDir);
		return tempDir;
	} catch (e) {
		const error = /** @type {Error} */ (e);
		throw new Error(`Failed to download template "${templateName}": ${error.message}`);
	}
}

/**
 * Get template directory path (for local development)
 * @param {string} templateName - The template name
 * @returns {string} - Absolute path to template directory
 */
export function getLocalTemplatePath(templateName) {
	// This is used for local development in the monorepo
	// Navigate from packages/cli/src/lib/ to templates/
	const repoRoot = join(__dirname, '../../../../');
	return join(repoRoot, 'templates', templateName);
}

/**
 * Check if we're running in development mode (monorepo)
 * @returns {boolean} - True if in development mode
 */
export function isLocalDevelopment() {
	// Check if we're in the monorepo by looking for the templates directory
	// Navigate from packages/cli/src/lib/ to templates/
	const repoRoot = join(__dirname, '../../../../');
	const templatesDir = join(repoRoot, 'templates');
	return existsSync(templatesDir);
}
