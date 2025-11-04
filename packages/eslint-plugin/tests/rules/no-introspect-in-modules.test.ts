import { RuleTester } from 'eslint';
import rule from '../../src/rules/no-introspect-in-modules.js';
import * as parser from '@ripple-ts/eslint-parser';

const ruleTester = new RuleTester({
	languageOptions: {
		parser,
		parserOptions: {
			ecmaVersion: 2022,
			sourceType: 'module',
		},
	},
});

ruleTester.run('no-introspect-in-modules', rule, {
	valid: [
		// Valid: using get() and set() in TypeScript modules
		{
			code: `
				import { get, set } from '@ripple-ts/ripple';

				export function useCount() {
					const count = track(1);
					const double = derived(() => get(count) * 2);

					effect(() => {
						console.log("count is", get(count));
					});

					return { count, double };
				}
			`,
			filename: 'countStore.ts',
		},
		// Valid: using get() in regular JavaScript
		{
			code: `
				import { get } from '@ripple-ts/ripple';

				function useCounter() {
					const count = track(0);
					effect(() => {
						console.log(get(count));
					});
					return { count };
				}
			`,
			filename: 'counter.js',
		},
		// Valid: using get/set functions to access tracked values
		{
			code: `
				import { get, set } from '@ripple-ts/ripple';

				export function useState() {
					const state = track({ value: 0 });
					const getValue = () => get(state);
					const setValue = (v) => set(state, v);
					return { getValue, setValue };
				}
			`,
			filename: 'state.ts',
		},
		// Valid: @ operator in .ripple files should be allowed
		{
			code: `
				component Counter() {
					const count = track(0);
					effect(() => {
						console.log(@count);
					});
					<div>{@count}</div>
				}
			`,
			filename: 'Counter.ripple',
		},
	],
	invalid: [
		{
			// Invalid: using @ operator in TypeScript module
			code: `
				export function useCount() {
					const count = track(1);
					effect(() => {
						console.log(@count);
					});
					return { count };
				}
			`,
			filename: 'countStore.ts',
			errors: [
				{
					messageId: 'noIntrospect',
				},
			],
		},
		{
			// Invalid: using @ operator in JavaScript module
			code: `
				function useCounter() {
					const value = track(42);
					const result = @value * 2;
					return result;
				}
			`,
			filename: 'counter.js',
			errors: [
				{
					messageId: 'noIntrospect',
				},
			],
		},
		{
			// Invalid: multiple @ operators in TypeScript module
			code: `
				export function useForm() {
					const firstName = track('');
					const lastName = track('');
					const fullName = @firstName + ' ' + @lastName;
					return { fullName };
				}
			`,
			filename: 'form.ts',
			errors: [
				{
					messageId: 'noIntrospect',
				},
				{
					messageId: 'noIntrospect',
				},
			],
		},
		{
			// Invalid: @ operator in TSX file
			code: `
				export function useData() {
					const data = track(null);
					effect(() => {
						console.log(@data);
					});
					return data;
				}
			`,
			filename: 'hooks.tsx',
			errors: [
				{
					messageId: 'noIntrospect',
				},
			],
		},
	],
});
