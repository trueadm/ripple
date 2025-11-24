import { z } from 'zod';
import { parse } from 'ripple/compiler';

export const ParseSchema = z.object({
	code: z.string(),
});

export const ripple_parse = {
	name: 'ripple_parse',
	description: 'Parses Ripple source code to ESTree AST',
	inputSchema: {
		type: 'object',
		properties: {
			code: {
				type: 'string',
				description: 'The Ripple source code to parse',
			},
		},
		required: ['code'],
	},
	handler: async (args: unknown) => {
		const { code } = ParseSchema.parse(args);
		try {
			const ast = parse(code);
			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify(ast, null, 2),
					},
				],
			};
		} catch (error: any) {
			return {
				content: [
					{
						type: 'text',
						text: `Parsing failed: ${error.message}`,
					},
				],
				isError: true,
			};
		}
	},
};
