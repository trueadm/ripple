/**
 * @import {Diagnostic, Range, LanguageServicePlugin, LanguageServiceContext, Position, Mapper} from '@volar/language-server';
 * @import {TextDocument} from 'vscode-languageserver-textdocument';
 * @import {RippleVirtualCode} from '@ripple-ts/typescript-plugin/src/language.js';
 */
// @ts-expect-error: ESM type import is fine
/** @import {RippleCompileError} from 'ripple/compiler'; */

const { getVirtualCode, createLogging } = require('./utils.js');

const { log } = createLogging('[Ripple Compile Error Diagnostic Plugin]');
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
					log('Providing Ripple diagnostics for:', document.uri);

					/** @type {Diagnostic[]} */
					const diagnostics = [];
					const { virtualCode, sourceMap } = getVirtualCode(document, context);

					if (!virtualCode || virtualCode.languageId !== 'ripple') {
						// skip if it's like embedded css
						return diagnostics;
					}

					if (!virtualCode.fatalErrors.length && !virtualCode.usageErrors.length) {
						return diagnostics;
					}

					for (const error of [...virtualCode.fatalErrors, ...virtualCode.usageErrors]) {
						const diagnostic = parseCompilationErrorWithDocument(
							error,
							virtualCode,
							sourceMap,
							document,
						);
						diagnostics.push(diagnostic);
					}

					log('Generated', diagnostics.length, 'diagnostics');
					return diagnostics;
				},
			};
		},
	};
}

/**
 * @param {RippleCompileError} error
 * @param {RippleVirtualCode} virtualCode
 * @param {Mapper | undefined} sourceMap
 * @param {TextDocument} document
 * @returns {Diagnostic}
 */
function parseCompilationErrorWithDocument(error, virtualCode, sourceMap, document) {
	if (error.type === 'fatal') {
		return {
			severity: DiagnosticSeverity.Error,
			range: get_error_range_from_source(error, document),
			message: error.message,
			source: 'Ripple',
			code: 'ripple-compile-error',
		};
	}

	/** @type {Position | null} */
	let start = null;
	/** @type {Position | null} */
	let end = null;

	if (error.pos) {
		const start_offset = get_start_offset_from_error(error);
		const end_offset = get_end_offset_from_error(error, start_offset);
		// try to find exact mapping
		// TODO: perhaps it's best to just switch to sourceMap entirely?
		const mapping = virtualCode.findMappingBySourceRange(start_offset, end_offset);

		if (mapping) {
			start = document.positionAt(mapping.generatedOffsets[0]);
			end = document.positionAt(
				mapping.generatedOffsets[0] +
					(mapping.generatedLengths || mapping.data.customData.generatedLengths)[0],
			);
		} else if (sourceMap) {
			// try to find the match even across multiple mappings
			const result = sourceMap.toGeneratedRange(start_offset, end_offset, true).next().value;

			if (result) {
				const [gen_start_offset, gen_end_offset] = result;
				start = document.positionAt(gen_start_offset);
				end = document.positionAt(gen_end_offset);
			}
		}
	}

	if (!start || !end) {
		start = { line: 0, character: 0 };
		end = { line: 0, character: 1 };
	}

	return {
		severity: DiagnosticSeverity.Error,
		range: { start, end },
		message: error.message,
		source: 'Ripple',
		code: 'ripple-usage-error',
	};
}

/**
 * @param {RippleCompileError} error
 * @param {TextDocument} document
 * @returns {Range}
 */
function get_error_range_from_source(error, document) {
	const start_offset = get_start_offset_from_error(error);
	return {
		start: document.positionAt(start_offset),
		end: document.positionAt(get_end_offset_from_error(error, start_offset)),
	};
}

/**
 * @param {RippleCompileError} error
 * @param {number} [start_offset]
 * @returns {number}
 */
function get_end_offset_from_error(error, start_offset) {
	start_offset = start_offset ?? get_start_offset_from_error(error);
	return error.end
		? error.end
		: error.raisedAt && (error.raisedAt ?? 0) > start_offset
			? error.raisedAt
			: start_offset + 1;
}

/**
 * @param {RippleCompileError} error
 * @returns {number}
 */
function get_start_offset_from_error(error) {
	return error.pos ?? 0;
}

module.exports = {
	createCompileErrorDiagnosticPlugin,
};
