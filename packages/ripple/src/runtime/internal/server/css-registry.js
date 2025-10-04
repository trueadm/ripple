/**
 * Global CSS registry for SSR
 * Maps CSS hashes to their content
 * This persists across requests for performance (CSS is immutable per hash)
 * @type {Map<string, string>}
 */
const css_registry = new Map();

/**
 * Register a component's CSS
 * Only sets if the hash doesn't already exist (CSS is immutable per hash)
 * @param {string} hash - The CSS hash
 * @param {string} content - The CSS content
 */
export function register_component_css(hash, content) {
	if (!css_registry.has(hash)) {
		css_registry.set(hash, content);
	}
}

/**
 * Get CSS content for a set of hashes
 * @param {Set<string>} hashes
 * @returns {string}
 */
export function get_css_for_hashes(hashes) {
	const css_parts = [];
	for (const hash of hashes) {
		const content = css_registry.get(hash);
		if (content) {
			css_parts.push(content);
		}
	}
	return css_parts.join('\n');
}
