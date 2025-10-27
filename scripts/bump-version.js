#!/usr/bin/env node
// @ts-check

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ALLOWED_BUMPS = new Set(["major", "minor", "patch"]);
const ALLOWED_SCOPES = new Set(["all", "vscode"]);

const bumpArg = process.argv[2] ?? "";
const maybeScope = process.argv[3] ?? null;
/** @type {"all" | "vscode"} */
let scope = "all";
let overrideArg = null;

if (maybeScope && ALLOWED_SCOPES.has(maybeScope)) {
	scope = /** @type {"all" | "vscode"} */ (maybeScope);
	overrideArg = process.argv[4] ?? null;
} else {
	overrideArg = maybeScope;
}

if (!ALLOWED_BUMPS.has(bumpArg)) {
	console.error("Usage: node scripts/bump-version.js <major|minor|patch> [scope] [override]");
	process.exit(1);
}

const bumpType = /** @type {"major" | "minor" | "patch"} */ (bumpArg);

const repoRoot = path.resolve(__dirname, "..");

/**
 * @param {string} command
 * @param {readonly string[]} args
 * @param {{ cwd?: string; stdio?: "pipe" | "inherit" }} [options]
 * @returns {string}
 */
function execSafe(command, args, options = {}) {
	const stdio = options.stdio ?? "pipe";

	try {
		if (stdio === "pipe") {
			const output = execFileSync(command, args, {
				cwd: options.cwd ?? repoRoot,
				stdio,
				encoding: "utf8"
			});
			return (output ?? "").toString().trim();
		}

		execFileSync(command, args, {
			cwd: options.cwd ?? repoRoot,
			stdio
		});
		return "";
	} catch (error) {
		const execError = /** @type {any} */ (error);
		if (execError.stdout) process.stdout.write(execError.stdout);
		if (execError.stderr) process.stderr.write(execError.stderr);
		throw error;
	}
}

function determineRemote() {
	const remotes = execSafe("git", ["remote"])?.split(/\r?\n/).filter(Boolean) ?? [];
	if (remotes.includes("upstream")) {
		return "upstream";
	}
	if (remotes.includes("origin")) {
		return "origin";
	}
	throw new Error("No git remote named 'upstream' or 'origin' found.");
}

/**
 * @param {string} remote
 */
function ensureGitState(remote) {
	const branch = execSafe("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
	if (branch !== "main") {
		throw new Error("Current branch is not 'main'. Please switch to 'main' and try again.");
	}

	execSafe("git", ["fetch", remote, "main"], { stdio: "inherit" });

	const status = execSafe("git", ["status", "--porcelain"]);
	if (status) {
		throw new Error("Working tree is dirty. Please commit or stash changes before running the bump script.");
	}

	const divergence = execSafe("git", ["rev-list", "--left-right", "--count", `main...${remote}/main`]);
	const [behind, ahead] = divergence.split(/\s+/).map((value) => Number.parseInt(value, 10));
	if (behind > 0) {
		throw new Error(`Local main is behind ${remote}/main by ${behind} commit(s). Please pull the latest changes.`);
	}
	if (ahead > 0) {
		throw new Error(`Local main is ahead of ${remote}/main by ${ahead} commit(s). Please push or reset before proceeding.`);
	}
}

/**
 * @param {string} version
 * @returns {[number, number, number]}
 */
function parseSemver(version) {
	const parts = version.split(".").map((value) => Number.parseInt(value, 10));
	if (parts.length !== 3 || parts.some(Number.isNaN)) {
		throw new Error(`Invalid semantic version: ${version}`);
	}
	return /** @type {[number, number, number]} */ ([parts[0], parts[1], parts[2]]);
}

/**
 * @param {[number, number, number]} a
 * @param {[number, number, number]} b
 */
function isGreaterVersion(a, b) {
	if (a[0] !== b[0]) return a[0] > b[0];
	if (a[1] !== b[1]) return a[1] > b[1];
	return a[2] > b[2];
}

/**
 * @param {string} version
 * @param {"major" | "minor" | "patch"} type
 */
function bumpVersion(version, type) {
	const [major, minor, patch] = parseSemver(version);
	if (type === "major") {
		return `${major + 1}.0.0`;
	}
	if (type === "minor") {
		return `${major}.${minor + 1}.0`;
	}
	return `${major}.${minor}.${patch + 1}`;
}

/**
 * @param {"major" | "minor" | "patch"} type
 * @param {string} override
 * @param {[number, number, number]} currentTuple
 */
function parseOverride(type, override, currentTuple) {
	if (!/^\d+$/.test(override)) {
		throw new Error("Override must be provided as a non-negative integer.");
	}

	const numeric = Number.parseInt(override, 10);

	if (type === "major") {
		return `${numeric}.0.0`;
	}

	if (type === "minor") {
		return `${currentTuple[0]}.${numeric}.0`;
	}

	return `${currentTuple[0]}.${currentTuple[1]}.${numeric}`;
}

/**
 * @param {"all" | "vscode"} targetScope
 */
function loadPackages(targetScope) {
	const packagesDir = path.join(repoRoot, "packages");
	const entries = fs.readdirSync(packagesDir, { withFileTypes: true });
	const packages = [];

	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		if (targetScope === "all" && entry.name === "ripple-vscode-plugin") continue;
		if (targetScope === "vscode" && entry.name !== "ripple-vscode-plugin") continue;

		const packageJsonPath = path.join(packagesDir, entry.name, "package.json");
		if (!fs.existsSync(packageJsonPath)) continue;

		const raw = fs.readFileSync(packageJsonPath, "utf8");
		const json = JSON.parse(raw);

		packages.push({
			dir: path.join(packagesDir, entry.name),
			packageJsonPath,
			json
		});
	}

	if (packages.length === 0) {
		throw new Error("No packages found to update.");
	}

	return packages;
}

