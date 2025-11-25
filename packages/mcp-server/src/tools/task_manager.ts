import { z } from 'zod';
import { randomUUID } from 'crypto';

const TaskStepSchema = z.object({
	id: z.string(),
	description: z.string(),
	status: z.enum(['pending', 'in_progress', 'completed']),
	dependencies: z.array(z.string()).optional(),
	notes: z.string().optional(),
});

const TaskSchema = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string(),
	steps: z.array(TaskStepSchema),
	template: z.enum(['new_app', 'add_feature', 'refactor', 'custom']).optional(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

type Task = z.infer<typeof TaskSchema>;
type TaskStep = z.infer<typeof TaskStepSchema>;

const tasks = new Map<string, Task>();

const TASK_TEMPLATES: Record<string, Omit<Task, 'id' | 'createdAt' | 'updatedAt'>> = {
	new_app: {
		name: 'Create New Ripple Application',
		description: 'Build a new Ripple application from scratch',
		template: 'new_app',
		steps: [
			{
				id: 'setup',
				description: 'Set up project structure and dependencies',
				status: 'pending',
			},
			{
				id: 'main-component',
				description: 'Create main App component',
				status: 'pending',
				dependencies: ['setup'],
			},
			{
				id: 'routing',
				description: 'Add routing if needed',
				status: 'pending',
				dependencies: ['main-component'],
			},
			{
				id: 'features',
				description: 'Implement core features',
				status: 'pending',
				dependencies: ['routing'],
			},
			{
				id: 'styling',
				description: 'Add styling and polish',
				status: 'pending',
				dependencies: ['features'],
			},
			{
				id: 'testing',
				description: 'Test and verify functionality',
				status: 'pending',
				dependencies: ['styling'],
			},
		],
	},
	add_feature: {
		name: 'Add New Feature',
		description: 'Add a new feature to existing Ripple application',
		template: 'add_feature',
		steps: [
			{
				id: 'analyze',
				description: 'Analyze existing code and requirements',
				status: 'pending',
			},
			{
				id: 'design',
				description: 'Design component structure',
				status: 'pending',
				dependencies: ['analyze'],
			},
			{
				id: 'implement',
				description: 'Implement new components',
				status: 'pending',
				dependencies: ['design'],
			},
			{
				id: 'integrate',
				description: 'Integrate with existing application',
				status: 'pending',
				dependencies: ['implement'],
			},
			{
				id: 'test',
				description: 'Test integration and functionality',
				status: 'pending',
				dependencies: ['integrate'],
			},
			{
				id: 'document',
				description: 'Update documentation',
				status: 'pending',
				dependencies: ['test'],
			},
		],
	},
	refactor: {
		name: 'Refactor Code',
		description: 'Refactor existing Ripple code for better maintainability',
		template: 'refactor',
		steps: [
			{
				id: 'identify',
				description: 'Identify code to refactor',
				status: 'pending',
			},
			{
				id: 'plan',
				description: 'Plan refactoring approach',
				status: 'pending',
				dependencies: ['identify'],
			},
			{
				id: 'extract',
				description: 'Extract reusable components',
				status: 'pending',
				dependencies: ['plan'],
			},
			{
				id: 'update',
				description: 'Update imports and references',
				status: 'pending',
				dependencies: ['extract'],
			},
			{
				id: 'test',
				description: 'Test refactored functionality',
				status: 'pending',
				dependencies: ['update'],
			},
			{
				id: 'cleanup',
				description: 'Clean up old code',
				status: 'pending',
				dependencies: ['test'],
			},
		],
	},
};

// Create task schema
export const CreateTaskSchema = z.object({
	name: z.string().describe('Name of the task'),
	description: z.string().describe('Description of what the task accomplishes'),
	template: z
		.enum(['new_app', 'add_feature', 'refactor', 'custom'])
		.optional()
		.describe('Task template to use'),
	steps: z
		.array(
			z.object({
				id: z.string(),
				description: z.string(),
				dependencies: z.array(z.string()).optional(),
			}),
		)
		.optional()
		.describe('Custom steps (required if template is "custom")'),
});

export const UpdateTaskSchema = z.object({
	taskId: z.string().describe('ID of the task to update'),
	stepId: z.string().describe('ID of the step to update'),
	status: z.enum(['pending', 'in_progress', 'completed']).describe('New status for the step'),
	notes: z.string().optional().describe('Optional notes about the update'),
});

export const GetTaskSchema = z.object({
	taskId: z.string().describe('ID of the task to retrieve'),
});

function getNextSteps(task: Task): TaskStep[] {
	const completedStepIds = new Set(
		task.steps.filter((s) => s.status === 'completed').map((s) => s.id),
	);

	return task.steps.filter((step) => {
		if (step.status === 'completed') return false;
		if (!step.dependencies || step.dependencies.length === 0) return true;
		return step.dependencies.every((depId) => completedStepIds.has(depId));
	});
}

export const ripple_create_task = {
	name: 'ripple_create_task',
	description:
		'Creates a new task for orchestrating complex Ripple projects. Tasks help break down work into manageable steps with dependencies.',
	inputSchema: {
		type: 'object',
		properties: {
			name: {
				type: 'string',
				description: 'Name of the task',
			},
			description: {
				type: 'string',
				description: 'Description of what the task accomplishes',
			},
			template: {
				type: 'string',
				enum: ['new_app', 'add_feature', 'refactor', 'custom'],
				description:
					'Task template: new_app (create new app), add_feature (add to existing app), refactor (improve code), custom (define your own steps)',
			},
			steps: {
				type: 'array',
				description: 'Custom steps (required if template is "custom")',
				items: {
					type: 'object',
					properties: {
						id: { type: 'string' },
						description: { type: 'string' },
						dependencies: {
							type: 'array',
							items: { type: 'string' },
						},
					},
					required: ['id', 'description'],
				},
			},
		},
		required: ['name', 'description'],
	},
	handler: async (args: unknown) => {
		const { name, description, template, steps: customSteps } = CreateTaskSchema.parse(args);

		try {
			const taskId = randomUUID();
			const now = new Date().toISOString();

			let task: Task;

			if (template && template !== 'custom' && TASK_TEMPLATES[template]) {
				const templateTask = TASK_TEMPLATES[template];
				task = {
					...templateTask,
					id: taskId,
					name,
					description,
					createdAt: now,
					updatedAt: now,
				};
			} else if (customSteps) {
				task = {
					id: taskId,
					name,
					description,
					template: 'custom',
					steps: customSteps.map((step) => ({
						...step,
						status: 'pending' as const,
					})),
					createdAt: now,
					updatedAt: now,
				};
			} else {
				throw new Error('Either provide a template or custom steps');
			}

			tasks.set(taskId, task);

			const nextSteps = getNextSteps(task);

			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify(
							{
								taskId: task.id,
								name: task.name,
								description: task.description,
								template: task.template,
								totalSteps: task.steps.length,
								nextSteps: nextSteps.map((s) => ({
									id: s.id,
									description: s.description,
								})),
								progress: {
									completed: 0,
									inProgress: 0,
									pending: task.steps.length,
								},
							},
							null,
							2,
						),
					},
				],
			};
		} catch (error: any) {
			return {
				content: [
					{
						type: 'text',
						text: `Failed to create task: ${error.message}`,
					},
				],
				isError: true,
			};
		}
	},
};

