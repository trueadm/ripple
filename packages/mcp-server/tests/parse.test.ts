import { describe, it, expect } from 'vitest';
import { ripple_parse } from '../src/tools/parse.js';

describe('ripple_parse tool', () => {
	it('should parse valid Ripple code', async () => {
		const result = await ripple_parse.handler({
			code: 'component App() { <div>{"Hello"}</div> }',
		});

		expect(result.isError).toBeFalsy();
		expect(result.content).toHaveLength(1);
		expect(result.content[0].type).toBe('text');

		const ast = JSON.parse(result.content[0].text);
		expect(ast).toHaveProperty('type', 'Program');
		expect(ast).toHaveProperty('body');
		expect(Array.isArray(ast.body)).toBe(true);
	});

	it('should return error for invalid syntax', async () => {
		const result = await ripple_parse.handler({
			code: 'component App() { invalid',
		});

		expect(result.isError).toBe(true);
		expect(result.content[0].text).toContain('Parsing failed');
	});

	it('should parse component with props', async () => {
		const result = await ripple_parse.handler({
			code: 'component Button({ label }: { label: string }) { <button>{label}</button> }',
		});

		expect(result.isError).toBeFalsy();
		const ast = JSON.parse(result.content[0].text);
		expect(ast.body[0].type).toBe('Component');
	});
});
