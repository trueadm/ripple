#!/usr/bin/env node

const { execSync } = require('child_process');

const isWindows = process.platform === 'win32';

try {
	const createDirCommand = isWindows
		? 'if not exist dist/node_modules (mkdir dist/node_modules)'
		: 'mkdir -p dist/node_modules';
	const rsyncCommand = 'rsync -aL --del node_modules/typescript/ dist/node_modules/typescript/';

	execSync(createDirCommand, { stdio: 'inherit' });
	execSync(rsyncCommand, { stdio: 'inherit' });
} catch (error) {
	console.error(error);
	process.exit(1);
}