/**
 * @param {{ packageJsonPath: string; json: Record<string, any> }} pkg
 */
function writePackage(pkg) {
	const content = `${JSON.stringify(pkg.json, null, 2)}\n`;
	fs.writeFileSync(pkg.packageJsonPath, content);
}

/**
 * @param {{ dir: string; json: Record<string, any> }} pkg
 * @param {string} newVersion
 */
function publishPackage(pkg, newVersion) {
	console.log(`Publishing ${pkg.json.name}@${newVersion}`);
	const args = ["publish"];
	if (pkg.json.publishConfig?.access === "public" || pkg.json.name.startsWith("@")) {
		args.push("--access", "public");
	}
	execSafe("pnpm", args, { cwd: pkg.dir, stdio: "inherit" });
}

/**
 * @param {{ dir: string; json: Record<string, any> }} pkg
 * @param {string} version
 */
function ensureVersionNotPublished(pkg, version) {
	try {
		execFileSync("npm", ["view", `${pkg.json.name}@${version}`, "version"], {
			cwd: pkg.dir,
			stdio: "pipe",
			encoding: "utf8"
		});
	} catch (error) {
		const err = /** @type {any} */ (error);
		if (!err || typeof err !== "object") {
			throw error;
		}

		const stderr = err.stderr ? err.stderr.toString() : "";
		const stdout = err.stdout ? err.stdout.toString() : "";
		const combined = `${stdout}\n${stderr}`;

		if (/E404/i.test(combined) || /404 Not Found/i.test(combined)) {
			return;
		}

		throw new Error(`Failed to check npm registry for ${pkg.json.name}@${version}: ${err.message ?? err}`);
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
 * @param {{ dir: string; json: Record<string, any> }} pkg
 * @param {string} destination
 */
function runPackagePack(pkg, destination) {
	console.log(`Running pnpm pack for ${pkg.json.name} into ${destination}`);
	execSafe("pnpm", ["pack", "--pack-destination", destination], {
		cwd: pkg.dir,
		stdio: "inherit"
	});
}

/**
 * @param {readonly { dir: string; json: Record<string, any> }[]} packages
 * @param {string} version
 * @param {"all" | "vscode"} targetScope
 */
function runPrePublishChecks(packages, version, targetScope) {
	console.log("\nPerforming pre-publish checks...");
	const packOutputDir = path.join(repoRoot, ".tmp", "prepublish-pack");
	preparePackOutputDir(packOutputDir);

	try {
		if (targetScope === "vscode") {
			runVscodeScopePreCheck(packages);
		}

		for (const pkg of packages) {
			console.log(`\nVerifying ${pkg.json.name}@${version}`);
			ensureVersionNotPublished(pkg, version);
			runPackagePack(pkg, packOutputDir);
		}
		console.log("\nAll pre-publish checks passed. Proceeding to publish.");
	} finally {
		cleanupPackOutputDir(packOutputDir);
	}
}

function revertLastCommit() {
	execSafe("git", ["reset", "--hard", "HEAD~1"], { stdio: "inherit" });
}

// Attempt to land the bump commit by rebasing onto the latest remote main branch.
function attemptRebaseAndPush(remote, version) {
	console.log("\nPush failed; attempting automatic rebase onto the latest main...");
	execSafe("git", ["fetch", remote, "main"], { stdio: "inherit" });

	try {
		execSafe("git", ["rebase", `${remote}/main`], { stdio: "inherit" });
	} catch (error) {
		try {
			execSafe("git", ["rebase", "--abort"], { stdio: "inherit" });
		} catch (abortError) {
			const abortMessage =
				abortError instanceof Error ? abortError.message : String(abortError);
			console.error(`Failed to abort rebase automatically: ${abortMessage}`);
		}
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(
			`Automatic rebase encountered conflicts. Resolve manually and push the bump commit. Details: ${message}`
		);
	}

	try {
		execSafe("git", ["push", remote, "main"], { stdio: "inherit" });
		console.log(`Completed bump to ${version} after automatic rebase.`);
	} catch (pushError) {
		const message = pushError instanceof Error ? pushError.message : String(pushError);
		throw new Error(`Push failed after successful rebase: ${message}`);
	}
}

/**
 * @param {readonly { dir: string; json: Record<string, any> }[]} packages
 */
function runVscodeScopePreCheck(packages) {
	const vscodePackage = packages.find((pkg) => pkg.json.name === "ripple-vscode-plugin");
	if (!vscodePackage) {
		throw new Error("Unable to locate ripple-vscode-plugin package for VS Code scope checks.");
	}

	console.log("\nRunning VS Code extension pre-check: pnpm run build-and-package");
	execSafe("pnpm", ["run", "build-and-package"], {
		cwd: vscodePackage.dir,
		stdio: "inherit"
	});
}

(function main() {
	try {
		const remote = determineRemote();
		ensureGitState(remote);

		const packages = loadPackages(scope);
		const basePackage =
			scope === "vscode"
				? packages.find((pkg) => pkg.json.name === "ripple-vscode-plugin")
				: packages.find((pkg) => pkg.json.name === "ripple");
		if (!basePackage) {
			const target = scope === "vscode" ? "'ripple-vscode-plugin'" : "'ripple'";
			throw new Error(`Unable to locate the ${target} package to determine the base version.`);
		}

		const currentVersion = basePackage.json.version;
		const currentTuple = parseSemver(currentVersion);
		const newVersion = overrideArg
			? parseOverride(bumpType, overrideArg, currentTuple)
			: bumpVersion(currentVersion, bumpType);
		const newTuple = parseSemver(newVersion);
		if (!isGreaterVersion(newTuple, currentTuple)) {
			const label = overrideArg ? "Override version" : "Computed version";
			throw new Error(`${label} ${newVersion} must be greater than current version ${currentVersion}.`);
		}

		if (packages.every((pkg) => pkg.json.version === newVersion)) {
			console.log(`All packages already set to version ${newVersion}. Nothing to do.`);
			return;
		}

		for (const pkg of packages) {
			pkg.json.version = newVersion;
			writePackage(pkg);
		}
		const changedPaths = packages.map((pkg) => path.relative(repoRoot, pkg.packageJsonPath));
		execSafe("git", ["add", ...changedPaths]);

		const scopeLabel = scope;
		const commitMessage = `chore: bump ${scopeLabel} to v${newVersion}`;
		let commitCreated = false;
		let publishStarted = false;
		let publishCompleted = false;
		let pushCompleted = false;

		try {
			execSafe("git", ["commit", "-m", commitMessage], { stdio: "inherit" });
			commitCreated = true;

			runPrePublishChecks(packages, newVersion, scope);

			for (const pkg of packages) {
				if (!publishStarted) {
					publishStarted = true;
				}
				publishPackage(pkg, newVersion);
			}
			publishCompleted = true;

			execSafe("git", ["push", remote, "main"], { stdio: "inherit" });
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

			if (commitCreated && !publishStarted) {
				try {
					revertLastCommit();
					console.error("Pre-publish checks failed. The bump commit has been reverted.");
				} catch (revertError) {
					const revertMessage =
						revertError instanceof Error ? revertError.message : String(revertError);
					console.error(`Failed to reset bump commit automatically: ${revertMessage}`);
					console.error(
						"Please run `git reset --hard HEAD~1` manually to discard the failed bump commit."
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
