import fs from 'node:fs/promises';
import path from 'node:path';
import { compile } from 'ripple/compiler';

const dir = './src/';
const output_dir = './debug';

await fs.rm(output_dir, { recursive: true, force: true });
await fs.mkdir(output_dir, { recursive: true });

for (const filename of await fs.readdir(dir)) {
	if (filename.endsWith('.ripple')) {
		const source = await fs.readFile(path.join(dir, filename), 'utf-8');
		const result = compile(source, filename, { mode: 'server' });
		const base_name = filename.replace('.ripple', '');
		await fs.writeFile(`${output_dir}/${base_name}.js`, result.js.code);
		if (result.css) {
			await fs.writeFile(`${output_dir}/${base_name}.css`, result.css);
		}
	}
}
