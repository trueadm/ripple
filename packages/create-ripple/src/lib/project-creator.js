/**
 * @typedef {import('type-fest').PackageJson & {
 *   scripts?: Record<string, string>;
 * }} Package
 */

/**
 * @typedef PackageManager
 * @type {'npm' | 'yarn' | 'pnpm'}
 */

import { join, basename } from 'node:path';
import { existsSync, mkdirSync, cpSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { green, dim } from 'kleur/colors';
import ora from 'ora';

import { downloadTemplate, getLocalTemplatePath, isLocalDevelopment } from './templates.js';

/**
 * Create a new Ripple project
 * @param {object} options - Project creation options
 * @param {string} options.projectName - Name of the project
 * @param {string} options.projectPath - Absolute path where project will be created
 * @param {string} options.template - Template to use
 * @param {PackageManager} options.packageManager - Package manager to use
 * @param {boolean} options.gitInit - Whether to initialize Git
 * @param {string} options.stylingFramework - Styling framework to use
 */
export async function createProject({
	projectName,
	projectPath,
	template,
	packageManager = 'npm',
	gitInit = false,
	stylingFramework = 'vanilla',
}) {
	console.log(dim(`Creating project: ${projectName}`));
	console.log(dim(`Template: ${template}`));
	console.log(dim(`Package manager: ${packageManager}`));
	console.log();

	let templatePath;
	let isTemporary = false;

	// Step 1: Get or download template
	const spinner1 = ora('Preparing template...').start();
	try {
		if (isLocalDevelopment()) {
			// Use local template for development
			templatePath = getLocalTemplatePath(template);
			if (!existsSync(templatePath)) {
				throw new Error(`Local template "${template}" not found at ${templatePath}`);
			}
			spinner1.succeed('Local template located');
		} else {
			// Download template from GitHub
			spinner1.text = 'Downloading template from GitHub...';
			templatePath = await downloadTemplate(template);
			isTemporary = true;
			spinner1.succeed('Template downloaded');
		}
	} catch (error) {
		spinner1.fail('Failed to prepare template');
		throw error;
	}

	// Step 2: Create project directory
	const spinner2 = ora('Creating project directory...').start();
	try {
		mkdirSync(projectPath, { recursive: true });
		spinner2.succeed('Project directory created');
	} catch (error) {
		spinner2.fail('Failed to create project directory');
		if (isTemporary) {
			rmSync(templatePath, { recursive: true, force: true });
		}
		throw error;
	}

	// Step 3: Copy template files
	const spinner3 = ora('Copying template files...').start();
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
			},
		});
		spinner3.succeed('Template files copied');
	} catch (error) {
		spinner3.fail('Failed to copy template files');
		if (isTemporary) {
			rmSync(templatePath, { recursive: true, force: true });
		}
		throw error;
	}

	// Step 4: Update package.json
	const spinner4 = ora('Configuring package.json...').start();
	try {
		updatePackageJson(projectPath, projectName, packageManager, stylingFramework);
		spinner4.succeed('Package.json configured');
	} catch (error) {
		spinner4.fail('Failed to configure package.json');
		if (isTemporary) {
			rmSync(templatePath, { recursive: true, force: true });
		}
		throw error;
	}

	// Step 5: Configure styling
	const spinner5 = ora('Configuring styling framework...').start();
	try {
		configureStyling(projectPath, stylingFramework);
		spinner5.succeed('Styling framework configured');
	} catch (error) {
		spinner5.fail('Failed to configure styling framework');
		if (isTemporary) {
			rmSync(templatePath, { recursive: true, force: true });
		}
		throw error;
	}

	// Step 6: Initialize Git (if requested)
	if (gitInit) {
		const spinner6 = ora('Initializing Git repository...').start();
		try {
			execSync('git init', { cwd: projectPath, stdio: 'ignore' });
			spinner6.succeed('Git repository initialized');
		} catch (error) {
			spinner6.warn('Git initialization failed (optional)');
		}
	}

	// Clean up temporary template directory
	if (isTemporary) {
		try {
			rmSync(templatePath, { recursive: true, force: true });
		} catch (error) {
			// Ignore cleanup errors
		}
	}

	console.log();
	console.log(green('✓ Project created successfully!'));
}

