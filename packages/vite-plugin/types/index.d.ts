import type { Plugin, BuildEnvironmentOptions, ViteDevServer } from 'vite';
import type { RuntimePrimitives } from '@ripple-ts/adapter';
import type { Transport } from 'ripple/transport';
export type { Transport, Transporter } from 'ripple/transport';

// ============================================================================
// Plugin exports
// ============================================================================

/**
 * The core `vite-plugin-ripple` plugin produced by {@link ripple}. The `name`
 * is narrowed so consumers (and tests) can locate it via `find` without an
 * `as` cast.
 */
export interface RipplePlugin extends Plugin {
	readonly name: 'vite-plugin-ripple';
}

export function ripple(options?: RipplePluginOptions): [RipplePlugin, ...Plugin[]];
export function defineConfig(options: RippleConfigOptions): RippleConfigOptions;
export function resolveRippleConfig(
	raw: RippleConfigOptions,
	options?: { requireAdapter?: boolean },
): ResolvedRippleConfig;
export function getRippleConfigPath(projectRoot: string): string;
export function rippleConfigExists(projectRoot: string): boolean;
export function loadRippleConfig(
	projectRoot: string,
	options?: { vite?: ViteDevServer; requireAdapter?: boolean },
): Promise<ResolvedRippleConfig>;

// ============================================================================
// Route classes
// ============================================================================

export class RenderRoute {
	readonly type: 'render';
	path: string;
	entry: RenderRouteEntry;
	layout?: string;
	before: Middleware[];
	prerender: boolean;
	entries?: RenderRouteEntries;
	crawl: boolean;
	constructor(options: RenderRouteOptions);
}

export class ServerRoute {
	readonly type: 'server';
	path: string;
	methods: string[];
	handler: RouteHandler;
	before: Middleware[];
	after: Middleware[];
	constructor(options: ServerRouteOptions);
}

export type Route = RenderRoute | ServerRoute;

// ============================================================================
// Route options
// ============================================================================

export interface RenderRouteOptions {
	/** URL path pattern (e.g., '/', '/posts/:id', '/docs/*slug') */
	path: string;
	/** Path to the Ripple component entry file, optionally with a preferred named export */
	entry: RenderRouteEntry;
	/** Path to the layout component (wraps the entry) */
	layout?: string;
	/** Middleware to run before rendering */
	before?: Middleware[];
	/**
	 * Render the page to static HTML at build time and serve that file. The
	 * build renders it buffered with every boundary settled and writes
	 * `<outDir>/client<path>/index.html`, which the adapter's static file
	 * handler serves before the server renders anything. The page still
	 * hydrates like a server-rendered one. A path with `:param` or `*`
	 * segments needs `entries` naming the pages to render.
	 * @default false
	 */
	prerender?: boolean;
	/**
	 * The pages of a parameterized path to prerender: one record per page
	 * mapping every `:param` and `*catch-all` of the path to a non-empty
	 * string, or a function (sync or async) returning that array, called once
	 * at build time. Required with `prerender` on a path with parameters and
	 * only allowed there. A value goes into the pathname as written, so one
	 * that percent-encoding would change is a configuration error, and only a
	 * `*` value may span segments. Every resulting pathname is matched like a
	 * request, so a more specific route renders the pathnames it claims.
	 */
	entries?: RenderRouteEntries;
	/**
	 * Follow the same-origin anchors of this route's prerendered pages and
	 * prerender every linked page that matches a `prerender` render route, and
	 * so on through routes that also set `crawl`. Only valid with `prerender`.
	 * @default false
	 */
	crawl?: boolean;
}

export interface ServerRouteOptions {
	/** URL path pattern (e.g., '/api/hello', '/api/posts/:id') */
	path: string;
	/** HTTP methods to handle (default: ['GET']) */
	methods?: string[];
	/** Request handler that returns a Response */
	handler: RouteHandler;
	/** Middleware to run before the handler */
	before?: Middleware[];
	/** Middleware to run after the handler */
	after?: Middleware[];
}

// ============================================================================
// Context and middleware
// ============================================================================

export interface Context {
	/** The incoming Request object */
	request: Request;
	/** URL parameters extracted from the route pattern */
	params: Record<string, string>;
	/** Parsed URL object */
	url: URL;
	/** Shared state for passing data between middlewares */
	state: Map<string, unknown>;
}

export type NextFunction = () => Promise<Response>;
export type Middleware = (context: Context, next: NextFunction) => Response | Promise<Response>;
export type RouteHandler = (context: Context) => Response | Promise<Response>;

// ============================================================================
// Configuration
// ============================================================================

export interface RipplePluginOptions {
	/**
	 * Override the build's rendering side. `false` builds a client-only app:
	 * components compile without the hydration cursor or serialization hashes,
	 * the runtime's hydration paths are compiled out, and `hydrate()` throws.
	 * `true` compiles every module for the server, for an adapter that drives
	 * the build itself. Leave unset to let Vite's environment decide, which is
	 * what a `ripple.config.ts` app with render routes needs.
	 */
	ssr?: boolean;

