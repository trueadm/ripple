const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const protocol = require('@volar/language-server/protocol');
const lsp = require('vscode-languageclient/node');
const { createLabsInfo, getTsdk } = require('@volar/vscode');

let ripple;

async function activate(context) {
	const file_path = vscode.window.activeTextEditor.document.fileName;
	const parts = file_path.split(path.sep);
	let ripple_path = null;

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

	if (!ripple_path) {
		return;
	}

	ripple = await import(ripple_path);

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

	return volar_labs.extensionExports;
}

module.exports = {
	activate
};
