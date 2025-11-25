#!/usr/bin/env node

import { rmSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Usage: node scripts/remove.js <path>
// Example: node scripts/remove.js packages/vscode-plugin/vscode-plugin

const [, , path] = process.argv;

if (!path) {
	console.error('Usage: node scripts/remove.js <path>');
	console.error('Example: node scripts/remove.js packages/vscode-plugin/vscode-plugin');
	process.exit(1);
}

const targetPath = join(__dirname, '..', path);

try {
	rmSync(targetPath, { recursive: true, force: true });
} catch (error) {
	console.error(`Error: ${/** @type {Error} */ (error).message}`);
	process.exit(1);
}
