/** @type {Map<string, string>} */
const normalized_properties_cache = new Map();

/**
 * Takes a camelCased string and returns a hyphenated string
 * @param {string} str
 * @returns {string}
 * @example
 * normalize_css_property_name('backgroundColor') // 'background-color'
 */
export function normalize_css_property_name(str) {
	if (str.startsWith('--')) return str;

	let normalized_result = normalized_properties_cache.get(str);
	if (normalized_result != null) {
		return normalized_result;
	}

	normalized_result = str.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
	normalized_properties_cache.set(str, normalized_result);

	return normalized_result;
}
