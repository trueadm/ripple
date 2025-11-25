import { z } from 'zod';
import * as cheerio from 'cheerio';

export const ListSectionsSchema = z.object({
	category: z
		.string()
		.optional()
		.describe('Optional category filter (e.g., "Guide", "Getting Started")'),
});

interface DocSection {
	id: string;
	title: string;
	category: string;
	path: string;
	url: string;
	description: string;
}

function generateSectionId(path: string): string {
	// Remove /docs prefix
	const withoutPrefix = path.replace(/^\/docs\/?/, '');
	if (withoutPrefix.startsWith('guide/')) {
		return `guide-${withoutPrefix.replace(/^guide\//, '')}`;
	}

	return withoutPrefix;
}

function getCategoryFromPath(path: string): string {
	if (path.includes('/guide/')) {
		return 'Guide';
	}
	const fileName = path.split('/').pop() || '';
	if (fileName === 'introduction' || fileName === 'quick-start') {
		return 'Getting Started';
	}
	return 'Further Reading';
}

async function discoverDocumentationSections(): Promise<DocSection[]> {
	const baseUrl = 'https://www.ripplejs.com';
	const docsUrl = `${baseUrl}/docs`;

	try {
		const response = await fetch(docsUrl);
		if (!response.ok) {
			throw new Error(`Failed to fetch ${docsUrl}: ${response.statusText}`);
		}

		const html = await response.text();
		const $ = cheerio.load(html);

		const sections: DocSection[] = [];
		const seenPaths = new Set<string>();

		// Try to find navigation links - common patterns in doc sites
		// Look for links in sidebar navigation, main content, or nav elements
		const selectors = [
			'aside nav a[href^="/docs"]',
			'.sidebar a[href^="/docs"]',
			'nav a[href^="/docs"]',
			'a[href^="/docs"]',
		];

		for (const selector of selectors) {
			$(selector).each((_, elem) => {
				const $link = $(elem);
				const href = $link.attr('href');
				if (!href) return;

				const docPath = href.split('#')[0];
				if (seenPaths.has(docPath) || docPath === '/docs' || docPath === '/docs/') {
					return;
				}

				seenPaths.add(docPath);
			});
		}

		// If we didn't find links via selectors, try common documentation paths
		if (seenPaths.size === 0) {
			const commonPaths = [
				'/docs/introduction',
				'/docs/quick-start',
				'/docs/guide/application',
				'/docs/guide/syntax',
				'/docs/guide/components',
				'/docs/guide/control-flow',
				'/docs/guide/reactivity',
				'/docs/guide/events',
				'/docs/guide/dom-refs',
				'/docs/guide/state-management',
				'/docs/guide/head-management',
				'/docs/guide/styling',
				'/docs/guide/bindings',
				'/docs/comparison',
				'/docs/best-practices',
				'/docs/libraries',
				'/docs/troubleshooting',
			];

			for (const docPath of commonPaths) {
				seenPaths.add(docPath);
			}
		}

		for (const docPath of seenPaths) {
			try {
				const url = `${baseUrl}${docPath}`;
				const pageResponse = await fetch(url);

				if (!pageResponse.ok) {
					continue;
				}

				const pageHtml = await pageResponse.text();
				const $page = cheerio.load(pageHtml);

				let title = $page('h1').first().text().trim();
				if (!title) {
					title = $page('title')
						.text()
						.replace(/ \| .*$/, '')
						.trim();
				}
				if (!title) {
					const fileName = docPath.split('/').pop() || 'Documentation';
					title = fileName
						.split('-')
						.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
						.join(' ');
				}

				let description = '';
				const firstParagraph = $page('.vp-doc p').first().text().trim();
				if (firstParagraph) {
					description = firstParagraph
						.replace(/<[^>]+>/g, '')
						.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
						.slice(0, 200);
				}
				if (!description) {
					description = `Documentation for ${title}`;
				}

				const id = generateSectionId(docPath);
				const category = getCategoryFromPath(docPath);

				sections.push({
					id,
					title,
					category,
					path: docPath,
					url,
					description,
				});
			} catch (error) {
				console.error(`Error fetching ${docPath}:`, error);
			}
		}

		const categoryOrder: Record<string, number> = {
			'Getting Started': 0,
			Guide: 1,
			'Further Reading': 2,
		};

		sections.sort((a, b) => {
			const orderA = categoryOrder[a.category] ?? 99;
			const orderB = categoryOrder[b.category] ?? 99;
			if (orderA !== orderB) {
				return orderA - orderB;
			}
			return a.title.localeCompare(b.title);
		});

		return sections;
	} catch (error) {
		console.error('Error discovering documentation sections:', error);

		return [];
	}
}

// Cache the discovered sections
let cachedSections: DocSection[] | null = null;

export async function getDocumentationSections(): Promise<DocSection[]> {
	if (!cachedSections) {
		cachedSections = await discoverDocumentationSections();
	}

	return cachedSections;
}

export const ripple_list_sections = {
	name: 'ripple_list_sections',
	description:
		'Lists all available Ripple documentation sections by fetching from ripplejs.com. Use this first to discover what documentation is available before requesting specific content.',
	inputSchema: {
		type: 'object',
		properties: {
			category: {
				type: 'string',
				description:
					'Optional category filter (e.g., "Guide", "Getting Started", "Further Reading")',
			},
		},
	},
	handler: async (args: unknown) => {
		const { category } = ListSectionsSchema.parse(args);

		try {
			const allSections = await getDocumentationSections();
			let sections = allSections;

			if (category) {
				sections = sections.filter((s) => s.category.toLowerCase() === category.toLowerCase());
			}

			const categories = Array.from(new Set(allSections.map((s) => s.category))).sort();

			const sectionList = sections.map((section) => ({
				id: section.id,
				title: section.title,
				category: section.category,
				description: section.description,
				path: section.path,
			}));

			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify(
							{
								sections: sectionList,
								categories,
								totalSections: sectionList.length,
								filteredBy: category || null,
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
						text: `Failed to list documentation sections: ${error.message}`,
					},
				],
				isError: true,
			};
		}
	},
};
