import { z } from 'zod';
import { compile } from 'ripple/compiler';

export const CompileSchema = z.object({
	code: z.string(),
	filename: z.string(),
	mode: z.enum(['client', 'server']).optional(),
});

export const ripple_compile = {
	name: 'ripple_compile',
	description: 'Compiles Ripple source code to JavaScript and CSS',
	inputSchema: {
		type: 'object',
		properties: {
			code: {
				type: 'string',
				description: 'The Ripple source code to compile',
			},
			filename: {
				type: 'string',
				description: 'The filename for source map generation',
			},
			mode: {
				type: 'string',
				enum: ['client', 'server'],
				description: 'Compilation mode (default: client)',
			},
		},
		required: ['code', 'filename'],
	},
	handler: async (args: unknown) => {
		const { code, filename, mode } = CompileSchema.parse(args);
		try {
			const result = compile(code, filename, { mode: mode || 'client' });
			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify(
							{
								js: result.js.code,
								css: result.css,
								map: result.js.map,
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
						text: `Compilation failed: ${error.message}`,
					},
				],
				isError: true,
			};
		}
	},
};
