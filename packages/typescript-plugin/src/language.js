/** @type {import('typescript')} */
// @ts-expect-error type-only import from ESM module into CJS is fine
/** @import { CodeMapping } from 'ripple/compiler' */
/** @typedef {Map<string, CodeMapping>} CachedMappings */
/** @typedef {import('typescript').CompilerOptions} CompilerOptions */
/** @typedef {Error & { pos?: number }} RippleError */
/** @typedef {import('@volar/language-core').IScriptSnapshot} IScriptSnapshot */
/** @typedef {import('@volar/language-core').VirtualCode} VirtualCode */
/** @typedef {string | { fsPath: string }} ScriptId */
/** @typedef {import('@volar/typescript')} */
/** @typedef {import('@volar/language-core').LanguagePlugin<ScriptId, VirtualCode>} RippleLanguagePlugin */
// @ts-expect-error type-only import from ESM module into CJS is fine
/** @typedef {import('ripple/compiler')} RippleCompiler */
/** @typedef {ReturnType<RippleCompiler['compile_to_volar_mappings']>['scopedClasses']} ScopedClasses */
/** @typedef {ReturnType<RippleCompiler['compile_to_volar_mappings']>['cssClasses']} CssClasses */

const ts = require('typescript');
const { forEachEmbeddedCode } = require('@volar/language-core');
const fs = require('fs');
const path = require('path');
const { createLogging, DEBUG } = require('./utils.js');

const { log, logWarning, logError } = createLogging('[Ripple Language]');

/**
 * @returns {RippleLanguagePlugin}
 */
function getRippleLanguagePlugin() {
	log('Creating Ripple language plugin...');

	/** @type {Map<string, string | null>} */
	const path2RipplePathMap = new Map();
	/** @type {string | null} */
	let packaged_path = null;

	return {
		/**
		 * @param {ScriptId} fileNameOrUri
		 */
		getLanguageId(fileNameOrUri) {
			const file_name =
				typeof fileNameOrUri === 'string'
					? fileNameOrUri
					: fileNameOrUri.fsPath.replace(/\\/g, '/');
			if (file_name.endsWith('.ripple')) {
				log('Identified Ripple file:', file_name);
				return 'ripple';
			}
		},

		/**
		 * @param {ScriptId} fileNameOrUri
		 * @param {string} languageId
		 * @param {IScriptSnapshot} snapshot
		 */
		createVirtualCode(fileNameOrUri, languageId, snapshot) {
			if (languageId === 'ripple') {
				const file_name =
					typeof fileNameOrUri === 'string'
						? fileNameOrUri
						: fileNameOrUri.fsPath.replace(/\\/g, '/');
				const ripple = getRippleForFile(file_name);
				if (!ripple) {
					logError(`Ripple compiler not found for file: ${file_name}`);
					return undefined;
				}
				log('Creating virtual code for:', file_name);
				try {
					return new RippleVirtualCode(file_name, snapshot, ripple);
				} catch (err) {
					logError('Failed to create virtual code for:', file_name, ':', err);
					throw err;
				}
			}
			return undefined;
		},

		/**
		 * @param {ScriptId} fileNameOrUri
		 * @param {VirtualCode} virtualCode
		 * @param {IScriptSnapshot} snapshot
		 */
		updateVirtualCode(fileNameOrUri, virtualCode, snapshot) {
			if (virtualCode instanceof RippleVirtualCode) {
				log('Updating existing virtual code for:', virtualCode.fileName);
				virtualCode.update(snapshot);
				return virtualCode;
			}
			return undefined;
		},

		typescript: {
			extraFileExtensions: [{ extension: 'ripple', isMixedContent: false, scriptKind: 7 }],
			/**
			 * @param {VirtualCode} ripple_code
			 */
			getServiceScript(ripple_code) {
				for (const code of forEachEmbeddedCode(ripple_code)) {
					if (code.languageId === 'ripple') {
						return {
							code,
							extension: '.tsx',
							scriptKind: 4,
						};
					}
				}
				return undefined;
			},
		},
	};

	/**
	 * @param {string} normalized_file_name
	 * @returns {RippleCompiler | undefined}
	 */
	function getRippleForFile(normalized_file_name) {
		const compiler_path = ['node_modules', 'ripple', 'src', 'compiler', 'index.js'];

		const parts = normalized_file_name.split('/');

		// First, try to find ripple in the workspace (user's repo)
		for (let i = parts.length - 2; i >= 0; i--) {
			const dir = parts.slice(0, i + 1).join('/');

			if (!path2RipplePathMap.has(dir)) {
				const full_path = [dir, ...compiler_path].join('/');
				if (fs.existsSync(full_path)) {
					path2RipplePathMap.set(dir, full_path);
					log('Found ripple compiler at:', full_path);
				} else {
					path2RipplePathMap.set(dir, null);
				}
			}

			const ripple_path = path2RipplePathMap.get(dir);
			if (ripple_path) {
				return /** @type {RippleCompiler} */ (require(ripple_path));
			}
		}

		const warn_message = `Ripple compiler not found in workspace for ${normalized_file_name}. \
		Using packaged version`;

		if (packaged_path) {
			logWarning(`${warn_message} at ${packaged_path}`);
			return /** @type {RippleCompiler} */ (require(packaged_path));
		}

		// Fallback: look for the packaged version
		// Use node's module resolution just in case we move the package location
		// Start from the plugin's directory and walk up
		let current_dir = __dirname;

		while (current_dir) {
			const full_path = path.join(current_dir, ...compiler_path);

			if (fs.existsSync(full_path)) {
				packaged_path = full_path;
				logWarning(`${warn_message} at ${packaged_path}`);
				return /** @type {RippleCompiler} */ (require(full_path));
			}

			const parent_dir = path.dirname(current_dir);
			// Stop if we've reached the root
			if (parent_dir === current_dir) {
				break;
			}
			current_dir = parent_dir;
		}

		return undefined;
	}
}

