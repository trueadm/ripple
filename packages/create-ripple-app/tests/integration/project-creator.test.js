import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createProject } from '../../src/lib/project-creator.js';

// Mock ora for cleaner test output
vi.mock('ora', () => ({
	default: () => ({
		start: () => ({ succeed: vi.fn(), fail: vi.fn(), warn: vi.fn() }),
		succeed: vi.fn(),
		fail: vi.fn(),
		warn: vi.fn()
	})
}));

// Mock execSync to prevent actual git commands during tests
vi.mock('node:child_process', () => ({
	execSync: vi.fn()
}));

describe('createProject integration tests', () => {
	let testDir;
	let projectPath;
	let templatePath;

	beforeEach(() => {
		// Create a temporary test directory
		testDir = join(tmpdir(), `create-ripple-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
		
		projectPath = join(testDir, 'test-project');
		templatePath = join(testDir, 'template');

		// Create a mock template directory structure
		mkdirSync(templatePath, { recursive: true });
		mkdirSync(join(templatePath, 'src'), { recursive: true });
		
		// Create mock template files
		writeFileSync(
			join(templatePath, 'package.json'),
			JSON.stringify({
				name: 'vite-template-ripple',
				version: '0.0.0',
				type: 'module',
				scripts: {
					dev: 'vite',
					build: 'vite build'
				},
				dependencies: {
					ripple: '^0.2.29'
				},
				devDependencies: {
					'vite-plugin-ripple': '^0.2.29',
					prettier: '^3.6.2'
				}
			}, null, 2)
		);

		writeFileSync(join(templatePath, 'index.html'), '<!DOCTYPE html><html></html>');
		writeFileSync(join(templatePath, 'src', 'App.ripple'), '<h1>Hello Ripple!</h1>');
		writeFileSync(join(templatePath, 'README.md'), '# Template Project');

		// Mock the getTemplatePath function
		vi.doMock('../../src/lib/templates.js', () => ({
			getTemplatePath: () => templatePath
		}));
	});

	afterEach(() => {
		// Clean up test directory
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
		vi.clearAllMocks();
	});

	it('should create a project successfully', async () => {
		await createProject({
			projectName: 'test-project',
			projectPath,
			template: 'basic',
			packageManager: 'npm',
			typescript: true,
			gitInit: false
		});

		// Verify project directory was created
		expect(existsSync(projectPath)).toBe(true);

		// Verify files were copied
		expect(existsSync(join(projectPath, 'package.json'))).toBe(true);
		expect(existsSync(join(projectPath, 'index.html'))).toBe(true);
		expect(existsSync(join(projectPath, 'src', 'App.ripple'))).toBe(true);
		expect(existsSync(join(projectPath, 'README.md'))).toBe(true);

		// Verify package.json was updated
		const packageJson = JSON.parse(readFileSync(join(projectPath, 'package.json'), 'utf-8'));
		expect(packageJson.name).toBe('test-project');
		expect(packageJson.description).toBe('A Ripple application created with create-ripple-app');
		expect(packageJson.version).toBe('1.0.0');
	});

	it('should update package.json with correct package manager', async () => {
		await createProject({
			projectName: 'test-pnpm-project',
			projectPath,
			template: 'basic',
			packageManager: 'pnpm',
			typescript: true,
			gitInit: false
		});

		const packageJson = JSON.parse(readFileSync(join(projectPath, 'package.json'), 'utf-8'));
		expect(packageJson.packageManager).toBe('pnpm@9.0.0');
	});

	it('should not add packageManager field for npm', async () => {
		await createProject({
			projectName: 'test-npm-project',
			projectPath,
			template: 'basic',
			packageManager: 'npm',
			typescript: true,
			gitInit: false
		});

		const packageJson = JSON.parse(readFileSync(join(projectPath, 'package.json'), 'utf-8'));
		expect(packageJson.packageManager).toBeUndefined();
	});

	it('should update dependency versions', async () => {
		await createProject({
			projectName: 'test-deps-project',
			projectPath,
			template: 'basic',
			packageManager: 'npm',
			typescript: true,
			gitInit: false
		});

		const packageJson = JSON.parse(readFileSync(join(projectPath, 'package.json'), 'utf-8'));
		expect(packageJson.dependencies.ripple).toBe('^0.2.35');
		expect(packageJson.devDependencies['vite-plugin-ripple']).toBe('^0.2.29');
	});

	it('should handle missing template directory', async () => {
		const invalidTemplatePath = join(testDir, 'non-existent-template');
		
		vi.doMock('../../src/lib/templates.js', () => ({
			getTemplatePath: () => invalidTemplatePath
		}));

		await expect(
			createProject({
				projectName: 'test-project',
				projectPath,
				template: 'non-existent',
				packageManager: 'npm',
				typescript: true,
				gitInit: false
			})
		).rejects.toThrow('Template "non-existent" not found');
	});

	it('should filter out unwanted files during copy', async () => {
		// Add files that should be filtered out
		mkdirSync(join(templatePath, 'node_modules'), { recursive: true });
		writeFileSync(join(templatePath, 'node_modules', 'some-package.js'), 'module content');
		writeFileSync(join(templatePath, 'package-lock.json'), '{}');
		writeFileSync(join(templatePath, 'yarn.lock'), 'yarn lock content');
		writeFileSync(join(templatePath, 'pnpm-lock.yaml'), 'pnpm lock content');

		await createProject({
			projectName: 'test-filter-project',
			projectPath,
			template: 'basic',
			packageManager: 'npm',
			typescript: true,
			gitInit: false
		});

		// Verify filtered files were not copied
		expect(existsSync(join(projectPath, 'node_modules'))).toBe(false);
		expect(existsSync(join(projectPath, 'package-lock.json'))).toBe(false);
		expect(existsSync(join(projectPath, 'yarn.lock'))).toBe(false);
		expect(existsSync(join(projectPath, 'pnpm-lock.yaml'))).toBe(false);

		// Verify other files were copied
		expect(existsSync(join(projectPath, 'package.json'))).toBe(true);
		expect(existsSync(join(projectPath, 'index.html'))).toBe(true);
	});

	it('should handle project creation in existing directory', async () => {
		// Create the directory first
		mkdirSync(projectPath, { recursive: true });
		writeFileSync(join(projectPath, 'existing-file.txt'), 'existing content');

		await createProject({
			projectName: 'test-existing-project',
			projectPath,
			template: 'basic',
			packageManager: 'npm',
			typescript: true,
			gitInit: false
		});

		// Verify project was created successfully
		expect(existsSync(join(projectPath, 'package.json'))).toBe(true);
		expect(existsSync(join(projectPath, 'existing-file.txt'))).toBe(true);
	});
});
