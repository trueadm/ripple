/**
 * @typedef {import('@ripple-ts/vite-plugin').Context} Context
 * @typedef {import('@ripple-ts/vite-plugin').Middleware} Middleware
 * @typedef {import('@ripple-ts/vite-plugin').RenderRouteOptions} RenderRouteOptions
 * @typedef {import('@ripple-ts/vite-plugin').ServerRouteOptions} ServerRouteOptions
 * @typedef {import('@ripple-ts/vite-plugin').RenderRouteEntries} RenderRouteEntries
 */

/**
 * @typedef {string | readonly [string, string]} RenderRouteEntry
 */

/**
 * @overload
 * @param {RenderRouteEntry} entry
 * @returns {string}
 */
/**
 * @overload
 * @param {RenderRouteEntry | undefined} entry
 * @returns {string | undefined}
 */
/**
 * @param {RenderRouteEntry | undefined} entry
 * @returns {string | undefined}
 */
export function get_route_entry_path(entry) {
	return typeof entry === 'string' ? entry : entry?.[1];
}

/**
 * @param {RenderRouteEntry | undefined} entry
 * @returns {string | undefined}
 */
export function get_route_entry_export_name(entry) {
	return typeof entry === 'string' ? undefined : entry?.[0];
}

/**
 * @param {RenderRouteEntry | undefined} entry
 * @returns {string | undefined}
 */
export function get_route_entry_id(entry) {
	const path = get_route_entry_path(entry);
	const export_name = get_route_entry_export_name(entry);
	return path && export_name ? `${path}#${export_name}` : path;
}

/**
 * @param {Record<string, unknown>} module
 * @param {string | undefined} export_name
 * @returns {Function | null}
 */
export function get_component_export(module, export_name) {
	if (export_name && typeof module[export_name] === 'function') {
		return module[export_name];
	}
	if (typeof module.default === 'function') {
		return module.default;
	}
	for (const [key, value] of Object.entries(module)) {
		if (typeof value === 'function' && /^[A-Z]/.test(key)) {
			return value;
		}
	}
	return null;
}

/**
 * Route for rendering Ripple components with SSR
 */
export class RenderRoute {
	/** @type {'render'} */
	type = 'render';

	/** @type {string} */
	path;

	/** @type {RenderRouteEntry | undefined} */
	entry;

	/** @type {string | undefined} */
	layout;

	/** @type {Middleware[]} */
	before;

	/** @type {boolean} */
	prerender;

	/** @type {RenderRouteEntries | undefined} */
	entries;

	/** @type {boolean} */
	crawl;

	/**
	 * @param {RenderRouteOptions} options
	 */
	constructor(options) {
		if (!options.entry) {
			throw new Error('RenderRoute requires an `entry`.');
		}

		this.path = options.path;
		this.entry = options.entry;
		this.layout = options.layout;
		this.before = options.before ?? [];
		this.prerender = options.prerender === true;
		this.entries = options.entries;
		this.crawl = options.crawl ?? false;
	}
}

/**
 * Route for API endpoints (returns Response directly)
 */
export class ServerRoute {
	/** @type {'server'} */
	type = 'server';

	/** @type {string} */
	path;

	/** @type {string[]} */
	methods;

	/** @type {(context: Context) => Response | Promise<Response>} */
	handler;

	/** @type {Middleware[]} */
	before;

	/** @type {Middleware[]} */
	after;

	/**
	 * @param {ServerRouteOptions} options
	 */
	constructor(options) {
		this.path = options.path;
		this.methods = options.methods ?? ['GET'];
		this.handler = options.handler;
		this.before = options.before ?? [];
		this.after = options.after ?? [];
	}
}

/**
 * The parameters of a route path, in order, each with the kind its own
 * segment gives it.
 * @param {string} path
 * @returns {Array<{ name: string, catch_all: boolean }>}
 */
export function get_route_params(path) {
	/** @type {Array<{ name: string, catch_all: boolean }>} */
	const params = [];
	for (const segment of path.split('/')) {
		if (segment.startsWith(':')) params.push({ name: segment.slice(1), catch_all: false });
		else if (segment.startsWith('*')) params.push({ name: segment.slice(1), catch_all: true });
	}
	return params;
}

