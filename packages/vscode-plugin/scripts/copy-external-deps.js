#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { getPackagePaths } from './collect-external-deps.js';

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length < 2) {
	console.error('Usage: copy-external-deps.js <distDir> <package1> [package2] [package3] ...');
	process.exit(1);
}

const distDir = path.resolve(args[0]);
const rootPackages = args.slice(1);

/**
 * Recursively copy directory contents, avoiding symlink loops
 * @param {string} src
 * @param {string} dest
 * @param {Set<string>} visited
 */
function copyDir(src, dest, visited = new Set()) {
	// Resolve the real path to detect symlink loops
	const realSrc = fs.realpathSync(src);

	// Check if we've already visited this real path
	if (visited.has(realSrc)) {
		return; // Skip to avoid infinite loop
	}
	visited.add(realSrc);

	// Create destination directory
	if (!fs.existsSync(dest)) {
		fs.mkdirSync(dest, { recursive: true });
	}

	const entries = fs.readdirSync(src, { withFileTypes: true });

	for (const entry of entries) {
		const srcPath = path.join(src, entry.name);
		const destPath = path.join(dest, entry.name);

		if (entry.isDirectory()) {
			// Skip node_modules to avoid infinite loops in workspace packages
			if (entry.name === 'node_modules') {
				continue;
			}
			copyDir(srcPath, destPath, visited);
		} else if (entry.isSymbolicLink()) {
			// For symlinks, copy the target content, not the link itself
			try {
				const linkTarget = fs.readlinkSync(srcPath);
				const resolvedTarget = path.resolve(path.dirname(srcPath), linkTarget);

				if (fs.existsSync(resolvedTarget)) {
					const stat = fs.statSync(resolvedTarget);
					if (stat.isDirectory()) {
						copyDir(resolvedTarget, destPath, visited);
					} else {
						fs.copyFileSync(resolvedTarget, destPath);
					}
				}
			} catch (err) {
				// If symlink resolution fails, skip it
				console.warn(`  ⚠ Warning: Could not resolve symlink ${srcPath}`);
			}
		} else {
			// Regular file
			fs.copyFileSync(srcPath, destPath);
		}
	}
}

/**
 * Remove directory recursively
 * @param {string} dir
 */
function removeDir(dir) {
	if (fs.existsSync(dir)) {
		fs.rmSync(dir, { recursive: true, force: true });
	}
}

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
		// Remove existing directory to ensure clean copy
		removeDir(destPath);

		// Copy the package
		copyDir(srcPath, destPath);
		console.log(`  ✓ ${packageName}`);
	} catch (error) {
		console.error(`  ✗ Error copying ${packageName}:`, error.message);
		process.exit(1);
	}
}

console.log('');
console.log('✅ External dependencies copied successfully');
