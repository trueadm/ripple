import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import polka from 'polka';
import { createServer as createViteServer } from 'vite';
import { executeServerFunction } from 'ripple/server';

const PORT = process.env.PORT || '5173';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const vite = await createViteServer({
	server: { middlewareMode: true },
	appType: 'custom',
});

const rpc_modules = new Map();

function get_request_body(req) {
	return new Promise((resolve, reject) => {
		let data = '';

		req.on('data', (chunk) => {
			data += chunk;
			if (data.length > 1e6) {
				req.destroy();
				reject(new Error('Request body too large'));
			}
		});

		req.on('end', () => {
			try {
				resolve(data);
			} catch (err) {
				reject(err);
			}
		});

		req.on('error', reject);
	});
}

polka()
	.use(vite.middlewares)
	.use(async (req, res) => {
		try {
			if (req.url.startsWith('/_$_ripple_rpc_$_/')) {
				const hash = req.url.slice('/_$_ripple_rpc_$_/'.length);
				const module_info = rpc_modules.get(hash);

				if (!module_info) {
					console.error('SSR Error:', err);
					res.writeHead(500, { 'Content-Type': 'text/plain' }).end(err.stack);
					return;
				}
				const file_path = module_info[0];
				const func_name = module_info[1];
				const { _$_server_$_: server } = await vite.ssrLoadModule(file_path);
				const rpc_arguments = await get_request_body(req);
				const result = await executeServerFunction(server[func_name], rpc_arguments);
				res.writeHead(200, { 'Content-Type': 'application/json' }).end(result);
				return;
			}
			const template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
			const transformed_template = await vite.transformIndexHtml(req.url, template);

			let render, get_css_for_hashes;
			let previous_rpc = rpc_modules;

			try {
				globalThis.rpc_modules = new Map(rpc_modules);
				({ render, get_css_for_hashes } = await vite.ssrLoadModule('ripple/server'));
			} finally {
				globalThis.rpc_modules = previous_rpc;
			}

			const { App } = await vite.ssrLoadModule('/src/App.ripple');

			const { head, body, css } = await render(App);

			// Get the actual CSS content for the rendered components
			let css_tags = '';
			if (css.size > 0) {
				const css_content = get_css_for_hashes(css);
				if (css_content) {
					// Inline CSS for development (simpler and faster)
					css_tags = `<style data-ripple-ssr>${css_content}</style>`;
				}
			}

			const html = transformed_template
				.replace(`<!--ssr-head-->`, head + css_tags)
				.replace(`<!--ssr-body-->`, body);

			res.writeHead(200, { 'Content-Type': 'text/html' }).end(html);
		} catch (err) {
			console.error('SSR Error:', err);
			res.writeHead(500, { 'Content-Type': 'text/plain' }).end(err.stack);
		}
	})
	.listen(PORT, () => {
		console.log(`http://localhost:${PORT}`);
	});