	/**
	 * Whether the app renders under the default root try/pending/catch
	 * boundary. `false` leaves the boundary runtime out of the build: `mount()`
	 * and `hydrate()` render without one, a `rootBoundary` option on either
	 * throws, and `trackAsync()` must sit inside a user `@try` block.
	 * @default true
	 */
	rootBoundary?: boolean;

	/**
	 * Opt-in primitive DOM text proofs from TypeScript. Requires TypeScript and
	 * strictNullChecks. Active only in one-shot production builds; development,
	 * HMR, and watch builds use local inference. Resolve tsconfig from Vite root.
	 */
	textTypes?: false | { tsconfig: string };

	excludeRippleExternalModules?: boolean;
}

export type Component<T = Record<string, any>> = (props: T) => void;

/**
 * A module in the app, by root-relative path (`'/src/Loading.tsrx'`), optionally
 * naming the export to use (`['Loading', '/src/screens.tsrx']`).
 */
export type ModuleEntry = string | readonly [exportName: string, path: string];

export type RenderRouteEntry = ModuleEntry;

/** The pages of a parameterized render route to prerender, or a function producing them at build time. */
export type RenderRouteEntries =
	Record<string, string>[] | (() => Record<string, string>[] | Promise<Record<string, string>[]>);

export interface RootBoundaryOptions {
	pending?: Component<Record<string, never>>;
	catch?: Component<{ error: unknown; reset: () => void }>;
}

/**
 * The root boundary's components, by module. A path without an export name
 * uses the module's default export, or else its first capitalized function
 * export, as route entries do.
 */
export interface RootBoundaryConfig {
	pending?: ModuleEntry;
	catch?: ModuleEntry;
}

export interface RippleConfigOptions {
	build?: {
		/** Output directory for the production build. @default 'dist' */
		outDir?: string;
		minify?: boolean;
		target?: BuildEnvironmentOptions['target'];
	};
	adapter?: {
		serve: AdapterServeFunction;
		/**
		 * Platform-specific runtime primitives provided by the adapter.
		 *
		 * These allow the server runtime to operate without depending
		 * on Node.js-specific APIs like `node:crypto` or `node:async_hooks`.
		 *
		 * Required for production builds. In development, the vite plugin
		 * falls back to Node.js defaults if not provided.
		 */
		runtime: RuntimePrimitives;
	};
	router?: {
		routes: Route[];
	};
	/**
	 * Global root pending/catch UI used by client and SSR render roots. The
	 * browser imports these modules, never ripple.config.ts itself.
	 */
	rootBoundary?: RootBoundaryConfig;
	/**
	 * Module exporting the custom serializers ({@link Transport}) shared by
	 * trackAsync hydration and RPC in both directions. A path alone uses the
	 * module's default export. The browser imports this module, never
	 * ripple.config.ts itself.
	 */
	transport?: ModuleEntry;
	ssr?: {
		/**
		 * Stream render-route responses: the synchronous shell (with pending
		 * fallbacks for suspended `@try` boundaries) is sent immediately and
		 * each boundary's content streams as it settles.
		 *
		 * Requires `<!--ssr-head-->` and `<!--ssr-body-->` markers in
		 * index.html; falls back to buffered rendering when they are missing.
		 *
		 * @default false
		 */
		streaming?: boolean;
	};
	/** Global middlewares applied to all routes */
	middlewares?: Middleware[];
	platform?: {
		env: Record<string, string>;
	};
	server?: {
		/**
		 * Whether to trust `X-Forwarded-Proto` and `X-Forwarded-Host` headers
		 * when deriving the request origin (protocol + host).
		 *
		 * Enable this only when the application is behind a trusted reverse proxy
		 * (e.g., nginx, Cloudflare, AWS ALB). When `false` (the default), the
		 * protocol is inferred from the socket and the host from the `Host` header.
		 *
		 * @default false
		 */
		trustProxy?: boolean;
	};
}

/**
 * Resolved configuration with all defaults applied.
 * Returned by `resolveRippleConfig` and `loadRippleConfig`.
 * Consumers should use this type instead of applying ad-hoc defaults.
 */
export interface ResolvedRippleConfig {
	build: {
		/** @default 'dist' */
		outDir: string;
		minify?: boolean;
		target?: BuildEnvironmentOptions['target'];
	};
	adapter?: {
		serve: AdapterServeFunction;
		runtime: RuntimePrimitives;
	};
	router: {
		routes: Route[];
	};
	/** @default {} */
	rootBoundary: RootBoundaryConfig;
	transport?: ModuleEntry;
	ssr: {
		/** @default false */
		streaming: boolean;
	};
	/** @default [] */
	middlewares: Middleware[];
	platform: {
		/** @default {} */
		env: Record<string, string>;
	};
	server: {
		/** @default false */
		trustProxy: boolean;
	};
}

export type AdapterServeFunction = (
	handler: (request: Request, platform?: unknown) => Response | Promise<Response>,
	options?: Record<string, unknown>,
) => { listen: (port?: number) => unknown; close: () => void };
