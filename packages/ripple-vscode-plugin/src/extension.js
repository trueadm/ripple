const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const protocol = require('@volar/language-server/protocol');
const lsp = require('vscode-languageclient/node');
const { createLabsInfo, getTsdk } = require('@volar/vscode');

let client;

async function activate(context) {
	console.log("Ripple extension starting...")

	// Try to find ripple compiler in workspace
	let ripple_path = null;

	// First try workspace folders
	if (vscode.workspace.workspaceFolders) {
		for (const folder of vscode.workspace.workspaceFolders) {
			const workspaceRipplePath = path.join(
				folder.uri.fsPath,
				'node_modules',
				'ripple',
				'src',
				'compiler',
				'index.js',
			);
			console.log("Checking ripple path:", workspaceRipplePath)

			if (fs.existsSync(workspaceRipplePath)) {
				ripple_path = workspaceRipplePath;
				console.log("Found ripple compiler at: ", ripple_path)
				break;
			}

			// Also try packages/ripple for monorepo structure
			const monorepoRipplePath = path.join(
				folder.uri.fsPath,
				'packages',
				'ripple',
				'src',
				'compiler',
				'index.js',
			);
			console.log("Checking monorepo ripple path:", monorepoRipplePath)

			if (fs.existsSync(monorepoRipplePath)) {
				ripple_path = monorepoRipplePath;
				console.log("Found ripple compiler at:", ripple_path)
				break;
			}
		}
	}

	// Fallback: try from active editor path
	if (!ripple_path && vscode.window.activeTextEditor) {
		const file_path = vscode.window.activeTextEditor.document.fileName;
		const parts = file_path.split(path.sep);

		for (let i = parts.length - 2; i >= 0; i--) {
			const full_path = parts
				.slice(0, i + 1)
				.concat('node_modules', 'ripple', 'src', 'compiler', 'index.js')
				.join(path.sep);

			console.log("Checking fallback ripple path:", full_path)
			if (fs.existsSync(full_path)) {
				ripple_path = full_path;
				console.log("Found ripple compiler at:", ripple_path)
				break;
			}
		}
	}

	if (!ripple_path) {
		const message = "Ripple compiler not found. Make sure ripple is installed in your workspace.";
		console.error(message);
		vscode.window.showWarningMessage(message);
		return;
	}

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

	let tsdk;
	try {
		tsdk = (await getTsdk(context)).tsdk;
		console.log("TypeScript SDK found at:", tsdk);
	} catch (error) {
		console.error("Failed to get TypeScript SDK: ", error);
		vscode.window.showErrorMessage(`Failed to get TypeScript SDK: ${error.message}`);
		return;
	}

	const initializationOptions = {
		typescript: {
			tsdk,
		},
		ripplePath: ripple_path,
		contentIntellisense: true,
	};

	const clientOptions = {
		documentSelector: [{ language: 'ripple' }],
		initializationOptions,

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
		const client = new lsp.LanguageClient(
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

module.exports = {
	activate,
};
