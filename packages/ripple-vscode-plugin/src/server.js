const {
	createConnection,
	createServer,
	createTypeScriptProject,
	loadTsdkByPath,
} = require('@volar/language-server/node');
const { createTypeScriptPlugins } = require('./ts.js');
const { getRippleLanguagePlugin, createRippleDiagnosticPlugin } = require('./language.js');

const connection = createConnection();
const server = createServer(connection);

connection.listen();

let ripple;

connection.onInitialize(async (params) => {
	const tsdk = params.initializationOptions?.typescript?.tsdk;
	const ripple_path = params.initializationOptions?.ripplePath;

	if (!tsdk) {
		throw new Error(
			'The `typescript.tsdk` init option is required. It should point to a directory containing a `typescript.js` or `tsserverlibrary.js` file, such as `node_modules/typescript/lib`.',
		);
	}

	ripple = await import(ripple_path);

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
