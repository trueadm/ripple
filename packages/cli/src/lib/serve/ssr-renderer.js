/**
 * SSR Renderer for Ripple applications
 * Handles server-side rendering of Ripple components
 */

/**
 * @typedef {Object} SSRRenderResult
 * @property {string} head - The rendered head content
 * @property {string} body - The rendered body content
 * @property {Set<string>} css - Set of CSS hashes used
 * @property {(hashes: Set<string>) => string} get_css_for_hashes - Function to get CSS content
 */

/**
 * @typedef {Object} RenderedHTML
 * @property {string} html - The final rendered HTML
 */

/**
 * Render a Ripple component to HTML for SSR
 * @param {*} vite - The Vite dev server instance
 * @param {string} entryPath - Path to the entry component (e.g., '/src/App.ripple')
 * @param {Map<string, [string, string]>} rpcModules - RPC modules registry
 * @returns {Promise<SSRRenderResult>} - The rendered result with head, body, and css
 */
export async function renderComponent(vite, entryPath, rpcModules) {
	// Store previous rpc modules and set new ones for this render
	const previousRpc = globalThis.rpc_modules;

	try {
		globalThis.rpc_modules = new Map(rpcModules);
		const { render, get_css_for_hashes } = await vite.ssrLoadModule('ripple/server');

		const { App } = await vite.ssrLoadModule(entryPath);
		const { head, body, css } = await render(App);

		return { head, body, css, get_css_for_hashes };
	} finally {
		globalThis.rpc_modules = previousRpc;
	}
}

/**
 * Generate CSS style tags from CSS hashes
 * @param {Set<string>} cssHashes - Set of CSS hashes
 * @param {(hashes: Set<string>) => string} getCssForHashes - Function to get CSS content for hashes
 * @returns {string} - Style tags HTML string
 */
export function generateCssTags(cssHashes, getCssForHashes) {
	if (cssHashes.size === 0) {
		return '';
	}

	const cssContent = getCssForHashes(cssHashes);
	if (!cssContent) {
		return '';
	}

	return `<style data-ripple-ssr>${cssContent}</style>`;
}

/**
 * Inject SSR content into the HTML template
 * @param {string} template - The HTML template with placeholders
 * @param {string} head - Content to inject in place of <!--ssr-head-->
 * @param {string} body - Content to inject in place of <!--ssr-body-->
 * @returns {string} - The final HTML with injected content
 */
export function injectSSRContent(template, head, body) {
	return template.replace('<!--ssr-head-->', head).replace('<!--ssr-body-->', body);
}

/**
 * Render and inject SSR content into an HTML template
 * @param {*} vite - The Vite dev server instance
 * @param {string} template - The HTML template
 * @param {string} entryPath - Path to the entry component
 * @param {Map<string, [string, string]>} rpcModules - RPC modules registry
 * @returns {Promise<string>} - The final rendered HTML
 */
export async function renderToHTML(vite, template, entryPath, rpcModules) {
	const { head, body, css, get_css_for_hashes } = await renderComponent(
		vite,
		entryPath,
		rpcModules,
	);

	const cssTags = generateCssTags(css, get_css_for_hashes);
	const fullHead = head + cssTags;

	return injectSSRContent(template, fullHead, body);
}
