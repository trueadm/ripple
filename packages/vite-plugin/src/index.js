/** @import {PackageJson} from 'type-fest' */
/** @import {Plugin, ResolvedConfig} from 'vite' */
/** @import {RipplePluginOptions} from '@ripple-ts/vite-plugin' */

import { compile } from 'ripple/compiler';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const VITE_FS_PREFIX = '/@fs/';
const IS_WINDOWS = process.platform === 'win32';

/**
 * @param {string} filename
 * @param {ResolvedConfig['root']} root
 * @returns {boolean}
 */
function existsInRoot(filename, root) {
	if (filename.startsWith(VITE_FS_PREFIX)) {
		return false; // vite already tagged it as out of root
	}
	return fs.existsSync(root + filename);
}

/**
 * @param {string} filename
 * @param {ResolvedConfig['root']} root
 * @param {'style'} type
 * @returns {string}
 */
function createVirtualImportId(filename, root, type) {
	const parts = ['ripple', `type=${type}`];
	if (type === 'style') {
		parts.push('lang.css');
	}
	if (existsInRoot(filename, root)) {
		filename = root + filename;
	} else if (filename.startsWith(VITE_FS_PREFIX)) {
		filename = IS_WINDOWS
			? filename.slice(VITE_FS_PREFIX.length) // remove /@fs/ from /@fs/C:/...
			: filename.slice(VITE_FS_PREFIX.length - 1); // remove /@fs from /@fs/home/user
	}
	// return same virtual id format as vite-plugin-vue eg ...App.ripple?ripple&type=style&lang.css
	return `${filename}?${parts.join('&')}`;
}

/**
 * Check if a package contains Ripple source files by examining its package.json
 * @param {string} packageJsonPath
 * @param {string} subpath - The subpath being imported (e.g., '.' or './foo')
 * @returns {boolean}
 */
function hasRippleSource(packageJsonPath, subpath = '.') {
	try {
		/** @type {PackageJson} */
		const pkgJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

		// Check if main/module/exports point to .ripple files
		/** @param {string | undefined} p */
		const checkPath = (p) => p && typeof p === 'string' && p.endsWith('.ripple');

		// Handle exports field (modern)
		if (pkgJson.exports) {
			/**
			 * @param {PackageJson.Exports} exports
			 * @returns {string | null}
			 */
			const resolveExport = (exports) => {
				if (typeof exports === 'string') {
					return exports;
				}
				if (typeof exports === 'object' && exports !== null) {
					// Try import condition first, then default
					const exp = /** @type {Record<string, PackageJson.Exports>} */ (exports);
					if (typeof exp.import === 'string') {
						return exp.import;
					}
					if (typeof exp.default === 'string') {
						return exp.default;
					}
					// Recursively check nested conditions
					for (const value of Object.values(exp)) {
						const resolved = resolveExport(value);
						if (resolved) return resolved;
					}
				}
				return null;
			};

			// Get the exports value for the subpath
			/** @type {PackageJson.Exports | undefined} */
			const exportsValue =
				typeof pkgJson.exports === 'string'
					? pkgJson.exports
					: typeof pkgJson.exports === 'object' && pkgJson.exports !== null
						? /** @type {Record<string, PackageJson.Exports>} */ (pkgJson.exports)[subpath]
						: undefined;

			if (exportsValue) {
				const resolved = resolveExport(exportsValue);
				if (resolved && checkPath(resolved)) {
					return true;
				}
			}
		}

		// Fallback to main/module for root imports
		if (subpath === '.') {
			if (checkPath(pkgJson.main) || checkPath(pkgJson.module)) {
				return true;
			}
		}

		// Last resort: scan the package directory for .ripple files
		const packageDir = packageJsonPath.replace('/package.json', '');
		return hasRippleFilesInDirectory(packageDir);
	} catch (e) {
		return false;
	}
}

/**
 * Recursively check if a directory contains any .ripple files
 * @param {string} dir
 * @param {number} [maxDepth=3]
 * @returns {boolean}
 */
function hasRippleFilesInDirectory(dir, maxDepth = 3) {
	if (maxDepth <= 0) return false;

	try {
		const entries = fs.readdirSync(dir, { withFileTypes: true });

		for (const entry of entries) {
			// Skip node_modules and hidden directories
			if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
				continue;
			}

			if (entry.isFile() && entry.name.endsWith('.ripple')) {
				return true;
			}

			if (entry.isDirectory()) {
				const subDir = dir + '/' + entry.name;
				if (hasRippleFilesInDirectory(subDir, maxDepth - 1)) {
					return true;
				}
			}
		}
	} catch (e) {
		// Ignore errors
	}

	return false;
}

/**
 * Try to resolve a package's package.json from node_modules
 * @param {string} packageName
 * @param {string} fromDir
 * @returns {string | null}
 */
function resolvePackageJson(packageName, fromDir) {
	try {
		const require = createRequire(fromDir + '/package.json');
		const packagePath = require.resolve(packageName + '/package.json');
		return packagePath;
	} catch (e) {
		return null;
	}
}

/**
 * Scan node_modules for packages containing Ripple source files
 * @param {string} rootDir
 * @returns {string[]}
 */
