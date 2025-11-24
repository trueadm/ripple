import { defineConfig } from 'tsdown';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { getAllExternalPackages } from '../../scripts/collect-external-deps.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Root packages to treat as external (their full dependency trees will be copied)
const ROOT_EXTERNAL_PACKAGES = [
	'typescript',
	'ripple',
	'volar-service-css',
	'vscode-uri',
	'@ripple-ts/typescript-plugin',
];
// Always external (bundled by VS Code or handled separately)
const ALWAYS_EXTERNAL = ['vscode', '@ripple-ts/typescript-plugin'];
const OUT_DIR = 'dist';

// Compute all external packages by collecting dependency trees
const computed = getAllExternalPackages(ROOT_EXTERNAL_PACKAGES);
const allExternalPackages = [...ALWAYS_EXTERNAL, ...computed];

console.log(`ℹ️  Found ${computed.length} packages to mark as external`);

export default defineConfig({
	entry: ['src/extension.js', 'src/server.js'],
	outDir: OUT_DIR,
	outputOptions: {
		legalComments: 'inline',
		minify: false,
	},
	clean: true,
	format: 'cjs',
	platform: 'node',
	target: 'node20',
	external: allExternalPackages,
	noExternal: /.+/,
	hooks: {
		'build:done': () => {
			const scriptPath = path.join(__dirname, '../../scripts/copy-external-deps.js');
			const distPath = path.join(__dirname, OUT_DIR);

			execSync(`node "${scriptPath}" "${distPath}" ${ROOT_EXTERNAL_PACKAGES.join(' ')}`, {
				stdio: 'inherit',
			});

			// Remove nested dist folder from typescript-plugin
			const nestedDistPath = path.join(
				__dirname,
				OUT_DIR,
				'node_modules',
				'@ripple-ts',
				'typescript-plugin',
				'dist',
			);
			execSync(`rm -rf "${nestedDistPath}"`, { stdio: 'inherit' });
		},
	},
});
