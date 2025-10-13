import { RuleTester } from 'eslint';
import rule from '../../src/rules/no-return-in-component.js';
import * as parser from 'eslint-parser-ripple';

const ruleTester = new RuleTester({
	languageOptions: {
		parser,
		parserOptions: {
			ecmaVersion: 2022,
			sourceType: 'module',
			ecmaFeatures: {
				jsx: true,
			},
		},
	},
});

ruleTester.run('no-return-in-component', rule, {
	valid: [
		// Valid: JSX as statement
		{
			code: `
				component App() {
					<div>{'Hello'}</div>
				}
			`,
		},
		// Valid: return non-JSX
		{
			code: `
				component App() {
					function helper() {
						return 42;
					}
				}
			`,
		},
	],
	invalid: [],
});
