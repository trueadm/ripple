import ripple from 'eslint-plugin-ripple';
import tsParser from '@typescript-eslint/parser';
import rippleParser from 'eslint-parser-ripple';

export default [
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      ripple,
    },
    rules: {
      ...ripple.configs.recommended.rules,
    },
  },
  {
    files: ['**/*.ripple'],
    languageOptions: {
      parser: rippleParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      ripple,
    },
    rules: {
      ...ripple.configs.recommended.rules,
    },
  },
  {
    ignores: ['node_modules/**', 'dist/**'],
  },
];
