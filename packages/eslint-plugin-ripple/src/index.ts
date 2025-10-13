import * as tsParser from '@typescript-eslint/parser';
import * as rippleParser from 'eslint-parser-ripple';

import noModuleScopeTrack from './rules/no-module-scope-track.js';
import preferOnInput from './rules/prefer-oninput.js';
import noReturnInComponent from './rules/no-return-in-component.js';
import unboxTrackedValues from './rules/unbox-tracked-values.js';
import controlFlowJsx from './rules/control-flow-jsx.js';
import noIntrospectInModules from './rules/no-introspect-in-modules.js';

const plugin = {
	meta: {
		name: 'eslint-plugin-ripple',
		version: '0.1.3',
	},
	rules: {
		'no-module-scope-track': noModuleScopeTrack,
		'prefer-oninput': preferOnInput,
		'no-return-in-component': noReturnInComponent,
		'unbox-tracked-values': unboxTrackedValues,
		'control-flow-jsx': controlFlowJsx,
		'no-introspect-in-modules': noIntrospectInModules,
	},
	configs: {} as any,
};

// Helper to create config objects
function createConfig(name: string, files: string[], parser: any) {
	const config: any = {
		name,
		files,
		plugins: {
			ripple: plugin,
		},
    languageOptions: {
      parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
		rules: {
			'ripple/no-module-scope-track': 'error',
			'ripple/prefer-oninput': 'warn',
			'ripple/no-return-in-component': 'error',
			'ripple/unbox-tracked-values': 'error',
			'ripple/control-flow-jsx': 'error',
			'ripple/no-introspect-in-modules': 'error',
		},
	};

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
