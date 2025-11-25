/**
 * Ripple VSCode Extension
 *
 * This extension provides language support for Ripple files (.ripple) by:
 * 1. Starting a Volar-based language server (language-server) for Ripple syntax and semantics
 * 2. Patching the built-in TypeScript extension to recognize Ripple files
 * 3. Setting VSCode context variables to expose TypeScript commands for Ripple files
 *
 * Architecture: Language Server vs TypeScript Plugin
 * --------------------------------------------------
 * language-server: A Language Server Protocol (LSP) server built on Volar that provides
 * language features for Ripple files including diagnostics, IntelliSense, go-to-definition, etc.
 * It uses typescript-plugin internally to transform Ripple syntax into TypeScript virtual
 * files for type checking and IntelliSense.
 *
 * typescript-plugin: A Volar-based TypeScript plugin that transforms .ripple files into
 * TypeScript virtual code. This plugin enables TypeScript's language service to understand Ripple
 * syntax. It's already loaded and used by language-server, so we don't need to configure
 * it separately.
 *
 * IMPORTANT: DO NOT use "typescriptServerPlugins" in package.json
 * ----------------------------------------------------------------
 * The "typescriptServerPlugins" contribution point would tell VSCode's TypeScript extension to
 * load typescript-plugin into its own tsserver instance. However:
 * 1. We already run language-server which uses typescript-plugin internally
 * 2. Loading it twice (once in our LSP, once in TS extension) creates conflicts and duplication
 * 3. Our language server provides more features than just the TypeScript plugin alone
 * 4. We use runtime patching instead to make the TS extension recognize Ripple files
 *
 * IMPORTANT: TypeScript Command Integration
 * ----------------------------------------
 * We DO NOT register TypeScript commands (like typescript.goToSourceDefinition,
 * typescript.findAllFileReferences, etc.) ourselves, as this would conflict with
 * the built-in TypeScript extension which already owns these commands.
 *
 * Instead, we:
 * 1. Patch the TypeScript extension to treat Ripple files as TypeScript-like files
 * 2. Set context variables (via setupDynamicContexts) that the TypeScript extension uses
 * 3. Declare menu contributions in package.json that reference the existing TypeScript commands
 *
 * The package.json "menus" section controls WHERE and WHEN TypeScript commands appear in the UI.
 * This extension's code sets the context variable VALUES that the menu "when" clauses check.
 *
 * Example flow:
 * - package.json declares: Show "typescript.goToSourceDefinition" when "resourceLangId == ripple"
 * - This code sets: resourceLangId = 'ripple' when editing a .ripple file
 * - Result: The TypeScript command appears in the context menu for Ripple files
 */

const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const protocol = require('@volar/language-server/protocol');
/** @type {typeof import('vscode-languageclient/node')} */
const lsp = require('vscode-languageclient/node');
const { activateAutoInsertion, createLabsInfo } = require('@volar/vscode');

/** @type {import('vscode-languageclient/node').LanguageClient | undefined} */
let client;

/**
 * @param {import('vscode').ExtensionContext} context
 */
