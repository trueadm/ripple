import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { green, cyan, dim, red } from 'kleur/colors';
import { validateProjectName } from '../lib/validation.js';
import { validateTemplate, getTemplateNames } from '../lib/templates.js';
import {
	promptProjectName,
	promptTemplate,
	promptOverwrite,
	promptPackageManager,
	promptGitInit,
	promptStylingFramework
} from '../lib/prompts.js';
import { createProject } from '../lib/project-creator.js';

/**
 * Create command handler
 * @param {string} projectName - Project name (optional)
 * @param {object} options - Command options
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

	// Step 2: Get template
	let template = options.template;
	if (!template) {
		template = await promptTemplate();
	} else {
		// Validate template
		if (!validateTemplate(template)) {
			console.error(red(`✖ Template "${template}" not found`));
			console.error(`Available templates: ${getTemplateNames().join(', ')}`);
			process.exit(1);
		}
	}

	// Step 3: Get package manager
	let packageManager = options.packageManager || 'npm';
	if (!options.packageManager && !options.yes) {
		packageManager = await promptPackageManager();
	}

	// Step 4: Check directory and handle conflicts
	const projectPath = resolve(process.cwd(), projectName);
	if (existsSync(projectPath) && !options.yes) {
		const shouldOverwrite = await promptOverwrite(projectName);
		if (!shouldOverwrite) {
			console.log(red('✖ Operation cancelled'));
			process.exit(1);
		}
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
			template,
			packageManager,
			typescript: true,
			gitInit,
			stylingFramework
		});

		showNextSteps(projectName, packageManager);
		process.exit(0);
	} catch (error) {
		console.error(red('✖ Failed to create project:'));
		console.error(error.message);
		process.exit(1);
	}
}

/**
 * Show next steps to the user
 * @param {string} projectName - The created project name
 * @param {string} packageManager - Package manager used
 */
function showNextSteps(projectName, packageManager) {
	const installCommand = getInstallCommand(packageManager);
	const devCommand = getDevCommand(packageManager);

	console.log();
	console.log(green('🎉 Success! Your Ripple app is ready to go.'));
	console.log();
	console.log('Next steps:');
	console.log(`  ${dim('cd')} ${projectName}`);
	console.log(`  ${dim(installCommand)}`);
	console.log(`  ${dim(devCommand)}`);
	console.log();
	console.log('Happy coding! 🌊');
	console.log();
}

/**
 * Get install command for package manager
 * @param {string} packageManager - Package manager name
 * @returns {string} - Install command
 */
function getInstallCommand(packageManager) {
	const commands = {
		npm: 'npm install',
		yarn: 'yarn install',
		pnpm: 'pnpm install'
	};
	return commands[packageManager] || 'npm install';
}

/**
 * Get dev command for package manager
 * @param {string} packageManager - Package manager name
 * @returns {string} - Dev command
 */
function getDevCommand(packageManager) {
	const commands = {
		npm: 'npm run dev',
		yarn: 'yarn dev',
		pnpm: 'pnpm dev'
	};
	return commands[packageManager] || 'npm run dev';
}
