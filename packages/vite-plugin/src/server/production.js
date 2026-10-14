/**
 * Production server runtime for Ripple metaframework.
 * This module is used in production builds to handle SSR + API routes + RPC.
 *
 * It is designed to be imported by the generated server entry and does NOT
 * depend on Vite at runtime.
 *
 * Platform-agnostic — no Node.js-specific imports. Platform capabilities
 * (hashing, async context) are provided via `manifest.runtime` from the adapter.
 */

import { createRouter } from './router.js';
import { createContext, runMiddlewareChain } from './middleware.js';
import { buildStreamTemplate, createStreamingResponse } from './stream-response.js';
import { createLayoutWrapper, createPropsWrapper } from './component-wrappers.js';
import {
	fill_route_path,
	get_route_entry_id,
	get_route_entry_path,
	validate_route_entries,
} from '../routes.js';
import { get_linked_pathnames } from './links.js';
import {
	patch_global_fetch,
	build_rpc_lookup,
	is_rpc_request,
	handle_rpc_request,
} from '@ripple-ts/adapter/rpc';

export { resolveRippleConfig, resolveRootBoundary, resolveTransport } from '../load-config.js';

/**
 * @typedef {import('@ripple-ts/vite-plugin').Route} Route
 * @typedef {import('@ripple-ts/vite-plugin').Middleware} Middleware
 * @typedef {import('@ripple-ts/vite-plugin').RenderRoute} RenderRoute
 * @typedef {import('@ripple-ts/vite-plugin').ServerRoute} ServerRoute
 */

/**
@import {
	ServerManifest,
	HandlerOptions,
	ClientAssetEntry,
} from '../../types/production.d.ts';
 */

/**
 * Create a production request handler from a manifest.
 *
 * The returned function is a standard Web `fetch`-style handler:
 *   `(request: Request) => Promise<Response>`
 *
 * @param {ServerManifest} manifest
 * @param {HandlerOptions} options
 * @returns {(request: Request) => Promise<Response>}
 */
export function createHandler(manifest, options) {
	const { render, getCss, htmlTemplate, executeServerFunction, createSsrStream } = options;
	const router = createRouter(manifest.routes);
	const globalMiddlewares = manifest.middlewares;
	const trustProxy = manifest.trustProxy ?? false;
	const clientAssets = manifest.clientAssets || {};

	// Use adapter's runtime primitives for platform-agnostic operation
	const runtime = manifest.runtime;

	// Build the RPC lookup table using the adapter's hash function
	const rpcLookup = manifest.rpcModules
		? build_rpc_lookup(manifest.rpcModules, runtime.hash)
		: new Map();

	// Create async context and patch fetch for relative URL resolution in `module server` declarations
	const asyncContext = runtime.createAsyncContext();
	const fetchHandle = patch_global_fetch(asyncContext);

	const handler = async function handler(/** @type {Request} */ request) {
		const url = new URL(request.url);
		const method = request.method;

		// Handle RPC requests for `module server` declarations
		if (is_rpc_request(url.pathname)) {
			return handle_rpc_request(request, {
				resolveFunction(hash) {
					const entry = rpcLookup.get(hash);
					if (!entry) return null;
					const fn = entry.serverObj[entry.funcName];
					return typeof fn === 'function' ? fn : null;
				},
				executeServerFunction,
				asyncContext,
				trustProxy,
			});
		}

		// Match route
		const match = router.match(method, url.pathname);

		if (!match) {
			return new Response('Not Found', { status: 404 });
		}

		// Create context
		const context = createContext(request, match.params);

		try {
			if (match.route.type === 'render') {
				return await handleRenderRoute(
					match.route,
					context,
					manifest,
					globalMiddlewares,
					render,
					getCss,
					htmlTemplate,
					clientAssets,
					createSsrStream,
				);
			} else {
				return await handleServerRoute(match.route, context, globalMiddlewares);
			}
		} catch (error) {
			console.error('[ripple] Request error:', error);
			return new Response('Internal Server Error', { status: 500 });
		}
	};

	// Enable same-origin fetch short-circuit: server-side fetch() calls that
	// resolve to the same origin are routed directly through this handler
	// in-process, instead of making a real network request.
	fetchHandle.set_handler(handler);

	return handler;
}

/**
 * Whether a pathname carries an empty segment, which the entry values a build
 * may name never produce. The root is the one pathname that is only a
 * separator.
 * @param {string} pathname
 * @returns {boolean}
 */
