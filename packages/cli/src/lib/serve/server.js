/**
 * SSR Development Server for Ripple applications
 * Uses Polka with Vite middleware for hot module replacement
 */

import fs from 'node:fs';
import path from 'node:path';
import polka from 'polka';
import { createServer as createViteServer } from 'vite';
import { isRpcRequest, handleRpcRequest } from './rpc-handler.js';
import { renderToHTML } from './ssr-renderer.js';
import { validateOptions, readTemplate } from './config.js';

// Re-export for backwards compatibility
export { validateOptions, readTemplate };

/**
 * @typedef {import('./config.js').ServerOptions} ServerOptions
 */

/**
 * @typedef {Object} ServerInstance
 * @property {() => void} close - Close the server
 * @property {number} port - The port the server is running on
 */

/**
 * Create a cached template reader with file watching for invalidation
 * @param {string} templatePath - Full path to the template file
 * @returns {{ getContent: () => string; close: () => void }}
 */
function createTemplateCache(templatePath) {
	/** @type {string | null} */
	let cachedContent = fs.readFileSync(templatePath, 'utf-8');

	// Watch for changes and invalidate cache
	const watcher = fs.watch(templatePath, (eventType) => {
		if (eventType === 'change') {
			cachedContent = null;
		}
	});

	return {
		getContent: () => {
			if (cachedContent === null) {
				cachedContent = fs.readFileSync(templatePath, 'utf-8');
			}

			return cachedContent;
		},
		close: () => watcher.close(),
	};
}

/**
 * Create and start the SSR development server
 * @param {Partial<ServerOptions>} options - Server options
 * @returns {Promise<ServerInstance>} - The server instance
 */
export async function createServer(options = {}) {
	const config = validateOptions(options);
	const root = config.root || process.cwd();
	const template = config.template || 'index.html';
	const entry = config.entry || '/src/App.ripple';
	const port = config.port || 3000;

	// Validate template exists and has required placeholders
	readTemplate(template, root);

	// Create Vite server in middleware mode
	const vite = await createViteServer({
		root,
		server: { middlewareMode: true },
		appType: 'custom',
	});

	// RPC modules registry - populated during SSR rendering
	/** @type {Map<string, [string, string]>} */
	const rpcModules = new Map();

	// Create cached template reader with file watching
	const templatePath = path.resolve(root, template);
	const templateCache = createTemplateCache(templatePath);

	// Create Polka server
	const app = polka()
		.use(vite.middlewares)
		.use(async (req, res) => {
			const url = req.url || '/';

			try {
				// Handle RPC requests
				if (isRpcRequest(url)) {
					await handleRpcRequest(req, res, vite, rpcModules);
					return;
				}

				// Read template from cache (invalidated on file change)
				const templateContent = templateCache.getContent();
				const transformedTemplate = await vite.transformIndexHtml(url, templateContent);

				// Render SSR content
				const html = await renderToHTML(vite, transformedTemplate, entry, rpcModules);

				res.writeHead(200, { 'Content-Type': 'text/html' });
				res.end(html);
			} catch (error) {
				const err = /** @type {Error} */ (error);
				// Let Vite handle the error for better DX
				vite.ssrFixStacktrace(err);
				console.error('SSR Error:', err);
				res.writeHead(500, { 'Content-Type': 'text/plain' });
				res.end(err.stack || err.message);
			}
		});

	// Start listening
	return new Promise((resolve, reject) => {
		const server = app.listen(port, (/** @type {Error | undefined} */ err) => {
			if (err) {
				reject(err);
				return;
			}

			console.log(`\n  🌊 Ripple SSR dev server running at:`);
			console.log(`  ➜  Local:   http://localhost:${port}`);
			console.log(`  ➜  Entry:   ${entry}`);
			console.log();

			resolve({
				close: () => {
					templateCache.close();
					vite.close();
					server.server.close();
				},
				port: port,
			});
		});
	});
}