/**
 * The `:param` and `*catch-all` names of a route path, in order.
 * @param {string} path
 * @returns {string[]}
 */
export function get_route_param_names(path) {
	return get_route_params(path).map((param) => param.name);
}

/**
 * Fill a route path with one entries record. The values go in as written,
 * which the validation above guarantees is what a path holds anyway.
 * @param {string} path
 * @param {Record<string, string>} record
 * @returns {string}
 */
export function fill_route_path(path, record) {
	return path
		.split('/')
		.map((segment) => {
			if (segment.startsWith(':') || segment.startsWith('*')) return record[segment.slice(1)];
			return segment;
		})
		.join('/');
}

/**
 * Whether a path segment reaches the pathname as written. A URL parser leaves
 * the sub-delimiters a path may hold -- `&`, `=`, `+`, `,`, `:`, `@` and their
 * like -- alone and escapes the rest, so serializing the segment and comparing
 * is the question itself. A literal `%` is out on its own: it reads as the
 * start of an escape, so the pathname no longer says what the value said. The
 * trailing letter keeps `.` and `..` away from the parser's dot-segment
 * handling, which normalizes the pathname rather than escaping the segment.
 * @param {string} segment
 * @returns {boolean}
 */
function survives_as_a_segment(segment) {
	if (segment.includes('%')) {
		return false;
	}
	const written = `/${segment}a`;
	const url = new URL('http://localhost');
	url.pathname = written;
	return url.pathname === written;
}

/**
 * Check the records that name a parameterized route's prerendered pages:
 * every record is an object giving each parameter of the path a non-empty
 * string that a path can hold as written, and nothing else.
 * @param {string} path
 * @param {unknown} entries
 * @returns {asserts entries is Record<string, string>[]}
 */
export function validate_route_entries(path, entries) {
	if (!Array.isArray(entries)) {
		throw new Error(
			`[@ripple-ts/vite-plugin] RenderRoute \`${path}\` \`entries\` must be an array of records or a function returning one.`,
		);
	}

	const params = get_route_params(path);
	const names = params.map((param) => param.name);
	for (const record of entries) {
		const prototype =
			record === null || typeof record !== 'object' ? undefined : Object.getPrototypeOf(record);
		if (prototype !== Object.prototype && prototype !== null) {
			throw new Error(
				`[@ripple-ts/vite-plugin] RenderRoute \`${path}\`: each entry must be a plain object mapping every route parameter to a string.`,
			);
		}
		for (const { name, catch_all } of params) {
			const value = record[name];
			if (typeof value !== 'string' || value === '') {
				throw new Error(
					`[@ripple-ts/vite-plugin] RenderRoute \`${path}\`: an entry is missing a non-empty string for \`${name}\`.`,
				);
			}
			// The value is substituted into the pathname as written, so it has
			// to be something a path already holds. A catch-all spans segments;
			// a named parameter is one, so a separator would make it two.
			if (!catch_all && value.includes('/')) {
				throw new Error(
					`[@ripple-ts/vite-plugin] RenderRoute \`${path}\`: the entry value for \`${name}\` spans segments, which only a \`*\` parameter may do.`,
				);
			}
			// Its own separators are its business: only what sits between them
			// has to survive as written.
			const parts = catch_all ? value.split('/') : [value];
			// A `*` value may carry separators, but an empty segment would name
			// a pathname no file can hold.
			if (parts.some((part) => part === '')) {
				throw new Error(
					`[@ripple-ts/vite-plugin] RenderRoute \`${path}\`: the entry value for \`${name}\` leaves an empty segment in the pathname.`,
				);
			}
			for (const part of parts) {
				if (!survives_as_a_segment(part)) {
					throw new Error(
						`[@ripple-ts/vite-plugin] RenderRoute \`${path}\`: the entry value for \`${name}\` is not usable in a path as written.`,
					);
				}
			}
		}
		for (const key of Reflect.ownKeys(record)) {
			if (typeof key !== 'string' || !names.includes(key)) {
				throw new Error(
					`[@ripple-ts/vite-plugin] RenderRoute \`${path}\`: an entry names \`${String(key)}\`, which is not a parameter of the path.`,
				);
			}
		}
	}
}
