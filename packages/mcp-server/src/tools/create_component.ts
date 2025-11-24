import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

export const CreateComponentSchema = z.object({
	name: z.string(),
	content: z.string(),
	path: z.string().optional(),
});

export const ripple_create_component = {
	name: 'ripple_create_component',
	description: 'Creates a new Ripple component file',
	inputSchema: {
		type: 'object',
		properties: {
			name: {
				type: 'string',
				description: 'The name of the component (e.g., "Button")',
			},
			content: {
				type: 'string',
				description: 'The content of the component',
			},
			path: {
				type: 'string',
				description: 'The directory path to create the component in (optional)',
			},
		},
		required: ['name', 'content'],
	},
	handler: async (args: unknown) => {
		const { name, content, path: dirPath } = CreateComponentSchema.parse(args);
		try {
			const fileName = `${name}.ripple`;
			const fullPath = dirPath
				? path.join(dirPath, fileName)
				: path.resolve(process.cwd(), fileName);

			// Ensure directory exists
			await fs.mkdir(path.dirname(fullPath), { recursive: true });
			await fs.writeFile(fullPath, content, 'utf-8');

			return {
				content: [
					{
						type: 'text',
						text: `Component ${name} created at ${fullPath}`,
					},
				],
			};
		} catch (error: any) {
			return {
				content: [
					{
						type: 'text',
						text: `Failed to create component: ${error.message}`,
					},
				],
				isError: true,
			};
		}
	},
};
