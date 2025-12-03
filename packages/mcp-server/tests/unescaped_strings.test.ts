import { describe, it, expect } from 'vitest';
import { ripple_analyze_reactivity } from '../src/tools/analyze_reactivity.js';

describe('ripple_analyze_reactivity - unescaped strings', () => {
	it('should throw error for unescaped strings in templates', async () => {
		const result = await ripple_analyze_reactivity.handler({
			code: `component App() {
				<div>Hello World</div>
			}`,
		});

		// Should throw an error because unescaped strings are not allowed
		expect(result.isError).toBe(true);
		expect(result.content[0].text).toContain('Analysis failed');
	});

	it('should not throw for properly escaped strings', async () => {
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

	it('should throw error for multiple unescaped strings', async () => {
		const result = await ripple_analyze_reactivity.handler({
			code: `component App() {
				<div>
					<h1>Title</h1>
					<p>Paragraph text</p>
				</div>
			}`,
		});

		// Should throw an error because unescaped strings are not allowed
		expect(result.isError).toBe(true);
		expect(result.content[0].text).toContain('Analysis failed');
	});
});
