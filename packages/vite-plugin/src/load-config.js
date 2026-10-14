/**
 * Shared utility for loading and resolving ripple.config.ts.
 *
 * `resolveRippleConfig` is the single source of truth for all config
 * validation and default values. Every consumer should receive a
 * `ResolvedRippleConfig` rather than applying ad-hoc defaults.
 *
 * `loadRippleConfig` is the single entry point for loading the config
 * file.  It accepts an optional Vite dev server — when provided the
 * config is loaded via `ssrLoadModule` (no temp server overhead,
 * HMR-aware). Otherwise a temporary Vite server is spun up, used to
 * transpile the TypeScript config, and immediately shut down.
 *
 * Used by the Vite plugin (during dev + build), the preview CLI script,
 * and the generated production server entry.
 */

/** @import { RippleConfigOptions, ResolvedRippleConfig, ModuleEntry, RootBoundaryConfig, RootBoundaryOptions, Transport } from '@ripple-ts/vite-plugin' */

import path from 'node:path';
import fs from 'node:fs';
import { compile } from '@tsrx/ripple';
import { DEFAULT_OUTDIR } from './constants.js';
import {
	get_component_export,
	get_route_entry_export_name,
	get_route_entry_path,
	get_route_param_names,
	validate_route_entries,
} from './routes.js';

const RIPPLE_EXTENSION_PATTERN = /\.tsrx$/;
const ROOT_BOUNDARY_KEYS = /** @type {const} */ (['pending', 'catch']);

/**
 * @param {unknown} entry
 * @returns {entry is ModuleEntry}
 */
function is_module_entry(entry) {
	return (
		typeof entry === 'string' ||
		(Array.isArray(entry) &&
			entry.length === 2 &&
			typeof entry[0] === 'string' &&
			typeof entry[1] === 'string')
	);
}

/**
 * @param {unknown} route
 * @returns {void}
 */
function validate_render_route(route) {
	if (
		!route ||
		typeof route !== 'object' ||
		/** @type {{ type?: unknown }} */ (route).type !== 'render'
	) {
		return;
	}

	const render_route =
		/** @type {{ path?: unknown, entry?: unknown, layout?: unknown, prerender?: unknown, entries?: unknown, crawl?: unknown }} */ (
			route
		);
	if (!is_module_entry(render_route.entry)) {
		throw new Error('[@ripple-ts/vite-plugin] RenderRoute requires a string/tuple `entry`.');
	}

	if (render_route.layout !== undefined && typeof render_route.layout !== 'string') {
		throw new Error('[@ripple-ts/vite-plugin] RenderRoute `layout` must be a string path.');
	}

	if (render_route.prerender !== undefined && typeof render_route.prerender !== 'boolean') {
		throw new Error('[@ripple-ts/vite-plugin] RenderRoute `prerender` must be a boolean.');
	}
	if (render_route.crawl !== undefined && typeof render_route.crawl !== 'boolean') {
		throw new Error('[@ripple-ts/vite-plugin] RenderRoute `crawl` must be a boolean.');
	}
	if (render_route.crawl === true && render_route.prerender !== true) {
		throw new Error(
			`[@ripple-ts/vite-plugin] RenderRoute \`${render_route.path}\` sets \`crawl\` but is not marked \`prerender\`: only a prerendered page is crawled for links.`,
		);
	}

	const has_params = !is_static_route_path(render_route.path);
	if (render_route.entries !== undefined) {
		if (render_route.prerender !== true) {
			throw new Error(
				`[@ripple-ts/vite-plugin] RenderRoute \`${render_route.path}\` declares \`entries\` but is not marked \`prerender\`.`,
			);
		}
		if (!has_params) {
			throw new Error(
				`[@ripple-ts/vite-plugin] RenderRoute \`${render_route.path}\` declares \`entries\` but its path has no \`:param\` or \`*\` segment to fill.`,
			);
		}
		if (typeof render_route.entries !== 'function') {
			validate_route_entries(/** @type {string} */ (render_route.path), render_route.entries);
		}
	} else if (render_route.prerender === true && has_params) {
		throw new Error(
			`[@ripple-ts/vite-plugin] RenderRoute \`${render_route.path}\` cannot be prerendered: only a static path (no \`:param\` or \`*\` segment) can be rendered to a file at build time.`,
		);
	}
}

/**
 * Whether a route path names exactly one page, by the same rule the router
 * uses: only a segment that starts with `:` or `*` is a parameter.
 * @param {unknown} path
 * @returns {boolean}
 */
export function is_static_route_path(path) {
	return typeof path === 'string' && get_route_param_names(path).length === 0;
}

