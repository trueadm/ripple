#!/usr/bin/env node

const { execSync } = require('child_process');

const isWindows = process.platform === 'win32';

try {
	const createDirCommand = isWindows
		? 'if not exist dist\\node_modules\\@ripple-ts mkdir dist\\node_modules\\@ripple-ts'
		: 'mkdir -p dist/node_modules/@ripple-ts';
	const copyCommand = isWindows
		? 'robocopy node_modules\\@ripple-ts\\typescript-plugin dist\\node_modules\\@ripple-ts\\typescript-plugin /E /XD node_modules src || (exit 0)'
		: 'rsync -aL --del --exclude=node_modules --exclude=src node_modules/@ripple-ts/typescript-plugin/ dist/node_modules/@ripple-ts/typescript-plugin/';

	execSync(createDirCommand, { stdio: 'inherit' });
	execSync(copyCommand, { stdio: 'inherit' });
} catch (error) {
	console.error(error);
	process.exit(1);
}
