#!/usr/bin/env node

/** @import {CommandOptions} from './commands/create.js' */

import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { red } from 'kleur/colors';
import { createCommand } from './commands/create.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'));
const program = new Command();

program
	.name('create-ripple')
	.description('Interactive CLI tool for creating Ripple applications')
	.version(packageJson.version)
	.helpOption('-h, --help', 'Display help for command');

program
	.argument('[project-name]', 'Name of the project to create')
	.option('-t, --template <template>', 'Template to use (default: basic)')
	.option('-p, --package-manager <pm>', 'Package manager to use (npm, yarn, pnpm)')
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
