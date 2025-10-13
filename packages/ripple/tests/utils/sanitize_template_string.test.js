import { describe, it, expect } from 'vitest';
import { sanitize_template_string } from '../../src/utils/sanitize_template_string.js';

describe('sanitize_template_string utility', () => {
	it('should escape backticks', () => {
		expect(sanitize_template_string('hello `world`')).toBe('hello \\`world\\`');
	});

	it('should escape dollar brace sequences', () => {
		expect(sanitize_template_string('hello ${world}')).toBe('hello \\${world}');
	});

	it('should escape backslashes', () => {
		expect(sanitize_template_string('hello \\ world')).toBe('hello \\\\ world');
	});

	it('should escape all special characters together', () => {
		expect(sanitize_template_string('`${test}\\`')).toBe('\\`\\${test}\\\\\\`');
	});

	it('should handle strings with no special characters', () => {
		expect(sanitize_template_string('hello world')).toBe('hello world');
	});

	it('should handle empty strings', () => {
		expect(sanitize_template_string('')).toBe('');
	});

	it('should escape multiple backticks', () => {
		expect(sanitize_template_string('```')).toBe('\\`\\`\\`');
	});

	it('should escape multiple dollar braces', () => {
		expect(sanitize_template_string('${a}${b}${c}')).toBe('\\${a}\\${b}\\${c}');
	});

	it('should escape multiple backslashes', () => {
		expect(sanitize_template_string('\\\\\\')).toBe('\\\\\\\\\\\\');
	});

	it('should handle mixed content', () => {
		expect(sanitize_template_string('Path: C:\\Users\\${name}`')).toBe('Path: C:\\\\Users\\\\\\${name}\\`');
	});

	it('should handle complex template literals', () => {
		const input = 'const str = `Hello ${name}, path: \\${root}\\`';
		const expected = 'const str = \\`Hello \\${name}, path: \\\\\\${root}\\\\\\`';
		expect(sanitize_template_string(input)).toBe(expected);
	});
});

