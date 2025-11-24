/** @import {PackageManager} from '../lib/project-creator.js' */

/**
 * @typedef {{ template?: string, packageManager?: PackageManager, git?: boolean, yes?: boolean, help?: boolean }} CommandOptions
 */

import { basename, resolve, relative } from 'node:path';
import { existsSync } from 'node:fs';
import { green, cyan, dim, red, bold } from 'kleur/colors';
import { validateProjectName } from '../lib/validation.js';
import { validateTemplate, getTemplateNames } from '../lib/templates.js';
import {
	promptProjectName,
	promptTemplate,
	promptPackageManager,
	promptGitInit,
	promptStylingFramework,
} from '../lib/prompts.js';
import { createProject } from '../lib/project-creator.js';
import { isFolderEmpty } from '../lib/is-folder-empty.js';
import { getCurrentPackageManager } from '../lib/package-manager.js';

/**
 * Create command handler
 * @param {string} projectName - Project name (optional)
 * @param {CommandOptions} options - Command options
 */
export async function createCommand(projectName, options) {
	console.log();
	console.log(cyan('🌊 Welcome to Create Ripple App!'));
	console.log(dim("Let's create a new Ripple application"));
	console.log();

	// Step 1: Get or validate project name
	if (!projectName) {
		projectName = await promptProjectName();
	} else {
		const validation = validateProjectName(projectName);
		if (!validation.valid) {
			console.error(red(`✖ ${validation.message}`));
			process.exit(1);
		}
	}

	// Step 1 results
	const projectPath = resolve(process.cwd(), projectName);

	// Step 2: Check directory and handle conflicts
	// Only if the directory exists already
	if (existsSync(projectPath) && !isFolderEmpty(projectPath, basename(projectPath))) {
		process.exit(1);
	}

	// Step 3: Get template
	let templateName = options.template;
	if (!templateName) {
		templateName = await promptTemplate();
	} else {
		// Validate template
		if (!validateTemplate(templateName)) {
			console.error(red(`✖ Template "${templateName}" not found`));
			console.error(`Available templates: ${getTemplateNames().join(', ')}`);
			process.exit(1);
		}
	}

	// Step 4: Get package manager
	// Auto-detect the package manager used to execute this CLI
	let packageManager;
	const detected = getCurrentPackageManager();
	if (!options.packageManager && !options.yes) {
		// interactive mode
		packageManager = await promptPackageManager(detected);
	} else {
		// non-interactive mode
		packageManager = options.packageManager || detected;
	}

	// Step 5: Git initialization preference
	let gitInit;

	// This logic assumes that `options.git` might be true by default.
	// We will prompt unless the user has explicitly opted out or is in non-interactive mode.
	if (options.git === false) {
		// --no-git was used
		gitInit = false;
	} else if (options.yes) {
		// --yes was used, default to true
		gitInit = true;
	} else {
		// In all other cases, including the implicit default, ask the user.
		gitInit = await promptGitInit();
	}

	let stylingFramework = 'vanilla';
	if (!options.yes) {
		stylingFramework = await promptStylingFramework();
	}

	// Step 6: Create the project
	console.log();
	console.log(`Creating Ripple app in ${green(projectPath)}...`);
	console.log();

	try {
		await createProject({
			projectName,
			projectPath,
			templateName,
			packageManager,
			gitInit,
			stylingFramework,
		});

		showNextSteps(projectPath, packageManager);
		process.exit(0);
	} catch (e) {
		const error = /** @type {Error} */ (e);
		console.error(red('✖ Failed to create project:'));
		console.error(error.message);
		process.exit(1);
	}
}

/**
 * Show next steps to the user
 * @param {string} projectPath - The created project path
 * @param {PackageManager} packageManager - Package manager used
 */
function showNextSteps(projectPath, packageManager) {
	const installCommand = getInstallCommand(packageManager);
	const devCommand = getDevCommand(packageManager);
	const relativePath = relative(process.cwd(), projectPath);
	console.log();
	console.log(green('🎉 Success! Your Ripple app is ready to go.'));
	console.log();
	console.log(bold('Next steps:'));
	console.log();
	console.log(`  ${green('1.')} ${dim('cd')} ${relativePath}`);
	console.log(`  ${green('2.')} ${dim(installCommand)}`);
	console.log(`  ${green('3.')} ${dim(devCommand)}`);
	console.log(`  ${green('4.')} visit: ${cyan('http://localhost:3000')}`);
	console.log(`  ${green('5.')} make changes in the: ${cyan('src/')} directory`);
	console.log();
	console.log(bold('Need help? Check out:'));
	console.log(`  ${dim('•')} README.md in your project folder`);
	console.log(`  ${dim('•')} Documentation: ${cyan('https://www.ripplejs.com/docs/introduction')}`);
	console.log();
	console.log('Happy coding! 🌊');
	console.log();
}

/**
 * Get install command for package manager
 * @param {PackageManager} packageManager - Package manager name
 * @returns {string} - Install command
 */
function getInstallCommand(packageManager) {
	const commands = {
		npm: 'npm install',
		yarn: 'yarn install',
		pnpm: 'pnpm install',
		bun: 'bun install',
	};
	return commands[packageManager] || 'npm install';
}

/**
 * Get dev command for package manager
 * @param {PackageManager} packageManager - Package manager name
 * @returns {string} - Dev command
 */
function getDevCommand(packageManager) {
	const commands = {
		npm: 'npm run dev',
		yarn: 'yarn dev',
		pnpm: 'pnpm dev',
		bun: 'bun dev',
	};
	return commands[packageManager] || 'npm run dev';
}
