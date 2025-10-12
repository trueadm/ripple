import { describe, it, expect } from 'vitest';
import { escape } from '../../src/utils/escaping.js';

describe('escape utility', () => {
	describe('content escaping (is_attr = false)', () => {
		it('should escape & to &amp;', () => {
			expect(escape('foo & bar', false)).toBe('foo &amp; bar');
		});

		it('should escape < to &lt;', () => {
			expect(escape('foo < bar', false)).toBe('foo &lt; bar');
		});

		it('should escape multiple special characters', () => {
			expect(escape('a & b < c', false)).toBe('a &amp; b &lt; c');
		});

		it('should not escape double quotes in content', () => {
			expect(escape('foo "bar" baz', false)).toBe('foo "bar" baz');
		});

		it('should handle empty string', () => {
			expect(escape('', false)).toBe('');
		});

		it('should handle string with no special characters', () => {
			expect(escape('hello world', false)).toBe('hello world');
		});

		it('should handle null values', () => {
			expect(escape(null, false)).toBe('');
		});

		it('should handle undefined values', () => {
			expect(escape(undefined, false)).toBe('');
		});

		it('should handle numbers', () => {
			expect(escape(123, false)).toBe('123');
		});

		it('should escape consecutive special characters', () => {
			expect(escape('&&<<', false)).toBe('&amp;&amp;&lt;&lt;');
		});

		it('should handle special characters at start', () => {
			expect(escape('&hello', false)).toBe('&amp;hello');
		});

		it('should handle special characters at end', () => {
			expect(escape('hello<', false)).toBe('hello&lt;');
		});
	});

	describe('attribute escaping (is_attr = true)', () => {
		it('should escape & to &amp;', () => {
			expect(escape('foo & bar', true)).toBe('foo &amp; bar');
		});

		it('should escape < to &lt;', () => {
			expect(escape('foo < bar', true)).toBe('foo &lt; bar');
		});

		it('should escape " to &quot;', () => {
			expect(escape('foo "bar" baz', true)).toBe('foo &quot;bar&quot; baz');
		});

		it('should escape all three special characters', () => {
			expect(escape('a & b < c "d"', true)).toBe('a &amp; b &lt; c &quot;d&quot;');
		});

		it('should handle empty string', () => {
			expect(escape('', true)).toBe('');
		});

		it('should handle string with no special characters', () => {
			expect(escape('hello world', true)).toBe('hello world');
		});

		it('should handle null values', () => {
			expect(escape(null, true)).toBe('');
		});

		it('should handle undefined values', () => {
			expect(escape(undefined, true)).toBe('');
		});

		it('should escape consecutive quotes', () => {
			expect(escape('"""', true)).toBe('&quot;&quot;&quot;');
		});

		it('should handle mixed escaping', () => {
			expect(escape('<div class="foo & bar">', true)).toBe('&lt;div class=&quot;foo &amp; bar&quot;>');
		});
	});

	describe('default parameter behavior', () => {
		it('should default to content escaping when is_attr is undefined', () => {
			expect(escape('foo "bar"')).toBe('foo "bar"');
		});
	});
});
