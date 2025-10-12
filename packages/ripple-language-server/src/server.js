const {
	createConnection,
	createServer,
	createTypeScriptProject,
} = require('@volar/language-server/node');
const { createRippleDiagnosticPlugin } = require('./diagnosticPlugin.js');
const { getRippleLanguagePlugin, resolveConfig } = require('typescript-plugin-ripple/src/language.js');
const { create: createTypeScriptServices } = require('volar-service-typescript');

const DEBUG = process.env.RIPPLE_DEBUG === 'true';

/** @typedef {import('typescript').CompilerOptions} CompilerOptions */

/**
 * @param {...unknown} args
 */
function log(...args) {
	if (DEBUG) {
		console.log('[Ripple Server]', ...args);
	}
}

/**
 * @param {...unknown} args
 */
function logError(...args) {
	console.error('[Ripple Server ERROR]', ...args);
}

function createRippleLanguageServer() {
	const connection = createConnection();
	const server = createServer(connection);

	connection.listen();

	// Create language plugin instance once and reuse it
	// This prevents creating multiple instances if the callback is called multiple times
	const rippleLanguagePlugin = getRippleLanguagePlugin();
	log('Language plugin instance created');

	/** @type {WeakSet<Function>} */
	const wrappedFunctions = new WeakSet();

	/**
	 * Ensure TypeScript hosts always see compiler options with Ripple defaults.
	 * @param {unknown} target
	 * @param {string} method
	 */
	function wrapCompilerOptionsProvider(target, method) {
		if (!target) {
			return;
		}

		const host = /** @type {{ [key: string]: unknown }} */ (target);
		const original = host[method];
		if (typeof original !== 'function' || wrappedFunctions.has(original)) {
			return;
		}

		/** @type {CompilerOptions | undefined} */
		let cachedInput;
		/** @type {CompilerOptions | undefined} */
		let cachedOutput;

		const wrapped = () => {
			/** @type {CompilerOptions} */
			const input = original.call(host);
			if (cachedInput !== input) {
				cachedInput = input;
				cachedOutput = resolveConfig({ options: input }).options;
			}
			return cachedOutput;
		};

		wrappedFunctions.add(original);
		wrappedFunctions.add(wrapped);
		host[method] = wrapped;
	}

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
					({ projectHost }) => {
						wrapCompilerOptionsProvider(projectHost, 'getCompilationSettings');

						return {
							languagePlugins: [rippleLanguagePlugin],
							setup({ project }) {
								wrapCompilerOptionsProvider(project?.typescript?.languageServiceHost, 'getCompilationSettings');
							},
						};
					},
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
