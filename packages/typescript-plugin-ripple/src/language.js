/** @type {import('typescript')} */
const ts = require('typescript');
const { forEachEmbeddedCode } = require('@volar/language-core');
const fs = require('fs');

/** @typedef {import('typescript').CompilerOptions} CompilerOptions */
/** @typedef {Error & { pos?: number }} RippleError */
/** @typedef {import('@volar/language-core').CodeMapping} CodeMapping */
/** @typedef {import('@volar/language-core').IScriptSnapshot} IScriptSnapshot */
/** @typedef {import('@volar/language-core').VirtualCode} VirtualCode */
/** @typedef {string | { fsPath: string }} ScriptId */
/** @typedef {import('@volar/language-core').LanguagePlugin<ScriptId, VirtualCode>} RippleLanguagePlugin */

/**
 * @typedef {object} RippleCompileResult
 * @property {string} code
 * @property {CodeMapping[]} [mappings]
 */

/**
 * @typedef {object} RippleCompiler
 * @property {(code: string, fileName: string) => RippleCompileResult} compile_to_volar_mappings
 */

const DEBUG = process.env.RIPPLE_DEBUG === 'true';

/**
 * @param {...unknown} args
 */
function log(...args) {
	if (DEBUG) {
		console.log('[Ripple Language]', ...args);
	}
}

/**
 * @param {...unknown} args
 */
function logError(...args) {
	console.error('[Ripple Language ERROR]', ...args);
}

/**
 * @returns {RippleLanguagePlugin}
 */
function getRippleLanguagePlugin() {
	log('Creating Ripple language plugin...');

	/** @type {Map<string, string | null>} */
	const path2RipplePathMap = new Map();

	return {
		/**
		 * @param {ScriptId} fileNameOrUri
		 */
		getLanguageId(fileNameOrUri) {
			const file_name = typeof fileNameOrUri === 'string'
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
				const file_name = typeof fileNameOrUri === 'string'
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
	 * @param {string} file_name
	 * @returns {RippleCompiler | undefined}
	 */
	function getRippleForFile(file_name) {
		const parts = file_name.split('/');

		for (let i = parts.length - 2; i >= 0; i--) {
			const dir = parts.slice(0, i + 1).join('/');

			if (!path2RipplePathMap.has(dir)) {
				const full_path = [dir, 'node_modules', 'ripple', 'src', 'compiler', 'index.js'].join('/');
				console.log("Checking ripple path:", full_path)
				if (fs.existsSync(full_path)) {
					path2RipplePathMap.set(dir, full_path);
					console.log("Found ripple compiler at:", full_path)
				}
				else {
					path2RipplePathMap.set(dir, null);
				}
			}

			const ripple_path = path2RipplePathMap.get(dir);
			if (ripple_path) {
				return /** @type {RippleCompiler} */ (require(ripple_path));
			}
		}
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
	/** @type {VirtualCode['mappings']} */
	mappings = [];
	/** @type {boolean} */
	isErrorMode = false;
	/** @type {RippleError[]} */
	errors = [];
	/** @type {IScriptSnapshot} */
	snapshot;
	/** @type {string} */
	originalCode = '';
	/** @type {unknown[]} */
	diagnostics = [];

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

		this.snapshot = snapshot;
		this.errors = [];
		/** @type {RippleCompileResult | undefined} */
		let transpiled;

		try {
			log('Compiling Ripple code...');
			transpiled = this.ripple.compile_to_volar_mappings(this.originalCode, this.fileName);
			log('Compilation successful, generated code length:', transpiled?.code?.length || 0);
		} catch (error) {
			logError('Ripple compilation failed for', this.fileName, ':', error);
			this.errors.push(/** @type {Error & { pos?: number }} */ (error));
		}

		if (transpiled && transpiled.code) {
			// Segment-based approach - mappings are already in Volar format
			this.generatedCode = transpiled.code;
			this.mappings = transpiled.mappings ?? [];
			this.isErrorMode = false; // Normal TypeScript mode

			log('Using transpiled code, mapping count:', this.mappings.length);

			this.snapshot = /** @type {IScriptSnapshot} */ ({
				getText: (start, end) => this.generatedCode.substring(start, end),
				getLength: () => this.generatedCode.length,
				getChangeRange: () => undefined,
			});
		} else {
			// When compilation fails, show where it failed and disable all
			// TypeScript diagnostics until the compilation error is fixed
			log('Compilation failed, only display where the compilation error occurred.');

			// Produce minimal valid TypeScript code to avoid cascading errors.
			this.generatedCode = 'export {};\n';
			this.isErrorMode = true; // Flag to indicate we're in diagnostic-only mode

			// Create 1:1 mappings for the entire content
			this.mappings = [
				{
					sourceOffsets: [this.errors[0]?.pos ?? 0],
					generatedOffsets: [0],
					lengths: [this.originalCode.length],
					data: {
						verification: true,
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
		(options.lib ?? [])
			.map(normalizeLibName)
			.filter((lib) => typeof lib === 'string'),
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
