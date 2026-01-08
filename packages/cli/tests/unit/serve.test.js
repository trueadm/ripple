import { describe, it, expect, beforeEach, vi } from 'vitest';
// Import from config.js to avoid loading vite (which causes esbuild issues in tests)
import { validateOptions } from '../../src/lib/serve/config.js';
import { parseRequestBody, isRpcRequest, extractRpcHash } from '../../src/lib/serve/rpc-handler.js';
import { generateCssTags, injectSSRContent } from '../../src/lib/serve/ssr-renderer.js';

describe('Server Options Validation', () => {
	describe('validateOptions', () => {
		it('should return default options when none provided', () => {
			const options = validateOptions();
			expect(options).toEqual({
				port: 3000,
				entry: '/src/App.ripple',
				template: 'index.html',
				root: process.cwd(),
			});
		});

		it('should accept valid port numbers', () => {
			expect(validateOptions({ port: 8080 }).port).toBe(8080);
			expect(validateOptions({ port: 0 }).port).toBe(0);
			expect(validateOptions({ port: 65535 }).port).toBe(65535);
		});

		it('should throw for invalid port numbers', () => {
			expect(() => validateOptions({ port: -1 })).toThrow('Port must be a valid number');
			expect(() => validateOptions({ port: 65536 })).toThrow('Port must be a valid number');
			expect(() => validateOptions({ port: 'abc' })).toThrow('Port must be a valid number');
		});

		it('should accept valid entry paths', () => {
			expect(validateOptions({ entry: '/src/App.ripple' }).entry).toBe('/src/App.ripple');
			expect(validateOptions({ entry: '/components/Main.ripple' }).entry).toBe(
				'/components/Main.ripple',
			);
		});

		it('should throw for invalid entry paths', () => {
			expect(() => validateOptions({ entry: '/src/App.js' })).toThrow(
				'Entry must be a path to a .ripple file',
			);
			expect(() => validateOptions({ entry: 123 })).toThrow(
				'Entry must be a path to a .ripple file',
			);
		});

		it('should accept valid template paths', () => {
			expect(validateOptions({ template: 'index.html' }).template).toBe('index.html');
			expect(validateOptions({ template: 'public/template.html' }).template).toBe(
				'public/template.html',
			);
		});

		it('should throw for invalid template types', () => {
			expect(() => validateOptions({ template: 123 })).toThrow(
				'Template must be a path to an HTML file',
			);
		});

		it('should accept custom root directory', () => {
			expect(validateOptions({ root: '/custom/path' }).root).toBe('/custom/path');
		});
	});
});

describe('RPC Handler', () => {
	describe('isRpcRequest', () => {
		it('should return true for RPC URLs', () => {
			expect(isRpcRequest('/_$_ripple_rpc_$_/abc123')).toBe(true);
			expect(isRpcRequest('/_$_ripple_rpc_$_/')).toBe(true);
		});

		it('should return false for non-RPC URLs', () => {
			expect(isRpcRequest('/')).toBe(false);
			expect(isRpcRequest('/api/users')).toBe(false);
			expect(isRpcRequest('/src/App.ripple')).toBe(false);
		});
	});

	describe('extractRpcHash', () => {
		it('should extract the hash from RPC URL', () => {
			expect(extractRpcHash('/_$_ripple_rpc_$_/abc123')).toBe('abc123');
			expect(extractRpcHash('/_$_ripple_rpc_$_/xyz789def')).toBe('xyz789def');
		});

		it('should return empty string for URL with no hash', () => {
			expect(extractRpcHash('/_$_ripple_rpc_$_/')).toBe('');
		});
	});

	describe('parseRequestBody', () => {
		it('should parse request body from stream', async () => {
			const mockReq = createMockRequest('{"data": "test"}');
			const result = await parseRequestBody(mockReq);
			expect(result).toBe('{"data": "test"}');
		});

		it('should reject if body exceeds max size', async () => {
			const largeBody = 'x'.repeat(1e6 + 1);
			const mockReq = createMockRequest(largeBody);

			await expect(parseRequestBody(mockReq, 1e6)).rejects.toThrow('Request body too large');
		});

		it('should reject on stream error', async () => {
			const mockReq = createMockErrorRequest(new Error('Stream error'));

			await expect(parseRequestBody(mockReq)).rejects.toThrow('Stream error');
		});
	});
});

describe('SSR Renderer', () => {
	describe('generateCssTags', () => {
		it('should return empty string for empty CSS set', () => {
			const result = generateCssTags(new Set(), () => '');
			expect(result).toBe('');
		});

		it('should generate style tags for CSS content', () => {
			const cssHashes = new Set(['hash1', 'hash2']);
			const getCssForHashes = () => '.class { color: red; }';

			const result = generateCssTags(cssHashes, getCssForHashes);
			expect(result).toContain('<style data-ripple-ssr>');
			expect(result).toContain('.class { color: red; }');
			expect(result).toContain('</style>');
		});

		it('should return empty string if getCssForHashes returns empty', () => {
			const cssHashes = new Set(['hash1']);
			const getCssForHashes = () => '';

			const result = generateCssTags(cssHashes, getCssForHashes);
			expect(result).toBe('');
		});
	});

	describe('injectSSRContent', () => {
		it('should inject head and body content into template', () => {
			const template =
				'<!DOCTYPE html><html><head><!--ssr-head--></head><body><!--ssr-body--></body></html>';
			const head = '<title>Test</title>';
			const body = '<div>Hello World</div>';

			const result = injectSSRContent(template, head, body);

			expect(result).toContain('<title>Test</title>');
			expect(result).toContain('<div>Hello World</div>');
			expect(result).not.toContain('<!--ssr-head-->');
			expect(result).not.toContain('<!--ssr-body-->');
		});

		it('should handle empty head and body', () => {
			const template = '<html><head><!--ssr-head--></head><body><!--ssr-body--></body></html>';

			const result = injectSSRContent(template, '', '');

			expect(result).toBe('<html><head></head><body></body></html>');
		});

		it('should preserve other template content', () => {
			const template =
				'<html><head><meta charset="utf-8"><!--ssr-head--></head><body><script src="main.js"></script><!--ssr-body--></body></html>';
			const head = '<title>App</title>';
			const body = '<div id="app"></div>';

			const result = injectSSRContent(template, head, body);

			expect(result).toContain('<meta charset="utf-8">');
			expect(result).toContain('<script src="main.js"></script>');
			expect(result).toContain('<title>App</title>');
			expect(result).toContain('<div id="app"></div>');
		});
	});
});

// Helper functions for creating mock request objects
function createMockRequest(body) {
	const chunks = [Buffer.from(body)];
	let dataCallback = null;
	let endCallback = null;
	let errorCallback = null;

	return {
		on(event, callback) {
			if (event === 'data') {
				dataCallback = callback;
				// Emit data chunks asynchronously
				setImmediate(() => {
					chunks.forEach((chunk) => dataCallback(chunk));
				});
			} else if (event === 'end') {
				endCallback = callback;
				// Emit end after data
				setImmediate(() => {
					setImmediate(() => endCallback());
				});
			} else if (event === 'error') {
				errorCallback = callback;
			}
		},
		destroy() {},
	};
}

function createMockErrorRequest(error) {
	return {
		on(event, callback) {
			if (event === 'error') {
				setImmediate(() => callback(error));
			} else if (event === 'data' || event === 'end') {
				// Do nothing
			}
		},
		destroy() {},
	};
}