/**
 * @implements {VirtualCode}
 */
class RippleVirtualCode {
	/** @type {string} */
	id = 'root';
	/** @type {string} */
	languageId = 'ripple';
	/** @type {unknown[]} */
	codegenStacks = [];
	/** @type {RippleCompiler} */
	ripple;
	/** @type {string} */
	generatedCode = '';
	/** @type {VirtualCode['embeddedCodes']} */
	embeddedCodes = [];
	/** @type {CodeMapping[]} */
	mappings = [];
	/** @type {boolean} */
	isErrorMode = false;
	/** @type {RippleError[]} */
	errors = [];
	/** @type {IScriptSnapshot} */
	snapshot;
	/** @type {IScriptSnapshot} */
	sourceSnapshot;
	/** @type {string} */
	originalCode = '';
	/** @type {unknown[]} */
	diagnostics = [];
	/** @type {ScopedClasses} */
	scopedClasses = [];
	/** @type {CssClasses} */
	cssClasses = [];
	/** @type {CachedMappings | null} */
	#mappingGenToSource = null;
	/** @type {CachedMappings | null} */
	#mappingSourceToGen = null;

	/**
	 * @param {string} file_name
	 * @param {IScriptSnapshot} snapshot
	 * @param {RippleCompiler} ripple
	 */
	constructor(file_name, snapshot, ripple) {
		log('Initializing RippleVirtualCode for:', file_name);

		this.fileName = file_name;
		this.ripple = ripple;
		this.snapshot = snapshot;
		this.sourceSnapshot = snapshot;
		this.originalCode = snapshot.getText(0, snapshot.getLength());

		// Validate ripple compiler
		if (!ripple || typeof ripple.compile_to_volar_mappings !== 'function') {
			logError('Invalid ripple compiler - missing compile_to_volar_mappings method');
			throw new Error('Invalid ripple compiler');
		}

		this.update(snapshot);
	}

