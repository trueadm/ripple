#!/usr/bin/env node
// @ts-check

/** @typedef {'origin' | 'upstream'} GitRemoteName */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @typedef {"major" | "minor" | "patch"} BumpType */
/** @typedef {"all" | "editors"} ScopeType */
/** @typedef {[number, number, number]} SemverTuple */
/**
 * @typedef {object} PackageInfo
 * @property {string} dirName directory the package
 * @property {string} dir Absolute path to the package directory.
 * @property {string} packageJsonPath Absolute path to the package.json file.
 * @property {Record<string, any>} json Parsed contents of the package.json file.
 */

/** @type {Set<BumpType>} */
const ALLOWED_BUMPS = new Set(['major', 'minor', 'patch']);
/** @type {Set<ScopeType>} */
const ALLOWED_SCOPES = new Set(['all', 'editors']);
const VSCODE_PACKAGE_DIR_NAME = 'vscode-plugin';
const RIPPLE_PACKAGE_DIR_NAME = 'ripple';
const ZED_PACKAGE_DIR_NAME = 'zed-plugin';
const EDITOR_PACKAGE_DIRS = new Set([
	'nvim-plugin',
	'sublime-text-plugin',
	VSCODE_PACKAGE_DIR_NAME,
	ZED_PACKAGE_DIR_NAME,
]);
const EXCLUDE_PACKAGE_DIRS_FROM_PUBLISH = new Set(['tree-sitter']);
const bumpArg = process.argv[2] ?? '';
const maybeScope = process.argv[3] ?? null;
/** @type {ScopeType} */
let scope = 'all';
let overrideArg = null;

if (maybeScope && ALLOWED_SCOPES.has(/** @type {ScopeType} */ (maybeScope))) {
	scope = /** @type {ScopeType} */ (maybeScope);
	overrideArg = process.argv[4] ?? null;
} else {
	overrideArg = maybeScope;
}

if (!ALLOWED_BUMPS.has(/** @type {BumpType} */ (bumpArg))) {
	console.error('Usage: node scripts/bump-version.js <major|minor|patch> [scope] [override]');
	process.exit(1);
}

const bumpType = /** @type {BumpType} */ (bumpArg);

const REPO_ROOT = path.resolve(__dirname, '..');

/**
 * @param {string} command
 * @param {readonly string[]} args
 * @param {{ cwd?: string; stdio?: "pipe" | "inherit" }} [options]
 * @returns {string}
 */
function execSafe(command, args, options = {}) {
	const stdio = options.stdio ?? 'pipe';

	try {
		if (stdio === 'pipe') {
			const output = execFileSync(command, args, {
				cwd: options.cwd ?? REPO_ROOT,
				stdio,
				encoding: 'utf8',
			});
			return (output ?? '').toString().trim();
		}

		execFileSync(command, args, {
			cwd: options.cwd ?? REPO_ROOT,
			stdio,
		});
		return '';
	} catch (error) {
		const execError = /** @type {any} */ (error);
		if (execError.stdout) process.stdout.write(execError.stdout);
		if (execError.stderr) process.stderr.write(execError.stderr);
		throw error;
	}
}

/**
 * @returns {GitRemoteName}
 */
function determineRemote() {
	const remotes = execSafe('git', ['remote'])?.split(/\r?\n/).filter(Boolean) ?? [];
	if (remotes.includes('upstream')) {
		return 'upstream';
	}
	if (remotes.includes('origin')) {
		return 'origin';
	}
	throw new Error("No git remote named 'upstream' or 'origin' found.");
}

/**
 * @param {GitRemoteName} remote
 */
