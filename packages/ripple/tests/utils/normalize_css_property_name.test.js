import { describe, it, expect } from 'vitest';
import { normalize_css_property_name } from '../../src/utils/normalize_css_property_name.js';

describe('normalize_css_property_name utility', () => {
	it('should convert camelCase to kebab-case', () => {
		expect(normalize_css_property_name('backgroundColor')).toBe('background-color');
		expect(normalize_css_property_name('fontSize')).toBe('font-size');
		expect(normalize_css_property_name('marginTop')).toBe('margin-top');
		expect(normalize_css_property_name('borderRadius')).toBe('border-radius');
	});

	it('should handle multiple uppercase letters', () => {
		expect(normalize_css_property_name('WebkitTransform')).toBe('-webkit-transform');
		expect(normalize_css_property_name('MozAppearance')).toBe('-moz-appearance');
	});

	it('should preserve CSS custom properties (starting with --)', () => {
		expect(normalize_css_property_name('--custom-property')).toBe('--custom-property');
		expect(normalize_css_property_name('--myColor')).toBe('--myColor');
		expect(normalize_css_property_name('--themePrimary')).toBe('--themePrimary');
	});

	it('should handle already lowercase properties', () => {
		expect(normalize_css_property_name('color')).toBe('color');
		expect(normalize_css_property_name('display')).toBe('display');
		expect(normalize_css_property_name('position')).toBe('position');
		expect(normalize_css_property_name('z-index')).toBe('z-index');
	});

	it('should handle consecutive uppercase letters', () => {
		expect(normalize_css_property_name('HTMLElement')).toBe('-h-t-m-l-element');
	});

	it('should handle empty string', () => {
		expect(normalize_css_property_name('')).toBe('');
	});

	it('should handle complex property names', () => {
		expect(normalize_css_property_name('borderTopLeftRadius')).toBe('border-top-left-radius');
		expect(normalize_css_property_name('textDecorationColor')).toBe('text-decoration-color');
	});
});

