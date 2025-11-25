import { z } from 'zod';

export const GeneratePlaygroundLinkSchema = z.object({
	code: z.string().describe('The Ripple source code to encode in the playground link'),
	title: z.string().optional().describe('Optional title for the playground'),
	version: z.string().optional().describe('Optional Ripple version (e.g., "0.2.175")'),
});

export const ripple_generate_playground_link = {
	name: 'ripple_generate_playground_link',
	description:
		'Generates a shareable Ripple playground link with the provided code. The link can be used to share code examples or demos.',
	inputSchema: {
		type: 'object',
		properties: {
			code: {
				type: 'string',
				description: 'The Ripple source code to encode in the playground link',
			},
			title: {
				type: 'string',
				description: 'Optional title for the playground (e.g., "Counter App")',
			},
			version: {
				type: 'string',
				description: 'Optional Ripple version (e.g., "0.2.175"). Defaults to latest.',
			},
		},
		required: ['code'],
	},
	handler: async (args: unknown) => {
		const { code, title, version } = GeneratePlaygroundLinkSchema.parse(args);

		try {
			const base64Code = Buffer.from(code, 'utf-8').toString('base64');
			const encodedCode = encodeURIComponent(base64Code);

			const baseUrl = 'https://www.ripplejs.com/playground';
			const params = new URLSearchParams();

			if (version) {
				params.append('v', version);
			}
			if (title) {
				params.append('title', title);
			}

			const queryString = params.toString();
			const hash = `config=code%2F${encodedCode}`;

			const fullUrl = `${baseUrl}${queryString ? '?' + queryString : ''}#${hash}`;
			const shortUrl = `ripplejs.com/playground${queryString ? '?' + queryString : ''}#config=code/...`;

			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify(
							{
								url: fullUrl,
								shortUrl,
								title: title || 'Untitled',
								version: version || 'latest',
								codeLength: code.length,
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
						text: `Failed to generate playground link: ${error.message}`,
					},
				],
				isError: true,
			};
		}
	},
};
