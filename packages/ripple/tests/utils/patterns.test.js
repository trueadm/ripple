import { describe, it, expect } from 'vitest';
import * as patterns from '../../src/utils/patterns.js';

describe('patterns utility', () => {
	describe('regex_whitespace', () => {
		it('should match single whitespace characters', () => {
			expect(patterns.regex_whitespace.test(' ')).toBe(true);
			expect(patterns.regex_whitespace.test('\t')).toBe(true);
			expect(patterns.regex_whitespace.test('\n')).toBe(true);
			expect(patterns.regex_whitespace.test('\r')).toBe(true);
		});

		it('should match whitespace character between characters', () => {
			expect(patterns.regex_whitespace.test('a b')).toBe(true);
			expect(patterns.regex_whitespace.test('a\tb')).toBe(true);
			expect(patterns.regex_whitespace.test('a\nb')).toBe(true);
		});

		it('should match whitespace at start or end', () => {
			expect(patterns.regex_whitespace.test(' hello')).toBe(true);
			expect(patterns.regex_whitespace.test('hello ')).toBe(true);
			expect(patterns.regex_whitespace.test('\thello')).toBe(true);
			expect(patterns.regex_whitespace.test('hello\t')).toBe(true);
		});

		it('should match multiple whitespace characters', () => {
			expect(patterns.regex_whitespace.test('  ')).toBe(true);
			expect(patterns.regex_whitespace.test('\t\r\n   ')).toBe(true);
		});

		it('should not match non-whitespace', () => {
			expect(patterns.regex_whitespace.test('helloworld')).toBe(false);
			expect(patterns.regex_whitespace.test('1')).toBe(false);
		});

		it('should not match empty string', () => {
			expect(patterns.regex_whitespace.test('')).toBe(false);
		});
	});

	describe('regex_whitespaces', () => {
		it('should match multiple whitespace characters', () => {
			expect(patterns.regex_whitespaces.test('   ')).toBe(true);
			expect(patterns.regex_whitespaces.test('\t\t')).toBe(true);
			expect(patterns.regex_whitespaces.test(' \t\n')).toBe(true);
		});

		it('should match single whitespace character', () => {
			expect(patterns.regex_whitespaces.test(' ')).toBe(true);
			expect(patterns.regex_whitespaces.test('\t')).toBe(true);
			expect(patterns.regex_whitespaces.test('\n')).toBe(true);
		});

		it('should match whitespaces between characters', () => {
			expect(patterns.regex_whitespaces.test('a b')).toBe(true);
			expect(patterns.regex_whitespaces.test('a\t\r\nb')).toBe(true);
			expect(patterns.regex_whitespaces.test('a\nb')).toBe(true);
		});

		it('should match whitespaces at start or end', () => {
			expect(patterns.regex_whitespaces.test('  hello')).toBe(true);
			expect(patterns.regex_whitespaces.test('hello \n')).toBe(true);
			expect(patterns.regex_whitespaces.test('\t\rhello')).toBe(true);
			expect(patterns.regex_whitespaces.test('hello\t  ')).toBe(true);
		});

		it('should not match non-whitespace', () => {
			expect(patterns.regex_whitespaces.test('helloworld')).toBe(false);
			expect(patterns.regex_whitespaces.test('1')).toBe(false);
		});

		it('should not match empty string', () => {
			expect(patterns.regex_whitespaces.test('')).toBe(false);
		});
	});

	describe('regex_starts_with_newline', () => {
		it('should match strings starting with newline', () => {
			expect(patterns.regex_starts_with_newline.test('\nhello')).toBe(true);
			expect(patterns.regex_starts_with_newline.test('\r\nworld')).toBe(true);
		});

		it('should match strings with only newline', () => {
			expect(patterns.regex_starts_with_newline.test('\n')).toBe(true);
			expect(patterns.regex_starts_with_newline.test('\r\n')).toBe(true);
		});

		it('should not match empty string', () => {
			expect(patterns.regex_starts_with_newline.test('')).toBe(false);
		});

		it('should not match strings without leading newline', () => {
			expect(patterns.regex_starts_with_newline.test('hello\n')).toBe(false);
			expect(patterns.regex_starts_with_newline.test(' \nhello')).toBe(false);
		});
	});

	describe('regex_starts_with_whitespace', () => {
		it('should match strings starting with whitespace', () => {
			expect(patterns.regex_starts_with_whitespace.test(' hello')).toBe(true);
			expect(patterns.regex_starts_with_whitespace.test('\thello')).toBe(true);
			expect(patterns.regex_starts_with_whitespace.test('\nhello')).toBe(true);
		});

		it('should match strings starting with multiple whitespaces', () => {
			expect(patterns.regex_starts_with_whitespace.test('  hello')).toBe(true);
			expect(patterns.regex_starts_with_whitespace.test('\t\nhello')).toBe(true);
		});

		it('should match strings with only whitespace', () => {
			expect(patterns.regex_starts_with_whitespace.test('   ')).toBe(true);
			expect(patterns.regex_starts_with_whitespace.test('\t\n\r')).toBe(true);
		});

		it('should not match empty string', () => {
			expect(patterns.regex_starts_with_whitespace.test('')).toBe(false);
		});

		it('should not match strings without leading whitespace', () => {
			expect(patterns.regex_starts_with_whitespace.test('hello ')).toBe(false);
		});
	});

	describe('regex_starts_with_whitespaces', () => {
		it('should match strings starting with a single whitespace', () => {
			expect(patterns.regex_starts_with_whitespaces.test(' hello')).toBe(true);
			expect(patterns.regex_starts_with_whitespaces.test('\thello')).toBe(true);
			expect(patterns.regex_starts_with_whitespaces.test('\nhello')).toBe(true);
		});

		it('should match strings starting with multiple whitespaces', () => {
			expect(patterns.regex_starts_with_whitespaces.test('  hello')).toBe(true);
			expect(patterns.regex_starts_with_whitespaces.test('\t\nhello')).toBe(true);
		});

		it('should match strings with only whitespace', () => {
			expect(patterns.regex_starts_with_whitespaces.test('   ')).toBe(true);
			expect(patterns.regex_starts_with_whitespaces.test('\t\n\r')).toBe(true);
		});

		it('should not match empty string', () => {
			expect(patterns.regex_starts_with_whitespaces.test('')).toBe(false);
		});

		it('should not match strings without leading whitespace', () => {
			expect(patterns.regex_starts_with_whitespaces.test('hello ')).toBe(false);
			expect(patterns.regex_starts_with_whitespaces.test('a b c ')).toBe(false);
		});
	});

	describe('regex_ends_with_whitespace', () => {
		it('should match strings ending with whitespace', () => {
			expect(patterns.regex_ends_with_whitespace.test('hello ')).toBe(true);
			expect(patterns.regex_ends_with_whitespace.test('hello\t')).toBe(true);
			expect(patterns.regex_ends_with_whitespace.test('hello\n')).toBe(true);
		});

		it('should match strings ending with multiple whitespaces', () => {
			expect(patterns.regex_ends_with_whitespace.test('hello  ')).toBe(true);
			expect(patterns.regex_ends_with_whitespace.test('hello\t\n')).toBe(true);
		});

		it('should match strings with only whitespace', () => {
			expect(patterns.regex_ends_with_whitespace.test('   ')).toBe(true);
			expect(patterns.regex_ends_with_whitespace.test('\t\n\r')).toBe(true);
		});

		it('should not match empty string', () => {
			expect(patterns.regex_ends_with_whitespace.test('')).toBe(false);
		});

		it('should not match strings without trailing whitespace', () => {
			expect(patterns.regex_ends_with_whitespace.test(' hello')).toBe(false);
			expect(patterns.regex_ends_with_whitespace.test('hello')).toBe(false);
		});
	});

	describe('regex_ends_with_whitespaces', () => {
		it('should match strings ending with multiple whitespaces', () => {
			expect(patterns.regex_ends_with_whitespaces.test('hello  ')).toBe(true);
			expect(patterns.regex_ends_with_whitespaces.test('hello\t\n')).toBe(true);
		});

		it('should match strings with only whitespaces', () => {
			expect(patterns.regex_ends_with_whitespaces.test('   ')).toBe(true);
			expect(patterns.regex_ends_with_whitespaces.test('\t\n\r')).toBe(true);
		});

		it('should not match empty string', () => {
			expect(patterns.regex_ends_with_whitespaces.test('')).toBe(false);
		});

		it('should not match strings not ending with whitespaces', () => {
			expect(patterns.regex_ends_with_whitespaces.test(' hello')).toBe(false);
			expect(patterns.regex_ends_with_whitespaces.test('hello')).toBe(false);
			expect(patterns.regex_ends_with_whitespaces.test('hello')).toBe(false);
			expect(patterns.regex_ends_with_whitespaces.test('a b\nc')).toBe(false);
		});
	});

	describe('regex_not_whitespace', () => {
		it('should match non-whitespace characters', () => {
			expect(patterns.regex_not_whitespace.test('a')).toBe(true);
			expect(patterns.regex_not_whitespace.test('1')).toBe(true);
			expect(patterns.regex_not_whitespace.test('hello world')).toBe(true);
		});

		it('should not match empty string', () => {
			expect(patterns.regex_not_whitespace.test('')).toBe(false);
		});

		it('should not match only whitespace', () => {
			expect(patterns.regex_not_whitespace.test('   ')).toBe(false);
			expect(patterns.regex_not_whitespace.test('\t\n\r')).toBe(false);
		});
	});

	describe('regex_only_whitespaces', () => {
		it('should match strings with only whitespaces', () => {
			expect(patterns.regex_only_whitespaces.test('   ')).toBe(true);
			expect(patterns.regex_only_whitespaces.test('\t\n\r\f')).toBe(true);
		});

		it('should not match empty string', () => {
			expect(patterns.regex_only_whitespaces.test('')).toBe(false);
		});

		it('should not match strings with content', () => {
			expect(patterns.regex_only_whitespaces.test(' a ')).toBe(false);
			expect(patterns.regex_only_whitespaces.test('hello')).toBe(false);
		});
	});

	describe('regex_is_valid_identifier', () => {
		it('should match valid JavaScript identifiers', () => {
			expect(patterns.regex_is_valid_identifier.test('foo')).toBe(true);
			expect(patterns.regex_is_valid_identifier.test('_private')).toBe(true);
			expect(patterns.regex_is_valid_identifier.test('$jquery')).toBe(true);
			expect(patterns.regex_is_valid_identifier.test('myVar123')).toBe(true);
			expect(patterns.regex_is_valid_identifier.test('CamelCase')).toBe(true);
		});

		it('should not match invalid identifiers', () => {
			expect(patterns.regex_is_valid_identifier.test('123abc')).toBe(false);
			expect(patterns.regex_is_valid_identifier.test('my-var')).toBe(false);
			expect(patterns.regex_is_valid_identifier.test('my var')).toBe(false);
			expect(patterns.regex_is_valid_identifier.test('my.var')).toBe(false);
			expect(patterns.regex_is_valid_identifier.test('')).toBe(false);
			expect(patterns.regex_is_valid_identifier.test('\n')).toBe(false);
			expect(patterns.regex_is_valid_identifier.test('my\tvar')).toBe(false);
			expect(patterns.regex_is_valid_identifier.test('my\rvar')).toBe(false);
		});
	});

	describe('regex_invalid_identifier_chars', () => {
		it('should remove invalid identifier characters', () => {
			expect('123abc'.replace(patterns.regex_invalid_identifier_chars, '_')).toBe('_23abc');
			expect('my-var'.replace(patterns.regex_invalid_identifier_chars, '_')).toBe('my_var');
			expect('hello.world'.replace(patterns.regex_invalid_identifier_chars, '_')).toBe('hello_world');
			expect('\t\r\nhello.world'.replace(patterns.regex_invalid_identifier_chars, '_')).toBe('___hello_world');
			expect('my\tvar'.replace(patterns.regex_invalid_identifier_chars, '_')).toBe('my_var');
			expect('my\rvar'.replace(patterns.regex_invalid_identifier_chars, '_')).toBe('my_var');
			expect(''.replace(patterns.regex_invalid_identifier_chars, '_')).toBe('');
		});
	});

	describe('regex_starts_with_vowel', () => {
		it('should match strings starting with vowels', () => {
			expect(patterns.regex_starts_with_vowel.test('apple')).toBe(true);
			expect(patterns.regex_starts_with_vowel.test('elephant')).toBe(true);
			expect(patterns.regex_starts_with_vowel.test('ice')).toBe(true);
			expect(patterns.regex_starts_with_vowel.test('orange')).toBe(true);
			expect(patterns.regex_starts_with_vowel.test('umbrella')).toBe(true);
		});

		it('should not match strings starting with consonants', () => {
			expect(patterns.regex_starts_with_vowel.test('banana')).toBe(false);
			expect(patterns.regex_starts_with_vowel.test('cat')).toBe(false);
			expect(patterns.regex_starts_with_vowel.test('d')).toBe(false);
			expect(patterns.regex_starts_with_vowel.test('f')).toBe(false);
			expect(patterns.regex_starts_with_vowel.test('g')).toBe(false);
			expect(patterns.regex_starts_with_vowel.test('hello')).toBe(false);
			expect(patterns.regex_starts_with_vowel.test('j')).toBe(false);
			expect(patterns.regex_starts_with_vowel.test('k')).toBe(false);
			expect(patterns.regex_starts_with_vowel.test('l')).toBe(false);
			expect(patterns.regex_starts_with_vowel.test('m')).toBe(false);
			expect(patterns.regex_starts_with_vowel.test('n')).toBe(false);
			expect(patterns.regex_starts_with_vowel.test('p')).toBe(false);
			expect(patterns.regex_starts_with_vowel.test('q')).toBe(false);
			expect(patterns.regex_starts_with_vowel.test('r')).toBe(false);
			expect(patterns.regex_starts_with_vowel.test('s')).toBe(false);
			expect(patterns.regex_starts_with_vowel.test('t')).toBe(false);
			expect(patterns.regex_starts_with_vowel.test('v')).toBe(false);
			expect(patterns.regex_starts_with_vowel.test('w')).toBe(false);
			expect(patterns.regex_starts_with_vowel.test('x')).toBe(false);
			expect(patterns.regex_starts_with_vowel.test('y')).toBe(false);
			expect(patterns.regex_starts_with_vowel.test('z')).toBe(false);
		});

		it('should be case-sensitive', () => {
			expect(patterns.regex_starts_with_vowel.test('Apple')).toBe(false);
		});
	});

	describe('regex_heading_tags', () => {
		it('should match heading tags h1 through h6', () => {
			expect(patterns.regex_heading_tags.test('h1')).toBe(true);
			expect(patterns.regex_heading_tags.test('h2')).toBe(true);
			expect(patterns.regex_heading_tags.test('h3')).toBe(true);
			expect(patterns.regex_heading_tags.test('h4')).toBe(true);
			expect(patterns.regex_heading_tags.test('h5')).toBe(true);
			expect(patterns.regex_heading_tags.test('h6')).toBe(true);
		});

		it('should not match invalid heading tags', () => {
			expect(patterns.regex_heading_tags.test('h0')).toBe(false);
			expect(patterns.regex_heading_tags.test('h7')).toBe(false);
			expect(patterns.regex_heading_tags.test('H1')).toBe(false);
			expect(patterns.regex_heading_tags.test('header')).toBe(false);
			expect(patterns.regex_heading_tags.test('h')).toBe(false);
		});
	});

	describe('regex_illegal_attribute_character', () => {
		it('should match illegal attribute characters', () => {
			expect(patterns.regex_illegal_attribute_character.test('123')).toBe(true);
			expect(patterns.regex_illegal_attribute_character.test('.class')).toBe(true);
			expect(patterns.regex_illegal_attribute_character.test('-attr')).toBe(true);
			expect(patterns.regex_illegal_attribute_character.test('attr^')).toBe(true);
			expect(patterns.regex_illegal_attribute_character.test('attr$')).toBe(true);
			expect(patterns.regex_illegal_attribute_character.test('attr@')).toBe(true);
			expect(patterns.regex_illegal_attribute_character.test('attr%')).toBe(true);
			expect(patterns.regex_illegal_attribute_character.test('attr&')).toBe(true);
			expect(patterns.regex_illegal_attribute_character.test('attr#')).toBe(true);
			expect(patterns.regex_illegal_attribute_character.test('attr?')).toBe(true);
			expect(patterns.regex_illegal_attribute_character.test('attr!')).toBe(true);
			expect(patterns.regex_illegal_attribute_character.test('attr|')).toBe(true);
			expect(patterns.regex_illegal_attribute_character.test('attr[')).toBe(true);
			expect(patterns.regex_illegal_attribute_character.test('attr]')).toBe(true);
			expect(patterns.regex_illegal_attribute_character.test('attr{')).toBe(true);
			expect(patterns.regex_illegal_attribute_character.test('attr}')).toBe(true);
			expect(patterns.regex_illegal_attribute_character.test('attr*')).toBe(true);
			expect(patterns.regex_illegal_attribute_character.test('attr+')).toBe(true);
			expect(patterns.regex_illegal_attribute_character.test('attr~')).toBe(true);
			expect(patterns.regex_illegal_attribute_character.test('attr;')).toBe(true);
		});

		it('should not match valid attribute names', () => {
			expect(patterns.regex_illegal_attribute_character.test('id')).toBe(false);
			expect(patterns.regex_illegal_attribute_character.test('class')).toBe(false);
			expect(patterns.regex_illegal_attribute_character.test('className')).toBe(false);
			expect(patterns.regex_illegal_attribute_character.test('className123')).toBe(false);
			expect(patterns.regex_illegal_attribute_character.test('class-name-123')).toBe(false);
			expect(patterns.regex_illegal_attribute_character.test('data-value')).toBe(false);
			expect(patterns.regex_illegal_attribute_character.test('aria-label')).toBe(false);
		});
	});

	describe('regex_newline_characters', () => {
		it('should match newline characters globally', () => {
			const text = 'line1\nline2\nline3';
			const matches = text.match(patterns.regex_newline_characters);
			expect(matches?.length).toBe(2);
		});
	});

	describe('regex_not_newline_characters', () => {
		it('should match non-newline characters globally', () => {
			const text = 'ab\ncd';
			const matches = text.match(patterns.regex_not_newline_characters);
			expect(matches?.length).toBe(4);
		});
	});

	describe('regex_whitespaces_strict', () => {
		it('should match strict whitespace sequences globally', () => {
			const text = 'a  b\tc  d';
			const result = text.replace(patterns.regex_whitespaces_strict, '-');
			expect(result).toBe('a-b-c-d');
		});
	});
});
