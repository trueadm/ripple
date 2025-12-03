import { describe, it, expect } from 'vitest';
import { ripple_get_documentation } from '../src/tools/get_documentation.js';

describe('ripple_get_documentation', () => {
	it('should have correct metadata', () => {
		expect(ripple_get_documentation.name).toBe('ripple_get_documentation');
		expect(ripple_get_documentation.description).toBeTruthy();
		expect(ripple_get_documentation.inputSchema).toBeDefined();
	});

	it('should retrieve documentation for valid section', async () => {
		const result = await ripple_get_documentation.handler({
			sections: ['introduction'],
		});

		expect(result.isError).toBeFalsy();
		const data = JSON.parse(result.content[0].text);

		expect(data.documentation).toBeDefined();
		expect(Array.isArray(data.documentation)).toBe(true);
		expect(data.documentation.length).toBe(1);
		expect(data.found).toBe(1);
		expect(data.requested).toBe(1);
	});

	it('should include full content and subsections', async () => {
		const result = await ripple_get_documentation.handler({
			sections: ['guide-reactivity'],
		});

		const data = JSON.parse(result.content[0].text);
		const doc = data.documentation[0];

		expect(doc.id).toBe('guide-reactivity');
		expect(doc.title).toBeDefined();
		expect(doc.category).toBeDefined();
		expect(doc.url).toBeDefined();
		expect(doc.description).toBeDefined();
		expect(doc.content).toBeDefined();
		expect(doc.content.length).toBeGreaterThan(0);
		expect(doc.subsections).toBeDefined();
		expect(Array.isArray(doc.subsections)).toBe(true);
	});

	it('should retrieve multiple sections', async () => {
		const result = await ripple_get_documentation.handler({
			sections: ['introduction', 'quick-start'],
		});

		const data = JSON.parse(result.content[0].text);

		expect(data.documentation.length).toBe(2);
		expect(data.found).toBe(2);
		expect(data.requested).toBe(2);
	});

	it('should handle non-existent section', async () => {
		const result = await ripple_get_documentation.handler({
			sections: ['non-existent-section'],
		});

		const data = JSON.parse(result.content[0].text);

		expect(data.found).toBe(0);
		expect(data.notFound).toBeDefined();
		expect(data.notFound).toContain('non-existent-section');
	});

	it('should handle mix of valid and invalid sections', async () => {
		const result = await ripple_get_documentation.handler({
			sections: ['introduction', 'invalid-section', 'quick-start'],
		});

		const data = JSON.parse(result.content[0].text);

		expect(data.found).toBe(2);
		expect(data.notFound).toContain('invalid-section');
		expect(data.documentation.length).toBe(2);
	});

	it('should include subsection details', async () => {
		const result = await ripple_get_documentation.handler({
			sections: ['guide-components'],
		});

		const data = JSON.parse(result.content[0].text);
		const doc = data.documentation[0];

		if (doc.subsections.length > 0) {
			const subsection = doc.subsections[0];
			expect(subsection.heading).toBeDefined();
			expect(subsection.level).toBeDefined();
			expect(subsection.content).toBeDefined();
		}
	});

	it('should return error for empty sections array', async () => {
		try {
			await ripple_get_documentation.handler({
				sections: [],
			});
			expect.fail('Should have thrown validation error');
		} catch (error) {
			// Zod validation error expected
			expect(error).toBeDefined();
		}
	});
});
