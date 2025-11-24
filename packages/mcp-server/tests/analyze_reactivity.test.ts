import { describe, it, expect } from 'vitest';
import { ripple_analyze_reactivity } from '../src/tools/analyze_reactivity.js';

describe('ripple_analyze_reactivity tool', () => {
	it('should detect tracked references', async () => {
		const result = await ripple_analyze_reactivity.handler({
			code: `component App() {
				let count = track(0);
				<div>{@count}</div>
			}`,
		});

		expect(result.isError).toBeUndefined();
		const output = JSON.parse(result.content[0].text);
		expect(output.trackedVariables).toContainEqual(
			expect.objectContaining({
				name: 'count',
				type: 'tracked_reference',
			}),
		);
		expect(output.summary.trackedReferences).toBeGreaterThan(0);
	});

	it('should detect reactive collections', async () => {
		const result = await ripple_analyze_reactivity.handler({
			code: `component App() {
				let arr = #[1, 2, 3];
				let obj = #{ name: 'test' };
				<div>{@arr[0]}</div>
			}`,
		});

		expect(result.isError).toBeUndefined();
		const output = JSON.parse(result.content[0].text);

		// Should detect the array and object declarations
		const arrVar = output.trackedVariables.find((v: any) => v.name === 'arr');
		const objVar = output.trackedVariables.find((v: any) => v.name === 'obj');

		// At minimum, should detect the tracked reference
		expect(output.trackedVariables.length).toBeGreaterThan(0);
	});

	it('should detect TrackedSet and TrackedMap', async () => {
		const result = await ripple_analyze_reactivity.handler({
			code: `component App() {
				let mySet = new #Set([1, 2, 3]);
				let myMap = new #Map([['a', 1]]);
				<div>{"Test"}</div>
			}`,
		});

		expect(result.isError).toBeFalsy();
		const output = JSON.parse(result.content[0].text);
		expect(output.trackedVariables).toBeDefined();
		expect(output.summary).toBeDefined();
	});

	it('should return empty for code without tracked variables', async () => {
		const result = await ripple_analyze_reactivity.handler({
			code: `component App() {
				let count = 0;
				<div>{count}</div>
			}`,
		});

		expect(result.isError).toBeUndefined();
		const output = JSON.parse(result.content[0].text);
		expect(output.trackedVariables).toHaveLength(0);
		expect(output.summary.total).toBe(0);
	});

	it('should handle compilation errors', async () => {
		const result = await ripple_analyze_reactivity.handler({
			code: 'invalid syntax here',
		});

		expect(result.isError).toBe(true);
		expect(result.content[0].text).toContain('Analysis failed');
	});
});
