import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

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
	const runCLI = (args = [], input = '', timeout = 10000) => {
		return new Promise((resolve, reject) => {
			const child = spawn('node', [CLI_PATH, ...args], {
				cwd: testDir,
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

	it('should handle project directory that already exists (with --yes)', async () => {
		const projectName = 'existing-project';
		const projectPath = join(testDir, projectName);

		mkdirSync(projectPath, { recursive: true });
		writeFileSync(join(projectPath, 'existing-file.txt'), 'test');

		const result = await runCLI([
			projectName,
			'--template', 'basic',
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