function has_empty_segment(pathname) {
	return pathname !== '/' && pathname.split('/').slice(1).includes('');
}

/**
 * Renders the render routes marked `prerender` to static HTML, buffered with
 * every boundary settled, as the build-time counterpart of the request
 * handler: the same template, assets, route data and hydration script, so the
 * written page hydrates exactly like a server-rendered one.
 *
 * A static route renders its own path. A parameterized route renders one page
 * per record of its `entries`, resolved at this point when they are a
 * function. Every pathname, and every same-origin link found in the pages of a
 * `crawl` route, is normalized like a request URL and then served by the
 * production request handler itself, so route precedence, middleware, the
 * params a page is given, a missing route and an error all behave the way they
 * will on the built site, and each pathname renders once.
 * @param {ServerManifest} manifest
 * @param {HandlerOptions} options
 * @param {string} origin the URL origin the pages are rendered under
 * @returns {Promise<Map<string, string>>} pathname → HTML document
 */
export async function prerenderRoutes(manifest, options, origin = 'http://localhost') {
	/** @type {Map<string, string>} */
	const pages = new Map();
	// Buffered: a streamed shell is not a document.
	const handler = createHandler({ ...manifest, streaming: false }, options);
	const router = createRouter(manifest.routes);

	/** @type {Array<{ pathname: string, listed: boolean }>} */
	const queue = [];
	const queued = new Set();

	/**
	 * A concrete pathname is a path rather than a reference, so it is
	 * normalized through the `pathname` setter, which collapses dot segments
	 * as a request URL does while a leading `//` stays a path instead of
	 * becoming another host.
	 * @param {string} pathname
	 * @returns {URL}
	 */
	const to_url = (pathname) => {
		const url = new URL(origin);
		url.pathname = pathname;
		return url;
	};

	/**
	 * @param {string} pathname
	 * @param {boolean} listed whether `entries` named this page, which must render
	 * @returns {void}
	 */
	const enqueue = (pathname, listed) => {
		const resolved = to_url(pathname).pathname;
		// A pathname only a percent escape can spell, or one carrying an empty
		// segment, is not one a path holds as written; `entries` rejects both
		// outright, and a link to one points at something this build does not
		// make a page of.
		if (!listed && (resolved.includes('%') || has_empty_segment(resolved))) return;
		if (queued.has(resolved)) return;
		queued.add(resolved);
		queue.push({ pathname: resolved, listed });
	};

	for (const route of manifest.routes) {
		if (route.type !== 'render' || !route.prerender) continue;
		if (route.entries === undefined) {
			enqueue(route.path, true);
			continue;
		}
		const entries = typeof route.entries === 'function' ? await route.entries() : route.entries;
		validate_route_entries(route.path, entries);
		for (const record of entries) {
			enqueue(fill_route_path(route.path, record), true);
		}
	}

	for (let i = 0; i < queue.length; i++) {
		const { pathname, listed } = queue[i];
		let match;
		try {
			match = router.match('GET', pathname);
		} catch (error) {
			throw new Error(`[ripple] Prerendering ${pathname} failed`, { cause: error });
		}
		const route =
			match && match.route.type === 'render' && match.route.prerender
				? /** @type {RenderRoute} */ (match.route)
				: null;
		// A link can point at anything; a page `entries` named is answered
		// whatever it now resolves to, so a page it silently loses is a failure.
		if (route === null && !listed) continue;

		const url = to_url(pathname);
		let response;
		try {
			response = await handler(new Request(url));
		} catch (error) {
			throw new Error(`[ripple] Prerendering ${pathname} failed`, { cause: error });
		}
		if (response.status !== 200) {
			throw new Error(`[ripple] Prerendering ${pathname} failed with status ${response.status}`);
		}
		const html = await response.text();
		pages.set(pathname, html);

		if (route !== null && route.crawl) {
			for (const linked of get_linked_pathnames(html, url)) {
				enqueue(linked, false);
			}
		}
	}

	return pages;
}

// ============================================================================
// Render routes
// ============================================================================

/**
 * Handle a RenderRoute in production
 *
 * @param {RenderRoute} route
 * @param {import('@ripple-ts/vite-plugin').Context} context
 * @param {ServerManifest} manifest
 * @param {Middleware[]} globalMiddlewares
 * @param {import('../../types/production.d.ts').RenderFunction} render
 * @param {(css: Set<string>) => string} getCss
 * @param {string} htmlTemplate
 * @param {Record<string, ClientAssetEntry>} clientAssets
 * @param {import('../../types/production.d.ts').HandlerOptions['createSsrStream']} [createSsrStream]
 * @returns {Promise<Response>}
 */
