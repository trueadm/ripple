import fs from 'node:fs/promises';
import path from 'node:path';
import { compile_to_volar_mappings } from 'ripple/compiler';

const dir = './src/';
const output_dir = './debug';

await fs.rm(output_dir, { recursive: true, force: true });
await fs.mkdir(output_dir, { recursive: true });

for (const filename of await fs.readdir(dir)) {
	if (filename.endsWith('.ripple')) {
		const source = await fs.readFile(path.join(dir, filename), 'utf-8');
		const result = compile_to_volar_mappings(source, filename);
		await fs.writeFile(`${output_dir}/${filename.replace('.ripple', '.tsx')}`, result.code);

		// Also output mappings for debugging
		await fs.writeFile(
			`${output_dir}/${filename.replace('.ripple', '.mappings.json')}`,
			JSON.stringify(result.mappings, null, 2)
		);
	}
}
