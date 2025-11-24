import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import prompts from 'prompts';

// Mock prompts module
vi.mock('prompts', () => ({
	default: vi.fn(),
}));

// Mock kleur colors
vi.mock('kleur/colors', () => ({
	red: vi.fn((text) => text),
}));

// Mock templates
vi.mock('../../src/lib/templates.js', () => ({
	getTemplateChoices: vi.fn(() => [
		{
			title: 'Basic Ripple App',
			description: 'A minimal Ripple application with Vite and TypeScript',
			value: 'basic',
		},
	]),
}));

// Mock process.exit
const mockExit = vi.fn();
Object.defineProperty(process, 'exit', {
	value: mockExit,
	writable: true,
});

// Mock console.log
const mockConsoleLog = vi.fn();
global.console = { ...console, log: mockConsoleLog };

import {
	promptProjectName,
	promptTemplate,
	promptPackageManager,
	promptTypeScript,
	promptGitInit,
	promptStylingFramework,
} from '../../src/lib/prompts.js';
import * as templates from '../../src/lib/templates.js';
import { getCurrentPackageManager } from '../../src/lib/package-manager.js';

const mockedPrompts = /** @type {import('vitest').MockedFunction<typeof prompts>} */ (prompts);
const mockedGetTemplateChoices =
	/** @type {import('vitest').MockedFunction<typeof templates.getTemplateChoices>} */ (
		templates.getTemplateChoices
	);