/**
 * Update package.json with project-specific configurations
 * @param {string} projectPath - Path to the project
 * @param {string} projectName - Name of the project
 * @param {PackageManager} packageManager - Package manager being used
 * @param {string} stylingFramework - Styling framework being used
 */
function updatePackageJson(projectPath, projectName, packageManager, stylingFramework) {
	const packageJsonPath = join(projectPath, 'package.json');

	if (!existsSync(packageJsonPath)) {
		throw new Error('package.json not found in template');
	}

	/** @type {Package} */
	const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

	// Update package name
	packageJson.name = basename(projectName);

	// Remove version if it exists (since this is a new project)
	if (packageJson.version === '0.0.0') {
		packageJson.version = '1.0.0';
	}

	// Update description
	packageJson.description = `A Ripple application created with create-ripple`;

	// Add package manager field if not npm
	if (packageManager !== 'npm') {
		packageJson.packageManager = getPackageManagerVersion(packageManager);
	}

	// Add styling dependencies
	if (stylingFramework === 'tailwind') {
		packageJson.devDependencies = {
			...packageJson.devDependencies,
			tailwindcss: '^4.1.12',
			'@tailwindcss/vite': '^4.1.12',
		};
	} else if (stylingFramework === 'bootstrap') {
		packageJson.dependencies = {
			...packageJson.dependencies,
			bootstrap: '^5.3.0',
		};
	}

	// Ensure we're using the latest versions
	updateDependencyVersions(packageJson);

	// Update scripts based on package manager
	updateScripts(packageJson);

	writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
}

/** Configure styling framework in the project
 * @param {string} projectPath - Path to the project
 * @param {string} stylingFramework - Styling framework to use
 */
function configureStyling(projectPath, stylingFramework) {
	if (stylingFramework === 'tailwind') {
		const tailwindConfig = `import type { Config } from 'tailwindcss';
export default {
	content: [
		"./index.html",
		"./src/**/*.{ts,ripple}",
	],
	theme: {
		extend: {},
	},
	plugins: []
} satisfies Config
`;
		writeFileSync(join(projectPath, 'tailwind.config.ts'), tailwindConfig);
		const mainCss = `@import "tailwindcss";
@config "../tailwind.config.ts";`;
		writeFileSync(join(projectPath, 'src', 'index.css'), mainCss);

		const mainTs = readFileSync(join(projectPath, 'src', 'index.ts'), 'utf-8');
		const newMainTs = "import './index.css';\n" + mainTs;
		writeFileSync(join(projectPath, 'src', 'index.ts'), newMainTs);

		if (existsSync(join(projectPath, 'vite.config.js'))) {
			rmSync(join(projectPath, 'vite.config.js'));
		}
		const viteConfig = `import { defineConfig } from 'vite';
import { ripple } from 'vite-plugin-ripple';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	plugins: [ripple(), tailwindcss()],
	server: {
		port: 3000
	}
});
`;
		writeFileSync(join(projectPath, 'vite.config.js'), viteConfig);
	} else if (stylingFramework === 'bootstrap') {
		const mainTs = readFileSync(join(projectPath, 'src', 'index.ts'), 'utf-8');
		const newMainTs = "import 'bootstrap/dist/css/bootstrap.min.css';\n" + mainTs;
		writeFileSync(join(projectPath, 'src', 'index.ts'), newMainTs);
	}
}

/**
 * Update dependency versions to latest
 * @param {Package} packageJson - Package.json object
 */
function updateDependencyVersions(packageJson) {
	// Use the latest versions for Ripple packages
	const latestVersions = {
		ripple: 'latest',
		'vite-plugin-ripple': 'latest',
		'prettier-plugin-ripple': 'latest',
		'eslint-plugin-ripple': 'latest',
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
 * @param {Package} packageJson - Package.json object
 */
function updateScripts(packageJson) {
	if (!packageJson.scripts) return;

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
 * @param {Extract<PackageManager, 'yarn' | 'pnpm'>} packageManager - Package manager name
 * @returns {string} - Package manager with version
 */
function getPackageManagerVersion(packageManager) {
	const versions = {
		yarn: 'yarn@4.0.0',
		pnpm: 'pnpm@9.0.0',
	};
	return versions[packageManager] || packageManager;
}
