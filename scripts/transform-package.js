#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Usage: node scripts/transform-package.js <file> <json-path> <new-value>
// Example: node scripts/transform-package.js packages/vscode-plugin/package.json main "dist/extension.js"

const [, , file, jsonPath, newValue] = process.argv;

if (!file || !jsonPath || newValue === undefined) {
	console.error('Usage: node scripts/transform-package.js <file> <json-path> <new-value>');
	console.error(
		'Example: node scripts/transform-package.js packages/vscode-plugin/package.json main "dist/extension.js"',
	);
	process.exit(1);
}

const filePath = join(__dirname, '..', file);

try {
	const content = readFileSync(filePath, 'utf-8');
	const data = JSON.parse(content);

	// Set the value at the specified JSON path
	const pathParts = jsonPath.split('.');
	let current = data;

	for (let i = 0; i < pathParts.length - 1; i++) {
		if (!(pathParts[i] in current)) {
			current[pathParts[i]] = {};
		}
		current = current[pathParts[i]];
	}

	current[pathParts[pathParts.length - 1]] = newValue;

	// Write back with 2-space indentation to match original formatting
	writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
} catch (error) {
	console.error(`Error: ${/** @type {Error} */ (error).message}`);
	process.exit(1);
}
