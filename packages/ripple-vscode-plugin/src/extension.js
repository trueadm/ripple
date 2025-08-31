const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const protocol = require('@volar/language-server/protocol');
const lsp = require('vscode-languageclient/node');
const { createLabsInfo, getTsdk } = require('@volar/vscode');

async function activate(context) {
	// Try to find ripple compiler in workspace
	let ripple_path = null;
	
	// First try workspace folders
	if (vscode.workspace.workspaceFolders) {
		for (const folder of vscode.workspace.workspaceFolders) {
			const workspaceRipplePath = path.join(folder.uri.fsPath, 'node_modules', 'ripple', 'src', 'compiler', 'index.js');
			if (fs.existsSync(workspaceRipplePath)) {
				ripple_path = workspaceRipplePath;
				break;
			}
			
			// Also try packages/ripple for monorepo structure
			const monorepoRipplePath = path.join(folder.uri.fsPath, 'packages', 'ripple', 'src', 'compiler', 'index.js');
			if (fs.existsSync(monorepoRipplePath)) {
				ripple_path = monorepoRipplePath;
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

			if (fs.existsSync(full_path)) {
				ripple_path = full_path;
				break;
			}
		}
	}

	if (!ripple_path) {
		return
	}

	const serverModule = vscode.Uri.joinPath(context.extensionUri, 'src/server.js').fsPath;
	const runOptions = { execArgv: [] };
	const debugOptions = {
		execArgv: ['--nolazy', '--inspect'],
		// Use for local debugging:
		// execArgv: ['--nolazy', '--inspect', '--inspect-brk']
	};

	const serverOptions = {
		run: {
			module: serverModule,
			transport: lsp.TransportKind.ipc,
			options: runOptions
		},
		debug: {
			module: serverModule,
			transport: lsp.TransportKind.ipc,
			options: debugOptions
		}
	};

	const initializationOptions = {
		typescript: {
			tsdk: (await getTsdk(context)).tsdk
		},
		ripplePath: ripple_path,
		contentIntellisense: true
	};

	const clientOptions = {
		documentSelector: [{ language: 'ripple' }],
		initializationOptions
	};

	const client = new lsp.LanguageClient(
		'ripple',
		'Ripple Language Server',
		serverOptions,
		clientOptions
	);
	await client.start();

	const volar_labs = createLabsInfo(protocol);
	volar_labs.addLanguageClient(client);

	// Configure Prettier to handle .ripple files
	const config = vscode.workspace.getConfiguration();
	
	// Tell Prettier extension to enable formatting for ripple language
	await config.update(
		'prettier.documentSelectors',
		['**/*.ripple'],
		vscode.ConfigurationTarget.Global
	);
	
	// Set Prettier as default formatter for .ripple files
	await config.update(
		'[ripple]',
		{
			'editor.defaultFormatter': 'esbenp.prettier-vscode'
		},
		vscode.ConfigurationTarget.Global
	);

	// Register a custom formatter as backup that calls Prettier directly
	const formatProvider = vscode.languages.registerDocumentFormattingEditProvider(
		{ language: 'ripple', scheme: 'file' },
		{
			async provideDocumentFormattingEdits(document, options, token) {
				try {
					// Try to use Prettier extension first
					const edits = await vscode.commands.executeCommand(
						'editor.action.formatDocument.prettier'
					);
					return edits || [];
				} catch (error) {
					console.error('Ripple formatting error:', error);
					vscode.window.showErrorMessage(
						'Failed to format Ripple file. Make sure Prettier extension is installed and prettier-plugin-ripple is configured.'
					);
					return [];
				}
			}
		}
	);

	context.subscriptions.push(formatProvider);

	return volar_labs.extensionExports;
}

module.exports = {
	activate
};
