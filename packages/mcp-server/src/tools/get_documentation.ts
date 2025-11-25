import { z } from 'zod';
import * as cheerio from 'cheerio';

export const GetDocumentationSchema = z.object({
	sections: z
		.array(z.string())
		.min(1)
		.describe('Array of section IDs to retrieve (e.g., ["guide-reactivity", "guide-components"])'),
});

interface DocSubsection {
	heading: string;
	level: number;
	content: string;
}

interface DocSection {
	id: string;
	title: string;
	category: string;
	path: string;
	url: string;
	description: string;
}

function generateUrlFromSectionId(sectionId: string): string {
	let docPath: string;

	if (sectionId.startsWith('guide-')) {
		const guideName = sectionId.replace(/^guide-/, '');
		docPath = `/docs/guide/${guideName}`;
	} else {
		docPath = `/docs/${sectionId}`;
	}

	return `https://www.ripplejs.com${docPath}`;
}

async function fetchDocumentationFromUrl(
	url: string,
): Promise<{ content: string; subsections: DocSubsection[]; title: string }> {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
	}

	const html = await response.text();
	const $ = cheerio.load(html);

	let title = $('h1').first().text().trim();
	if (!title) {
		title = $('title')
			.text()
			.replace(/ \| .*$/, '')
			.trim();
	}

	const mainContent = $('.vp-doc');
	let fullContent = '';
	const subsections: DocSubsection[] = [];

	mainContent.find('h1, h2, h3, h4').each((_, elem) => {
		const $heading = $(elem);
		const headingText = $heading.text().replace(/​/g, '').trim();
		const level = parseInt(elem.tagName[1]);

		let sectionContent = '';
		let $next = $heading.next();

		while ($next.length && !$next.is('h1, h2, h3, h4')) {
			const text = $next.text().trim();
			if (text) {
				sectionContent += text + '\n\n';
			}
			$next = $next.next();
		}

		if (headingText && sectionContent) {
			subsections.push({
				heading: headingText,
				level,
				content: sectionContent.trim(),
			});
			fullContent += `${'#'.repeat(level)} ${headingText}\n\n${sectionContent.trim()}\n\n`;
		}
	});

	if (subsections.length === 0 && mainContent.length > 0) {
		const allText = mainContent.text().trim();
		if (allText) {
			fullContent = allText;
			subsections.push({
				heading: title || 'Content',
				level: 1,
				content: allText,
			});
		}
	}

	return { content: fullContent, subsections, title: title || 'Documentation' };
}

async function getSectionMetadata(sectionId: string): Promise<DocSection | null> {
	const { getDocumentationSections } = await import('./list_sections.js');
	const sections = await getDocumentationSections();
	const section = sections.find((s) => s.id === sectionId);

	if (!section) {
		const url = generateUrlFromSectionId(sectionId);
		let docPath: string;
		if (sectionId.startsWith('guide-')) {
			const guideName = sectionId.replace(/^guide-/, '');
			docPath = `/docs/guide/${guideName}`;
		} else {
			docPath = `/docs/${sectionId}`;
		}

		try {
			const { title } = await fetchDocumentationFromUrl(url);
			const category = docPath.includes('/guide/')
				? 'Guide'
				: docPath.includes('introduction') || docPath.includes('quick-start')
					? 'Getting Started'
					: 'Further Reading';

			return {
				id: sectionId,
				title,
				category,
				path: docPath,
				url,
				description: `Documentation for ${title}`,
			};
		} catch {
			return null;
		}
	}

	return {
		...section,
		url: generateUrlFromSectionId(sectionId),
	};
}

export const ripple_get_documentation = {
	name: 'ripple_get_documentation',
	description:
		'Retrieves full documentation content for one or more specific sections by fetching from ripplejs.com. Use ripple_list_sections first to discover available section IDs. URLs are automatically generated from section IDs if needed.',
	inputSchema: {
		type: 'object',
		properties: {
			sections: {
				type: 'array',
				items: {
					type: 'string',
				},
				description:
					'Array of section IDs to retrieve (e.g., ["guide-reactivity", "guide-components"]). Get IDs from ripple_list_sections, or use URL path patterns like "introduction" or "guide-components".',
			},
		},
		required: ['sections'],
	},
	handler: async (args: unknown) => {
		const { sections: requestedSections } = GetDocumentationSchema.parse(args);

		try {
			const documentation = [];
			const notFoundIds: string[] = [];

			for (const sectionId of requestedSections) {
				try {
					const section = await getSectionMetadata(sectionId);
					if (!section) {
						notFoundIds.push(sectionId);
						continue;
					}

					const { content, subsections, title } = await fetchDocumentationFromUrl(section.url);

					documentation.push({
						id: section.id,
						title: title || section.title,
						category: section.category,
						url: section.url,
						description: section.description,
						content,
						subsections,
					});
				} catch (error: any) {
					console.error(`Error fetching ${sectionId}:`, error);
					notFoundIds.push(sectionId);
				}
			}

			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify(
							{
								documentation,
								requested: requestedSections.length,
								found: documentation.length,
								notFound: notFoundIds.length > 0 ? notFoundIds : undefined,
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
						text: `Failed to get documentation: ${error.message}`,
					},
				],
				isError: true,
			};
		}
	},
};
