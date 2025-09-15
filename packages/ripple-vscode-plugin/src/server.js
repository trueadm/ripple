const {
	createConnection,
	createServer,
	createTypeScriptProject,
	loadTsdkByPath,
} = require('@volar/language-server/node');
const { createTypeScriptPlugins } = require('./ts.js');
const { getRippleLanguagePlugin, createRippleDiagnosticPlugin } = require('./language.js');
const { pathToFileURL } = require('url');
const path = require('path');
const fs = require("fs");

const connection = createConnection();
const server = createServer(connection);

const DEBUG = process.env.RIPPLE_DEBUG === 'true';

function log(...args) {
	if (DEBUG) {
		console.log('[Ripple Server]', ...args);
	}
}

function logError(...args) {
	console.error('[Ripple Server ERROR]', ...args);
}

connection.listen();

let ripple;

function validateRipplePath(ripple_path) {
	if (!ripple_path) {
		throw new Error('Ripple path is required');
	}

	// Ensure path exists
	if (!fs.existsSync(ripple_path)) {
		throw new Error(`Ripple compiler not found at path: ${ripple_path}`)
	}

  const workspaceFolder = params.rootPath;
  if (!workspaceFolder) {
    return { capabilities: {} };
  }
  // Resolve paths to be absolute to prevent path traversal.
  const resolvedWorkspaceFolder = path.resolve(workspaceFolder);
  const rippleExecutablePath = path.join(
    resolvedWorkspaceFolder,
    'node_modules/.bin/ripple',
  );
  const resolvedRippleExecutablePath = path.resolve(rippleExecutablePath);

  // Security: Ensure the executable path is within the workspace folder.
  if (!resolvedRippleExecutablePath.startsWith(path.normalize(resolvedWorkspaceFolder + '/'))) {
    connection.console.error(
      `Security: Path traversal attempt detected. Path "${resolvedRippleExecutablePath}" is outside of workspace "${resolvedWorkspaceFolder}".`,
    );
    return { capabilities: {} };
  }
    return { capabilities: {} };
  }
  // Resolve paths to be absolute to prevent path traversal.
  const resolvedWorkspaceFolder = path.resolve(workspaceFolder);
  const rippleExecutablePath = path.join(
    resolvedWorkspaceFolder,
    'node_modules/.bin/ripple',
  );
  const resolvedRippleExecutablePath = path.resolve(rippleExecutablePath);

  // Security: Ensure the executable path is within the workspace folder.
  if (!resolvedRippleExecutablePath.startsWith(path.normalize(resolvedWorkspaceFolder + '/'))) {
    connection.console.error(
      `Security: Path traversal attempt detected. Path "${resolvedRippleExecutablePath}" is outside of workspace "${resolvedWorkspaceFolder}".`,
    );
    return { capabilities: {} };
  }
	
	// Must end with the expected ripple compiler path
	const isValidPath = normalizedPath.includes('ripple/src/compiler/index.js') || 
		normalizedPath.includes('ripple\\src\\compiler\\index.js');
	
	if (!isValidPath) {
		throw new Error('Invalid ripple compiler path: must point to ripple/src/compiler/index.js');
	}
	
	// Prevent directory traversal attacks
	if (normalizedPath.includes('..')) {
		throw new Error('Path traversal not allowed in ripple path');
	}
	
	// Additional security: ensure the path doesn't contain suspicious patterns
	const suspiciousPatterns = ['/etc/', '/bin/', '/usr/bin/', 'C:\\Windows\\', 'C:\\System32\\'];
	for (const pattern of suspiciousPatterns) {
		if (normalizedPath.includes(pattern)) {
			throw new Error('Suspicious path detected in ripple path');
		}
	}
	
	log('Validated ripple path:', normalizedPath);
	return normalizedPath;
}

connection.onInitialize(async (params) => {
	try {
		log('Initializing Ripple language server...');
		log('Initialization options:', JSON.stringify(params.initializationOptions, null, 2));

		const tsdk = params.initializationOptions?.typescript?.tsdk;
		const ripple_path = params.initializationOptions?.ripplePath;

		if (!tsdk) {
			const errorMsg = 'The `typescript.tsdk` init option is required. It should point to a directory containing a `typescript.js` or `tsserverlibrary.js` file, such as `node_modules/typescript/lib`.';
			logError(errorMsg);
			throw new Error(errorMsg);
		}

		log('TypeScript SDK path:', tsdk);

		// Validate the ripple path before importing for security
		const validatedPath = validateRipplePath(ripple_path);

		log('Importing ripple compiler...');
		try {
			ripple = await import(pathToFileURL(validatedPath).href);
			log('Ripple compiler imported successfully');

			// Test if the compiler has the expected methods
			if (!ripple || typeof ripple.compile_to_volar_mappings !== 'function') {
				throw new Error('Ripple compiler does not have expected compile_to_volar_mappings method');
			}
		} catch (importError) {
			logError('Failed to import ripple compiler:', importError);
			throw new Error(`Failed to import ripple compiler: ${importError.message}`);
		}
		
		log('Loading TypeScript SDK...');
		const { typescript, diagnosticMessages } = loadTsdkByPath(tsdk, params.locale);
		log('TypeScript SDK loaded successfully');

		const initResult = server.initialize(
			params,
			createTypeScriptProject(typescript, diagnosticMessages, ({ env }) => {
				log('Creating TypeScript project...')
				return {
					languagePlugins: [getRippleLanguagePlugin(ripple)],
					setup({ project }) {
						log('TypeScript project setup complete')
						const { languageServiceHost, configFileName } = project.typescript;
					},
				};
			}),
			[...createTypeScriptPlugins(typescript), createRippleDiagnosticPlugin()],
		);

		log('Server initialization complete');
		return initResult;
	} catch (initError) {
		logError('Server initialization failed:', initError);
		throw initError;
	}
});

connection.onInitialized(() => {
	try {
		log('Server initialized, setting up file watcher...');
		server.initialized();

		const extensions = ['ripple'];
		server.fileWatcher.watchFiles([`**/*.{${extensions.join(',')}}`]);

		log('File watcher setup complete for extensions:', extensions);
	} catch (err) {
		logError('Failed to setup file watcher:', err);
	}
});

process.on('uncaughtException', (err) => {
	logError('Uncaught exception:', err);
})

process.on('unhandledRejection', (reason, promise) => {
	logError('Unhandled rejection at:', promise, 'reason:', reason);
})