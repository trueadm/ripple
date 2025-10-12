import { RuleTester } from 'eslint';
import rule from '../../src/rules/unbox-tracked-values.js';
import * as parser from 'eslint-parser-ripple';

const ruleTester = new RuleTester({
	languageOptions: {
		parser,
		parserOptions: {
			ecmaVersion: 2022,
			sourceType: 'module',
		},
	},
});

ruleTester.run('unbox-tracked-values', rule, {
	valid: [
		// Valid: the value gets unboxed
		{
			code: `
				component Counter() {
					const count = track(0);
					<div>{@count}</div>
				}
			`,
		},
		// Valid: the values get unboxed
		{
			code: `
				component App() {
					const value = track(42);
					const doubled = track(@value * 2);
					<span>{@doubled}</span>
				}
			`,
		},
		// Valid: the value gets unboxed
		{
			code: `
				component Form() {
					const name = track('');
					<input value={@name} />
				}
			`,
		},
		// Valid: nothing to unbox
		{
			code: `
				component List() {
					const items = [1, 2, 3];
					<div>{items.length}</div>
				}
			`,
		},
		// Valid: nothing to unbox
		{
			code: `
				component Example() {
					const nonTracked = 'hello';
					<div>{nonTracked}</div>
				}
			`,
		},
	],
	invalid: [
		{
			// Invalid: the value does not get unboxed
			code: `
				component Counter() {
					const count = track(0);
					<div>{count}</div>
				}
			`,
			errors: [
				{
					messageId: 'needsUnbox',
					data: { name: 'count' },
				},
			],
		},
		{
			// Invalid: the value does not get unboxed
			code: `
				component App() {
					const value = track(10);
					<span>{\`Value: ${value}\`}</span>
				}
			`,
			errors: [
				{
					messageId: 'needsUnbox',
					data: { name: 'value' },
				},
			],
		},
		{
			// Invalid: multiple values don't get unboxed
			code: `
				component Form() {
					const firstName = track('');
					const lastName = track('');
					<div>
						<span>{firstName}</span>
						<span>{lastName}</span>
					</div>
				}
			`,
			errors: [
				{
					messageId: 'needsUnbox',
					data: { name: 'firstName' },
				},
				{
					messageId: 'needsUnbox',
					data: { name: 'lastName' },
				},
			],
		},
	],
});