export const ripple_update_task = {
	name: 'ripple_update_task',
	description: 'Updates the status of a task step and optionally adds notes about the progress.',
	inputSchema: {
		type: 'object',
		properties: {
			taskId: {
				type: 'string',
				description: 'ID of the task to update',
			},
			stepId: {
				type: 'string',
				description: 'ID of the step to update',
			},
			status: {
				type: 'string',
				enum: ['pending', 'in_progress', 'completed'],
				description: 'New status for the step',
			},
			notes: {
				type: 'string',
				description: 'Optional notes about the update',
			},
		},
		required: ['taskId', 'stepId', 'status'],
	},
	handler: async (args: unknown) => {
		const { taskId, stepId, status, notes } = UpdateTaskSchema.parse(args);

		try {
			const task = tasks.get(taskId);
			if (!task) {
				throw new Error(`Task not found: ${taskId}`);
			}

			const step = task.steps.find((s) => s.id === stepId);
			if (!step) {
				throw new Error(`Step not found: ${stepId}`);
			}

			step.status = status;
			if (notes) {
				step.notes = notes;
			}
			task.updatedAt = new Date().toISOString();

			const nextSteps = getNextSteps(task);
			const progress = {
				completed: task.steps.filter((s) => s.status === 'completed').length,
				inProgress: task.steps.filter((s) => s.status === 'in_progress').length,
				pending: task.steps.filter((s) => s.status === 'pending').length,
			};

			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify(
							{
								taskId: task.id,
								stepId: step.id,
								newStatus: status,
								notes: step.notes,
								progress,
								nextSteps: nextSteps.map((s) => ({
									id: s.id,
									description: s.description,
								})),
								isComplete: progress.completed === task.steps.length,
							},
							null,
							2,
						),
					},
				],
			};
		} catch (error: any) {
			return {
				content: [
					{
						type: 'text',
						text: `Failed to update task: ${error.message}`,
					},
				],
				isError: true,
			};
		}
	},
};

export const ripple_get_task = {
	name: 'ripple_get_task',
	description:
		'Retrieves the current state of a task, including all steps, progress, and next actions.',
	inputSchema: {
		type: 'object',
		properties: {
			taskId: {
				type: 'string',
				description: 'ID of the task to retrieve',
			},
		},
		required: ['taskId'],
	},
	handler: async (args: unknown) => {
		const { taskId } = GetTaskSchema.parse(args);

		try {
			const task = tasks.get(taskId);
			if (!task) {
				throw new Error(`Task not found: ${taskId}`);
			}

			const nextSteps = getNextSteps(task);
			const progress = {
				completed: task.steps.filter((s) => s.status === 'completed').length,
				inProgress: task.steps.filter((s) => s.status === 'in_progress').length,
				pending: task.steps.filter((s) => s.status === 'pending').length,
			};

			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify(
							{
								task: {
									id: task.id,
									name: task.name,
									description: task.description,
									template: task.template,
									createdAt: task.createdAt,
									updatedAt: task.updatedAt,
								},
								steps: task.steps,
								progress,
								nextSteps: nextSteps.map((s) => ({
									id: s.id,
									description: s.description,
									dependencies: s.dependencies,
								})),
								isComplete: progress.completed === task.steps.length,
							},
							null,
							2,
						),
					},
				],
			};
		} catch (error: any) {
			return {
				content: [
					{
						type: 'text',
						text: `Failed to get task: ${error.message}`,
					},
				],
				isError: true,
			};
		}
	},
};
