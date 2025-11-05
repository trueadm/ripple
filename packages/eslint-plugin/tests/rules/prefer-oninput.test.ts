import { RuleTester } from 'eslint';
import rule from '../../src/rules/prefer-oninput.js';
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

ruleTester.run('prefer-oninput', rule, {
	valid: [
		// Valid: using onInput
		{
			code: '<input onInput={handleInput} />',
		},
		// Valid: using other event handlers
		{
			code: '<button onClick={handleClick} />',
		},
	],
	invalid: [
		// Invalid: using onChange
		{
			code: '<input onChange={handleChange} />',
			output: '<input onInput={handleChange} />',
			errors: [
				{
					messageId: 'preferOnInput',
				},
			],
		},
		// Invalid: onChange in object
		{
			code: `
				const props = {
					onChange: handleChange
				};
			`,
			output: `
				const props = {
					onInput: handleChange
				};
			`,
			errors: [
				{
					messageId: 'preferOnInput',
				},
			],
		},
	],
});
