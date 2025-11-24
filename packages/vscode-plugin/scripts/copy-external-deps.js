#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { getPackagePaths } from './collect-external-deps.js';

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length < 2) {
	console.error('Usage: copy-external-deps.js <distDir> <package1> [package2] [package3] ...');
	process.exit(1);
}

const distDir = path.resolve(args[0]);
const rootPackages = args.slice(1);

console.log('🔍 Collecting dependency tree...');
console.log('');

// Collect all packages
const packagesToCopy = getPackagePaths(rootPackages);

// Log the tree
for (const [packageName] of packagesToCopy) {
	console.log(`📦 ${packageName}`);
}

console.log('');
console.log(`📋 Found ${packagesToCopy.size} packages to copy`);
console.log('');
console.log('📂 Copying packages...');

// Create dist/node_modules if it doesn't exist
const distNodeModules = path.join(distDir, 'node_modules');
if (!fs.existsSync(distNodeModules)) {
	fs.mkdirSync(distNodeModules, { recursive: true });
}

// Copy all collected packages
for (const [packageName, srcPath] of packagesToCopy) {
	const destPath = path.join(distNodeModules, packageName);

	// Handle scoped packages - create parent directory if needed
	if (packageName.startsWith('@')) {
		const scopeDir = path.join(distNodeModules, packageName.split('/')[0]);
		if (!fs.existsSync(scopeDir)) {
			fs.mkdirSync(scopeDir, { recursive: true });
		}
	}

	try {
		execSync(`rsync -aL --del "${srcPath}/" "${destPath}/"`, { stdio: 'pipe' });
		console.log(`  ✓ ${packageName}`);
	} catch (error) {
		console.error(`  ✗ Error copying ${packageName}:`, error.message);
		process.exit(1);
	}
}

console.log('');
console.log('✅ External dependencies copied successfully');
