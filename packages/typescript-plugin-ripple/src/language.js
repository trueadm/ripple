const { forEachEmbeddedCode } = require('@volar/language-core');

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
		getLanguageId(fileNameOrUri) {
			const file_name = typeof fileNameOrUri === 'string'
				? fileNameOrUri
				: fileNameOrUri.fsPath.replace(/\\/g, '/');
			if (file_name.endsWith('.ripple')) {
				log('Identified Ripple file:', file_name);
				return 'ripple';
			}
		},
		createVirtualCode(fileNameOrUri, languageId, snapshot) {
			if (languageId === 'ripple' && ripple) {
				const file_name = typeof fileNameOrUri === 'string'
					? fileNameOrUri
					: fileNameOrUri.fsPath.replace(/\\/g, '/');
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
				for (const code of forEachEmbeddedCode(ripple_code)) {
					if (code.languageId === 'ripple') {
						return {
							code,
							extension: '.tsx',
							scriptKind: 4,
						};
					}
				}
				return null;
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

module.exports = {
	getRippleLanguagePlugin,
	RippleVirtualCode,
};
