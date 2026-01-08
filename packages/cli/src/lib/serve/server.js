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

/**
 * @typedef {Object} ServerOptions
 * @property {number} [port=3000] - The port to run the server on
 * @property {string} [entry='/src/App.ripple'] - Path to the entry component
 * @property {string} [template='index.html'] - Path to the HTML template
 * @property {string} [root=process.cwd()] - Root directory of the project
 */

/**
 * @typedef {Object} ServerInstance
 * @property {() => void} close - Close the server
 * @property {number} port - The port the server is running on
 */

/**
 * Validate server options and apply defaults
 * @param {Partial<ServerOptions>} options - User-provided options
 * @returns {ServerOptions} - Validated options with defaults
 */
export function validateOptions(options = {}) {
	const port = options.port ?? 3000;
	const entry = options.entry ?? '/src/App.ripple';
	const template = options.template ?? 'index.html';
	const root = options.root ?? process.cwd();

	if (typeof port !== 'number' || port < 0 || port > 65535) {
		throw new Error('Port must be a valid number between 0 and 65535');
	}

	if (typeof entry !== 'string' || !entry.endsWith('.ripple')) {
		throw new Error('Entry must be a path to a .ripple file');
	}

	if (typeof template !== 'string') {
		throw new Error('Template must be a path to an HTML file');
	}

	return { port, entry, template, root };
}

/**
 * Read and validate the HTML template file
 * @param {string} templatePath - Path to the template file
 * @param {string} root - Root directory
 * @returns {string} - The template content
 */
export function readTemplate(templatePath, root) {
	const fullPath = path.resolve(root, templatePath);

	if (!fs.existsSync(fullPath)) {
		throw new Error(`Template file not found: ${fullPath}`);
	}

	const content = fs.readFileSync(fullPath, 'utf-8');

	if (!content.includes('<!--ssr-head-->') || !content.includes('<!--ssr-body-->')) {
		throw new Error(
			'Template must contain <!--ssr-head--> and <!--ssr-body--> placeholders for SSR',
		);
	}

	return content;
}

/**
 * Create and start the SSR development server
 * @param {Partial<ServerOptions>} options - Server options
 * @returns {Promise<ServerInstance>} - The server instance
 */
export async function createServer(options = {}) {
	const config = validateOptions(options);
	const { port, entry, template, root } = config;

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

				// Read and transform the HTML template
				const templateContent = fs.readFileSync(path.resolve(root, template), 'utf-8');
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
					vite.close();
					server.server.close();
				},
				port,
			});
		});
	});
}
