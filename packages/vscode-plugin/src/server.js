const { createRippleLanguageServer } = require('@ripple-ts/language-server/src/server.js');

try {
	createRippleLanguageServer();
} catch (error) {
	console.error('[Ripple Server] Failed to start:', error);
	process.exit(1);
}
