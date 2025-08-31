/**
 * Ripple JSX Runtime
 * This module provides the JSX runtime functions that TypeScript will automatically import
 * when using jsxImportSource: "ripple/jsx-runtime"
 */

/**
 * Create a JSX element (for elements with children)
 * In Ripple, components don't return values - they imperatively render to the DOM
 * @param {string | Function} type - Element type (tag name or component function)
 * @param {object} props - Element properties
 * @param {string} key - Element key (optional)
 * @returns {void} Ripple components don't return anything
 */
export function jsx(type, props, key) {
	// Ripple components are imperative - they don't return JSX elements
	// This is a placeholder for the actual Ripple rendering logic
	if (typeof type === 'function') {
		// Call the Ripple component function
		type(props);
	} else {
		// Handle DOM elements
		console.warn('DOM element rendering not implemented in jsx runtime:', type, props);
	}
}

/**
 * Create a JSX element with static children (optimization for multiple children)
 * @param {string | Function} type - Element type (tag name or component function)
 * @param {object} props - Element properties
 * @param {string} key - Element key (optional)
 * @returns {void} Ripple components don't return anything
 */
export function jsxs(type, props, key) {
	return jsx(type, props, key);
}

/**
 * JSX Fragment component
 * @param {object} props - Fragment props (should contain children)
 * @returns {void} Ripple fragments don't return anything
 */
export function Fragment(props) {
	// Ripple fragments are imperative
	console.warn('Fragment rendering not implemented in jsx runtime:', props);
}
