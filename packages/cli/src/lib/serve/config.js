/**
 * Server configuration utilities
 * Separated from server.js to allow unit testing without loading vite
 */

import fs from 'node:fs';
import path from 'node:path';

/**
 * @typedef {Object} ServerOptions
 * @property {number} [port=3000] - The port to run the server on
 * @property {string} [entry='/src/App.ripple'] - Path to the entry component
 * @property {string} [template='index.html'] - Path to the HTML template
 * @property {string} [root=process.cwd()] - Root directory of the project
 */

/**
 * Validate server options and apply defaults
 * @param {Partial<ServerOptions>} options - User-provided options
 * @returns {ServerOptions} - Validated options with defaults
 */
export function validateOptions(options = {}) {
	const port = options.port ?? 3000;
	const entry = options.entry ?? '/src/App.ripple';
	const template = options.template ?? 'index.html';
	const root = options.root ?? process.cwd();

	if (typeof port !== 'number' || port < 0 || port > 65535) {
		throw new Error('Port must be a valid number between 0 and 65535');
	}

	if (typeof entry !== 'string' || !entry.endsWith('.ripple')) {
		throw new Error('Entry must be a path to a .ripple file');
	}

	if (typeof template !== 'string') {
		throw new Error('Template must be a path to an HTML file');
	}

	return { port, entry, template, root };
}

/**
 * Read and validate the HTML template file
 * @param {string} templatePath - Path to the template file
 * @param {string} root - Root directory
 * @returns {string} - The template content
 */
export function readTemplate(templatePath, root) {
	const fullPath = path.resolve(root, templatePath);

	if (!fs.existsSync(fullPath)) {
		throw new Error(`Template file not found: ${fullPath}`);
	}

	const content = fs.readFileSync(fullPath, 'utf-8');

	if (!content.includes('<!--ssr-head-->') || !content.includes('<!--ssr-body-->')) {
		throw new Error(
			'Template must contain <!--ssr-head--> and <!--ssr-body--> placeholders for SSR',
		);
	}

	return content;
}
