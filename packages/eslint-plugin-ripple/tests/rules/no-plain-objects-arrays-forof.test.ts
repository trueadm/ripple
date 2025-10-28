import { RuleTester } from 'eslint';
import rule from '../../src/rules/no-plain-objects-arrays-forof.js';
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

ruleTester.run('no-plain-objects-arrays-forof', rule, {
	valid: [
		// Valid: simple identifier without destructuring
		{
			code: `
				for (const item of items) {
					console.log(item);
				}
			`,
		},
		// Valid: object destructuring with join()
		{
			code: `
				for (const key of [item.id, item.name].join(':')) {
					console.log(key);
				}
			`,
		},
		// Valid: array destructuring with map()
		{
			code: `
				for (const [id, name] of items.map(i => [i.id, i.name])) {
					console.log(id, name);
				}
			`,
		},
		// Valid: destructuring with filter()
		{
			code: `
				for (const {id, name} of data.filter(x => x.active)) {
					console.log(id, name);
				}
			`,
		},
		// Valid: destructuring with toString()
		{
			code: `
				for (const [a, b] of array.toString()) {
					console.log(a, b);
				}
			`,
		},
		// Valid: destructuring with flat()
		{
			code: `
				for (const item of nestedArray.flat()) {
					console.log(item);
				}
			`,
		},
		// Valid: destructuring with values()
		{
			code: `
				for (const {key, value} of map.entries()) {
					console.log(key, value);
				}
			`,
		},
	],
	invalid: [
		// Invalid: object destructuring without stringification
		{
			code: `
				for (const {id, name} of items) {
					console.log(id, name);
				}
			`,
			errors: [
				{
					messageId: 'objectDestructuring',
				},
			],
		},
		// Invalid: array destructuring without stringification
		{
			code: `
				for (const [id, name] of items) {
					console.log(id, name);
				}
			`,
			errors: [
				{
					messageId: 'arrayDestructuring',
				},
			],
		},
		// Invalid: nested object destructuring
		{
			code: `
				for (const {user: {id, name}} of data) {
					console.log(id, name);
				}
			`,
			errors: [
				{
					messageId: 'objectDestructuring',
				},
			],
		},
		// Invalid: rest element in array destructuring
		{
			code: `
				for (const [first, ...rest] of items) {
					console.log(first, rest);
				}
			`,
			errors: [
				{
					messageId: 'arrayDestructuring',
				},
			],
		},
	],
});