	/**
	 * @param {IScriptSnapshot} snapshot
	 * @returns {void}
	 */
	update(snapshot) {
		log('Updating virtual code for:', this.fileName);

		const newCode = snapshot.getText(0, snapshot.getLength());
		const changeRange = snapshot.getChangeRange(this.sourceSnapshot);
		this.sourceSnapshot = snapshot;

		// Only clear mapping index - don't update snapshot/originalCode yet
		this.#mappingGenToSource = null;
		this.#mappingSourceToGen = null;

		/** @type {ReturnType<RippleCompiler['compile_to_volar_mappings']> | undefined} */
		let transpiled;

		// Check if a single "." was typed using changeRange
		let isDotTyped = false;
		let dotPosition = -1;

		log('changeRange:', JSON.stringify(changeRange));

		if (changeRange) {
			const changeStart = changeRange.span.start;
			const changeEnd = changeStart + changeRange.span.length;
			const newEnd = changeStart + changeRange.newLength;

			// Get the old text (what was replaced) from originalCode
			const oldText = this.originalCode.substring(changeStart, changeEnd);
			// Get the new text (what replaced it) from newCode
			const newText = newCode.substring(changeStart, newEnd);

			log('Change details:');
			log('  Position:', changeStart, '-', changeEnd, '(length:', changeRange.span.length, ')');
			log('  Old text:', JSON.stringify(oldText));
			log('  New text:', JSON.stringify(newText), '(length:', changeRange.newLength, ')');

			// Check if a dot was added at the end of the new text
			if (newText.endsWith('.')) {
				// The dot is at position newEnd - 1
				// We need to check the character BEFORE the dot (inside the new text)
				const charBeforeDot = newEnd > 1 ? newCode[newEnd - 2] : '';
				log('  Char before dot:', JSON.stringify(charBeforeDot));

				if (/[a-zA-Z0-9_\)\]\}]/.test(charBeforeDot)) {
					isDotTyped = true;
					dotPosition = newEnd - 1; // Position of the dot
					log('ChangeRange detected dot typed at position', dotPosition);
				}
			}
		}

		try {
			// If user typed a ".", use placeholder technique to get completions
			if (isDotTyped && dotPosition >= 0) {
				const charBeforeDot = newCode[dotPosition - 1];
				const codeWithPlaceholder =
					newCode.substring(0, dotPosition) + charBeforeDot + newCode.substring(dotPosition + 1);

				log('Using placeholder technique for dot at position', dotPosition);
				transpiled = this.ripple.compile_to_volar_mappings(codeWithPlaceholder, this.fileName);
				log('Compilation with placeholder successful');

				// Find where the placeholder ended up in generated code and replace with "."
				if (transpiled && transpiled.code && transpiled.mappings.length > 0) {
					let placeholderMapping = null;
					for (const mapping of transpiled.mappings) {
						const sourceStart = mapping.sourceOffsets[0];
						const sourceEnd = sourceStart + mapping.lengths[0];

						if (dotPosition >= sourceStart && dotPosition < sourceEnd) {
							placeholderMapping = mapping;
							break;
						}
					}

					if (placeholderMapping) {
						const offsetInMapping = dotPosition - placeholderMapping.sourceOffsets[0];
						const placeholderPosInGenerated =
							placeholderMapping.generatedOffsets[0] + offsetInMapping;

						transpiled.code =
							transpiled.code.substring(0, placeholderPosInGenerated) +
							'.' +
							transpiled.code.substring(placeholderPosInGenerated + 1);

						log('Replaced placeholder at position', placeholderPosInGenerated, 'with dot');
					}
				}
				this.errors = [];
			} else {
				// Normal compilation
				log('Compiling Ripple code...');
				transpiled = this.ripple.compile_to_volar_mappings(newCode, this.fileName, {
					loose: true,
				});
				log('Compilation successful, generated code length:', transpiled?.code?.length || 0);
				this.errors = [];
			}
		} catch (error) {
			logError('Ripple compilation failed for', this.fileName, ':', error);
			this.errors.push(/** @type {Error & { pos?: number }} */ (error));
		}

		if (transpiled && transpiled.code) {
			// Successful compilation - update everything
			this.originalCode = newCode;
			this.generatedCode = transpiled.code;
			this.mappings = transpiled.mappings ?? [];
			this.scopedClasses = transpiled.scopedClasses ?? [];
			this.cssClasses = transpiled.cssClasses ?? [];
			this.isErrorMode = false;

			const { cssMappings, cssSources } = transpiled;
			if (cssMappings.length > 0) {
				log('Creating', cssMappings.length, 'CSS embedded codes');

				this.embeddedCodes = cssMappings.map((mapping, index) => {
					const cssContent = cssSources[index];
					log(
						`CSS region ${index}: \
						offset ${mapping.sourceOffsets[0]}-${mapping.sourceOffsets[0] + mapping.lengths[0]}, \
						length ${mapping.lengths[0]}`,
					);

					return {
						id: `style_${index}`,
						languageId: 'css',
						snapshot: {
							getText: (start, end) => cssContent.substring(start, end),
							getLength: () => mapping.lengths[0],
							getChangeRange: () => undefined,
						},
						mappings: [mapping],
						embeddedCodes: [],
					};
				});
			} else {
				this.embeddedCodes = [];
			}

			if (DEBUG) {
				log('CSS embedded codes:', this.embeddedCodes.length);
				log('Using transpiled code, mapping count:', this.mappings.length);
				log('Original code length:', newCode.length);
				log('Generated code length:', this.generatedCode.length);
				log('Last 100 chars of original:', JSON.stringify(newCode.slice(-100)));
				log('Last 200 chars of generated:', JSON.stringify(this.generatedCode.slice(-200)));
				log('Last few mappings:');
				const startIdx = Math.max(0, this.mappings.length - 5);
				for (let i = startIdx; i < this.mappings.length; i++) {
					const m = this.mappings[i];
					log(
						`  Mapping ${i}: source[${m.sourceOffsets[0]}:${m.sourceOffsets[0] + m.lengths[0]}] -> gen[${m.generatedOffsets[0]}:${m.generatedOffsets[0] + m.lengths[0]}], len=${m.lengths[0]}, completion=${m.data?.completion}`,
					);
				}
			}

			this.snapshot = /** @type {IScriptSnapshot} */ ({
				getText: (start, end) => this.generatedCode.substring(start, end),
				getLength: () => this.generatedCode.length,
				getChangeRange: () => undefined,
			});
		} else {
			// When compilation fails, show where it failed and disable all
			// TypeScript diagnostics until the compilation error is fixed
			log('Compilation failed, only display where the compilation error occurred.');

			this.originalCode = newCode;
			this.generatedCode = 'export {};\n';
			this.isErrorMode = true;

			// Create 1:1 mappings for the entire content
			this.mappings = [
				{
					sourceOffsets: [this.errors[0]?.pos ?? 0],
					generatedOffsets: [0],
					lengths: [newCode.length],
					data: {
						verification: true,
						customData: { generatedLengths: [newCode.length] },
					},
				},
			];

			this.snapshot = /** @type {IScriptSnapshot} */ ({
				getText: (start, end) => this.generatedCode.substring(start, end),
				getLength: () => this.generatedCode.length,
				getChangeRange: () => undefined,
			});
		}
	}

	#buildMappingCache() {
		if (this.#mappingGenToSource || this.#mappingSourceToGen) {
			return;
		}

		this.#mappingGenToSource = new Map();
		this.#mappingSourceToGen = new Map();

		var mapping, genStart, genLength, genEnd, genKey;
		var sourceStart, sourceLength, sourceEnd, sourceKey;
		for (var i = 0; i < this.mappings.length; i++) {
			mapping = this.mappings[i];

			genStart = mapping.generatedOffsets[0];
			genLength = mapping.data.customData.generatedLengths[0];
			genEnd = genStart + genLength;
			genKey = `${genStart}-${genEnd}`;
			this.#mappingGenToSource.set(genKey, mapping);

			sourceStart = mapping.sourceOffsets[0];
			sourceLength = mapping.lengths[0];
			sourceEnd = sourceStart + sourceLength;
			sourceKey = `${sourceStart}-${sourceEnd}`;
			this.#mappingSourceToGen.set(sourceKey, mapping);
		}
	}

	/**
	 * Find mapping by generated range
	 * @param {number} start - The start offset of the range
	 * @param {number} end - The end offset of the range
	 * @returns {CodeMapping | null} The mapping for this range, or null if not found
	 */
	findMappingByGeneratedRange(start, end) {
		this.#buildMappingCache();
		return /** @type {CachedMappings} */ (this.#mappingGenToSource).get(`${start}-${end}`) ?? null;
	}

	/**
	 * Find mapping by source range
	 * @param {number} start - The start offset of the range
	 * @param {number} end - The end offset of the range
	 * @returns {CodeMapping | null} The mapping for this range, or null if not found
	 */
	findMappingBySourceRange(start, end) {
		this.#buildMappingCache();
		return /** @type {CachedMappings} */ (this.#mappingSourceToGen).get(`${start}-${end}`) ?? null;
	}
}

/**
 * @template T
 * @param {{ options?: CompilerOptions } & T} config
 * @returns {{ options: CompilerOptions } & T}
 */
const resolveConfig = (config) => {
	const baseOptions = config.options ?? /** @type {CompilerOptions} */ ({});
	/** @type {CompilerOptions} */
	const options = { ...baseOptions };

	// Default target: align with modern bundlers while staying configurable.
	if (options.target === undefined) {
		options.target = ts.ScriptTarget.ESNext;
	}

	/** @param {string} libName */
	const normalizeLibName = (libName) => {
		if (typeof libName !== 'string' || libName.length === 0) {
			return undefined;
		}
		const trimmed = libName.trim();
		if (trimmed.startsWith('lib.')) {
			return trimmed.toLowerCase();
		}
		return `lib.${trimmed.toLowerCase().replace(/\s+/g, '').replace(/_/g, '.')}\.d.ts`;
	};

	const normalizedLibs = new Set(
		(options.lib ?? []).map(normalizeLibName).filter((lib) => typeof lib === 'string'),
	);

	if (normalizedLibs.size === 0) {
		const host = ts.createCompilerHost(options);
		const defaultLibFileName = host.getDefaultLibFileName(options).toLowerCase();
		normalizedLibs.add(defaultLibFileName);
		normalizedLibs.add('lib.dom.d.ts');
		normalizedLibs.add('lib.dom.iterable.d.ts');
	}

	options.lib = [...normalizedLibs];

	// Default typeRoots: automatically discover @types like tsserver.
	if (!options.types) {
		const host = ts.createCompilerHost(options);
		const typeRoots = ts.getEffectiveTypeRoots(options, host);
		if (typeRoots && typeRoots.length > 0) {
			options.typeRoots = typeRoots;
		}
	}

	return {
		...config,
		options,
	};
};

module.exports = {
	getRippleLanguagePlugin,
	RippleVirtualCode,
	resolveConfig,
};
