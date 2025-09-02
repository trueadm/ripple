const { forEachEmbeddedCode } = require('@volar/language-core');
const { URI } = require('vscode-uri');

const DEBUG = process.env.RIPPLE_DEBUG === 'true';

function log(...args) {
	if (DEBUG) {
		console.log('[Ripple Language]', ...args);
	}
}

function logError(...args) {
	console.error('[Ripple Language ERROR]', ...args);
}

function getRippleLanguagePlugin(ripple) {
	log('Creating Ripple language plugin...')

	return {
		getLanguageId(uri) {
			const path = uri.path;
			if (path.endsWith('.ripple')) {
				log('Identified Ripple file:', path);
				return 'ripple';
			}
		},
		createVirtualCode(uri, languageId, snapshot) {
			if (languageId === 'ripple') {
				const file_name = uri.fsPath.replace(/\\/g, '/');
				log('Creating virtual code for:', file_name);
				try {
					return new RippleVirtualCode(file_name, snapshot, ripple);
				} catch (err) {
					logError('Failed to create virtual code for:', file_name, ':', err);
					throw err;
				}
			}
		},
		typescript: {
			extraFileExtensions: [{ extension: 'ripple', isMixedContent: false, scriptKind: 7 }],
			getServiceScript(ripple_code) {
				try {
					for (const code of forEachEmbeddedCode(ripple_code)) {
						if (code.languageId === 'ripple') {
							return {
								code,
								extension: '.ts',
								scriptKind: 4,
							};
						}
					}
					return null;
				} catch (err) {
					logError('Failed to get service script:', err);
					return null;
				}
			},
		},
	};
}

class RippleVirtualCode {
	id = 'root';
	languageId = 'ripple';
	codegenStacks = [];

	constructor(file_name, snapshot, ripple) {
		log('Initializing RippleVirtualCode for:', file_name);

		this.fileName = file_name;
		this.ripple = ripple;
		this.diagnostics = [];
		this.originalCode = snapshot.getText(0, snapshot.getLength());

		// Validate ripple compiler
		if (!ripple || typeof ripple.compile_to_volar_mappings !== 'function') {
			logError('Invalid ripple compiler - missing compile_to_volar_mappings method');
			throw new Error('Invalid ripple compiler');
		}

		this.embeddedCodes = [];
		this.update(snapshot);
	}

	update(snapshot) {
		log('Updating virtual code for:', this.fileName);

		this.snapshot = snapshot;
		this.errors = [];
		let transpiled;

		try {
			log('Compiling Ripple code...');
			transpiled = this.ripple.compile_to_volar_mappings(this.originalCode, this.fileName);
			log('Compilation successful, generated code length:', transpiled?.code?.length || 0);
		} catch (error) {
			logError('Ripple compilation failed for', this.fileName, ':', error);
			this.errors.push(error);
		}

		if (transpiled && transpiled.code) {
			// Segment-based approach - mappings are already in Volar format
			this.generatedCode = transpiled.code;
			this.mappings = transpiled.mappings || [];
			this.isErrorMode = false; // Normal TypeScript mode

			log('Using transpiled code, mapping count:', this.mappings.length);

			this.snapshot = {
				getText: (start, end) => this.generatedCode.substring(start, end),
				getLength: () => this.generatedCode.length,
				getChangeRange: () => undefined,
			};
		} else {
			// When compilation fails, use the original code as-is
			// This way positions match exactly and we can provide diagnostics on raw text
			log('Compilation failed, using original code for diagnostics');

			this.generatedCode = this.originalCode;
			this.isErrorMode = true; // Flag to indicate we're in diagnostic-only mode

			// Create 1:1 mappings for the entire content
			this.mappings = [
				{
					sourceOffsets: [0],
					generatedOffsets: [0],
					lengths: [this.originalCode.length],
					data: {
						verification: true,
					},
				},
			];

			this.snapshot = {
				getText: (start, end) => this.generatedCode.substring(start, end),
				getLength: () => this.generatedCode.length,
				getChangeRange: () => undefined,
			};
		}
	}

	// Required by Volar for virtual code
	getEmbeddedCodes() {
		return this.embeddedCodes;
	}

	// Required by Volar for sourcemap mapping
	getMirrorMap() {
		return this.mappings;
	}
}

function createRippleDiagnosticPlugin() {
	log('Creating Ripple diagnostic plugin...');

	return {
		name: 'ripple-diagnostics',
		capabilities: {
			diagnosticProvider: {
				interFileDependencies: false,
				workspaceDiagnostics: false,
			},
		},
		create(context) {
			return {
				provideDiagnostics(document) {
					try {
						log('Providing diagnostics for:', document.uri);

						const info = getEmbeddedInfo(context, document);

						if (info && info.virtualCode.errors && info.virtualCode.errors.length > 0) {
							const virtualCode = info.virtualCode;
							const diagnostics = [];

							log('Processing', virtualCode.errors.length, 'errors');

							// Convert each stored error to a diagnostic
							for (const error of virtualCode.errors) {
								try {
									// Use the actual snapshot text that Volar is working with
									const snapshotText = virtualCode.snapshot.getText(
										0,
										virtualCode.snapshot.getLength(),
									);
									const diagnostic = parseCompilationErrorWithDocument(
										error,
										virtualCode.fileName,
										snapshotText,
										document,
									);
									diagnostics.push(diagnostic);
								} catch (parseError) {
									logError('Failed to parse compilation error:', parseError);
								}
							}

							log('Generated', diagnostics.length, 'diagnostics');
							return diagnostics;
						}

						return [];
					} catch (err) {
						logError('Failed to provide diagnostics:', err);
						return [];
					}
				},
			};
		},
	};
}