async function handleRenderRoute(
	route,
	context,
	manifest,
	globalMiddlewares,
	render,
	getCss,
	htmlTemplate,
	clientAssets,
	createSsrStream,
) {
	const renderHandler = async () => {
		// Get the page component
		const entryId = get_route_entry_id(route.entry);
		const entryPath = get_route_entry_path(route.entry);
		const PageComponent = entryId ? manifest.components[entryId] : null;
		if (!PageComponent) {
			throw new Error(`Component not found for route ${route.path}`);
		}

		// Get layout if specified
		let RootComponent;
		const pageProps = { params: context.params };

		if (route.layout && manifest.layouts[route.layout]) {
			const LayoutComponent = manifest.layouts[route.layout];
			RootComponent = createLayoutWrapper(LayoutComponent, PageComponent, pageProps);
		} else {
			RootComponent = createPropsWrapper(PageComponent, pageProps);
		}

		// Build asset preload tags from the client manifest.
		// These ensure the browser starts downloading page-specific JS/CSS
		// immediately, before the hydration script executes.
		/** @type {string[]} */
		const preloadTags = [];
		const entryAssets = entryPath ? clientAssets[entryPath] : undefined;

		if (entryAssets?.css) {
			for (const cssFile of entryAssets.css) {
				preloadTags.push(`<link rel="stylesheet" href="/${cssFile}">`);
			}
		}
		if (entryAssets?.js) {
			preloadTags.push(`<link rel="modulepreload" href="/${entryAssets.js}">`);
		}

		// Preload the hydrate runtime so it starts downloading in parallel
		const hydrateAsset = clientAssets.__hydrate_js;
		if (hydrateAsset?.js) {
			preloadTags.push(`<link rel="modulepreload" href="/${hydrateAsset.js}">`);
		}

		// Build head content with hydration data
		const routeData = JSON.stringify({
			entry: route.entry,
			layout: route.layout,
			params: context.params,
		});
		const routeDataScript = `<script id="__ripple_data" type="application/json">${escapeScript(routeData)}</script>`;

		if (manifest.streaming && createSsrStream) {
			// SSR head content and CSS travel in the stream itself; only the
			// static per-request head additions go into the scaffold
			const streamTemplate = buildStreamTemplate(
				htmlTemplate,
				[...preloadTags, routeDataScript].join('\n'),
			);
			if (streamTemplate) {
				return createStreamingResponse({
					render,
					createSsrStream,
					component: RootComponent,
					rootBoundary: manifest.rootBoundary,
					streamTemplate,
				});
			}
			console.warn(
				'[ripple] ssr.streaming is enabled but the HTML template is missing the <!--ssr-head--> or <!--ssr-body--> marker — falling back to buffered SSR.',
			);
		}

		// Render to HTML
		const { head, body, css } = await render(RootComponent, {
			rootBoundary: manifest.rootBoundary,
		});

		// Generate inline scoped CSS (from SSR-rendered component hashes)
		let cssContent = '';
		if (css.size > 0) {
			const cssString = getCss(css);
			if (cssString) {
				cssContent = `<style data-ripple-ssr>${cssString}</style>`;
			}
		}

		const headContent = [head, cssContent, ...preloadTags, routeDataScript]
			.filter(Boolean)
			.join('\n');

		// Inject into the HTML template
		const html = htmlTemplate
			.replace('<!--ssr-head-->', headContent)
			.replace('<!--ssr-body-->', body);

		return new Response(html, {
			status: 200,
			headers: { 'Content-Type': 'text/html; charset=utf-8' },
		});
	};

	return runMiddlewareChain(context, globalMiddlewares, route.before || [], renderHandler, []);
}

// ============================================================================
// Server routes
// ============================================================================

/**
 * Handle a ServerRoute in production
 *
 * @param {ServerRoute} route
 * @param {import('@ripple-ts/vite-plugin').Context} context
 * @param {Middleware[]} globalMiddlewares
 * @returns {Promise<Response>}
 */
async function handleServerRoute(route, context, globalMiddlewares) {
	const handler = async () => route.handler(context);
	return runMiddlewareChain(
		context,
		globalMiddlewares,
		route.before || [],
		handler,
		route.after || [],
	);
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Escape script content to prevent XSS
 * @param {string} str
 * @returns {string}
 */
function escapeScript(str) {
	return str.replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
}
