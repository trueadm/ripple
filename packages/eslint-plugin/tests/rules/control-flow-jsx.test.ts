import { RuleTester } from 'eslint';
import rule from '../../src/rules/control-flow-jsx.js';
import * as parser from '@ripple-ts/eslint-parser';

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

ruleTester.run('control-flow-jsx', rule, {
	valid: [
		// Valid: for...of with JSX in component body (outside effect)
		{
			code: `
				component App() {
					const items = ['Item 1', 'Item 2'];

					for (const item of items) {
						<div>{item}</div>
					}
				}
			`,
		},
		// Valid: for...of without JSX inside effect
		{
			code: `
				component App() {
					const items = ['Item 1', 'Item 2'];
					effect(() => {
						let sum = 0;
						for (const item of items) {
							sum += item;
						}
					});
				}
			`,
		},
		// Valid: nested JSX in for...of in component
		{
			code: `
				component App() {
					const items = [1, 2, 3];
					for (const item of items) {
						<div>
							<span>{item}</span>
						</div>
					}
				}
			`,
		},
		// Valid: for...of without JSX inside effect with untrack
		{
			code: `
				component App() {
					const items = new TrackedArray(1, 2, 3);
					const sum = track(0);
					effect(() => {
						@sum = 0;
						for (const item of items) {
							untrack(() => {
								@sum += item;
							});
						}
					});
				}
			`,
		},
		// Valid: for...of outside component (no checks applied)
		{
			code: `
				function notAComponent() {
					const items = [1, 2, 3];
					for (const item of items) {
						console.log(item);
					}
				}
			`,
		},
	],
	invalid: [
		// Invalid: for...of without JSX in component body
		{
			code: `
				component App() {
					const items = ['Item 1', 'Item 2'];
					for (const item of items) {
						console.log(item);
					}
				}
			`,
			errors: [
				{
					messageId: 'requireJsxInLoop',
				},
			],
		},
		// Invalid: for...of with JSX inside effect
		{
			code: `
				component App() {
					const items = ['Item 1', 'Item 2'];
					effect(() => {
						for (const item of items) {
							<div>{item}</div>
						}
					});
				}
			`,
			errors: [
				{
					messageId: 'noJsxInEffectLoop',
				},
			],
		},
		// Invalid: for...of with JSX deeply nested in effect
		{
			code: `
				component App() {
					const items = [1, 2, 3];
					effect(() => {
						for (const item of items) {
							if (item > 1) {
								<span>{item}</span>
							}
						}
					});
				}
			`,
			errors: [
				{
					messageId: 'noJsxInEffectLoop',
				},
			],
		},
		// Invalid: for...of without JSX in component (even with other statements)
		{
			code: `
				component App() {
					const items = [1, 2, 3];
					for (const item of items) {
						const double = item * 2;
						console.log(double);
					}
				}
			`,
			errors: [
				{
					messageId: 'requireJsxInLoop',
				},
			],
		},
	],
});
