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
	'../ripple-vscode-plugin/syntaxes/ripple.tmLanguage.json'
);
const rippleGrammar = JSON.parse(fs.readFileSync(grammarPath, 'utf8'));

// https://astro.build/config
export default defineConfig({
	integrations: [
		starlight({
			title: 'Ripple',
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/trueadm/ripple' }],
			sidebar: [
				{
					label: 'Introduction',
					items: [
						// Each item here is one entry in the navigation menu.
						{ label: 'Overview', slug: 'intro/overview' },
						{ label: 'Getting started', slug: 'intro/getting-started' }
					]
				}
				// {
				// 	label: 'Reference',
				// 	autogenerate: { directory: 'reference' }
				// }
			]
		})
	],
	markdown: {
		shikiConfig: {
			langs: [{ ...rippleGrammar, name: 'ripple' }]
		}
	}
});
