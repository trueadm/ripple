/**
 * Serve command for Ripple SSR development server
 */

import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { green, cyan, red, dim } from 'kleur/colors';
import { createServer } from '../lib/serve/index.js';

/**
 * @typedef {Object} ServeCommandOptions
 * @property {string} [port] - Port to run the server on
 * @property {string} [entry] - Path to the entry component
 * @property {string} [template] - Path to the HTML template
 */

/**
 * Validate that we're in a valid Ripple project directory
 * @param {string} root - The root directory to check
 * @returns {{ valid: boolean; message: string }}
 */
function validateProjectDirectory(root) {
	const packageJsonPath = resolve(root, 'package.json');

	if (!existsSync(packageJsonPath)) {
		return {
			valid: false,
			message: 'No package.json found. Are you in a Ripple project directory?',
		};
	}

	return { valid: true, message: '' };
}

/**
 * Serve command handler
 * @param {ServeCommandOptions} options - Command options
 */
export async function serveCommand(options) {
	const root = process.cwd();

	// Validate we're in a project directory
	const validation = validateProjectDirectory(root);
	if (!validation.valid) {
		console.error(red(`✖ ${validation.message}`));
		process.exit(1);
	}

	// Parse port option
	const port = options.port ? parseInt(options.port, 10) : 3000;
	if (isNaN(port)) {
		console.error(red('✖ Port must be a valid number'));
		process.exit(1);
	}

	// Resolve paths
	const entry = options.entry || '/src/App.ripple';
	const template = options.template || 'index.html';

	// Validate entry file exists
	const entryPath = resolve(root, entry.startsWith('/') ? entry.slice(1) : entry);
	if (!existsSync(entryPath)) {
		console.error(red(`✖ Entry file not found: ${entryPath}`));
		console.error(
			dim(`  Make sure the entry component exists or specify a different one with --entry`),
		);
		process.exit(1);
	}

	// Validate template file exists
	const templatePath = resolve(root, template);
	if (!existsSync(templatePath)) {
		console.error(red(`✖ Template file not found: ${templatePath}`));
		console.error(
			dim(`  Make sure index.html exists or specify a different template with --template`),
		);
		process.exit(1);
	}

	console.log();
	console.log(cyan('🌊 Starting Ripple SSR development server...'));
	console.log();

	try {
		const server = await createServer({
			port,
			entry,
			template,
			root,
		});

		// Handle graceful shutdown
		const shutdown = () => {
			console.log();
			console.log(dim('Shutting down server...'));
			server.close();
			process.exit(0);
		};

		process.on('SIGINT', shutdown);
		process.on('SIGTERM', shutdown);
	} catch (error) {
		const err = /** @type {Error} */ (error);
		console.error(red('✖ Failed to start server:'));
		console.error(err.message);
		process.exit(1);
	}
}
