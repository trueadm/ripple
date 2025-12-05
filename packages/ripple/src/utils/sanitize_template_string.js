/**
 * @param {string | null | undefined} str
 * @returns {string}
 */
export function sanitize_template_string(str) {
	return (str ?? '').replace(/(`|\${|\\)/g, '\\$1');
}