function ensureGitState(remote) {
	const branch = execSafe('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
	if (branch !== 'main') {
		throw new Error("Current branch is not 'main'. Please switch to 'main' and try again.");
	}

	execSafe('git', ['fetch', remote, 'main'], { stdio: 'inherit' });

	const status = execSafe('git', ['status', '--porcelain']);
	if (status) {
		throw new Error(
			'Working tree is dirty. Please commit or stash changes before running the bump script.',
		);
	}

	const divergence = execSafe('git', [
		'rev-list',
		'--left-right',
		'--count',
		`main...${remote}/main`,
	]);
	const [behind, ahead] = divergence.split(/\s+/).map((value) => Number.parseInt(value, 10));
	if (behind > 0) {
		throw new Error(
			`Local main is behind ${remote}/main by ${behind} commit(s). Please pull the latest changes.`,
		);
	}
	if (ahead > 0) {
		throw new Error(
			`Local main is ahead of ${remote}/main by ${ahead} commit(s). Please push or reset before proceeding.`,
		);
	}
}

function ensureNpmToken() {
	try {
		execSafe('npm', ['whoami']);
	} catch (error) {
		throw new Error(
			'npm authentication failed. Please ensure you are logged in with a valid npm token. Run `npm login` to authenticate.',
		);
	}
}

/**
 * @param {string} version
 * @returns {SemverTuple}
 */
function parseSemver(version) {
	const parts = version.split('.').map((value) => Number.parseInt(value, 10));
	if (parts.length !== 3 || parts.some(Number.isNaN)) {
		throw new Error(`Invalid semantic version: ${version}`);
	}
	return /** @type {SemverTuple} */ ([parts[0], parts[1], parts[2]]);
}

/**
 * @param {SemverTuple} a
 * @param {SemverTuple} b
 */
function isGreaterVersion(a, b) {
	if (a[0] !== b[0]) return a[0] > b[0];
	if (a[1] !== b[1]) return a[1] > b[1];
	return a[2] > b[2];
}

/**
 * @param {string} version
 * @param {BumpType} type
 */
function bumpVersion(version, type) {
	const [major, minor, patch] = parseSemver(version);
	if (type === 'major') {
		return `${major + 1}.0.0`;
	}
	if (type === 'minor') {
		return `${major}.${minor + 1}.0`;
	}
	return `${major}.${minor}.${patch + 1}`;
}

/**
 * @param {BumpType} type
 * @param {string} override
 * @param {SemverTuple} currentTuple
 */
function parseOverride(type, override, currentTuple) {
	if (!/^\d+$/.test(override)) {
		throw new Error('Override must be provided as a non-negative integer.');
	}

	const numeric = Number.parseInt(override, 10);

	if (type === 'major') {
		return `${numeric}.0.0`;
	}

	if (type === 'minor') {
		return `${currentTuple[0]}.${numeric}.0`;
	}

	return `${currentTuple[0]}.${currentTuple[1]}.${numeric}`;
}

/**
 * @param {ScopeType} targetScope
 */
function loadPackages(targetScope) {
	const packagesDir = path.join(REPO_ROOT, 'packages');
	const entries = fs.readdirSync(packagesDir, { withFileTypes: true });
	/** @type {PackageInfo[]} */
	const packages = [];

	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		if (targetScope === 'all' && EDITOR_PACKAGE_DIRS.has(entry.name)) continue;
		if (targetScope === 'editors' && !EDITOR_PACKAGE_DIRS.has(entry.name)) continue;

		const packageJsonPath = path.join(packagesDir, entry.name, 'package.json');
		if (!fs.existsSync(packageJsonPath)) continue;

		const raw = fs.readFileSync(packageJsonPath, 'utf8');
		const json = JSON.parse(raw);

		packages.push({
			dirName: entry.name,
			dir: path.join(packagesDir, entry.name),
			packageJsonPath,
			json,
		});
	}

	if (packages.length === 0) {
		throw new Error('No packages found to update.');
	}

	return packages;
}

/**
 * @param {PackageInfo} pkg
 */
function writePackage(pkg) {
	const content = `${JSON.stringify(pkg.json, null, 2)}\n`;
	fs.writeFileSync(pkg.packageJsonPath, content);
}

/**
 * @param {string} fileDir
 * @param {string} fileName
 * @param {string} newVersion
 */
function updateVersionInTomlFile(fileDir, fileName, newVersion) {
	const filePath = path.join(fileDir, fileName);
	if (!fs.existsSync(filePath)) {
		throw new Error(
			`Failed to update version in ${path.relative(REPO_ROOT, filePath)}: file does not exist.`,
		);
	}
	const original = fs.readFileSync(filePath, 'utf8');
	let replaced = false;
	const updatedContent = original.replace(
		/(\bversion\s*=\s*")([^"]+)(")/,
		(match, prefix, _current, suffix) => {
			replaced = true;
			return `${prefix}${newVersion}${suffix}`;
		},
	);
	if (!replaced) {
		throw new Error(
			`Failed to update version in ${path.relative(REPO_ROOT, filePath)}: version field not found.`,
		);
	}
	fs.writeFileSync(filePath, updatedContent);
}

/**
 * @param {PackageInfo} pkg
 * @param {string} version
 * @return {string[]}
 */
function updateAdditionalVersionFiles(pkg, version) {
	/** @type {string[]} */
	const changedPaths = [];

	if (pkg.dirName === ZED_PACKAGE_DIR_NAME) {
		updateVersionInTomlFile(pkg.dir, 'Cargo.toml', version);
		changedPaths.push(path.relative(REPO_ROOT, path.join(pkg.dir, 'Cargo.toml')));

		updateVersionInTomlFile(pkg.dir, 'extension.toml', version);
		changedPaths.push(path.relative(REPO_ROOT, path.join(pkg.dir, 'extension.toml')));
	}

	return changedPaths;
}

