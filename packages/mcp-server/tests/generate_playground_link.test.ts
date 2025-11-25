import { describe, it, expect } from 'vitest';
import { ripple_generate_playground_link } from '../src/tools/generate_playground_link.js';

describe('ripple_generate_playground_link', () => {
	it('should have correct metadata', () => {
		expect(ripple_generate_playground_link.name).toBe('ripple_generate_playground_link');
		expect(ripple_generate_playground_link.description).toBeTruthy();
		expect(ripple_generate_playground_link.inputSchema).toBeDefined();
	});

	it('should generate playground link with code only', async () => {
		const code = 'component App() { <div>{"Hello"}</div> }';
		const result = await ripple_generate_playground_link.handler({ code });

		expect(result.isError).toBeFalsy();
		const data = JSON.parse(result.content[0].text);

		expect(data.url).toContain('https://www.ripplejs.com/playground');
		expect(data.url).toContain('#config=code%2F');
		expect(data.shortUrl).toBe('ripplejs.com/playground#config=code/...');
		expect(data.codeLength).toBe(code.length);
	});

	it('should generate playground link with title', async () => {
		const code = 'component Counter() {}';
		const title = 'Counter App';
		const result = await ripple_generate_playground_link.handler({ code, title });

		const data = JSON.parse(result.content[0].text);

		expect(data.url).toContain('title=Counter+App');
		expect(data.title).toBe(title);
		expect(data.shortUrl).toContain('?title=Counter+App');
	});

	it('should generate playground link with version', async () => {
		const code = 'component App() {}';
		const version = '0.2.175';
		const result = await ripple_generate_playground_link.handler({ code, version });

		const data = JSON.parse(result.content[0].text);

		expect(data.url).toContain('v=0.2.175');
		expect(data.version).toBe(version);
	});

	it('should generate playground link with title and version', async () => {
		const code = 'component App() { <div>{"Test"}</div> }';
		const title = 'Test App';
		const version = '0.2.175';
		const result = await ripple_generate_playground_link.handler({ code, title, version });

		const data = JSON.parse(result.content[0].text);

		expect(data.url).toContain('v=0.2.175');
		expect(data.url).toContain('title=Test+App');
		expect(data.title).toBe(title);
		expect(data.version).toBe(version);
	});

	it('should handle complex code with special characters', async () => {
		const code = `component App() {
			let count = track(0);
			<div>
				<button onClick={() => @count++}>{"Count: "}{@count}</button>
			</div>
		}`;
		const result = await ripple_generate_playground_link.handler({ code });

		expect(result.isError).toBeFalsy();
		const data = JSON.parse(result.content[0].text);

		expect(data.url).toContain('https://www.ripplejs.com/playground');
		expect(data.url).toContain('#config=code%2F');
	});

	it('should properly encode base64 and URL encode', async () => {
		const code = 'component App() { <div>{"Hello"}</div> }';
		const result = await ripple_generate_playground_link.handler({ code });

		const data = JSON.parse(result.content[0].text);

		// Extract the encoded part from the URL
		const hashPart = data.url.split('#')[1];
		expect(hashPart).toMatch(/^config=code%2F/);

		// The encoded part should be URL-encoded base64
		const encodedCode = hashPart.replace('config=code%2F', '');
		const decodedUrlEncoded = decodeURIComponent(encodedCode);
		const decodedBase64 = Buffer.from(decodedUrlEncoded, 'base64').toString('utf-8');

		expect(decodedBase64).toBe(code);
	});
});
