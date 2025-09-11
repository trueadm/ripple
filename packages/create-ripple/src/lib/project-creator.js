import { join } from 'node:path';
import { existsSync, mkdirSync, cpSync, readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { green, dim } from 'kleur/colors';
import ora from 'ora';

import { getTemplatePath } from './templates.js';

/**
 * Create a new Ripple project
 * @param {object} options - Project creation options
 * @param {string} options.projectName - Name of the project
 * @param {string} options.projectPath - Absolute path where project will be created
 * @param {string} options.template - Template to use
 * @param {string} options.packageManager - Package manager to use
 * @param {boolean} options.typescript - Whether to use TypeScript
 * @param {boolean} options.gitInit - Whether to initialize Git
 */
export async function createProject({
	projectName,
	projectPath,
	template,
	packageManager = 'npm',
	typescript = true,
	gitInit = true
}) {
	console.log(dim(`Creating project: ${projectName}`));
	console.log(dim(`Template: ${template}`));
	console.log(dim(`Package manager: ${packageManager}`));
	console.log();

	const templatePath = getTemplatePath(template);

	if (!existsSync(templatePath)) {
		throw new Error(`Template "${template}" not found at ${templatePath}`);
	}

	// Step 1: Create project directory
	const spinner1 = ora('Creating project directory...').start();
	try {
		mkdirSync(projectPath, { recursive: true });
		spinner1.succeed('Project directory created');
	} catch (error) {
		spinner1.fail('Failed to create project directory');
		throw error;
	}

	// Step 2: Copy template files
	const spinner2 = ora('Copying template files...').start();
	try {
		cpSync(templatePath, projectPath, {
			recursive: true,
			filter: (src) => {
				// Skip node_modules and any lock files from template
				const relativePath = src.replace(templatePath, '');
				return (
					!relativePath.includes('node_modules') &&
					!relativePath.includes('package-lock.json') &&
					!relativePath.includes('yarn.lock') &&
					!relativePath.includes('pnpm-lock.yaml')
				);
			}
		});
		spinner2.succeed('Template files copied');
	} catch (error) {
		spinner2.fail('Failed to copy template files');
		throw error;
	}

	// Step 3: Update package.json
	const spinner3 = ora('Configuring package.json...').start();
	try {
		updatePackageJson(projectPath, projectName, packageManager, typescript);
		spinner3.succeed('Package.json configured');
	} catch (error) {
		spinner3.fail('Failed to configure package.json');
		throw error;
	}

	// Step 4: Initialize Git (if requested)
	if (gitInit) {
		const spinner4 = ora('Initializing Git repository...').start();
		try {
			execSync('git init', { cwd: projectPath, stdio: 'ignore' });
			execSync('git add .', { cwd: projectPath, stdio: 'ignore' });
			execSync('git commit -m "Initial commit"', { cwd: projectPath, stdio: 'ignore' });
			spinner4.succeed('Git repository initialized');
		} catch (error) {
			spinner4.warn('Git initialization failed (optional)');
		}
	}

	console.log();
	console.log(green('✓ Project created successfully!'));
}

/**
 * Update package.json with project-specific configurations
 * @param {string} projectPath - Path to the project
 * @param {string} projectName - Name of the project
 * @param {string} packageManager - Package manager being used
 * @param {boolean} typescript - Whether TypeScript is enabled
 */
function updatePackageJson(projectPath, projectName, packageManager, typescript) {
	const packageJsonPath = join(projectPath, 'package.json');

	if (!existsSync(packageJsonPath)) {
		throw new Error('package.json not found in template');
	}

	const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

	// Update package name
	packageJson.name = projectName;

	// Remove version if it exists (since this is a new project)
	if (packageJson.version === '0.0.0') {
		packageJson.version = '1.0.0';
	}

	// Update description
	packageJson.description = `A Ripple application created with create-ripple-app`;

	// Add package manager field if not npm
	if (packageManager !== 'npm') {
		packageJson.packageManager = getPackageManagerVersion(packageManager);
	}

	// Ensure we're using the latest versions
	updateDependencyVersions(packageJson);

	// Update scripts based on package manager
	updateScripts(packageJson, packageManager);

	writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
}

/**
 * Update dependency versions to latest
 * @param {object} packageJson - Package.json object
 */
function updateDependencyVersions(packageJson) {
	// Use the latest versions for Ripple packages
	const latestVersions = {
		ripple: '^0.2.35',
		'vite-plugin-ripple': '^0.2.29',
		'prettier-plugin-ripple': '^0.2.29'
	};

	// Update dependencies
	if (packageJson.dependencies) {
		for (const [pkg, version] of Object.entries(latestVersions)) {
			if (packageJson.dependencies[pkg]) {
				packageJson.dependencies[pkg] = version;
			}
		}
	}

	// Update devDependencies
	if (packageJson.devDependencies) {
		for (const [pkg, version] of Object.entries(latestVersions)) {
			if (packageJson.devDependencies[pkg]) {
				packageJson.devDependencies[pkg] = version;
			}
		}
	}
}

/**
 * Update scripts based on package manager
 * @param {object} packageJson - Package.json object
 * @param {string} packageManager - Package manager being used
 */
function updateScripts(packageJson, packageManager) {
	if (!packageJson.scripts) return;

	// Add package manager specific scripts
	const pmCommands = {
		npm: 'npm run',
		yarn: 'yarn',
		pnpm: 'pnpm'
	};

	const pm = pmCommands[packageManager] || 'npm run';

	// Update format scripts to use the correct package manager
	if (packageJson.scripts.format) {
		packageJson.scripts.format = 'prettier --write .';
	}
	if (packageJson.scripts['format:check']) {
		packageJson.scripts['format:check'] = 'prettier --check .';
	}
}

/**
 * Get package manager version string
 * @param {string} packageManager - Package manager name
 * @returns {string} - Package manager with version
 */
function getPackageManagerVersion(packageManager) {
	const versions = {
		yarn: 'yarn@4.0.0',
		pnpm: 'pnpm@9.0.0'
	};
	return versions[packageManager] || packageManager;
}
