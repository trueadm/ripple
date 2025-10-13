import { createRequire } from 'module';
import noModuleScopeTrack from './rules/no-module-scope-track.js';
import preferOnInput from './rules/prefer-oninput.js';
import noReturnInComponent from './rules/no-return-in-component.js';
import unboxTrackedValues from './rules/unbox-tracked-values.js';
import controlFlowJsx from './rules/control-flow-jsx.js';

const plugin = {
  meta: {
    name: 'eslint-plugin-ripple',
    version: '0.1.2',
  },
  rules: {
    'no-module-scope-track': noModuleScopeTrack,
    'prefer-oninput': preferOnInput,
    'no-return-in-component': noReturnInComponent,
    'unbox-tracked-values': unboxTrackedValues,
    'control-flow-jsx': controlFlowJsx,
  },
  configs: {} as any,
};

// Try to synchronously load the parser
const require = createRequire(import.meta.url);
const rippleParser = require('eslint-parser-ripple');

// Helper to create config objects
function createConfig(name: string, files: string[], isStrict = false) {
  const config: any = {
    name,
    files,
    plugins: {
      ripple: plugin,
    },
    rules: {
      'ripple/no-module-scope-track': 'error',
      'ripple/prefer-oninput': isStrict ? 'error' : 'warn',
      'ripple/no-return-in-component': 'error',
      'ripple/unbox-tracked-values': 'error',
      'ripple/control-flow-jsx': 'error',
    },
  };

  // Add parser for .ripple files if available
  if (files.includes('**/*.ripple') && rippleParser) {
    config.languageOptions = {
      parser: rippleParser,
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
  createConfig('ripple/recommended-ripple-files', ['**/*.ripple'], false),
  createConfig('ripple/recommended-typescript-files', ['**/*.ts', '**/*.tsx'], false),
  {
    name: 'ripple/ignores',
    ignores: ['**/*.d.ts', '**/node_modules/**', '**/dist/**', '**/build/**'],
  },
];

// Strict configuration (flat config format)
plugin.configs.strict = [
  createConfig('ripple/strict-ripple-files', ['**/*.ripple'], true),
  createConfig('ripple/strict-typescript-files', ['**/*.ts', '**/*.tsx'], true),
  {
    name: 'ripple/ignores',
    ignores: ['**/*.d.ts', '**/node_modules/**', '**/dist/**', '**/build/**'],
  },
];

export default plugin;
