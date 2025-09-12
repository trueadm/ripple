import prompts from 'prompts';
import { validateProjectName } from './validation.js';
import { getTemplateChoices } from './templates.js';
import { red } from 'kleur/colors';

/**
 * Prompt for project name
 * @param {string} defaultName - Default project name
 * @returns {Promise<string>} - Project name
 */
export async function promptProjectName(defaultName = 'my-ripple-app') {
	const response = await prompts({
		type: 'text',
		name: 'projectName',
		message: 'What is your project named?',
		initial: defaultName,
		validate: (value) => {
			const validation = validateProjectName(value);
			return validation.valid || validation.message;
		}
	});

	if (!response.projectName) {
		console.log(red('✖ Operation cancelled'));
		process.exit(1);
	}

	return response.projectName;
}

/**
 * Prompt for template selection
 * @returns {Promise<string>} - Selected template name
 */
export async function promptTemplate() {
	const response = await prompts({
		type: 'select',
		name: 'template',
		message: 'Which template would you like to use?',
		choices: getTemplateChoices(),
		initial: 0
	});

	if (!response.template) {
		console.log(red('✖ Operation cancelled'));
		process.exit(1);
	}

	return response.template;
}

/**
 * Prompt for directory overwrite confirmation
 * @param {string} projectName - The project name
 * @returns {Promise<boolean>} - Whether to overwrite
 */
export async function promptOverwrite(projectName) {
	const response = await prompts({
		type: 'confirm',
		name: 'overwrite',
		message: `Directory "${projectName}" already exists. Continue anyway?`,
		initial: false
	});

	if (response.overwrite === undefined) {
		console.log(red('✖ Operation cancelled'));
		process.exit(1);
	}

	return response.overwrite;
}

/**
 * Prompt for package manager selection
 * @returns {Promise<string>} - Selected package manager
 */
export async function promptPackageManager() {
	const response = await prompts({
		type: 'select',
		name: 'packageManager',
		message: 'Which package manager would you like to use?',
		choices: [
			{ title: 'npm', value: 'npm', description: 'Use npm for dependency management' },
			{ title: 'yarn', value: 'yarn', description: 'Use Yarn for dependency management' },
			{ title: 'pnpm', value: 'pnpm', description: 'Use pnpm for dependency management' }
		],
		initial: 0
	});

	if (!response.packageManager) {
		console.log(red('✖ Operation cancelled'));
		process.exit(1);
	}

	return response.packageManager;
}

/**
 * Prompt for TypeScript usage
 * @returns {Promise<boolean>} - Whether to use TypeScript
 */
export async function promptTypeScript() {
	const response = await prompts({
		type: 'confirm',
		name: 'typescript',
		message: 'Would you like to use TypeScript?',
		initial: true
	});

	if (response.typescript === undefined) {
		console.log(red('✖ Operation cancelled'));
		process.exit(1);
	}

	return response.typescript;
}

/**
 * Prompt for Git initialization
 * @returns {Promise<boolean>} - Whether to initialize Git
 */
export async function promptGitInit() {
	const response = await prompts({
		type: 'confirm',
		name: 'gitInit',
		message: 'Initialize a new Git repository?',
		initial: true
	});

	if (response.gitInit === undefined) {
		console.log(red('✖ Operation cancelled'));
		process.exit(1);
	}

	return response.gitInit;
}
