import { RuleTester } from 'eslint';
import rule from '../../src/rules/require-component-export';
import * as parser from '../../../eslint-parser-ripple/src/index';

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

ruleTester.run('require-component-export', rule, {
	valid: [
		// Valid: default export
		{
			code: `
				component MyComponent() {
					<div>{'Hello'}</div>
				}
				export default MyComponent;
			`,
		},
		// Valid: named export
		{
			code: `
				component MyComponent() {
					<div>{'Hello'}</div>
				}
				export { MyComponent };
			`,
		},
	],
	invalid: [
		// Invalid: not exported
		{
			code: `
				component MyComponent() {
					<div>{'Hello'}</div>
				}
			`,
			errors: [
				{
					messageId: 'notExported',
					data: { name: 'MyComponent' },
				},
			],
		},
		// Invalid: multiple components not exported
		{
			code: `
				component Button() {
					<button>{'Click'}</button>
				}
				component Card() {
					<div>{'Card'}</div>
				}
			`,
			errors: [
				{
					messageId: 'notExported',
					data: { name: 'Button' },
				},
				{
					messageId: 'notExported',
					data: { name: 'Card' },
				},
			],
		},
	],
});
