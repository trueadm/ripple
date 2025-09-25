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
		const template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
		const transformed_template = await vite.transformIndexHtml(req.url, template);

		const { renderToString } = await vite.ssrLoadModule('ripple/server');
		const { App } = await vite.ssrLoadModule('/src/App.ripple');

		const { head, body } = await renderToString(App);

		const html = transformed_template
			.replace(`<!--ssr-head-->`, head)
			.replace(`<!--ssr-body-->`, body);

		res.writeHead(200, { 'Content-Type': 'text/html' }).end(html);
	})
	.listen(PORT, () => {
		console.log(`http://localhost:${PORT}`);
	});