// Helper function to parse compilation errors using document.positionAt (Glint style)
function parseCompilationErrorWithDocument(error, fallbackFileName, sourceText, document) {
	const message = error.message || String(error);

	try {
		// First check if there's a GitHub-style range in the error
		// Format: filename#L39C24-L39C32
		const githubRangeMatch = message.match(/\(([^#]+)#L(\d+)C(\d+)-L(\d+)C(\d+)\)/);

		if (githubRangeMatch) {
			// Use the GitHub range data directly
			const startLine = parseInt(githubRangeMatch[2]);
			const startColumn = parseInt(githubRangeMatch[3]);
			const endLine = parseInt(githubRangeMatch[4]);
			const endColumn = parseInt(githubRangeMatch[5]);

			// Convert to zero-based
			const zeroBasedStartLine = Math.max(0, startLine - 1);
			const zeroBasedStartColumn = Math.max(0, startColumn);
			const zeroBasedEndLine = Math.max(0, endLine - 1);
			const zeroBasedEndColumn = Math.max(0, endColumn);

			return {
				severity: 1, // DiagnosticSeverity.Error
				range: {
					start: { line: zeroBasedStartLine, character: zeroBasedStartColumn },
					end: { line: zeroBasedEndLine, character: zeroBasedEndColumn },
				},
				message: message.replace(/\s*\([^#]+#L\d+C\d+-L\d+C\d+\)/, '').trim(), // Remove the range part from message
				source: 'Ripple',
				code: 'ripple-compile-error',
			};
		}

		// Fallback to old parsing method if no range found
		// Try to parse location from error message
		// Format: "Error message (filename:line:column)"
		const locationMatch = message.match(/\(([^:]+):(\d+):(\d+)\)$/);

		if (locationMatch) {
			const [, fileName, lineStr, columnStr] = locationMatch;
			const line = parseInt(lineStr, 10);
			const column = parseInt(columnStr, 10);

			// Extract the main error message (without location)
			const cleanMessage = message.replace(/\s*\([^:]+:\d+:\d+\)$/, '');

			// Convert 1-based line/column to 0-based for VS Code
			const zeroBasedLine = Math.max(0, line - 1);
			const zeroBasedColumn = Math.max(0, column - 1);

			// Use the original error coordinates from the Ripple compiler
			// Just use the compiler's position as-is, with a simple 1-character highlight
			let actualColumn = zeroBasedColumn;
			let length = Math.min(1, sourceText.split('\n')[zeroBasedLine]?.length - actualColumn || 1);

			return {
				severity: 1, // DiagnosticSeverity.Error
				range: {
					start: { line: zeroBasedLine, character: actualColumn },
					end: { line: zeroBasedLine, character: actualColumn + length },
				},
				message: cleanMessage,
				source: 'Ripple',
				code: 'ripple-compile-error',
			};
		} else {
			// Fallback for errors without location information
			const startPosition = document.positionAt(0);
			const endPosition = document.positionAt(Math.min(1, sourceText.length));

			return {
				severity: 1, // DiagnosticSeverity.Error
				range: {
					start: startPosition,
					end: endPosition,
				},
				message: `Ripple compilation error: ${message}`,
				source: 'Ripple',
				code: 'ripple-compile-error',
			};
		}
	} catch (parseError) {
		logError('Error parsing compilation error:', parseError);

		return {
			serverity: 1,
			range: {
				start: { line: 0, character: 0 },
				end: { line: 0, character: 1 },
			},
			message: `Ripple compilation error: ${message}`,
			source: 'Ripple',
			code: 'ripple-parse-error',
		};
	}
}

function getEmbeddedInfo(context, document) {
	try {
		const uri = URI.parse(document.uri);
		const decoded = context.decodeEmbeddedDocumentUri(uri);
		if (!decoded) {
			return;
		}

		const [documentUri, embeddedCodeId] = decoded;

		const sourceScript = context.language.scripts.get(documentUri);
		if (!sourceScript?.generated) {
			return;
		}

		const virtualCode = sourceScript.generated.embeddedCodes.get(embeddedCodeId);
		if (!(virtualCode instanceof RippleVirtualCode)) {
			return;
		}

		return {
			sourceScript: sourceScript,
			virtualCode,
		};
	} catch (err) {
		logError('Failed to get embedded info:', err);
		return null;
	}
}

module.exports = {
	getRippleLanguagePlugin,
	createRippleDiagnosticPlugin,
	RippleVirtualCode,
};
