import { describe, it, expect } from 'vitest';
import { ripple_analyze_reactivity } from '../src/tools/analyze_reactivity.js';

describe('ripple_analyze_reactivity - unescaped strings', () => {
	it('should detect unescaped strings in templates', async () => {
		const result = await ripple_analyze_reactivity.handler({
			code: `component App() {
				<div>Hello World</div>
			}`,
		});

		expect(result.isError).toBeFalsy();
		const output = JSON.parse(result.content[0].text);

		expect(output.warnings).toHaveLength(1);
		expect(output.warnings[0]).toMatchObject({
			type: 'unescaped_string',
			message: expect.stringContaining('Hello World'),
		});
		expect(output.warnings[0].suggestion).toContain('{"Hello World"}');
		expect(output.summary.warningsCount).toBe(1);
	});

	it('should not warn for properly escaped strings', async () => {
		const result = await ripple_analyze_reactivity.handler({
			code: `component App() {
				<div>{"Hello World"}</div>
			}`,
		});

		expect(result.isError).toBeFalsy();
		const output = JSON.parse(result.content[0].text);

		expect(output.warnings).toHaveLength(0);
		expect(output.summary.warningsCount).toBe(0);
	});

	it('should detect multiple unescaped strings', async () => {
		const result = await ripple_analyze_reactivity.handler({
			code: `component App() {
				<div>
					<h1>Title</h1>
					<p>Paragraph text</p>
				</div>
			}`,
		});

		expect(result.isError).toBeFalsy();
		const output = JSON.parse(result.content[0].text);

		expect(output.warnings.length).toBeGreaterThan(0);
		expect(output.summary.warningsCount).toBeGreaterThan(0);
	});
});
