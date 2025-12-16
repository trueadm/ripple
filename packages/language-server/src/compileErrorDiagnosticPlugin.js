/**
 * @import {Diagnostic, LanguageServicePlugin, LanguageServiceContext} from '@volar/language-server'
 * @import {TextDocument} from 'vscode-languageserver-textdocument'
 */

const { getVirtualCode, createLogging } = require('./utils.js');

const { log, logError } = createLogging('[Ripple Compile Error Diagnostic Plugin]');
const { DiagnosticSeverity } = require('@volar/language-server');

/**
 * @returns {LanguageServicePlugin}
 */
function createCompileErrorDiagnosticPlugin() {
	log('Creating Ripple diagnostic plugin...');

	return {
		name: 'ripple-diagnostics',
		capabilities: {
			diagnosticProvider: {
				interFileDependencies: false,
				workspaceDiagnostics: false,
			},
		},
		create(/** @type {LanguageServiceContext} */ context) {
			return {
				provideDiagnostics(document, _token) {
					try {
						log('Providing Ripple diagnostics for:', document.uri);

						const [virtualCode] = getVirtualCode(document, context);

						if (!virtualCode || !virtualCode.errors || virtualCode.errors.length === 0) {
							return [];
						}

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
/**
 * @param {unknown} error
 * @param {string} fallbackFileName
 * @param {string} sourceText
 * @param {TextDocument} document
 * @returns {Diagnostic}
 */
function parseCompilationErrorWithDocument(error, fallbackFileName, sourceText, document) {
	const errorObject = /** @type {{ message?: string }} */ (error);
	const message = errorObject.message || String(error);

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
				severity: DiagnosticSeverity.Error,
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
			const actualColumn = Math.max(0, column - 1);

			// Use the original error coordinates from the Ripple compiler
			// Just use the compiler's position as-is, with a simple 1-character highlight
			let length = Math.min(1, sourceText.split('\n')[zeroBasedLine]?.length - actualColumn || 1);

			return {
				severity: DiagnosticSeverity.Error,
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
				severity: DiagnosticSeverity.Error,
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
			severity: DiagnosticSeverity.Error,
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

module.exports = {
	createCompileErrorDiagnosticPlugin,
};
