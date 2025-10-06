const {
	createConnection,
	createServer,
	createTypeScriptProject,
} = require('@volar/language-server/node');
const { createRippleDiagnosticPlugin } = require('./diagnosticPlugin.js');
const { getRippleLanguagePlugin } = require('typescript-plugin-ripple/src/language.js');
const { create: createTypeScriptServices } = require('volar-service-typescript');

const DEBUG = process.env.RIPPLE_DEBUG === 'true';

function log(...args) {
	if (DEBUG) {
		console.log('[Ripple Server]', ...args);
	}
}

function logError(...args) {
	console.error('[Ripple Server ERROR]', ...args);
}

function createRippleLanguageServer() {
	const connection = createConnection();
	const server = createServer(connection);

	connection.listen();

	connection.onInitialize(async (params) => {
		try {
			log('Initializing Ripple language server...');
			log('Initialization options:', JSON.stringify(params.initializationOptions, null, 2));

			const ts = require('typescript');

			const initResult = server.initialize(
				params,
				createTypeScriptProject(
					ts,
					undefined,
					() => {
						return {
							languagePlugins: [getRippleLanguagePlugin()],
						};
					}
				),
				[
					createRippleDiagnosticPlugin(),
					...createTypeScriptServices(ts),
				],
			);

			log('Server initialization complete');
			return initResult;
		} catch (initError) {
			logError('Server initialization failed:', initError);
			throw initError;
		}
	});

	connection.onInitialized(() => {
		log('Server initialized.');
		server.initialized();
	});

	process.on('uncaughtException', (err) => {
		logError('Uncaught exception:', err);
	});

	process.on('unhandledRejection', (reason, promise) => {
		logError('Unhandled rejection at:', promise, 'reason:', reason);
	});

	return { connection, server };
}

module.exports = {
	createRippleLanguageServer,
};
