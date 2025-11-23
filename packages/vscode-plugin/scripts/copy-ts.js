#!/usr/bin/env node

const { execSync } = require('child_process');

const isWindows = process.platform === 'win32';

try {
	const createDirCommand = isWindows
		? 'if not exist dist\\node_modules mkdir dist\\node_modules'
		: 'mkdir -p dist/node_modules';
	const copyCommand = isWindows
		? 'robocopy node_modules\\typescript dist\\node_modules\\typescript /E || (exit 0)'
		: 'rsync -aL --del node_modules/typescript/ dist/node_modules/typescript/';

	execSync(createDirCommand, { stdio: 'inherit' });
	execSync(copyCommand, { stdio: 'inherit' });
} catch (error) {
	console.error(error);
	process.exit(1);
}
