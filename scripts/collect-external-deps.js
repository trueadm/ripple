#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Find workspace root by looking for pnpm-workspace.yaml
 */
function findWorkspaceRoot() {
	let workspaceRoot = __dirname;
	while (workspaceRoot !== '/') {
		if (fs.existsSync(path.join(workspaceRoot, 'pnpm-workspace.yaml'))) {
			return workspaceRoot;
		}
		workspaceRoot = path.dirname(workspaceRoot);
	}
	throw new Error('Could not find workspace root (no pnpm-workspace.yaml found)');
}

/**
 * Resolve package path by searching node_modules directories
 * @param {string} packageName
 * @param {string} workspaceRoot
 * @returns {string|null}
 */
function resolvePackagePath(packageName, workspaceRoot) {
	// Try direct path first (handles both regular packages and workspace symlinks)
	const directPath = path.join(workspaceRoot, 'node_modules', packageName);
	if (fs.existsSync(directPath)) {
		// Resolve symlinks for workspace packages
		const realPath = fs.realpathSync(directPath);
		if (fs.existsSync(path.join(realPath, 'package.json'))) {
			const pkg = JSON.parse(fs.readFileSync(path.join(realPath, 'package.json'), 'utf8'));
			if (pkg.name === packageName) {
				return realPath;
			}
		}
	}

	// Check if it's a workspace package in packages/ directory
	const packageDirName = packageName.startsWith('@') ? packageName.split('/')[1] : packageName;
	const workspacePath = path.join(workspaceRoot, 'packages', packageDirName);
	if (fs.existsSync(workspacePath) && fs.existsSync(path.join(workspacePath, 'package.json'))) {
		const pkg = JSON.parse(fs.readFileSync(path.join(workspacePath, 'package.json'), 'utf8'));
		if (pkg.name === packageName) {
			return workspacePath;
		}
	}

	// Search in .pnpm store
	const pnpmStore = path.join(workspaceRoot, 'node_modules/.pnpm');
	if (fs.existsSync(pnpmStore)) {
		const entries = fs.readdirSync(pnpmStore);
		for (const entry of entries) {
			const normalized = packageName.replace('/', '+');
			if (entry.startsWith(normalized + '@')) {
				const pkgPath = path.join(pnpmStore, entry, 'node_modules', packageName);
				if (fs.existsSync(pkgPath) && fs.existsSync(path.join(pkgPath, 'package.json'))) {
					return pkgPath;
				}
			}
		}
	}

	return null;
}

/**
 * Recursively collect all dependencies of a package
 * @param {string} packageName
 * @param {string} workspaceRoot
 * @param {Map<string, string>} collected
 * @returns {Map<string, string>}
 */
function collectDependencies(packageName, workspaceRoot, collected = new Map()) {
	// Skip if already processed
	if (collected.has(packageName)) {
		return collected;
	}

	// Resolve the package path
	const packagePath = resolvePackagePath(packageName, workspaceRoot);

	if (!packagePath) {
		return collected;
	}

	// Add to the map
	collected.set(packageName, packagePath);

	// Read package.json to find dependencies
	const packageJsonPath = path.join(packagePath, 'package.json');
	if (!fs.existsSync(packageJsonPath)) {
		return collected;
	}

	const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
	const deps = { ...packageJson.dependencies };

	// Add non-optional peer dependencies
	if (packageJson.peerDependencies) {
		for (const [depName, depVersion] of Object.entries(packageJson.peerDependencies)) {
			if (packageJson.peerDependenciesMeta?.[depName]?.optional) {
				continue;
			}
			deps[depName] = depVersion;
		}
	}

	// Recursively collect dependencies
	for (const depName of Object.keys(deps)) {
		collectDependencies(depName, workspaceRoot, collected);
	}

	return collected;
}

/**
 * Get all external packages that need to be copied
 * @param {string[]} rootPackages
 * @returns {string[]}
 */
export function getAllExternalPackages(rootPackages) {
	const workspaceRoot = findWorkspaceRoot();
	const allPackages = new Map();

	for (const pkg of rootPackages) {
		collectDependencies(pkg, workspaceRoot, allPackages);
	}

	return Array.from(allPackages.keys());
}

/**
 * Get package paths for copying
 * @param {string[]} rootPackages
 * @returns {Map<string, string>}
 */
export function getPackagePaths(rootPackages) {
	const workspaceRoot = findWorkspaceRoot();
	const allPackages = new Map();

	for (const pkg of rootPackages) {
		collectDependencies(pkg, workspaceRoot, allPackages);
	}

	return allPackages;
}
