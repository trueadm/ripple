import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as prompts from 'prompts';

// Mock prompts module
vi.mock('prompts', () => ({
	default: vi.fn()
}));

// Mock kleur colors
vi.mock('kleur/colors', () => ({
	red: vi.fn((text) => text)
}));

// Mock process.exit
const mockExit = vi.fn();
Object.defineProperty(process, 'exit', {
	value: mockExit,
	writable: true
});

// Mock console.log
const mockConsoleLog = vi.fn();
global.console = { ...console, log: mockConsoleLog };

import {
	promptProjectName,
	promptTemplate,
	promptOverwrite,
	promptPackageManager,
	promptTypeScript,
	promptGitInit,
	promptStylingFramework
} from '../../src/lib/prompts.js';

describe('Prompts', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	describe('promptProjectName', () => {
		it('should return project name when valid input provided', async () => {
			prompts.default.mockResolvedValue({ projectName: 'my-app' });

			const result = await promptProjectName();
			expect(result).toBe('my-app');
			expect(prompts.default).toHaveBeenCalledWith({
				type: 'text',
				name: 'projectName',
				message: 'What is your project named?',
				initial: 'my-ripple-app',
				validate: expect.any(Function)
			});
		});

		it('should use custom default name', async () => {
			prompts.default.mockResolvedValue({ projectName: 'custom-app' });

			await promptProjectName('custom-default');
			expect(prompts.default).toHaveBeenCalledWith(
				expect.objectContaining({
					initial: 'custom-default'
				})
			);
		});

		it('should exit when user cancels', async () => {
			prompts.default.mockResolvedValue({});

			await promptProjectName();
			expect(mockExit).toHaveBeenCalledWith(1);
			expect(mockConsoleLog).toHaveBeenCalledWith('✖ Operation cancelled');
		});

		it('should validate project name input', async () => {
			prompts.default.mockResolvedValue({ projectName: 'valid-name' });

			await promptProjectName();
			const call = prompts.default.mock.calls[0][0];
			const validate = call.validate;

			expect(validate('valid-name')).toBe(true);
			expect(validate('Invalid Name!')).toBe(
				'Project name can only contain lowercase letters, numbers, hyphens, dots, and underscores'
			);
		});
	});

	describe('promptTemplate', () => {
		it('should return selected template', async () => {
			prompts.default.mockResolvedValue({ template: 'basic' });

			const result = await promptTemplate();
			expect(result).toBe('basic');
			expect(prompts.default).toHaveBeenCalledWith({
				type: 'select',
				name: 'template',
				message: 'Which template would you like to use?',
				choices: expect.any(Array),
				initial: 0
			});
		});

		it('should exit when user cancels', async () => {
			prompts.default.mockResolvedValue({});

			await promptTemplate();
			expect(mockExit).toHaveBeenCalledWith(1);
			expect(mockConsoleLog).toHaveBeenCalledWith('✖ Operation cancelled');
		});
	});

	describe('promptOverwrite', () => {
		it('should return overwrite decision', async () => {
			prompts.default.mockResolvedValue({ overwrite: true });

			const result = await promptOverwrite('test-project');
			expect(result).toBe(true);
			expect(prompts.default).toHaveBeenCalledWith({
				type: 'confirm',
				name: 'overwrite',
				message: 'Directory "test-project" already exists. Continue anyway?',
				initial: false
			});
		});

		it('should exit when user cancels', async () => {
			prompts.default.mockResolvedValue({});

			await promptOverwrite('test-project');
			expect(mockExit).toHaveBeenCalledWith(1);
		});
	});

	describe('promptPackageManager', () => {
		it('should return selected package manager', async () => {
			prompts.default.mockResolvedValue({ packageManager: 'pnpm' });

			const result = await promptPackageManager();
			expect(result).toBe('pnpm');
			expect(prompts.default).toHaveBeenCalledWith({
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
		});

		it('should exit when user cancels', async () => {
			prompts.default.mockResolvedValue({});

			await promptPackageManager();
			expect(mockExit).toHaveBeenCalledWith(1);
		});
	});

	describe('promptTypeScript', () => {
		it('should return TypeScript preference', async () => {
			prompts.default.mockResolvedValue({ typescript: false });

			const result = await promptTypeScript();
			expect(result).toBe(false);
			expect(prompts.default).toHaveBeenCalledWith({
				type: 'confirm',
				name: 'typescript',
				message: 'Would you like to use TypeScript?',
				initial: true
			});
		});

		it('should exit when user cancels', async () => {
			prompts.default.mockResolvedValue({});

			await promptTypeScript();
			expect(mockExit).toHaveBeenCalledWith(1);
		});
	});

	describe('promptGitInit', () => {
		it('should return Git initialization preference', async () => {
			prompts.default.mockResolvedValue({ gitInit: false });

			const result = await promptGitInit();
			expect(result).toBe(false);
			expect(prompts.default).toHaveBeenCalledWith({
				type: 'confirm',
				name: 'gitInit',
				message: 'Initialize a new Git repository?',
				initial: true
			});
		});

		it('should exit when user cancels', async () => {
			prompts.default.mockResolvedValue({});

			await promptGitInit();
			expect(mockExit).toHaveBeenCalledWith(1);
		});
	});
	describe('promptStylingFramework', () => {
		it('should return selected styling framework', async () => {
			prompts.default.mockResolvedValue({ stylingFramework: 'tailwind' });

			const result = await promptStylingFramework();
			expect(result).toBe('tailwind');
			expect(prompts.default).toHaveBeenCalledWith({
				type: 'select',
				name: 'stylingFramework',
				message: 'Which styling framework would you like to integrate with Ripple?',
				choices: [{
					title: 'css',
					value: 'vanilla',
					description: 'Use Vanilla CSS for styling your components'
				}, {
					title: 'bs',
					value: 'bootStrap',
					description: 'Use BootStrap classes to style your components'
				}, {
					title: 'tw',
					value: 'tailWind',
					description: 'Use TailWindCSS to style your components'
				}]
			});
		});

		it('should return undefined when user cancels', async () => {
			prompts.default.mockResolvedValue({ stylingFramework: undefined });
			const result = await promptStylingFramework();
			expect(result).toBeUndefined();
		});
	});
});
