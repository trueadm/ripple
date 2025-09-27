import { describe, it, beforeEach, vi, expect } from 'vitest';
import * as promptsModule from '../../src/lib/prompts.js';
import * as projectCreator from '../../src/lib/project-creator.js';
import { createCommand } from '../../src/commands/create.js';
import * as validation from '../../src/lib/validation.js';
import * as templates from '../../src/lib/templates.js';

// Mock fs module
vi.mock('node:fs', () => ({
	existsSync: vi.fn(),
}));

import { existsSync } from 'node:fs';

// Mock kleur/colors
vi.mock('kleur/colors', () => ({
	red: (t) => t,
	green: (t) => t,
	cyan: (t) => t,
	dim: (t) => t,
}));

// Mock process.exit
const mockExit = vi.fn();
Object.defineProperty(process, 'exit', { value: mockExit, writable: true });

// Mock console.log
const mockConsoleLog = vi.fn();
global.console = { ...console, log: mockConsoleLog };

describe('createCommand', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should create a project with default options', async () => {
		// Mock prompts
		vi.spyOn(promptsModule, 'promptProjectName').mockResolvedValue('my-app');
		vi.spyOn(promptsModule, 'promptTemplate').mockResolvedValue('basic');
		vi.spyOn(promptsModule, 'promptPackageManager').mockResolvedValue('npm');
		vi.spyOn(promptsModule, 'promptGitInit').mockResolvedValue(true);
		vi.spyOn(promptsModule, 'promptStylingFramework').mockResolvedValue('vanilla');

		// Mock validation
		vi.spyOn(validation, 'validateProjectName').mockReturnValue({ valid: true });

		// Mock template validation
		vi.spyOn(templates, 'validateTemplate').mockReturnValue(true);
		vi.spyOn(templates, 'getTemplateNames').mockReturnValue(['basic']);

		// Mock filesystem
		existsSync.mockReturnValue(false);

		// Mock project creation
		vi.spyOn(projectCreator, 'createProject').mockResolvedValue();

		await createCommand(undefined, {});

		expect(projectCreator.createProject).toHaveBeenCalledWith(
			expect.objectContaining({
				projectName: 'my-app',
				template: 'basic',
				packageManager: 'npm',
				gitInit: true,
				stylingFramework: 'vanilla',
				typescript: true,
			}),
		);

		expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Success!'));
	});

	it('should create a project with CLI options provided', async () => {
		// Mock validation
		vi.spyOn(validation, 'validateProjectName').mockReturnValue({ valid: true });
		vi.spyOn(templates, 'validateTemplate').mockReturnValue(true);
		vi.spyOn(templates, 'getTemplateNames').mockReturnValue(['basic']);

		// Mock filesystem - directory doesn't exist
		existsSync.mockReturnValue(false);

		// Mock project creation
		vi.spyOn(projectCreator, 'createProject').mockResolvedValue();

		// Call with CLI options (no prompts should be called)
		await createCommand('my-cli-app', {
			template: 'basic',
			packageManager: 'pnpm',
			git: false, // --no-git flag
			yes: true, // --yes flag
		});

		// Verify createProject was called with CLI-provided options
		expect(projectCreator.createProject).toHaveBeenCalledWith(
			expect.objectContaining({
				projectName: 'my-cli-app',
				template: 'basic',
				packageManager: 'pnpm',
				gitInit: false, // Should be false due to --no-git
				stylingFramework: 'vanilla', // Default when --yes is used
				typescript: true,
			}),
		);

		// Verify no prompts were called since options were provided
		expect(promptsModule.promptProjectName).not.toHaveBeenCalled();
		expect(promptsModule.promptTemplate).not.toHaveBeenCalled();
		expect(promptsModule.promptPackageManager).not.toHaveBeenCalled();
		expect(promptsModule.promptGitInit).not.toHaveBeenCalled();
		expect(promptsModule.promptStylingFramework).not.toHaveBeenCalled();

		// Verify success message
		expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Success!'));
	});

	it('should exit if project name is invalid', async () => {
		vi.spyOn(validation, 'validateProjectName').mockReturnValue({
			valid: false,
			message: 'Invalid name',
		});

		await createCommand('Invalid Name!', {});

		expect(mockExit).toHaveBeenCalledWith(1);
	});

	it('should exit if template is invalid', async () => {
		vi.spyOn(validation, 'validateProjectName').mockReturnValue({ valid: true });
		vi.spyOn(templates, 'validateTemplate').mockReturnValue(false);
		vi.spyOn(templates, 'getTemplateNames').mockReturnValue(['basic']);

		await createCommand('my-app', { template: 'unknown' });

		expect(mockExit).toHaveBeenCalledWith(1);
	});

	it('should prompt overwrite if directory exists', async () => {
		vi.spyOn(validation, 'validateProjectName').mockReturnValue({ valid: true });
		vi.spyOn(templates, 'validateTemplate').mockReturnValue(true);
		vi.spyOn(templates, 'getTemplateNames').mockReturnValue(['basic']);

		// Mock filesystem to simulate existing directory
		existsSync.mockReturnValue(true);

		// Mock prompts
		vi.spyOn(promptsModule, 'promptOverwrite').mockResolvedValue(true);
		vi.spyOn(promptsModule, 'promptProjectName').mockResolvedValue('my-app');
		vi.spyOn(promptsModule, 'promptTemplate').mockResolvedValue('basic');
		vi.spyOn(promptsModule, 'promptPackageManager').mockResolvedValue('npm');
		vi.spyOn(promptsModule, 'promptGitInit').mockResolvedValue(true);
		vi.spyOn(promptsModule, 'promptStylingFramework').mockResolvedValue('vanilla');

		// Mock project creation
		vi.spyOn(projectCreator, 'createProject').mockResolvedValue();

		await createCommand('my-app', {});

		expect(promptsModule.promptOverwrite).toHaveBeenCalled();
		expect(projectCreator.createProject).toHaveBeenCalled();
	});
});
