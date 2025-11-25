import { describe, it, expect } from 'vitest';
import { ripple_list_sections } from '../src/tools/list_sections.js';

describe('ripple_list_sections', () => {
	it('should have correct metadata', () => {
		expect(ripple_list_sections.name).toBe('ripple_list_sections');
		expect(ripple_list_sections.description).toBeTruthy();
		expect(ripple_list_sections.inputSchema).toBeDefined();
	});

	it('should list all documentation sections', async () => {
		const result = await ripple_list_sections.handler({});

		expect(result.isError).toBeFalsy();
		const data = JSON.parse(result.content[0].text);

		expect(data.sections).toBeDefined();
		expect(Array.isArray(data.sections)).toBe(true);
		expect(data.sections.length).toBeGreaterThan(0);
		expect(data.totalSections).toBe(data.sections.length);
		expect(data.categories).toBeDefined();
		expect(Array.isArray(data.categories)).toBe(true);
	});

	it('should include section metadata', async () => {
		const result = await ripple_list_sections.handler({});
		const data = JSON.parse(result.content[0].text);

		const section = data.sections[0];
		expect(section.id).toBeDefined();
		expect(section.title).toBeDefined();
		expect(section.category).toBeDefined();
		expect(section.description).toBeDefined();
		expect(section.path).toBeDefined();

		// Should NOT include full content in list
		expect(section.content).toBeUndefined();
		expect(section.subsections).toBeUndefined();
	});

	it('should filter by category', async () => {
		const result = await ripple_list_sections.handler({ category: 'Guide' });
		const data = JSON.parse(result.content[0].text);

		expect(data.filteredBy).toBe('Guide');
		expect(data.sections.every((s: any) => s.category === 'Guide')).toBe(true);
	});

	it('should handle case-insensitive category filter', async () => {
		const result = await ripple_list_sections.handler({ category: 'guide' });
		const data = JSON.parse(result.content[0].text);

		expect(data.sections.every((s: any) => s.category === 'Guide')).toBe(true);
	});

	it('should return empty list for non-existent category', async () => {
		const result = await ripple_list_sections.handler({ category: 'NonExistent' });
		const data = JSON.parse(result.content[0].text);

		expect(data.sections).toHaveLength(0);
		expect(data.totalSections).toBe(0);
	});

	it('should include common categories', async () => {
		const result = await ripple_list_sections.handler({});
		const data = JSON.parse(result.content[0].text);

		expect(data.categories).toContain('Getting Started');
		expect(data.categories).toContain('Guide');
		expect(data.categories).toContain('Further Reading');
	});
});
