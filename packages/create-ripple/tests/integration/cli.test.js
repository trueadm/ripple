import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { resolve, relative } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CLI_PATH = join(__dirname, '../../src/index.js');

describe('CLI Integration Tests', () => {
	let testDir;

	beforeEach(() => {
		testDir = join(tmpdir(), `cli-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
	});

	afterEach(() => {
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	// Helper function to run CLI commands
	const runCLI = (args = [], input = '', timeout = 10000, cwd = testDir) => {
		return new Promise((resolve, reject) => {
			const child = spawn('node', [CLI_PATH, ...args], {
				cwd,
				stdio: 'pipe'
			});

			let stdout = '';
			let stderr = '';

			child.stdout.on('data', (data) => {
				stdout += data.toString();
			});

			child.stderr.on('data', (data) => {
				stderr += data.toString();
			});

			child.on('close', (code) => {
				resolve({ code, stdout, stderr });
			});

			child.on('error', reject);

			if (input) {
				child.stdin.write(input);
			}
			child.stdin.end();

			setTimeout(() => {
				child.kill();
				reject(new Error('Command timed out'));
			}, timeout);
		});
	};

	it('should show help when --help flag is used', async () => {
		const result = await runCLI(['--help']);

		expect(result.code).toBe(0);
		expect(result.stdout).toContain('Interactive CLI tool for creating Ripple applications');
		expect(result.stdout).toContain('Usage: create-ripple');
		expect(result.stdout).toContain('Arguments:');
		expect(result.stdout).toContain('Options:');
		expect(result.stdout).toContain('--template');
		expect(result.stdout).toContain('--package-manager');
	});

	it('should show version when --version flag is used', async () => {
		const result = await runCLI(['--version']);

		expect(result.code).toBe(0);
		expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
	});

	it('should create project with all arguments provided', async () => {
		const projectName = 'test-cli-project';
		const result = await runCLI([
			projectName,
			'--template', 'basic',
			'--package-manager', 'npm',
			'--no-git',
			'--yes'
		]);

		expect(result.code).toBe(0);
		expect(result.stdout).toContain('Welcome to Create Ripple App');
		expect(result.stdout).toContain('Creating Ripple app');
		expect(result.stdout).toContain('Project created successfully');
		expect(result.stdout).toContain('Next steps:');
		expect(result.stdout).toContain(`cd ${projectName}`);
		expect(result.stdout).toContain('npm install');
		expect(result.stdout).toContain('npm run dev');

		expect(existsSync(join(testDir, projectName))).toBe(true);
		expect(existsSync(join(testDir, projectName, 'package.json'))).toBe(true);
	});

	it('should create project with relative path to target directory', async () => {
		const projectName = './relative/test-cli-project';
		const result = await runCLI([
			projectName,
			'--template', 'basic',
			'--package-manager', 'npm',
			'--no-git',
			'--yes'
		]);

		expect(result.code).toBe(0);
		expect(result.stdout).toContain('Project created successfully');

		// Verify project directory name
		expect(result.stdout).toContain(`cd ${relative(testDir, resolve(testDir, projectName))}`);
	});

	it('should create project with outer relative path to target directory', async () => {
		// Create a subdirectory inside the testDir and use that as the current working directory
		const subTestDir = join(testDir, 'subdir');
		mkdirSync(subTestDir, { recursive: true });

		const projectName = '../test-outer-cli-project';
		const projectPath = resolve(subTestDir, projectName);
		const result = await runCLI([
			projectName,
			'--template', 'basic',
			'--package-manager', 'npm',
			'--no-git',
			'--yes'
		], '',
			10000,
			subTestDir
		);

		expect(result.code).toBe(0);
		expect(result.stdout).toContain('Project created successfully');

		// Verify project directory name
		expect(result.stdout).toContain(`cd ${relative(subTestDir, projectPath)}`);
	});

	it('should handle invalid template gracefully', async () => {
		const result = await runCLI([
			'test-project',
			'--template', 'invalid-template',
			'--yes'
		]);

		expect(result.code).toBe(1);
		expect(result.stderr).toContain('Template "invalid-template" not found');
		expect(result.stderr).toContain('Available templates:');
	});

	it('should handle invalid project name gracefully', async () => {
		const result = await runCLI([
			'Invalid Project Name!',
			'--yes'
		]);

		expect(result.code).toBe(1);
		expect(result.stderr).toContain('Project name can only contain lowercase letters');
	});

	it('should show different package manager commands based on selection', async () => {
		const projectName = 'test-pnpm-project';
		const result = await runCLI([
			projectName,
			'--template', 'basic',
			'--package-manager', 'pnpm',
			'--yes'
		]);

		expect(result.code).toBe(0);
		expect(result.stdout).toContain('pnpm install');
		expect(result.stdout).toContain('pnpm dev');
	});

	it('should handle yarn package manager', async () => {
		const projectName = 'test-yarn-project';
		const result = await runCLI([
			projectName,
			'--template', 'basic',
			'--package-manager', 'yarn',
			'--yes'
		]);

		expect(result.code).toBe(0);
		expect(result.stdout).toContain('yarn install');
		expect(result.stdout).toContain('yarn dev');
	});

	it('Should abort if the target directory is containing any conflicting files', async () => {
		const projectName = 'non-empty-project';
		const projectPath = join(testDir, projectName);
		const conflictFiles = ['conflict-file.txt', 'another-file.js', 'README.md'];
		const nonConflictFiles = ['.gitignore', 'LICENSE'];

		mkdirSync(projectPath, { recursive: true });
		[...conflictFiles, ...nonConflictFiles].forEach(file => writeFileSync(join(projectPath, file), 'conflict'));
		const result = await runCLI([
			projectName,
			'--yes'
		]);

		expect(result.code).toBe(1);
		expect(result.stdout).toContain(`The directory ${projectName} contains files that could conflict:`);

		// Verify only conflicting file is listed
		conflictFiles.forEach(file => {
			expect(result.stdout).toContain(file);
		});

		expect(result.stdout).toContain('Either try using a new directory name, or remove the files listed above.');
	});

	it('should create a project with non-conflicting files in target directory', async () => {
		const projectName = 'non-conflicting-project';
		const projectPath = join(testDir, projectName);
		const nonConflictFiles = [
			'.DS_Store',
			'.git',
			'.gitattributes',
			'.gitignore',
			'.gitlab-ci.yml',
			'.hg',
			'.hgcheck',
			'.hgignore',
			'.idea',
			'.npmignore',
			'.travis.yml',
			'LICENSE',
			'Thumbs.db',
			'docs',
			'mkdocs.yml',
			'npm-debug.log',
			'yarn-debug.log',
			'yarn-error.log',
			'yarnrc.yml',
			'.yarn',
			'project.iml', // IntelliJ IDEA-based editor files
		];

		mkdirSync(projectPath, { recursive: true });
		nonConflictFiles.forEach(file => writeFileSync(join(projectPath, file), 'no conflict'));
		const result = await runCLI([
			projectName,
			'--template', 'basic',
			'--package-manager', 'npm',
			'--no-git',
			'--yes'
		]);

		expect(result.code).toBe(0);
		expect(result.stdout).toContain('Project created successfully');
	});

	it('should validate all required dependencies are available', async () => {
		const result = await runCLI(['--help']);
		expect(result.code).toBe(0);
		expect(result.stderr).toBe('');
	});
});
