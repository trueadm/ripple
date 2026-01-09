#!/usr/bin/env node

/** @import {CommandOptions} from './commands/create.js' */
/** @import {ServeCommandOptions} from './commands/serve.js' */

import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { red } from 'kleur/colors';
import { createCommand } from './commands/create.js';
import { serveCommand } from './commands/serve.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'));
const program = new Command();

program
	.name('ripple')
	.description('CLI tool for creating and serving Ripple applications')
	.version(packageJson.version)
	.helpOption('-h, --help', 'Display help for command');

// Create command (default action for backward compatibility)
program
	.command('create [project-name]', { isDefault: true })
	.description('Create a new Ripple application')
	.option('-t, --template <template>', 'Template to use (default: basic)')
	.option('-p, --package-manager <pm>', 'Package manager to use (npm, yarn, pnpm, bun)')
	.option('--no-git', 'Skip Git repository initialization')
	.option('-y, --yes', 'Skip all prompts and use defaults')
	.action(
		/**
		 * @param {string} projectName
		 * @param {CommandOptions} options
		 */
		async (projectName, options) => {
			try {
				await createCommand(projectName, options);
			} catch (e) {
				const error = /** @type {Error} */ (e);
				console.error(red('✖ Unexpected error:'));
				console.error(error.message);
				process.exit(1);
			}
		},
	);

// Serve command for SSR development server
program
	.command('serve')
	.description('Start the SSR development server')
	.option('-p, --port <port>', 'Port to run the server on (default: 3000)')
	.option('-e, --entry <path>', 'Path to the entry component (default: /src/App.ripple)')
	.option('-t, --template <path>', 'Path to the HTML template (default: index.html)')
	.action(
		/**
		 * @param {ServeCommandOptions} options
		 */
		async (options) => {
			try {
				await serveCommand(options);
			} catch (e) {
				const error = /** @type {Error} */ (e);
				console.error(red('✖ Unexpected error:'));
				console.error(error.message);
				process.exit(1);
			}
		},
	);

// Handle unhandled promise rejections
process.on(
	'unhandledRejection',
	/** @param {string} reason */ (reason) => {
		console.error(red('✖ Unhandled error:'));
		console.error(reason);
		process.exit(1);
	},
);

// Handle SIGINT (Ctrl+C)
process.on('SIGINT', () => {
	console.log();
	console.log(red('✖ Operation cancelled'));
	process.exit(1);
});

program.parse();
