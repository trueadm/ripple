#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

/**
 * @param {string} message
 */
function fail(message) {
	console.error(message);
	process.exit(1);
}

/**
 * @param {string} dir
 */
function emptyDirSafe(dir) {
	if (fs.existsSync(dir)) {
		console.log(`Removing directory: ${dir}`);
		try {
			fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
		} catch (e) {
			const error = /** @type {NodeJS.ErrnoException} */ (e);
			fail(`Failed to remove directory ${dir}: ${error.message}`);
		}

		// Verify it's gone
		if (fs.existsSync(dir)) {
			fail(`Directory still exists after removal: ${dir}`);
		}
	}
}

const dirName = 'ripple-vscode-plugin';

const vsixArg = process.argv[2];
const vsixPath = path.resolve(process.cwd(), vsixArg || dirName + '.vsix');

if (!fs.existsSync(vsixPath)) {
	fail(`VSIX not found at ${vsixPath}`);
}

const vsixDir = path.dirname(vsixPath);
const extractDir = path.join(vsixDir, dirName);

emptyDirSafe(extractDir);
fs.mkdirSync(extractDir, { recursive: true });

const zip = new AdmZip(vsixPath);
zip.extractAllTo(extractDir, true);

const extensionDir = path.join(extractDir, 'extension');
if (!fs.existsSync(extensionDir) || !fs.statSync(extensionDir).isDirectory()) {
	fail('Unexpected VSIX layout: missing extension directory');
}

const targetNodeModules = path.join(extensionDir, 'node_modules');
const sourceNodeModules = path.join(extensionDir, 'dist', 'node_modules');

// Just in case, remove any nested folders from manually unpacked VSIX
emptyDirSafe(path.join(extensionDir, dirName));

if (fs.existsSync(sourceNodeModules) && fs.statSync(sourceNodeModules).isDirectory()) {
	fs.renameSync(sourceNodeModules, targetNodeModules);
} else if (fs.existsSync(targetNodeModules) && fs.statSync(targetNodeModules).isDirectory()) {
	console.log('extension/node_modules already present; skipping move.');
} else {
	fail('Expected dist/node_modules not found inside VSIX');
}

fs.unlinkSync(vsixPath);

// Create new zip with correct file order (noSort preserves insertion order)
// @ts-ignore
const repackedZip = new AdmZip({ noSort: true });

/**
 * @param {string} dir
 * @param {string} prefix
 */
function addDirectory(dir, prefix = '') {
	const entries = fs.readdirSync(dir, { withFileTypes: true });
	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		const zipPath = prefix ? path.join(prefix, entry.name) : entry.name;

		if (entry.isDirectory()) {
			addDirectory(fullPath, zipPath);
		} else if (entry.isFile()) {
			const content = fs.readFileSync(fullPath);
			repackedZip.addFile(zipPath, content);
		}
	}
}

// Add files in specific order so unpacking works correctly on MacOS.
// Otherwise adding the first `[Content_Types].xml` causes issues with OOXML.
// 1. extension.vsixmanifest first
// 2. Everything else

const firstAddedFile = 'extension.vsixmanifest';
const vsixManifest = path.join(extractDir, firstAddedFile);

if (fs.existsSync(vsixManifest)) {
	repackedZip.addFile(firstAddedFile, fs.readFileSync(vsixManifest));
}

// Add all other contents
const entries = fs.readdirSync(extractDir, { withFileTypes: true });
for (const entry of entries) {
	const fullPath = path.join(extractDir, entry.name);

	// Skip the files we already added
	if (entry.name === firstAddedFile) {
		continue;
	}

	if (entry.isDirectory()) {
		addDirectory(fullPath, entry.name);
	} else if (entry.isFile()) {
		const content = fs.readFileSync(fullPath);
		repackedZip.addFile(entry.name, content);
	}
}

repackedZip.writeZip(vsixPath);

// Clean up the extracted directory
emptyDirSafe(extractDir);
console.log(`Repacked ${path.basename(vsixPath)} with bundled node_modules.`);
