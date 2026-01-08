import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync, cpSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CLI_PATH = join(__dirname, '../../src/index.js');
const TEMPLATES_PATH = join(__dirname, '../../../../templates');

describe('Serve Command Integration Tests', () => {
	/** @type {string} */
	let testDir;

	beforeEach(() => {
		testDir = join(tmpdir(), `serve-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
	});

	afterEach(() => {
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	/**
	 * Helper function to run CLI commands
	 * @param {string[]} args
	 * @param {string} cwd
	 * @param {number} timeout
	 * @returns {Promise<{code: number | null, stdout: string, stderr: string}>}
	 */
	const runCLI = (args = [], cwd = testDir, timeout = 5000) => {
		return new Promise((resolve, reject) => {
			const child = spawn('node', [CLI_PATH, ...args], {
				cwd,
				stdio: 'pipe',
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

			// Kill after timeout
			setTimeout(() => {
				child.kill('SIGTERM');
			}, timeout);
		});
	};

	/**
	 * Create a minimal test project directory
	 * @param {string} dir
	 */
	const createTestProject = (dir) => {
		mkdirSync(join(dir, 'src'), { recursive: true });

		// Create package.json
		writeFileSync(
			join(dir, 'package.json'),
			JSON.stringify({
				name: 'test-project',
				type: 'module',
			}),
		);

		// Create index.html with SSR placeholders
		writeFileSync(
			join(dir, 'index.html'),
			`<!DOCTYPE html>
<html>
<head><!--ssr-head--></head>
<body><div id="root"><!--ssr-body--></div></body>
</html>`,
		);

		// Create a minimal App.ripple
		writeFileSync(
			join(dir, 'src', 'App.ripple'),
			`export component App() {
	<div>Hello SSR</div>
}`,
		);
	};

	describe('serve command help', () => {
		it('should display serve command in help', async () => {
			const result = await runCLI(['--help']);

			expect(result.code).toBe(0);
			expect(result.stdout).toContain('serve');
			expect(result.stdout).toContain('Start the SSR development server');
		});

		it('should display serve command options', async () => {
			const result = await runCLI(['serve', '--help']);

			expect(result.code).toBe(0);
			expect(result.stdout).toContain('--port');
			expect(result.stdout).toContain('--entry');
			expect(result.stdout).toContain('--template');
		});
	});

	describe('serve command validation', () => {
		it('should fail when not in a project directory', async () => {
			// Empty directory without package.json
			const result = await runCLI(['serve'], testDir);

			expect(result.code).toBe(1);
			expect(result.stderr).toContain('No package.json found');
		});

		it('should fail when entry file does not exist', async () => {
			// Create minimal project without App.ripple
			writeFileSync(
				join(testDir, 'package.json'),
				JSON.stringify({ name: 'test', type: 'module' }),
			);
			writeFileSync(
				join(testDir, 'index.html'),
				'<html><head><!--ssr-head--></head><body><!--ssr-body--></body></html>',
			);

			const result = await runCLI(['serve'], testDir);

			expect(result.code).toBe(1);
			expect(result.stderr).toContain('Entry file not found');
		});

		it('should fail when template file does not exist', async () => {
			writeFileSync(
				join(testDir, 'package.json'),
				JSON.stringify({ name: 'test', type: 'module' }),
			);
			mkdirSync(join(testDir, 'src'), { recursive: true });
			writeFileSync(join(testDir, 'src', 'App.ripple'), 'export component App() { <div></div> }');
			// No index.html

			const result = await runCLI(['serve'], testDir);

			expect(result.code).toBe(1);
			expect(result.stderr).toContain('Template file not found');
		});

		it('should fail with invalid port', async () => {
			createTestProject(testDir);

			const result = await runCLI(['serve', '--port', 'invalid'], testDir);

			expect(result.code).toBe(1);
			expect(result.stderr).toContain('Port must be a valid number');
		});
	});

	describe('serve command startup', () => {
		it('should start server with default options', async () => {
			createTestProject(testDir);

			// Run server briefly and check startup message
			const result = await runCLI(['serve'], testDir, 3000);

			// Server should start (even if we kill it quickly)
			expect(result.stdout).toContain('Starting Ripple SSR development server');
		});

		it('should accept custom port option', async () => {
			createTestProject(testDir);

			const result = await runCLI(['serve', '--port', '8080'], testDir, 3000);

			expect(result.stdout).toContain('Starting Ripple SSR development server');
		});

		it('should accept custom entry option', async () => {
			createTestProject(testDir);
			writeFileSync(
				join(testDir, 'src', 'Main.ripple'),
				'export component App() { <div>Main</div> }',
			);

			const result = await runCLI(['serve', '--entry', '/src/Main.ripple'], testDir, 3000);

			expect(result.stdout).toContain('Starting Ripple SSR development server');
		});
	});

	describe('basic-ssr template integration', () => {
		it('should create project with basic-ssr template', async () => {
			const projectName = 'test-ssr-project';
			const result = await runCLI(
				[projectName, '--template', 'basic-ssr', '--package-manager', 'npm', '--no-git', '--yes'],
				testDir,
				10000,
			);

			expect(result.code).toBe(0);
			expect(result.stdout).toContain('Project created successfully');

			// Verify SSR-specific files
			const projectPath = join(testDir, projectName);
			expect(existsSync(join(projectPath, 'package.json'))).toBe(true);
			expect(existsSync(join(projectPath, 'index.html'))).toBe(true);
			expect(existsSync(join(projectPath, 'src', 'App.ripple'))).toBe(true);
			expect(existsSync(join(projectPath, 'src', 'index.ts'))).toBe(true);
		});

		it('should have SSR placeholders in template index.html', async () => {
			// Check the actual template
			const templateIndexPath = join(TEMPLATES_PATH, 'basic-ssr', 'index.html');
			if (existsSync(templateIndexPath)) {
				const content = require('node:fs').readFileSync(templateIndexPath, 'utf-8');
				expect(content).toContain('<!--ssr-head-->');
				expect(content).toContain('<!--ssr-body-->');
			}
		});

		it('should have hydration in template entry file', async () => {
			// Check the actual template
			const templateEntryPath = join(TEMPLATES_PATH, 'basic-ssr', 'src', 'index.ts');
			if (existsSync(templateEntryPath)) {
				const content = require('node:fs').readFileSync(templateEntryPath, 'utf-8');
				expect(content).toContain('hydrate: true');
			}
		});

		it('should have serve script in template package.json', async () => {
			// Check the actual template
			const templatePkgPath = join(TEMPLATES_PATH, 'basic-ssr', 'package.json');
			if (existsSync(templatePkgPath)) {
				const pkg = JSON.parse(require('node:fs').readFileSync(templatePkgPath, 'utf-8'));
				expect(pkg.scripts.dev).toContain('@ripple-ts/cli serve');
				expect(pkg.devDependencies).toHaveProperty('@ripple-ts/cli');
			}
		});
	});
});
