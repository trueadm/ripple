// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const grammarPath = path.resolve(
	__dirname,
	'../packages/ripple-vscode-plugin/syntaxes/ripple.tmLanguage.json',
);
const rippleGrammar = JSON.parse(fs.readFileSync(grammarPath, 'utf8'));

// https://astro.build/config
export default defineConfig({
	base: '/docs',
	redirects: { '/': '/docs/intro/overview' },
	integrations: [
		starlight({
			title: 'Ripple',
			expressiveCode: {
				themes: ['tokyo-night', 'catppuccin-latte'],
			},
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/trueadm/ripple' }],
			sidebar: [
				{
					label: 'Introduction',
					items: [
						{ label: 'Overview', slug: 'intro/overview' },
						{ label: 'Getting started', slug: 'intro/getting-started' },
					],
				},
				{
					label: 'Reactivity',
					items: [
						{ label: "Ripple's reactivity model", slug: 'reactivity' },
						{ label: 'Effects', slug: 'reactivity/effects' },
					],
				},
				{
					label: 'Template syntax',
					items: [
						{ label: 'Ripple components', slug: 'template-syntax/ripple-components' },
						{ label: 'Templating', slug: 'template-syntax' },
						{ label: 'If block', slug: 'template-syntax/if-block' },
						{ label: 'For block', slug: 'template-syntax/for-block' },
						{ label: 'Try, catch block', slug: 'template-syntax/try-catch-block' },
						{ label: 'Event handling', slug: 'template-syntax/event-handling' },
					],
				},
				// {
				// 	label: 'Reference',
				// 	autogenerate: { directory: 'reference' }
				// }
			],
		}),
	],
	markdown: {
		shikiConfig: {
			langs: [{ ...rippleGrammar, name: 'ripple' }, 'css', 'javascript', 'typescript'],
			themes: {
				light: 'catppuccin-latte',
				dark: 'tokyo-night',
			},
		},
	},
});