async function activate(context) {
	console.log('Ripple extension starting...');

	const patchResult = await patchTypeScriptExtension();
	if (!patchResult.success) {
		switch (patchResult.reason) {
			case 'missing':
				console.warn('[Ripple] TypeScript extension not found; Ripple commands will be limited.');
				break;
			case 'alreadyActive':
				console.warn('[Ripple] TypeScript extension already active - patch skipped');
				// Check if we've already prompted for reload in this session
				const hasPromptedReload = context.globalState.get('ripple.hasPromptedReload', false);
				if (!hasPromptedReload) {
					// Mark that we've prompted to avoid repeated prompts
					await context.globalState.update('ripple.hasPromptedReload', true);
					// Prompt user to restart extension host for full TypeScript integration
					vscode.window
						.showInformationMessage(
							'Ripple extension needs to restart extensions to enable full TypeScript integration.',
							'Restart Extensions',
							'Later',
						)
						.then((selection) => {
							if (selection === 'Restart Extensions') {
								vscode.commands.executeCommand('workbench.action.restartExtensionHost');
							}
						});
				}
				break;
			case 'patternMismatch':
				console.warn(
					'[Ripple] Patch patterns did not match - TypeScript extension internals may have changed.',
				);
				break;
		}
	} else if (patchResult.reason === 'alreadyPatched') {
		console.log('[Ripple] TypeScript extension already supports Ripple files.');
	} else {
		console.log('[Ripple] Successfully patched TypeScript extension to recognize Ripple files.');
	}

	const serverModule = path.join(__dirname, 'server.js');

	if (!fs.existsSync(serverModule)) {
		const message = `Server module not found at: ${serverModule}`;
		console.error(message);
		vscode.window.showErrorMessage(message);
		return;
	}

	const runOptions = {
		execArgv: [],
		env: {
			...process.env,
			RIPPLE_DEBUG: 'true',
		},
	};

	const debugOptions = {
		execArgv: ['--nolazy', '--inspect'],
		env: {
			...process.env,
			RIPPLE_DEBUG: 'true',
		},
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

	/** @type {import('vscode-languageclient/node').LanguageClientOptions} */
	const clientOptions = {
		documentSelector: [{ language: 'ripple' }],
		errorHandler: {
			error: (
				/** @type {Error} */ error,
				/** @type {import('vscode-languageclient/node').Message | undefined} */ message,
				/** @type {number | undefined} */ count,
			) => {
				console.error('Language server error:', error, message, count);
				return { action: lsp.ErrorAction.Continue };
			},
			closed: () => {
				console.log('Language server connection closed');
				return { action: lsp.CloseAction.Restart };
			},
		},
		outputChannel: vscode.window.createOutputChannel('Ripple Language Server'),
		traceOutputChannel: vscode.window.createOutputChannel('Ripple Language Server Trace'),
	};

	try {
		client = new lsp.LanguageClient(
			'ripple',
			'Ripple Language Server',
			serverOptions,
			clientOptions,
		);

		console.log('Starting language client...');
		await client.start();
		console.log('Language client started successfully');

		const volar_labs = createLabsInfo(protocol);
		volar_labs.addLanguageClient(client);

		context.subscriptions.push(activateAutoInsertion([{ language: 'ripple' }], client));
		console.log('[Ripple] Auto-insertion activated');

		// Configure Prettier to handle .ripple files
		await configurePrettier();

		// Register custom formatter
		const formatProvider = registerFormatter();
		context.subscriptions.push(formatProvider);

		// Configure TypeScript command visibility for Ripple files
		//
		// The TypeScript extension provides many useful commands (Go to Definition, Find References, etc.)
		// but its menus only show for .ts/.js files by default. To make these commands available for
		// Ripple files, we need to:
		//
		// 1. Set static capability contexts (features that don't change):
		//    - tsSupportsSourceDefinition: Enables "Go to Source Definition" command
		//    - tsSupportsFileReferences: Enables "Find All File References" command
		//
		// 2. Set dynamic contexts that change based on the active editor (via setupDynamicContexts):
		//    - editorLangId: Current editor's language (used in Command Palette "when" clauses)
		//    - resourceLangId: Current resource's language (used in context menu "when" clauses)
		//    - typescript.isManagedFile: Whether TypeScript extension manages this file
		//    - supportedCodeAction: Available code actions (for "Sort Imports", etc.)
		//
		// These context values are then checked by the "when" clauses in package.json's "menus" section.
		// For example: "when": "resourceLangId == ripple" will show a menu item only for Ripple files.
		// Set contexts - but ts Supports Source Definition might need to be set by TS extension
		// based on actual capability
		vscode.commands.executeCommand('setContext', 'tsSupportsSourceDefinition', true);
		vscode.commands.executeCommand('setContext', 'tsSupportsFileReferences', true);

		setupDynamicContexts(context);
		console.log('[Ripple] Set up dynamic VSCode menu contexts');

		addCustomCommands(context);
		console.log('[Ripple] Registered custom commands');

		console.log('[Ripple] Extension activated successfully');
		return volar_labs.extensionExports;
	} catch (error) {
		console.error('Failed to start language client:', error);
		const message = error instanceof Error ? error.message : String(error);
		vscode.window.showErrorMessage(`Failed to start Ripple language server: ${message}`);
	}
}

/**
 * Sets up dynamic context variables that control when TypeScript commands appear in menus.
 *
 * Context Variables vs Menu Contributions:
 * ----------------------------------------
 * VSCode's menu system is declarative (defined in package.json) but uses context variables
 * for conditional visibility. This function bridges the gap by setting those context values.
 *
 * How it works:
 * 1. package.json defines WHERE commands appear and WHEN (using "when" clauses)
 *    Example: { "command": "typescript.goToSourceDefinition", "when": "resourceLangId == ripple" }
 *
 * 2. This function sets the VALUES of context variables that the "when" clauses check
 *    Example: setContext('resourceLangId', 'ripple') makes the above menu item visible
 *
 * 3. We update these contexts dynamically as the user switches between files
 *
 * Context Variables Set:
 * - editorLangId: Language ID of the active editor (for Command Palette menus)
 * - resourceLangId: Language ID of the current resource (for context menus)
 * - typescript.isManagedFile: Whether this file should be treated as a TypeScript-managed file
 * - supportedCodeAction: Space-separated list of available code action kinds
 *
 * Why Dynamic?
 * These contexts must update as the user switches files. A context set for a .ripple file
 * should not persist when switching to a .txt file, otherwise TypeScript commands would
 * inappropriately appear for non-Ripple files.
 *
 * Package.json Requirement:
 * This function is USELESS without corresponding "menus" entries in package.json that
 * reference these context variables in their "when" clauses. The contexts set here are
 * checked by those "when" clauses to determine menu visibility.
 */
/**
 * @param {import('vscode').ExtensionContext} context
 */
function setupDynamicContexts(context) {
	// Update contexts based on active editor
	function updateContexts() {
		const editor = vscode.window.activeTextEditor;
		const isRipple = editor?.document.languageId === 'ripple';

		// Set editorLangId context (used in commandPalette "when" clauses)
		// Example usage in package.json: "when": "editorLangId == ripple"
		vscode.commands.executeCommand('setContext', 'editorLangId', isRipple ? 'ripple' : undefined);

		// Set resourceLangId context (used in editor/context and explorer/context "when" clauses)
		// Example usage in package.json: "when": "resourceLangId == ripple"
		vscode.commands.executeCommand('setContext', 'resourceLangId', isRipple ? 'ripple' : undefined);

		// Set typescript.isManagedFile (used in commandPalette "when" clauses)
		// This mimics the TypeScript extension's own context to indicate Ripple files
		// are managed by TypeScript-like tooling
		vscode.commands.executeCommand('setContext', 'typescript.isManagedFile', isRipple);

		// Set supportedCodeAction context based on available code actions
		// This enables commands like "Sort Imports" and "Remove Unused Imports"
		// which check for specific code action support via regex in their "when" clauses
		if (isRipple && editor) {
			// Query available code actions for the current file
			vscode.commands
				.executeCommand('vscode.executeCodeActionProvider', editor.document.uri, editor.selection)
				.then((actions) => {
					if (Array.isArray(actions) && actions.length > 0) {
						const kinds = actions
							.map(
								(/** @type {{ kind?: { value?: string } }} */ action) => action.kind?.value || '',
							)
							.join(' ');
						vscode.commands.executeCommand('setContext', 'supportedCodeAction', kinds);
					} else {
						vscode.commands.executeCommand('setContext', 'supportedCodeAction', undefined);
					}
				});
		} else {
			vscode.commands.executeCommand('setContext', 'supportedCodeAction', undefined);
		}
	}

	// Update on activation
	updateContexts();

	// Update when active editor changes
	context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(() => updateContexts()));

	// Update when text document changes (code actions may change)
	context.subscriptions.push(
		vscode.workspace.onDidChangeTextDocument((e) => {
			if (e.document === vscode.window.activeTextEditor?.document) {
				updateContexts();
			}
		}),
	);
}