/**
 * @param {PackageInfo} pkg
 * @param {string} newVersion
 */
function publishPackage(pkg, newVersion) {
	console.log(`Publishing ${pkg.json.name}@${newVersion}`);
	const args = ['publish'];
	if (pkg.json.publishConfig?.access === 'public' || pkg.json.name.startsWith('@')) {
		args.push('--access', 'public');
	}
	execSafe('pnpm', args, { cwd: pkg.dir, stdio: 'inherit' });
}

/**
 * @param {PackageInfo} pkg
 * @param {string} version
 */
function ensureVersionNotPublished(pkg, version) {
	try {
		execFileSync('npm', ['view', `${pkg.json.name}@${version}`, 'version'], {
			cwd: pkg.dir,
			stdio: 'pipe',
			encoding: 'utf8',
		});
	} catch (error) {
		const err = /** @type {any} */ (error);
		if (!err || typeof err !== 'object') {
			throw error;
		}

		const stderr = err.stderr ? err.stderr.toString() : '';
		const stdout = err.stdout ? err.stdout.toString() : '';
		const combined = `${stdout}\n${stderr}`;

		if (/E404/i.test(combined) || /404 Not Found/i.test(combined)) {
			return;
		}

		throw new Error(
			`Failed to check npm registry for ${pkg.json.name}@${version}: ${err.message ?? err}`,
		);
	}

	throw new Error(`${pkg.json.name}@${version} is already published on npm.`);
}

/**
 * @param {string} directory
 */
function preparePackOutputDir(directory) {
	fs.rmSync(directory, { recursive: true, force: true });
	fs.mkdirSync(directory, { recursive: true });
}

/**
 * @param {string} directory
 */
function cleanupPackOutputDir(directory) {
	fs.rmSync(directory, { recursive: true, force: true });
}

/**
 * @param {PackageInfo} pkg
 * @param {string} destination
 */
function runPackagePack(pkg, destination) {
	console.log(`Running pnpm pack for ${pkg.json.name} into ${destination}`);
	execSafe('pnpm', ['pack', '--pack-destination', destination], {
		cwd: pkg.dir,
		stdio: 'inherit',
	});
}

/**
 * @param {readonly PackageInfo[]} packages
 * @param {string} version
 * @param {ScopeType} targetScope
 */
function runPrePublishChecks(packages, version, targetScope) {
	console.log('\nPerforming pre-publish checks...');
	const packOutputDir = path.join(REPO_ROOT, '.tmp', 'prepublish-pack');
	preparePackOutputDir(packOutputDir);

	try {
		if (targetScope === 'editors') {
			runEditorsScopePreCheck(packages);
		}

		for (const pkg of packages) {
			console.log(`\nVerifying ${pkg.json.name}@${version}`);
			ensureVersionNotPublished(pkg, version);
			runPackagePack(pkg, packOutputDir);
		}
		console.log('\nAll pre-publish checks passed. Proceeding to publish.');
	} finally {
		cleanupPackOutputDir(packOutputDir);
	}
}

function revertLastCommit() {
	execSafe('git', ['reset', '--hard', 'HEAD~1'], { stdio: 'inherit' });
}

/**
 * Attempt to land the bump commit by rebasing onto the latest remote main branch.
 * @param {GitRemoteName} remote
 * @param {string} version
 */
function attemptRebaseAndPush(remote, version) {
	console.log('\nPush failed; attempting automatic rebase onto the latest main...');
	execSafe('git', ['fetch', remote, 'main'], { stdio: 'inherit' });

	try {
		execSafe('git', ['rebase', `${remote}/main`], { stdio: 'inherit' });
	} catch (error) {
		try {
			execSafe('git', ['rebase', '--abort'], { stdio: 'inherit' });
		} catch (abortError) {
			const abortMessage = abortError instanceof Error ? abortError.message : String(abortError);
			console.error(`Failed to abort rebase automatically: ${abortMessage}`);
		}
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(
			`Automatic rebase encountered conflicts. Resolve manually and push the bump commit. Details: ${message}`,
		);
	}

	try {
		execSafe('git', ['push', remote, 'main'], { stdio: 'inherit' });
		console.log(`Completed bump to ${version} after automatic rebase.`);
	} catch (pushError) {
		const message = pushError instanceof Error ? pushError.message : String(pushError);
		throw new Error(`Push failed after successful rebase: ${message}`);
	}
}

/**
 * @param {readonly PackageInfo[]} packages
 */
