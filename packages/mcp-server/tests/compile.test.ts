import { describe, it, expect } from 'vitest';
import { ripple_compile } from '../src/tools/compile.js';

describe('ripple_compile tool', () => {
	it('should compile valid Ripple code', async () => {
		const result = await ripple_compile.handler({
			code: 'component App() { <div>Hello</div> }',
			filename: 'App.ripple',
			mode: 'client',
		});

		expect(result.isError).toBeFalsy();
		expect(result.content).toHaveLength(1);
		expect(result.content[0].type).toBe('text');

		const output = JSON.parse(result.content[0].text);
		expect(output).toHaveProperty('js');
		expect(output).toHaveProperty('css');
		expect(output).toHaveProperty('map');
		expect(output.js).toContain('function App');
	});

	it('should return error for invalid Ripple code', async () => {
		const result = await ripple_compile.handler({
			code: 'component App() { invalid syntax',
			filename: 'App.ripple',
			mode: 'client',
		});

		expect(result.isError).toBe(true);
		expect(result.content).toHaveLength(1);
		expect(result.content[0].text).toContain('Compilation failed');
	});

	it('should compile in server mode', async () => {
		const result = await ripple_compile.handler({
			code: 'component App() { <div>{"Server"}</div> }',
			filename: 'App.ripple',
			mode: 'server',
		});

		expect(result.isError).toBeFalsy();
		const output = JSON.parse(result.content[0].text);
		expect(output.js).toBeDefined();
	});
});