/**
 * @param {import('vscode').ExtensionContext} context
 */
function addCustomCommands(context) {
	context.subscriptions.push(
		vscode.commands.registerCommand('ripple.goToSourceDefinition', async () => {
			try {
				const editor = vscode.window.activeTextEditor;
				if (!editor) {
					console.log('[Ripple] No active editor');
					return;
				}

				const position = editor.selection.active;
				console.log('[Ripple] Getting definitions at position:', position);

				// Use VS Code's definition provider API
				const definitions = /** @type {any} */ (
					await vscode.commands.executeCommand(
						'vscode.executeDefinitionProvider',
						editor.document.uri,
						position,
					)
				);

				console.log('[Ripple] Definitions result:', definitions);

				if (!definitions || !Array.isArray(definitions) || definitions.length === 0) {
					vscode.window.showInformationMessage('No definition found');
					return;
				}

				// Filter for .ripple files (prefer source over .d.ts)
				// Definition objects can have either `uri` or `targetUri`
				const rippleDefinition = definitions.find((d) => {
					const uri = d?.uri || d?.targetUri;
					if (!uri) {
						console.warn('[Ripple] Definition has no uri:', d);
						return false;
					}
					const isRipple = uri.path.endsWith('.ripple');
					console.log('[Ripple] Checking definition:', uri.path, 'isRipple:', isRipple);
					return isRipple;
				});

				if (rippleDefinition) {
					const uri = rippleDefinition.uri || rippleDefinition.targetUri;
					const range = rippleDefinition.range || rippleDefinition.targetRange;
					console.log('[Ripple] Found ripple definition:', uri.path);
					await vscode.window.showTextDocument(uri, {
						selection: range,
					});
				} else {
					// If no .ripple file found, just go to the first definition (might be .d.ts)
					const firstDef = definitions[0];
					const uri = firstDef?.uri || firstDef?.targetUri;
					const range = firstDef?.range || firstDef?.targetRange;
					console.log('[Ripple] No .ripple definition, using first result:', uri?.path);
					if (uri) {
						await vscode.window.showTextDocument(uri, {
							selection: range,
						});
					}
				}
			} catch (error) {
				console.error('[Ripple] Error in goToSourceDefinition:', error);
				const message = error instanceof Error ? error.message : String(error);
				vscode.window.showErrorMessage(`Go to Source Definition failed: ${message}`);
			}
		}),
	);
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

		console.log('Prettier configuration updated for Ripple files');
	} catch (error) {
		console.error('Failed to configure Prettier:', error);
	}
}