function scanForRipplePackages(rootDir) {
	/** @type {string[]} */
	const ripplePackages = [];
	const nodeModulesPath = rootDir + '/node_modules';

	if (!fs.existsSync(nodeModulesPath)) {
		return ripplePackages;
	}

	try {
		// Read all directories in node_modules
		const entries = fs.readdirSync(nodeModulesPath, { withFileTypes: true });

		for (const entry of entries) {
			// Skip .pnpm and other hidden directories
			if (entry.name.startsWith('.')) continue;

			// Handle scoped packages (@org/package)
			if (entry.name.startsWith('@')) {
				const scopePath = nodeModulesPath + '/' + entry.name;
				try {
					const scopedEntries = fs.readdirSync(scopePath, { withFileTypes: true });

					for (const scopedEntry of scopedEntries) {
						if (scopedEntry.name.startsWith('.')) continue;
						const packageName = entry.name + '/' + scopedEntry.name;
						const pkgPath = scopePath + '/' + scopedEntry.name;

						// Follow symlinks to get the real path
						const realPath = fs.realpathSync(pkgPath);
						const pkgJsonPath = realPath + '/package.json';

						if (fs.existsSync(pkgJsonPath) && hasRippleSource(pkgJsonPath, '.')) {
							ripplePackages.push(packageName);
						}
					}
				} catch (e) {
					// Skip if can't read scoped directory
				}
			} else {
				// Regular package
				const pkgPath = nodeModulesPath + '/' + entry.name;

				try {
					// Follow symlinks to get the real path
					const realPath = fs.realpathSync(pkgPath);
					const pkgJsonPath = realPath + '/package.json';

					if (fs.existsSync(pkgJsonPath) && hasRippleSource(pkgJsonPath, '.')) {
						ripplePackages.push(entry.name);
					}
				} catch (e) {
					// Skip if can't resolve symlink
				}
			}
		}
	} catch (e) {
		// Ignore errors during scanning
	}

	return ripplePackages;
}

/**
 * @param {RipplePluginOptions} [inlineOptions]
 * @returns {Plugin[]}
 */
export function ripple(inlineOptions = {}) {
	const { excludeRippleExternalModules = false } = inlineOptions;
	const api = {};
	/** @type {ResolvedConfig['root']} */
	let root;
	/** @type {ResolvedConfig} */
	let config;
	const ripplePackages = new Set();
	const cssCache = new Map();

	/** @type {Plugin[]} */
	const plugins = [
		{
			name: 'vite-plugin',
			// make sure our resolver runs before vite internal resolver to resolve ripple field correctly
			enforce: 'pre',
			api,

			async config(userConfig) {
				if (excludeRippleExternalModules) {
					return {
						optimizeDeps: {
							exclude: userConfig.optimizeDeps?.exclude || [],
						},
					};
				}

				// Scan node_modules for Ripple packages early
				console.log('[@ripple-ts/vite-plugin] Scanning for Ripple packages...');
				const detectedPackages = scanForRipplePackages(userConfig.root || process.cwd());
				detectedPackages.forEach((pkg) => {
					ripplePackages.add(pkg);
				});
				const existingExclude = userConfig.optimizeDeps?.exclude || [];
				console.log('[@ripple-ts/vite-plugin] Scan complete. Found:', detectedPackages);
				console.log(
					`[@ripple-ts/vite-plugin] Original vite.config 'optimizeDeps.exclude':`,
					existingExclude,
				);
				// Merge with existing exclude list
				const allExclude = [...new Set([...existingExclude, ...ripplePackages])];

				console.log(`[@ripple-ts/vite-plugin] Merged 'optimizeDeps.exclude':`, allExclude);
				console.log(
					'[@ripple-ts/vite-plugin] Pass',
					{ excludeRippleExternalModules: true },
					`option to the 'ripple' plugin to skip this scan.`,
				);

				// Return a config hook that will merge with user's config
				return {
					optimizeDeps: {
						exclude: allExclude,
					},
				};
			},

			async configResolved(resolvedConfig) {
				root = resolvedConfig.root;
				config = resolvedConfig;
			},

			async resolveId(id, importer, options) {
				// Skip non-package imports (relative/absolute paths)
				if (id.startsWith('.') || id.startsWith('/') || id.includes(':')) {
					return null;
				}

				// Extract package name and subpath (handle scoped packages)
				let packageName;
				let subpath = '.';

				if (id.startsWith('@')) {
					const parts = id.split('/');
					packageName = parts.slice(0, 2).join('/');
					subpath = parts.length > 2 ? './' + parts.slice(2).join('/') : '.';
				} else {
					const parts = id.split('/');
					packageName = parts[0];
					subpath = parts.length > 1 ? './' + parts.slice(1).join('/') : '.';
				}

				// Skip if already detected
				if (ripplePackages.has(packageName)) {
					return null;
				}

				// Try to find package.json
				const pkgJsonPath = resolvePackageJson(packageName, root || process.cwd());

				if (pkgJsonPath && hasRippleSource(pkgJsonPath, subpath)) {
					ripplePackages.add(packageName);

					// If we're in dev mode and config is available, update optimizeDeps
					if (config?.command === 'serve') {
						console.log(`[@ripple-ts/vite-plugin] Detected Ripple source package: ${packageName}`);
					}
				}

				return null; // Let Vite handle the actual resolution
			},

			async load(id, opts) {
				if (cssCache.has(id)) {
					return cssCache.get(id);
				}
			},

			transform: {
				filter: { id: /\.ripple$/ },

				async handler(code, id, opts) {
					const filename = id.replace(root, '');
					const ssr = this.environment.config.consumer === 'server';

					const { js, css } = await compile(code, filename, {
						mode: ssr ? 'server' : 'client',
					});

					if (css !== '') {
						const cssId = createVirtualImportId(filename, root, 'style');
						cssCache.set(cssId, css);
						js.code += `\nimport ${JSON.stringify(cssId)};\n`;
					}

					return js;
				},
			},
		},
	];

	return plugins;
}