/**
 * @param {unknown} rootBoundary
 * @returns {void}
 */
function validate_root_boundary(rootBoundary) {
	if (rootBoundary === undefined) {
		return;
	}
	if (!rootBoundary || typeof rootBoundary !== 'object') {
		throw new Error('[@ripple-ts/vite-plugin] rootBoundary must be an object when provided.');
	}

	const boundary = /** @type {{ pending?: unknown, catch?: unknown }} */ (rootBoundary);
	for (const key of ROOT_BOUNDARY_KEYS) {
		if (boundary[key] !== undefined && !is_module_entry(boundary[key])) {
			throw new Error(
				`[@ripple-ts/vite-plugin] rootBoundary.${key} must be a module path or an [exportName, path] tuple, such as '/src/Loading.tsrx'. The browser imports that module instead of ripple.config.ts.`,
			);
		}
	}
}

/**
 * @param {unknown} transport
 * @returns {void}
 */
function validate_transport(transport) {
	if (transport !== undefined && !is_module_entry(transport)) {
		throw new Error(
			"[@ripple-ts/vite-plugin] transport must be a module path or an [exportName, path] tuple, such as ['transport', '/src/transport.ts']. The browser imports that module instead of ripple.config.ts.",
		);
	}
}

/**
 * The transport a config's `transport` entry names, read from its loaded module.
 * A path alone names the default export.
 *
 * @param {ModuleEntry} entry
 * @param {Record<string, unknown>} module
 * @returns {Transport}
 */
export function resolveTransport(entry, module) {
	const export_name = get_route_entry_export_name(entry) ?? 'default';
	const source = `${get_route_entry_path(entry)} export \`${export_name}\``;
	const transport = module[export_name];
	if (!transport || typeof transport !== 'object' || Array.isArray(transport)) {
		throw new Error(`[@ripple-ts/vite-plugin] transport: ${source} must be an object.`);
	}
	for (const [name, handler] of Object.entries(transport)) {
		if (
			!handler ||
			typeof handler !== 'object' ||
			Array.isArray(handler) ||
			typeof handler.encode !== 'function' ||
			typeof handler.decode !== 'function'
		) {
			throw new Error(
				`[@ripple-ts/vite-plugin] transport.${name} (${source}) must be an object with encode and decode functions.`,
			);
		}
	}
	return /** @type {Transport} */ (transport);
}

/**
 * @param {RootBoundaryConfig} boundary
 * @param {keyof RootBoundaryConfig} key
 * @param {Record<string, unknown> | undefined} module
 * @returns {Function | undefined}
 */
function get_root_boundary_component(boundary, key, module) {
	const entry = boundary[key];
	if (entry === undefined) return undefined;
	const component = get_component_export(module ?? {}, get_route_entry_export_name(entry));
	if (!component) {
		throw new Error(
			`[@ripple-ts/vite-plugin] rootBoundary.${key}: no component export found in ${get_route_entry_path(entry)}.`,
		);
	}
	return component;
}

/**
 * The root boundary components a config's `rootBoundary` entries name, read
 * from their loaded modules.
 *
 * @param {RootBoundaryConfig} boundary
 * @param {Partial<Record<keyof RootBoundaryConfig, Record<string, unknown>>>} modules
 * @returns {RootBoundaryOptions}
 */
export function resolveRootBoundary(boundary, modules) {
	/** @type {RootBoundaryOptions} */
	const components = {};
	const pending = get_root_boundary_component(boundary, 'pending', modules.pending);
	if (pending) {
		components.pending = /** @type {NonNullable<RootBoundaryOptions['pending']>} */ (pending);
	}
	const error = get_root_boundary_component(boundary, 'catch', modules.catch);
	if (error) {
		components.catch = /** @type {NonNullable<RootBoundaryOptions['catch']>} */ (error);
	}
	return components;
}

/**
 * Validate a raw ripple config and apply all defaults.
 *
 * After this function returns every optional field carries its default
 * value so callers never need to use `??` / `||` fallbacks.
 *
 * The function is idempotent — passing an already-resolved config
 * through it again is safe and produces the same result.
 *
 * @param {RippleConfigOptions} raw - The user-provided config (from ripple.config.ts)
 * @param {{ requireAdapter?: boolean }} [options]
 * @returns {ResolvedRippleConfig}
 */
