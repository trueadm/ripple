import { describe, it, expect, beforeEach } from 'vitest';
import {
	ripple_create_task,
	ripple_update_task,
	ripple_get_task,
} from '../src/tools/task_manager.js';

describe('Task Manager', () => {
	describe('ripple_create_task', () => {
		it('should have correct metadata', () => {
			expect(ripple_create_task.name).toBe('ripple_create_task');
			expect(ripple_create_task.description).toBeTruthy();
			expect(ripple_create_task.inputSchema).toBeDefined();
		});

		it('should create task with new_app template', async () => {
			const result = await ripple_create_task.handler({
				name: 'Build Counter App',
				description: 'Create a simple counter application',
				template: 'new_app',
			});

			expect(result.isError).toBeFalsy();
			const data = JSON.parse(result.content[0].text);

			expect(data.taskId).toBeDefined();
			expect(data.name).toBe('Build Counter App');
			expect(data.template).toBe('new_app');
			expect(data.totalSteps).toBeGreaterThan(0);
			expect(data.nextSteps).toBeDefined();
			expect(data.progress.pending).toBe(data.totalSteps);
			expect(data.progress.completed).toBe(0);
		});

		it('should create task with add_feature template', async () => {
			const result = await ripple_create_task.handler({
				name: 'Add Dark Mode',
				description: 'Add dark mode toggle to existing app',
				template: 'add_feature',
			});

			const data = JSON.parse(result.content[0].text);

			expect(data.template).toBe('add_feature');
			expect(data.totalSteps).toBeGreaterThan(0);
		});

		it('should create task with refactor template', async () => {
			const result = await ripple_create_task.handler({
				name: 'Refactor Components',
				description: 'Extract reusable components',
				template: 'refactor',
			});

			const data = JSON.parse(result.content[0].text);

			expect(data.template).toBe('refactor');
			expect(data.totalSteps).toBeGreaterThan(0);
		});

		it('should create custom task with provided steps', async () => {
			const result = await ripple_create_task.handler({
				name: 'Custom Task',
				description: 'A custom workflow',
				template: 'custom',
				steps: [
					{ id: 'step1', description: 'First step' },
					{ id: 'step2', description: 'Second step', dependencies: ['step1'] },
					{ id: 'step3', description: 'Third step', dependencies: ['step2'] },
				],
			});

			const data = JSON.parse(result.content[0].text);

			expect(data.template).toBe('custom');
			expect(data.totalSteps).toBe(3);
			expect(data.nextSteps).toHaveLength(1); // Only step1 has no dependencies
			expect(data.nextSteps[0].id).toBe('step1');
		});

		it('should return error if custom template without steps', async () => {
			const result = await ripple_create_task.handler({
				name: 'Invalid Task',
				description: 'Missing steps',
				template: 'custom',
			});

			expect(result.isError).toBe(true);
		});
	});

	describe('ripple_update_task', () => {
		it('should update task step status', async () => {
			// Create a task first
			const createResult = await ripple_create_task.handler({
				name: 'Test Task',
				description: 'Test',
				template: 'new_app',
			});

			const createData = JSON.parse(createResult.content[0].text);
			const taskId = createData.taskId;
			const firstStepId = createData.nextSteps[0].id;

			// Update the first step
			const updateResult = await ripple_update_task.handler({
				taskId,
				stepId: firstStepId,
				status: 'completed',
				notes: 'Completed successfully',
			});

			expect(updateResult.isError).toBeFalsy();
			const updateData = JSON.parse(updateResult.content[0].text);

			expect(updateData.stepId).toBe(firstStepId);
			expect(updateData.newStatus).toBe('completed');
			expect(updateData.notes).toBe('Completed successfully');
			expect(updateData.progress.completed).toBe(1);
		});

		it('should unlock dependent steps when dependency completes', async () => {
			// Create custom task with dependencies
			const createResult = await ripple_create_task.handler({
				name: 'Dependent Task',
				description: 'Test dependencies',
				template: 'custom',
				steps: [
					{ id: 'step1', description: 'First' },
					{ id: 'step2', description: 'Second', dependencies: ['step1'] },
				],
			});

			const createData = JSON.parse(createResult.content[0].text);
			const taskId = createData.taskId;

			// Initially, only step1 should be available
			expect(createData.nextSteps).toHaveLength(1);
			expect(createData.nextSteps[0].id).toBe('step1');

			// Complete step1
			const updateResult = await ripple_update_task.handler({
				taskId,
				stepId: 'step1',
				status: 'completed',
			});

			const updateData = JSON.parse(updateResult.content[0].text);

			// Now step2 should be available
			expect(updateData.nextSteps).toHaveLength(1);
			expect(updateData.nextSteps[0].id).toBe('step2');
		});

		it('should return error for non-existent task', async () => {
			const result = await ripple_update_task.handler({
				taskId: 'non-existent-id',
				stepId: 'step1',
				status: 'completed',
			});

			expect(result.isError).toBe(true);
			expect(result.content[0].text).toContain('Task not found');
		});
	});

	describe('ripple_get_task', () => {
		it('should retrieve task details', async () => {
			// Create a task
			const createResult = await ripple_create_task.handler({
				name: 'Retrieve Test',
				description: 'Test retrieval',
				template: 'new_app',
			});

			const createData = JSON.parse(createResult.content[0].text);
			const taskId = createData.taskId;

			// Retrieve the task
			const getResult = await ripple_get_task.handler({ taskId });

			expect(getResult.isError).toBeFalsy();
			const getData = JSON.parse(getResult.content[0].text);

			expect(getData.task.id).toBe(taskId);
			expect(getData.task.name).toBe('Retrieve Test');
			expect(getData.steps).toBeDefined();
			expect(getData.progress).toBeDefined();
			expect(getData.nextSteps).toBeDefined();
			expect(getData.isComplete).toBe(false);
		});

		it('should show task as complete when all steps done', async () => {
			// Create a simple custom task
			const createResult = await ripple_create_task.handler({
				name: 'Simple Task',
				description: 'One step task',
				template: 'custom',
				steps: [{ id: 'only-step', description: 'Only step' }],
			});

			const createData = JSON.parse(createResult.content[0].text);
			const taskId = createData.taskId;

			// Complete the step
			await ripple_update_task.handler({
				taskId,
				stepId: 'only-step',
				status: 'completed',
			});

			// Get task
			const getResult = await ripple_get_task.handler({ taskId });
			const getData = JSON.parse(getResult.content[0].text);

			expect(getData.isComplete).toBe(true);
			expect(getData.progress.completed).toBe(1);
		});

		it('should return error for non-existent task', async () => {
			const result = await ripple_get_task.handler({ taskId: 'non-existent' });

			expect(result.isError).toBe(true);
			expect(result.content[0].text).toContain('Task not found');
		});
	});
});