function registerFormatter() {
	return vscode.languages.registerDocumentFormattingEditProvider(
		{ language: 'ripple', scheme: 'file' },
		{
			async provideDocumentFormattingEdits(document) {
				try {
					console.log('Formatting Ripple document:', document.fileName);

					// Try to use Prettier extension first
					const edits = await vscode.commands.executeCommand(
						'editor.action.formatDocument.prettier',
					);
					return Array.isArray(edits) ? edits : [];
				} catch (error) {
					console.error('Ripple formatting error:', error);
					vscode.window.showErrorMessage(
						'Failed to format Ripple file. Ensure Prettier and @ripple-ts/prettier-plugin are installed.',
					);
					return [];
				}
			},
		},
	);
}

async function deactivate() {
	console.log('Deactivating Ripple extension...');
	if (client) {
		try {
			await client.stop();
			console.log('Language client stopped');
		} catch (error) {
			console.error('Error stopping language client:', error);
		}
	}
}

/**
 * Patches the built-in TypeScript extension to recognize Ripple files.
 *
 * The built-in TypeScript extension (vscode.typescript-language-features) provides rich
 * language features for TypeScript and JavaScript files. To make these features work for
 * Ripple files, we need to patch the extension's internal language mode list.
 *
 * This patch modifies the TypeScript extension's code at runtime to add 'ripple' to:
 * 1. jsTsLanguageModes - The list of supported language IDs
 * 2. isSupportedLanguageMode - The function that checks if a file should be handled
 *
 * Why patching instead of typescriptServerPlugins?
 * -------------------------------------------------
 * The typescriptServerPlugins contribution point would load typescript-plugin into
 * the TypeScript extension's tsserver. However, we already run our own language server
 * (language-server) which uses typescript-plugin internally. Loading the
 * plugin twice would create conflicts and duplicate processing.
 *
 * By patching directly instead, we:
 * 1. Avoid double-loading typescript-plugin (it's already in our language server)
 * 2. Get deeper integration with the TypeScript extension's UI (menus, commands)
 * 3. Enable TypeScript commands for Ripple files without running duplicate language services
 * 4. Keep language intelligence in language-server while exposing TS UI features
 *
 * Combined with the context variables set by setupDynamicContexts(), this patch enables
 * the full suite of TypeScript commands and features to work seamlessly with Ripple files.
 */
