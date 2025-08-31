const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const protocol = require('@volar/language-server/protocol');
const lsp = require('vscode-languageclient/node');
const { createLabsInfo, getTsdk } = require('@volar/vscode');

let ripple;

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

	// // Check if prettier-plugin-ripple is available
	// let hasPrettierPlugin = false;
	// try {
	// 	// Try to find prettier-plugin-ripple in the workspace
	// 	const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
	// 	if (workspaceRoot) {
	// 		const pluginPath = path.join(workspaceRoot, 'packages', 'prettier-plugin-ripple', 'src', 'index.js');
	// 		if (fs.existsSync(pluginPath)) {
	// 			hasPrettierPlugin = true;
	// 		}
	// 	}
	// } catch (error) {
	// 	// Plugin not found, continue without it
	// }

	// // Register the format command
	// const formatCommand = vscode.commands.registerCommand('ripple.format', async () => {
	// 	const editor = vscode.window.activeTextEditor;
	// 	if (editor && editor.document.languageId === 'ripple') {
	// 		if (hasPrettierPlugin) {
	// 			await vscode.commands.executeCommand('editor.action.formatDocument.prettier');
	// 		} else {
	// 			vscode.window.showWarningMessage(
	// 				'Prettier plugin for Ripple not found. Install prettier-plugin-ripple for formatting support.'
	// 			);
	// 		}
	// 	}
	// });

	// context.subscriptions.push(formatCommand);

	// if (hasPrettierPlugin) {
	// 	// Register Prettier as the default formatter for .ripple files
	// 	const formatProvider = vscode.languages.registerDocumentFormattingEditProvider(
	// 		{ language: 'ripple', scheme: 'file' },
	// 		{
	// 			async provideDocumentFormattingEdits(document, options, token) {
	// 				try {
	// 					// Use Prettier extension to format
	// 					const edits = await vscode.commands.executeCommand(
	// 						'editor.action.formatDocument.prettier',
	// 						document.uri
	// 					);
	// 					return edits;
	// 				} catch (error) {
	// 					console.error('Ripple formatting error:', error);
	// 					vscode.window.showErrorMessage(
	// 						'Failed to format Ripple file. Make sure Prettier extension is installed.'
	// 					);
	// 					return [];
	// 				}
	// 			}
	// 		}
	// 	);

	// 	context.subscriptions.push(formatProvider);

	// 	// Set Prettier as default formatter for .ripple files
	// 	const config = vscode.workspace.getConfiguration();
	// 	await config.update(
	// 		'[ripple]',
	// 		{
	// 			'editor.defaultFormatter': 'esbenp.prettier-vscode'
	// 		},
	// 		vscode.ConfigurationTarget.Global
	// 	);

	// 	// Show info message that Prettier plugin is available (only once)
	// 	const hasShownMessage = context.globalState.get('ripple.prettierPluginMessageShown', false);
	// 	if (!hasShownMessage) {
	// 		vscode.window.showInformationMessage(
	// 			'Ripple Prettier plugin detected. Formatting is now available for .ripple files.'
	// 		);
	// 		context.globalState.update('ripple.prettierPluginMessageShown', true);
	// 	}
	// } else {
	// 	// Register a basic formatter that shows a helpful message
	// 	const basicFormatProvider = vscode.languages.registerDocumentFormattingEditProvider(
	// 		{ language: 'ripple', scheme: 'file' },
	// 		{
	// 			provideDocumentFormattingEdits(document, options, token) {
	// 				vscode.window.showInformationMessage(
	// 					'Install prettier-plugin-ripple for advanced formatting support.',
	// 					'Install Plugin'
	// 				).then(selection => {
	// 					if (selection === 'Install Plugin') {
	// 						vscode.env.openExternal(vscode.Uri.parse('https://www.npmjs.com/package/prettier-plugin-ripple'));
	// 					}
	// 				});
	// 				return [];
	// 			}
	// 		}
	// 	);

	// 	context.subscriptions.push(basicFormatProvider);
	// }

	return volar_labs.extensionExports;
}

module.exports = {
	activate
};
