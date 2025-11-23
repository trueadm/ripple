#!/usr/bin/env node

const { execSync } = require('child_process');

const isWindows = process.platform === 'win32';

try {
	const createDirCommand = isWindows
		? 'if not exist dist\\node_modules mkdir dist\\node_modules'
		: 'mkdir -p dist/node_modules';
	const copyCommand = isWindows
		? 'robocopy node_modules\\ripple dist\\node_modules\\ripple /E /XD node_modules /XF .ignored* || (exit 0)'
		: 'rsync -aL --del --exclude=node_modules/ripple --exclude=node_modules/typescript --exclude=.ignored* node_modules/ripple/ dist/node_modules/ripple/';

	execSync(createDirCommand, { stdio: 'inherit' });
	execSync(copyCommand, { stdio: 'inherit' });
} catch (error) {
	console.error(error);
	process.exit(1);
}
