#!/usr/bin/env node
import('@ripple-ts/cli').catch((err) => {
	console.error('[create-ripple] Failed to load @ripple-ts/cli:', err);
	process.exit(1);
});
