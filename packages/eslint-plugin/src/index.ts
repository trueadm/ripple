import { createRequire } from 'module';
import noModuleScopeTrack from './rules/no-module-scope-track.js';
import preferOnInput from './rules/prefer-oninput.js';
import noReturnInComponent from './rules/no-return-in-component.js';
import unboxTrackedValues from './rules/unbox-tracked-values.js';
import controlFlowJsx from './rules/control-flow-jsx.js';
import noIntrospectInModules from './rules/no-introspect-in-modules.js';
import validForOfKey from './rules/valid-for-of-key.js';

const plugin = {
	meta: {
		name: '@ripple-ts/eslint-plugin',
		version: '0.1.3',
	},
	rules: {
		'no-module-scope-track': noModuleScopeTrack,
		'prefer-oninput': preferOnInput,
		'no-return-in-component': noReturnInComponent,
		'unbox-tracked-values': unboxTrackedValues,
		'control-flow-jsx': controlFlowJsx,
		'no-introspect-in-modules': noIntrospectInModules,
		'valid-for-of-key': validForOfKey,
	},
	configs: {} as any,
};

// Try to load optional parsers
const require = createRequire(import.meta.url);

let rippleParser: any;
let tsParser: any;

try {
	rippleParser = require('@ripple-ts/eslint-parser');
} catch {
	// @ripple-ts/eslint-parser is optional
	rippleParser = null;
}

try {
	tsParser = require('@typescript-eslint/parser');
} catch {
	// @typescript-eslint/parser is optional
	tsParser = null;
}

// Helper to create config objects
function createConfig(name: string, files: string[], parser: any) {
	const config: any = {
		name,
		files,
		plugins: {
			ripple: plugin,
		},
		rules: {
			'ripple/no-module-scope-track': 'error',
			'ripple/prefer-oninput': 'warn',
			'ripple/no-return-in-component': 'error',
			'ripple/unbox-tracked-values': 'error',
			'ripple/control-flow-jsx': 'error',
			'ripple/no-introspect-in-modules': 'error',
			'ripple/valid-for-of-key': 'error',
		},
	};

	// Only add parser if it's available
	if (parser) {
		config.languageOptions = {
			parser,
			parserOptions: {
				ecmaVersion: 'latest',
				sourceType: 'module',
			},
		};
	}

	return config;
}

// Recommended configuration (flat config format)
plugin.configs.recommended = [
	createConfig('ripple/recommended-ripple-files', ['**/*.ripple'], rippleParser),
	createConfig('ripple/recommended-typescript-files', ['**/*.ts', '**/*.tsx'], tsParser),
	{
		name: 'ripple/ignores',
		ignores: ['**/*.d.ts', '**/node_modules/**', '**/dist/**', '**/build/**'],
	},
];

// Strict configuration (flat config format)
plugin.configs.strict = [
	createConfig('ripple/strict-ripple-files', ['**/*.ripple'], rippleParser),
	createConfig('ripple/strict-typescript-files', ['**/*.ts', '**/*.tsx'], tsParser),
	{
		name: 'ripple/ignores',
		ignores: ['**/*.d.ts', '**/node_modules/**', '**/dist/**', '**/build/**'],
	},
];

export default plugin;
