const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const protocol = require('@volar/language-server/protocol');
const lsp = require('vscode-languageclient/node');
const { createLabsInfo } = require('@volar/vscode');

const neededRestart = !patchTypeScriptExtension();
let client;

async function activate(context) {
	console.log("Ripple extension starting...")

	const serverModule = vscode.Uri.joinPath(context.extensionUri, 'src/server.js').fsPath;

	if (!fs.existsSync(serverModule)) {
		const message = `Server module not found at: ${serverModule}`
		console.error(message)
		vscode.window.showErrorMessage(message)
		return
	}

	const runOptions = {
		execArgv: [],
		env: {
			...process.env,
			RIPPLE_DEBUG: 'true'
		}
	};

	const debugOptions = {
		execArgv: ['--nolazy', '--inspect'],
		// Use for local debugging:
		// execArgv: ['--nolazy', '--inspect', '--inspect-brk']
		env: {
			...process.env,
			RIPPLE_DEBUG: 'true'
		}
	};

	const serverOptions = {
		run: {
			module: serverModule,
			transport: lsp.TransportKind.stdio,
			options: runOptions,
		},
		debug: {
			module: serverModule,
			transport: lsp.TransportKind.stdio,
			options: debugOptions,
		},
	};

	const clientOptions = {
		documentSelector: [{ language: 'ripple' }],
		errorHandler: {
			error: (error, message, count) => {
				console.error('Language server error:', error, message, count);
				return lsp.ErrorAction.Continue;
			},
			closed: () => {
				console.log('Language server connection closed');
				return lsp.CloseAction.Restart;
			}
		},
		outputChannel: vscode.window.createOutputChannel('Ripple Language Server'),
		traceOutputChannel: vscode.window.createOutputChannel('Ripple Language Server Trace')
	};

	try {
		client = new lsp.LanguageClient(
			'ripple',
			'Ripple Language Server',
			serverOptions,
			clientOptions,
		);

		console.log("Starting language client...")
		await client.start();
		console.log("Language client started successfully")

		const volar_labs = createLabsInfo(protocol);
		volar_labs.addLanguageClient(client);

		// Configure Prettier to handle .ripple files
		await configurePrettier();

		// Register custom formatter
		const formatProvider = registerFormatter()
		context.subscriptions.push(formatProvider);

		console.log("Ripple extension activated successfully");
		// vscode.window.showInformationMessage("Ripple extension activated!")

		return volar_labs.extensionExports;
	} catch (error) {
		console.error("Failed to start language client:", error);
		vscode.window.showErrorMessage(`Failed to start Ripple language server: ${error.message}`);
		return;
	}
}

async function configurePrettier() {
	try {
		const config = vscode.workspace.getConfiguration();

		// Tell Prettier extension to enable formatting for ripple language
		await config.update(
			'prettier.documentSelectors',
			['**/*.ripple'],
			vscode.ConfigurationTarget.Global,
		);

		// Set Prettier as default formatter for .ripple files
		await config.update(
			'[ripple]',
			{
				'editor.defaultFormatter': 'esbenp.prettier-vscode',
			},
			vscode.ConfigurationTarget.Global,
		);

		console.log("Prettier configuration updated for Ripple files");
	} catch (error) {
		console.error("Failed to configure Prettier:", error);
	}
}

function registerFormatter() {
	return vscode.languages.registerDocumentFormattingEditProvider(
		{ language: 'ripple', scheme: 'file' },
		{
			async provideDocumentFormattingEdits(document, options, token) {
				try {
					console.log("Formatting Ripple document:", document.fileName);

					// Try to use Prettier extension first
					const edits = await vscode.commands.executeCommand(
						'editor.action.formatDocument.prettier',
					);
					return edits || [];
				} catch (error) {
					console.error('Ripple formatting error:', error);
					vscode.window.showErrorMessage(
						'Failed to format Ripple file. Make sure Prettier extension is installed and prettier-plugin-ripple is configured.',
					);
					return [];
				}
			},
		},
	);
}

async function deactivate() {
	console.log("Deactivating Ripple extension...");
	if (client) {
		try {
			await client.stop();
			console.log("Language client stopped")
		} catch (error) {
			console.error("Error stopping language client:", error)
		}
	}
}

function patchTypeScriptExtension() {
	const tsExtension = vscode.extensions.getExtension('vscode.typescript-language-features');
	if (tsExtension.isActive) {
		return false;
	}

	const fs = require('node:fs');
	const readFileSync = fs.readFileSync;
	const extensionJsPath = require.resolve('./dist/extension.js', { paths: [tsExtension.extensionPath] });

	fs.readFileSync = (...args) => {
		if (args[0] === extensionJsPath) {
			let text = readFileSync(...args);
			// patch jsTsLanguageModes
			text = text.replace(
				't.jsTsLanguageModes=[t.javascript,t.javascriptreact,t.typescript,t.typescriptreact]',
				s => s + '.concat("ripple")',
			);
			// patch isSupportedLanguageMode
			text = text.replace(
				'.languages.match([t.typescript,t.typescriptreact,t.javascript,t.javascriptreact]',
				s => s + '.concat("ripple")',
			);
			return text;
		}
		return readFileSync(...args);
	};

	const loadedModule = require.cache[extensionJsPath];
	if (loadedModule) {
		delete require.cache[extensionJsPath];
		const patchedModule = require(extensionJsPath);
		Object.assign(loadedModule.exports, patchedModule);
	}
	return true;
}

module.exports = {
	activate,
	deactivate,
};