function runEditorsScopePreCheck(packages) {
	const vscodePackage = packages.find((pkg) => pkg.dirName === VSCODE_PACKAGE_DIR_NAME);
	if (!vscodePackage) {
		throw new Error(
			`Unable to locate '${VSCODE_PACKAGE_DIR_NAME}' package for editors scope checks.`,
		);
	}

	console.log('\nRunning VS Code extension pre-check: pnpm run build-and-package');
	execSafe('pnpm', ['run', 'build-and-package'], {
		cwd: vscodePackage.dir,
		stdio: 'inherit',
	});
}

(function main() {
	try {
		const remote = determineRemote();
		ensureNpmToken();
		ensureGitState(remote);

		const packages = loadPackages(scope);

		const basePackage =
			scope === 'editors'
				? packages.find((pkg) => pkg.dirName === VSCODE_PACKAGE_DIR_NAME)
				: packages.find((pkg) => pkg.dirName === RIPPLE_PACKAGE_DIR_NAME);

		if (!basePackage) {
			const target =
				scope === 'editors' ? `'${VSCODE_PACKAGE_DIR_NAME}'` : `'${RIPPLE_PACKAGE_DIR_NAME}'`;
			throw new Error(`Unable to locate the ${target} package to determine the base version.`);
		}

		const currentVersion = basePackage.json.version;
		const currentTuple = parseSemver(currentVersion);
		const newVersion = overrideArg
			? parseOverride(bumpType, overrideArg, currentTuple)
			: bumpVersion(currentVersion, bumpType);
		const newTuple = parseSemver(newVersion);
		if (!isGreaterVersion(newTuple, currentTuple)) {
			const label = overrideArg ? 'Override version' : 'Computed version';
			throw new Error(
				`${label} ${newVersion} must be greater than current version ${currentVersion}.`,
			);
		}

		if (packages.every((pkg) => pkg.json.version === newVersion)) {
			console.log(`All packages already set to version ${newVersion}. Nothing to do.`);
			return;
		}

		const changedPaths = [];
		for (const pkg of packages) {
			pkg.json.version = newVersion;
			writePackage(pkg);
			changedPaths.push(path.relative(REPO_ROOT, pkg.packageJsonPath));
			const additional = updateAdditionalVersionFiles(pkg, newVersion);
			changedPaths.push(...additional);
		}
		execSafe('git', ['add', ...changedPaths]);

		const scopeLabel = scope;
		const commitMessage = `chore: bump ${scopeLabel} to v${newVersion}`;
		let commitCreated = false;
		let publishStarted = false;
		let publishCompleted = false;
		let pushCompleted = false;
		let publishCount = 0;

		try {
			execSafe('git', ['commit', '-m', commitMessage], { stdio: 'inherit' });
			commitCreated = true;

			runPrePublishChecks(packages, newVersion, scope);

			for (const pkg of packages) {
				if (EDITOR_PACKAGE_DIRS.has(pkg.dirName)) {
					console.log(`Skipping publish for editor plugin package '${pkg.dirName}'.`);
					continue;
				}
				if (EXCLUDE_PACKAGE_DIRS_FROM_PUBLISH.has(pkg.dirName)) {
					console.log(`Skipping publish for excluded package '${pkg.dirName}'.`);
					continue;
				}
				if (!publishStarted) {
					publishStarted = true;
				}

				publishPackage(pkg, newVersion);
				publishCount++;
			}
			publishCompleted = true;

			execSafe('git', ['push', remote, 'main'], { stdio: 'inherit' });
			pushCompleted = true;
			console.log(`Completed bump to ${newVersion}.`);
		} catch (caughtError) {
			let error = caughtError instanceof Error ? caughtError : new Error(String(caughtError));

			if (!commitCreated) {
				throw new Error(`Git commit failed: ${error.message}`);
			}

			if (commitCreated && publishCompleted && !pushCompleted) {
				try {
					attemptRebaseAndPush(remote, newVersion);
					pushCompleted = true;
					return;
				} catch (rebaseError) {
					error = rebaseError instanceof Error ? rebaseError : new Error(String(rebaseError));
				}
			}

			if (commitCreated && (!publishStarted || publishCount === 0)) {
				try {
					revertLastCommit();
					const msg = !publishStarted
						? 'Pre-publish checks failed.'
						: 'Error while publishing the first package.';
					console.error(`${msg} The bump commit has been reverted.`);
				} catch (revertError) {
					const revertMessage =
						revertError instanceof Error ? revertError.message : String(revertError);
					console.error(`Failed to reset bump commit automatically: ${revertMessage}`);
					console.error(
						'Please run `git reset --hard HEAD~1` manually to discard the failed bump commit.',
					);
				}
			}

			throw error;
		}
	} catch (error) {
		const err = error instanceof Error ? error : new Error(String(error));
		console.error(`\nError: ${err.message}`);
		process.exit(1);
	}
})();