describe('Prompts', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	describe('promptProjectName', () => {
		it('should return project name when valid input provided', async () => {
			mockedPrompts.mockResolvedValue({ projectName: 'my-app' });

			const result = await promptProjectName();
			expect(result).toBe('my-app');
			expect(mockedPrompts).toHaveBeenCalledWith({
				type: 'text',
				name: 'projectName',
				message: 'What is your project named?',
				initial: 'my-ripple-app',
				validate: expect.any(Function),
			});
		});

		it('should use custom default name', async () => {
			mockedPrompts.mockResolvedValue({ projectName: 'custom-app' });

			await promptProjectName('custom-default');
			expect(mockedPrompts).toHaveBeenCalledWith(
				expect.objectContaining({
					initial: 'custom-default',
				}),
			);
		});

		it('should exit when user cancels', async () => {
			mockedPrompts.mockResolvedValue({});

			await promptProjectName();
			expect(mockExit).toHaveBeenCalledWith(1);
			expect(mockConsoleLog).toHaveBeenCalledWith('✖ Operation cancelled');
		});

		it('should validate project name input', async () => {
			mockedPrompts.mockResolvedValue({ projectName: 'valid-name' });

			await promptProjectName();
			const call = /** @type {any} */ (mockedPrompts.mock.calls[0][0]);
			const validate = call.validate;

			expect(validate('valid-name')).toBe(true);
			expect(validate('Invalid Name!')).toBe(
				'Project name can only contain lowercase letters, numbers, hyphens, dots, and underscores',
			);
		});
	});

	describe('promptTemplate', () => {
		it('should return the template directly when only one is available', async () => {
			mockedGetTemplateChoices.mockReturnValue([
				{
					title: 'Basic Ripple App',
					description: 'A minimal Ripple application with Vite and TypeScript',
					value: 'basic',
				},
			]);

			const result = await promptTemplate();
			expect(result).toBe('basic');
			expect(mockedPrompts).not.toHaveBeenCalled();
		});

		it('should prompt user when multiple templates are available', async () => {
			mockedGetTemplateChoices.mockReturnValue([
				{
					title: 'Basic Ripple App',
					description: 'A minimal Ripple application',
					value: 'basic',
				},
				{
					title: 'Advanced Ripple App',
					description: 'An advanced Ripple application',
					value: 'advanced',
				},
			]);
			mockedPrompts.mockResolvedValue({ template: 'advanced' });

			const result = await promptTemplate();
			expect(result).toBe('advanced');
			expect(mockedPrompts).toHaveBeenCalledWith({
				type: 'select',
				name: 'template',
				message: 'Which template would you like to use?',
				choices: expect.any(Array),
				initial: 0,
			});
		});

		it('should exit when user cancels with multiple templates', async () => {
			mockedGetTemplateChoices.mockReturnValue([
				{
					title: 'Basic Ripple App',
					description: 'A minimal Ripple application',
					value: 'basic',
				},
				{
					title: 'Advanced Ripple App',
					description: 'An advanced Ripple application',
					value: 'advanced',
				},
			]);
			mockedPrompts.mockResolvedValue({});

			await promptTemplate();
			expect(mockExit).toHaveBeenCalledWith(1);
			expect(mockConsoleLog).toHaveBeenCalledWith('✖ Operation cancelled');
		});
	});

	describe('promptPackageManager', () => {
		it('should return selected package manager', async () => {
			mockedPrompts.mockResolvedValue({ packageManager: 'pnpm' });

			const detected = getCurrentPackageManager();
			const result = await promptPackageManager(detected);
			expect(result).toBe('pnpm');
			expect(mockedPrompts).toHaveBeenCalledWith({
				type: 'select',
				name: 'packageManager',
				message: 'Which package manager would you like to use?',
				choices: [
					{ title: 'npm', value: 'npm', description: 'Use npm for dependency management' },
					{ title: 'yarn', value: 'yarn', description: 'Use Yarn for dependency management' },
					{ title: 'pnpm', value: 'pnpm', description: 'Use pnpm for dependency management' },
					{ title: 'bun', value: 'bun', description: 'Use bun for dependency management' },
				],
				initial: ['npm', 'yarn', 'pnpm', 'bun'].indexOf(detected),
			});
		});

		it('should exit when user cancels', async () => {
			mockedPrompts.mockResolvedValue({});

			const detected = getCurrentPackageManager();
			await promptPackageManager(detected);
			expect(mockExit).toHaveBeenCalledWith(1);
		});
	});

	describe('promptTypeScript', () => {
		it('should return TypeScript preference', async () => {
			mockedPrompts.mockResolvedValue({ typescript: false });

			const result = await promptTypeScript();
			expect(result).toBe(false);
			expect(mockedPrompts).toHaveBeenCalledWith({
				type: 'confirm',
				name: 'typescript',
				message: 'Would you like to use TypeScript?',
				initial: true,
			});
		});

		it('should exit when user cancels', async () => {
			mockedPrompts.mockResolvedValue({});

			await promptTypeScript();
			expect(mockExit).toHaveBeenCalledWith(1);
		});
	});

	describe('promptGitInit', () => {
		it('should return Git initialization preference', async () => {
			mockedPrompts.mockResolvedValue({ gitInit: true });
			const result = await promptGitInit();
			expect(result).toBe(true);
			expect(mockedPrompts).toHaveBeenCalledWith({
				type: 'confirm',
				name: 'gitInit',
				message: 'Initialize a new Git repository?',
				initial: true,
			});
		});

		it('should exit when user cancels', async () => {
			mockedPrompts.mockResolvedValue({});
			await promptGitInit();
			expect(mockExit).toHaveBeenCalledWith(1);
		});
	});

	describe('promptGitInit', () => {
		it('should return Git initialization preference as false', async () => {
			mockedPrompts.mockResolvedValue({ gitInit: false });
			const result = await promptGitInit();
			expect(result).toBe(false);
			expect(mockedPrompts).toHaveBeenCalledWith({
				type: 'confirm',
				name: 'gitInit',
				message: 'Initialize a new Git repository?',
				initial: true,
			});
		});

		it('should exit when user cancels', async () => {
			mockedPrompts.mockResolvedValue({});
			await promptGitInit();
			expect(mockExit).toHaveBeenCalledWith(1);
		});
	});

	describe('promptStylingFramework', () => {
		it('should return selected styling framework', async () => {
			mockedPrompts.mockResolvedValue({ stylingFramework: 'tailwind' });

			const result = await promptStylingFramework();
			expect(result).toBe('tailwind');
			expect(mockedPrompts).toHaveBeenCalledWith({
				type: 'select',
				name: 'stylingFramework',
				message: 'Which styling framework would you like to integrate with Ripple?',
				choices: [
					{
						title: 'Vanilla CSS',
						value: 'vanilla',
						description: 'Use Vanilla CSS for styling your components',
					},
					{
						title: 'Bootstrap',
						value: 'bootstrap',
						description: 'Use Bootstrap classes to style your components',
					},
					{
						title: 'TailwindCSS',
						value: 'tailwind',
						description: 'Use TailwindCSS to style your components',
					},
				],
			});
		});

		it('should return undefined when user cancels', async () => {
			mockedPrompts.mockResolvedValue({ stylingFramework: undefined });
			const result = await promptStylingFramework();
			expect(result).toBeUndefined();
		});
	});
});
