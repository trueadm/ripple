import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import polka from 'polka';
import { createServer as createViteServer } from 'vite';

const PORT = process.env.PORT || '5173';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const vite = await createViteServer({
	server: { middlewareMode: true },
	appType: 'custom'
});

polka()
	.use(vite.middlewares)
	.use(async (req, res) => {
		try {
			const template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
			const transformed_template = await vite.transformIndexHtml(req.url, template);

			const { render, get_css_for_hashes } = await vite.ssrLoadModule('ripple/server');
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
