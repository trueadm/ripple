import { defineConfig } from 'vitepress'
import { tabsMarkdownPlugin } from 'vitepress-plugin-tabs'
import { npmCommandsMarkdownPlugin } from 'vitepress-plugin-npm-commands'

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
			await highlighter.loadLanguage({
				...modifiedGrammar,
				name: 'ripple',
			})
		},
	},

	themeConfig: {
		socialLinks: [
			{ icon: 'github', link: 'https://github.com/trueadm/ripple' },
			{ icon: 'discord', link: 'https://discord.gg/JBF2ySrh2W' },
		],

		nav: nav(),

		sidebar: {
			'/guide/': { base: '/guide/', items: sidebarGuide() },
			'/reference/': { base: '/reference/', items: sidebarReference() }
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
		},
		{
			text: 'Docs',
			link: '/docs/intro',
		}
	]
}

/** @type {DefaultTheme.SidebarItem[]} */
function sidebarGuide() {
	return [
		{
			text: 'Introduction',
			collapsed: false,
			items: [
				{ text: 'What is VitePress?', link: 'what-is-vitepress' },
				{ text: 'Getting Started', link: 'getting-started' },
				{ text: 'Routing', link: 'routing' },
				{ text: 'Deploy', link: 'deploy' }
			]
		},
		{
			text: 'Writing',
			collapsed: false,
			items: [
				{ text: 'Markdown Extensions', link: 'markdown' },
				{ text: 'Asset Handling', link: 'asset-handling' },
				{ text: 'Frontmatter', link: 'frontmatter' },
				{ text: 'Using Vue in Markdown', link: 'using-vue' },
				{ text: 'Internationalization', link: 'i18n' }
			]
		},
		{
			text: 'Customization',
			collapsed: false,
			items: [
				{ text: 'Using a Custom Theme', link: 'custom-theme' },
				{
					text: 'Extending the Default Theme',
					link: 'extending-default-theme'
				},
				{ text: 'Build-Time Data Loading', link: 'data-loading' },
				{ text: 'SSR Compatibility', link: 'ssr-compat' },
				{ text: 'Connecting to a CMS', link: 'cms' }
			]
		},
		{
			text: 'Experimental',
			collapsed: false,
			items: [
				{ text: 'MPA Mode', link: 'mpa-mode' },
				{ text: 'Sitemap Generation', link: 'sitemap-generation' }
			]
		},
		{ text: 'Config & API Reference', base: '/reference/', link: 'site-config' }
	]
}

/** @type {DefaultTheme.SidebarItem[]} */
function sidebarReference() {
	return [
		{
			text: 'Reference',
			items: [
				{ text: 'Site Config', link: 'site-config' },
				{ text: 'Frontmatter Config', link: 'frontmatter-config' },
				{ text: 'Runtime API', link: 'runtime-api' },
				{ text: 'CLI', link: 'cli' },
				{
					text: 'Default Theme',
					base: '/reference/default-theme-',
					items: [
						{ text: 'Overview', link: 'config' },
						{ text: 'Nav', link: 'nav' },
						{ text: 'Sidebar', link: 'sidebar' },
						{ text: 'Home Page', link: 'home-page' },
						{ text: 'Footer', link: 'footer' },
						{ text: 'Layout', link: 'layout' },
						{ text: 'Badge', link: 'badge' },
						{ text: 'Team Page', link: 'team-page' },
						{ text: 'Prev / Next Links', link: 'prev-next-links' },
						{ text: 'Edit Link', link: 'edit-link' },
						{ text: 'Last Updated Timestamp', link: 'last-updated' },
						{ text: 'Search', link: 'search' },
						{ text: 'Carbon Ads', link: 'carbon-ads' }
					]
				}
			]
		}
	]
}
