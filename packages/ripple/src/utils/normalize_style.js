/**
 * @param {string|HTMLElement['style']} style
 * @returns {string}
 */
export function normalize_style(style) {
	if (typeof style === 'string') {
		return style;
	}

	return Object.entries(style).map(([key, value]) => {
		if (key.startsWith('--')) {
			// CSS variable, keep as is
			return `${key}: ${value}`;
		}
		const kebabKey = key.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
		return `${kebabKey}: ${value}`;
	}).join('; ');
}
