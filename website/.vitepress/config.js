import { defineConfig } from 'vitepress'
import { tabsMarkdownPlugin } from 'vitepress-plugin-tabs'
import { npmCommandsMarkdownPlugin } from 'vitepress-plugin-npm-commands'
/** @import { DefaultTheme } from 'vitepress'; */

import rippleGrammar from "../../packages/ripple-vscode-plugin/syntaxes/ripple.tmLanguage.json"
const modifiedGrammar = {
	...rippleGrammar,
	embeddedLangs: [
		'jsx',
		'tsx',
		'css',
	],
}

export default defineConfig({
	title: 'Ripple',
	description: 'The elegant JSX view library',

	markdown: {
		config(md) {
			md.use(tabsMarkdownPlugin)
			md.use(npmCommandsMarkdownPlugin)
		},
		languages: ['jsx', 'js', 'tsx', 'ts', 'css', 'sh', 'bash'],
		async shikiSetup(highlighter) {
			await highlighter.loadLanguage(modifiedGrammar)

			/**
			 * we have to duplicate the instance with a different name here,
			 * because trying to insert an alias instead causes shiki to complain
			 * that the Ripple Grammar doesn't exist, instead of waiting till
			 * after setup to check.
			 *
			 * Additionally, adding the grammar to `languages` doesn't work for
			 * some reason.
			 */
			await highlighter.loadLanguage({
				...modifiedGrammar,
				name: 'ripple',
			})
		},
	},

	themeConfig: {
		logoLink: { target: '_self' },
		notFound: {
			link: '/docs/introduction',
			linkLabel: 'Back to docs home',
			linkText: 'Back to docs home',
			quote: '',
		},

		search: { provider: 'local' },

		socialLinks: [
			{ icon: 'github', link: 'https://github.com/trueadm/ripple' },
			{ icon: 'discord', link: 'https://discord.gg/JBF2ySrh2W' },
		],

		nav: nav(),

		sidebar: {
			'/docs/': { base: '/docs/', items: docs_sidebar() }
		},

		editLink: {
			pattern: 'https://github.com/trueadm/ripple/edit/main/webside/:path',
			text: 'Edit this page on GitHub'
		},

		footer: {
			message: 'Released under the MIT License.',
			copyright: 'Copyright © 2025-present Dominic Gannaway'
		}
	},

	locales: {
		root: { label: 'English', lang: 'en-US', dir: 'ltr' },
	},

	head: [
		['link', { rel: 'icon', href: '/favicon.ico' }],
		[
			'link',
			{ rel: 'preconnect', href: 'https://fonts.googleapis.com' }
		],
		[
			'link',
			{ rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }
		],
		[
			'link',
			{ href: 'https://fonts.googleapis.com/css2?family=Recursive:wght@300..1000&display=swap" rel="stylesheet', rel: 'stylesheet' }
		],
	],

	cleanUrls: true,
});


/** @type {DefaultTheme.NavItem[]} */
function nav() {
	return [
		{
			text: 'Playground',
			link: '/playground',
			target: '_self',
		},
		{
			text: 'Docs',
			link: '/docs/introduction',
			activeMatch: '/docs/*'
		}
	]
}

/** @type {DefaultTheme.SidebarItem[]} */
function docs_sidebar() {
	return [
		{
			text: 'Getting Started',
			collapsed: false,
			items: [
				{ text: 'Introduction', link: 'introduction' },
				{ text: 'Quick Start', link: 'quick-start' },
			]
		},
		{
			text: 'Guide',
			collapsed: false,
			items: [
				{ text: 'Creating an Application', link: 'guide/application' },
				{ text: 'Template Syntax', link: 'guide/syntax' },
				{ text: 'Components', link: 'guide/components' },
				{ text: 'Control Flow', link: 'guide/control-flow' },
				{ text: 'Reactivity', link: 'guide/reactivity' },
				{ text: 'Data Binding', link: 'guide/data-binding' },
				{ text: 'Events', link: 'guide/events' },
				{ text: 'Decorators', link: 'guide/decorators' },
				{ text: 'State Management', link: 'guide/state-management' },
			]
		},
		{
			text: 'Good to Know',
			collapsed: false,
			items: [
				{ text: 'Comparison to Other Frameworks', link: 'comparison' },
				{ text: 'Best Practices', link: 'best-practices' },
			]
		},
	]
}
