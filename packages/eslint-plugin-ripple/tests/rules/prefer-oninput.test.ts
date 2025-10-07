import { describe, it } from 'vitest';
import { RuleTester } from 'eslint';
import rule from '../../src/rules/prefer-oninput.js';

const ruleTester = new RuleTester({
	languageOptions: {
		parserOptions: {
			ecmaVersion: 2022,
			sourceType: 'module',
			ecmaFeatures: {
				jsx: true,
			},
		},
	},
});

describe('prefer-oninput', () => {
	it('should validate correctly', () => {
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
	});
});
