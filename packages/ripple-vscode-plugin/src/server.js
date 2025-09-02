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

const connection = createConnection();
const server = createServer(connection);

connection.listen();

let ripple;

function validateRipplePath(ripple_path) {
	if (!ripple_path) {
		throw new Error('Ripple path is required');
	}

	// Ensure path is absolute and points to expected ripple location
	const normalizedPath = path.resolve(ripple_path);
	
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
	
	return normalizedPath;
}

connection.onInitialize(async (params) => {
	const tsdk = params.initializationOptions?.typescript?.tsdk;
	const ripple_path = params.initializationOptions?.ripplePath;

	if (!tsdk) {
		throw new Error(
			'The `typescript.tsdk` init option is required. It should point to a directory containing a `typescript.js` or `tsserverlibrary.js` file, such as `node_modules/typescript/lib`.',
		);
	}

	// Validate the ripple path before importing for security
	const validatedPath = validateRipplePath(ripple_path);
	ripple = await import(pathToFileURL(validatedPath).href);

	const { typescript, diagnosticMessages } = loadTsdkByPath(tsdk, params.locale);

	return server.initialize(
		params,
		createTypeScriptProject(typescript, diagnosticMessages, ({ env }) => {
			return {
				languagePlugins: [getRippleLanguagePlugin(ripple)],
				setup({ project }) {
					const { languageServiceHost, configFileName } = project.typescript;
				},
			};
		}),
		[...createTypeScriptPlugins(typescript), createRippleDiagnosticPlugin()],
	);
});

connection.onInitialized(() => {
	server.initialized();

	const extensions = ['ripple'];

	server.fileWatcher.watchFiles([`**/*.{${extensions.join(',')}}`]);
});