/**
 * @typedef {object} PatchResult
 * @property {boolean} success Whether the patch ran without issues.
 * @property {"patched" | "alreadyPatched" | "missing" | "alreadyActive" | "patternMismatch"} reason
 */

/**
 * Ensures the built-in TypeScript extension recognizes Ripple files before it activates.
 * @returns {Promise<PatchResult>}
 */
async function patchTypeScriptExtension() {
	console.log('[Ripple] Starting TypeScript extension patch...');

	const tsExtension = vscode.extensions.getExtension('vscode.typescript-language-features');
	if (!tsExtension) {
		console.warn('[Ripple] TypeScript extension not found');
		return { success: false, reason: 'missing' };
	}

	if (tsExtension.isActive) {
		return { success: false, reason: 'alreadyActive' };
	}

	const fs = require('node:fs');
	const originalReadFileSync = fs.readFileSync;
	const extensionJsPath = require.resolve('./dist/extension.js', {
		paths: [tsExtension.extensionPath],
	});

	/**
	 * @param {import('node:fs').PathOrFileDescriptor} path
	 * @param {(import('node:fs').ObjectEncodingOptions & { flag?: string }) | BufferEncoding | null} [options]
	 */
	function patchedReadFileSync(path, options) {
		const hasOptions = typeof options !== 'undefined' && options !== null;
		const result = hasOptions
			? originalReadFileSync.call(fs, path, options)
			: originalReadFileSync.call(fs, path);
		if (path === extensionJsPath) {
			console.log('[Ripple] Intercepted read of TypeScript extension.js, applying patch...');
			const text = typeof result === 'string' ? result : result.toString('utf8');

			// Patch the TypeScript extension to recognize ripple files
			let patched = text
				.replace(
					't.jsTsLanguageModes=[t.javascript,t.javascriptreact,t.typescript,t.typescriptreact]',
					(s) => s + '.concat("ripple")',
				)
				.replace(
					'.languages.match([t.typescript,t.typescriptreact,t.javascript,t.javascriptreact]',
					(s) => s + '.concat("ripple")',
				);

			if (patched !== text) {
				console.log('[Ripple] Successfully patched TypeScript extension');
				return typeof result === 'string' ? patched : Buffer.from(patched, 'utf8');
			} else {
				console.warn(
					'[Ripple] TypeScript extension patterns did not match - may already be patched or structure changed',
				);
			}
		}
		return result;
	}

	try {
		console.log('[Ripple] Installing fs.readFileSync hook and activating TypeScript extension...');
		fs.readFileSync = /** @type {any} */ (patchedReadFileSync);
		await tsExtension.activate();
		console.log('[Ripple] TypeScript extension activated');
	} catch (error) {
		console.error('[Ripple] Failed to activate TypeScript extension:', error);
	} finally {
		fs.readFileSync = originalReadFileSync;
		console.log('[Ripple] fs.readFileSync hook removed');
	}

	return { success: true, reason: 'patched' };
}

module.exports = {
	activate,
	deactivate,
};
