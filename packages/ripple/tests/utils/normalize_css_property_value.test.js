import { describe, it, expect } from 'vitest';
import { normalize_css_property_value } from '../../src/utils/normalize_css_property_value.js';

describe('normalize_css_property_value utility', () => {
	 it('should convert numbers to px for normal CSS properties', () => {
    expect(normalize_css_property_value('width', 16)).toBe('16px');
    expect(normalize_css_property_value('height', 0)).toBe('0');
    expect(normalize_css_property_value('margin', 10)).toBe('10px');
  });

  it('should keep unitless properties as numbers', () => {
    expect(normalize_css_property_value('line-height', 1.5)).toBe('1.5');
    expect(normalize_css_property_value('opacity', 1)).toBe('1');
    expect(normalize_css_property_value('z-index', 100)).toBe('100');
    expect(normalize_css_property_value('-webkit-flex-grow', 1)).toBe('1');
  });

  it('should handle CSS custom properties', () => {
    expect(normalize_css_property_value('--my-var', 10)).toBe('10');
    expect(normalize_css_property_value('--my-var', null)).toBe('');
    expect(normalize_css_property_value('--foo', 'bar')).toBe('bar');
  });

  it('should handle null or undefined values', () => {
    expect(normalize_css_property_value('width', null)).toBe('');
    expect(normalize_css_property_value('height', undefined)).toBe('');
  });

  it('should handle boolean values', () => {
    expect(normalize_css_property_value('display', true)).toBe('true');
    expect(normalize_css_property_value('display', false)).toBe('');
  });

  it('should convert strings as-is', () => {
    expect(normalize_css_property_value('margin', '12px')).toBe('12px');
    expect(normalize_css_property_value('color', 'red')).toBe('red');
  });

  it('should work with kebab-case and camelCase interchangeably', () => {
    expect(normalize_css_property_value('line-height', 2)).toBe('2');
    expect(normalize_css_property_value('fontSize', 16)).toBe('16px');
  });

  it('should handle edge numeric cases', () => {
    expect(normalize_css_property_value('width', 0)).toBe('0');
    expect(normalize_css_property_value('opacity', 0)).toBe('0');
    expect(normalize_css_property_value('line-height', 0)).toBe('0'); // unitless
  });

  it('should convert unknown types to string', () => {
    expect(normalize_css_property_value('content', Symbol('test'))).toBe('Symbol(test)');
    expect(normalize_css_property_value('custom', { foo: 'bar' })).toBe('[object Object]');
  });
});