export function resolveRippleConfig(raw, options = {}) {
	const { requireAdapter = false } = options;

	// ------------------------------------------------------------------
	// Validate
	// ------------------------------------------------------------------
	if (!raw) {
		throw new Error(
			'[@ripple-ts/vite-plugin] ripple.config.ts must export a default config object.',
		);
	}

	if (requireAdapter) {
		if (!raw.adapter) {
			throw new Error(
				'[@ripple-ts/vite-plugin] Production builds require an `adapter` in ripple.config.ts. ' +
					'Install an adapter package (e.g. @ripple-ts/adapter-node) and set the `adapter` property.',
			);
		}

		if (!raw.adapter.runtime) {
			throw new Error(
				'[@ripple-ts/vite-plugin] The adapter in ripple.config.ts is missing the `runtime` property. ' +
					'Make sure your adapter exports runtime primitives.',
			);
		}
	}

	if (raw.router?.routes !== undefined && !Array.isArray(raw.router.routes)) {
		throw new Error('[@ripple-ts/vite-plugin] router.routes must be an array.');
	}

	for (const route of raw.router?.routes ?? []) {
		validate_render_route(route);
	}

	validate_root_boundary(raw.rootBoundary);
	validate_transport(raw.transport);

	// ------------------------------------------------------------------
	// Apply defaults
	// ------------------------------------------------------------------
	return {
		build: {
			outDir: raw.build?.outDir ?? DEFAULT_OUTDIR,
			minify: raw.build?.minify,
			target: raw.build?.target,
		},
		adapter: raw.adapter,
		router: {
			routes: raw.router?.routes ?? [],
		},
		rootBoundary: raw.rootBoundary ?? {},
		transport: raw.transport,
		ssr: {
			streaming: raw.ssr?.streaming ?? false,
		},
		middlewares: raw.middlewares ?? [],
		platform: {
			env: raw.platform?.env ?? {},
		},
		server: {
			trustProxy: raw.server?.trustProxy ?? false,
		},
	};
}

/**
 * Return the absolute path to ripple.config.ts for the given project root.
 *
 * This is the single source of truth for the config file name / location.
 *
 * @param {string} projectRoot - Absolute path to the project root
 * @returns {string}
 */
export function getRippleConfigPath(projectRoot) {
	return path.join(projectRoot, 'ripple.config.ts');
}

/**
 * Check whether a ripple.config.ts file exists in the given root.
 *
 * Use this before calling `loadRippleConfig` when the absence of a
 * config is a valid state (e.g. the Vite plugin running in SPA mode).
 *
 * @param {string} projectRoot - Absolute path to the project root
 * @returns {boolean}
 */
export function rippleConfigExists(projectRoot) {
	return fs.existsSync(getRippleConfigPath(projectRoot));
}

/**
 * Load ripple.config.ts, validate, and apply defaults via `resolveRippleConfig`.
 *
 * When a Vite dev server is provided via `options.vite`, the config is loaded
 * through its `ssrLoadModule` — avoiding the cost of spinning up a temporary
 * server and enabling HMR-aware reloads.
 *
 * When no dev server is available (build / preview), a temporary Vite server
 * is created in middleware mode, used to transpile the config, then shut down.
 *
 * Throws if the config file does not exist or is invalid.
 *
 * @param {string} projectRoot - Absolute path to the project root
 * @param {{ vite?: import('vite').ViteDevServer, requireAdapter?: boolean }} [options]
 * @returns {Promise<ResolvedRippleConfig>}
 */
export async function loadRippleConfig(projectRoot, options = {}) {
	const { vite, requireAdapter } = options;
	const configPath = getRippleConfigPath(projectRoot);

	if (!fs.existsSync(configPath)) {
		throw new Error(`[@ripple-ts/vite-plugin] ripple.config.ts not found in ${projectRoot}`);
	}

	// When a running Vite dev server is available, use it directly.
	if (vite) {
		const configModule = await vite.ssrLoadModule(configPath);
		return resolveRippleConfig(configModule.default, { requireAdapter });
	}

	// Otherwise spin up a temporary Vite server (build / preview).
	// The temp server only transpiles ripple.config.ts (plain TypeScript) —
	// no .tsrx compilation plugin is needed.
	const { createServer } = await import('vite');

	const tempVite = await createServer({
		root: projectRoot,
		configFile: false,
		appType: 'custom',
		server: { middlewareMode: true },
		plugins: [
			{
				name: 'ripple-config-tsrx-loader',
				transform(source, id) {
					if (!RIPPLE_EXTENSION_PATTERN.test(id)) return null;
					const filename = id.replace(projectRoot, '');
					return compile(source, filename, {
						mode: 'server',
						dev: true,
						hmr: false,
					});
				},
			},
		],
		logLevel: 'silent',
	});

	try {
		const configModule = await tempVite.ssrLoadModule(configPath);
		return resolveRippleConfig(configModule.default, { requireAdapter });
	} finally {
		await tempVite.close();
	}
}
