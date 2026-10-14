import { describe, it, expect, vi } from 'vitest';
import { prerenderRoutes } from '../src/server/production.js';
import { resolveRippleConfig } from '../src/load-config.js';
import { RenderRoute, ServerRoute } from '../src/routes.js';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

/**
 * @param {string} relative
 * @returns {string}
 */
function readRepoFile(relative) {
	return readFileSync(REPO_ROOT + relative, 'utf-8');
}

/**
 * @param {string} html
 * @returns {any}
 */
function parseRippleData(html) {
	const match = html.match(/<script id="__ripple_data" type="application\/json">([^<]+)<\/script>/);
	if (!match) {
		throw new Error('Missing __ripple_data script');
	}
	return JSON.parse(match[1]);
}

function createRuntime() {
	return {
		hash: () => '00000000',
		createAsyncContext: () => ({
			run: (_store, fn) => fn(),
			getStore: () => undefined,
		}),
	};
}

/**
 * Render double: the body is whatever the page component returns, so a page
 * can emit anchors for the crawler.
 */
function createHandlerOptions() {
	return {
		render: /** @type {import('../types/production.d.ts').RenderFunction} */ (
			async (/** @type {Function} */ Component) => {
				const body = Component({});
				return {
					head: '',
					body: typeof body === 'string' ? body : '<div>page</div>',
					css: new Set(),
				};
			}
		),
		getCss: () => '',
		htmlTemplate: '<html><head><!--ssr-head--></head><body><!--ssr-body--></body></html>',
		executeServerFunction: async () => '',
		createSsrStream: () => {
			throw new Error('streaming must not be used for prerendering');
		},
	};
}

/**
 * @param {import('../src/routes.js').RenderRoute[] | any[]} routes
 * @param {Record<string, Function>} components
 */
function createManifest(routes, components) {
	return {
		routes,
		components,
		layouts: {},
		middlewares: [],
		runtime: createRuntime(),
		streaming: true,
		clientAssets: {},
	};
}

/** Records the props of every render and returns a body. */
function pageComponent(body = '<div>page</div>') {
	const fn = vi.fn((/** @type {Record<string, unknown>} */ props) => {
		return typeof body === 'function' ? body(props) : body;
	});
	return fn;
}

const ENTRY = './src/Post.tsrx';

/** A parameterized prerendered route with valid entries resolves without error. */
function expectValidEntriesAccepted() {
	const route = new RenderRoute({
		path: '/posts/:slug',
		entry: ENTRY,
		prerender: true,
		entries: [{ slug: 'hello' }],
	});
	expect(() => resolveRippleConfig({ router: { routes: [route] } })).not.toThrow();
}

describe('RenderRoute entries validation', () => {
	it('accepts a prerendered parameterized route that declares entries', () => {
		const route = new RenderRoute({
			path: '/posts/:slug',
			entry: ENTRY,
			prerender: true,
			entries: [{ slug: 'hello' }, { slug: 'world' }],
		});
		expect(() => resolveRippleConfig({ router: { routes: [route] } })).not.toThrow();
	});

	it('accepts an entries function without invoking it at resolve time', () => {
		const entries = vi.fn(() => [{ slug: 'hello' }]);
		const route = new RenderRoute({ path: '/posts/:slug', entry: ENTRY, prerender: true, entries });
		resolveRippleConfig({ router: { routes: [route] } });
		expect(entries).not.toHaveBeenCalled();
	});

	it('still rejects a prerendered parameterized route without entries', () => {
		expectValidEntriesAccepted();
		/** @param {string} path */
		const legacyMessage = (path) =>
			'[@ripple-ts/vite-plugin] RenderRoute `' +
			path +
			'` cannot be prerendered: only a static path (no `:param` or `*` segment) can be rendered to a file at build time.';
		/** @param {any[]} routes */
		const messageFor = (routes) => {
			try {
				resolveRippleConfig({ router: { routes } });
			} catch (error) {
				return /** @type {Error} */ (error).message;
			}
			return 'resolveRippleConfig did not throw';
		};
		// the diagnostic a route without entries gets is the one the repository
		// already raises, word for word
		const route = new RenderRoute({ path: '/posts/:slug', entry: ENTRY, prerender: true });
		expect(messageFor([route])).toBe(legacyMessage('/posts/:slug'));
		const catchAll = new RenderRoute({ path: '/docs/*rest', entry: ENTRY, prerender: true });
		expect(messageFor([catchAll])).toBe(legacyMessage('/docs/*rest'));
	});

	it('rejects entries on a static path or on a route that is not prerendered', () => {
		expectValidEntriesAccepted();
		const onStatic = new RenderRoute({
			path: '/about',
			entry: ENTRY,
			prerender: true,
			entries: [{}],
		});
		expect(() => resolveRippleConfig({ router: { routes: [onStatic] } })).toThrow();
		const notPrerendered = new RenderRoute({
			path: '/posts/:slug',
			entry: ENTRY,
			entries: [{ slug: 'hello' }],
		});
		expect(() => resolveRippleConfig({ router: { routes: [notPrerendered] } })).toThrow();
		const functionOnStatic = new RenderRoute({
			path: '/about',
			entry: ENTRY,
			prerender: true,
			entries: () => [{}],
		});
		expect(() => resolveRippleConfig({ router: { routes: [functionOnStatic] } })).toThrow();
		const functionNotPrerendered = new RenderRoute({
			path: '/posts/:slug',
			entry: ENTRY,
			entries: async () => [{ slug: 'hello' }],
		});
		expect(() => resolveRippleConfig({ router: { routes: [functionNotPrerendered] } })).toThrow();
	});

	it('rejects records that miss a parameter, carry unknown keys or non-string values', () => {
		expectValidEntriesAccepted();
		for (const entries of [
			[{ slug: 'hello' }, {}],
			[{ slug: 'hello', extra: 'x' }],
			[{ slug: 42 }],
			[{ slug: '' }],
			['hello'],
			[null],
			[
				new (class Slug {
					constructor() {
						this.slug = 'hello';
					}
				})(),
			],
			[new Date()],
		]) {
			const route = new RenderRoute({
				path: '/posts/:slug',
				entry: ENTRY,
				prerender: true,
				entries: /** @type {any} */ (entries),
			});
			expect(() => resolveRippleConfig({ router: { routes: [route] } })).toThrow(/\/posts\/:slug/);
		}
		const twoParams = new RenderRoute({
			path: '/users/:user/posts/:post',
			entry: ENTRY,
			prerender: true,
			entries: [{ user: 'a' }],
		});
		expect(() => resolveRippleConfig({ router: { routes: [twoParams] } })).toThrow(
			/\/users\/:user\/posts\/:post/,
		);
	});

	it('rejects entries that are neither an array nor a function', () => {
		expectValidEntriesAccepted();
		for (const entries of ['hello', { slug: 'hello' }, 1]) {
			const route = new RenderRoute({
				path: '/posts/:slug',
				entry: ENTRY,
				prerender: true,
				entries: /** @type {any} */ (entries),
			});
			expect(() => resolveRippleConfig({ router: { routes: [route] } })).toThrow();
		}
	});

	it('only allows crawl on a prerendered route and defaults it to false', () => {
		const ok = new RenderRoute({ path: '/', entry: ENTRY, prerender: true, crawl: true });
		expect(ok.crawl).toBe(true);
		expect(() => resolveRippleConfig({ router: { routes: [ok] } })).not.toThrow();
		expect(new RenderRoute({ path: '/', entry: ENTRY, prerender: true }).crawl).toBe(false);
		const notPrerendered = new RenderRoute({ path: '/live', entry: ENTRY, crawl: true });
		expect(() => resolveRippleConfig({ router: { routes: [notPrerendered] } })).toThrow();
	});
});

describe('prerenderRoutes with entries', () => {
	it('renders one page per record and passes the params like a request would', async () => {
		const Post = pageComponent();
		const routes = [
			new RenderRoute({ path: '/', entry: './src/Home.tsrx', prerender: true }),
			new RenderRoute({
				path: '/posts/:slug',
				entry: ENTRY,
				prerender: true,
				entries: [{ slug: 'hello' }, { slug: 'world' }],
			}),
			new RenderRoute({ path: '/live/:id', entry: './src/Live.tsrx' }),
		];
		const pages = await prerenderRoutes(
			createManifest(routes, { './src/Home.tsrx': pageComponent(), [ENTRY]: Post }),
			createHandlerOptions(),
		);

		expect(new Set(pages.keys())).toEqual(new Set(['/', '/posts/hello', '/posts/world']));
		expect(parseRippleData(/** @type {string} */ (pages.get('/posts/hello'))).params).toEqual({
			slug: 'hello',
		});
		expect(parseRippleData(/** @type {string} */ (pages.get('/posts/world'))).params).toEqual({
			slug: 'world',
		});
		expect(Post).toHaveBeenCalledTimes(2);
		expect(new Set(Post.mock.calls.map(([props]) => props.params.slug))).toEqual(
			new Set(['hello', 'world']),
		);
	});

	it('invokes a synchronous entries function once at prerender time and propagates its error', async () => {
		const entries = vi.fn(() => [{ slug: 'sync-one' }, { slug: 'sync-two' }]);
		const routes = [
			new RenderRoute({ path: '/posts/:slug', entry: ENTRY, prerender: true, entries }),
		];
		const pages = await prerenderRoutes(
			createManifest(routes, { [ENTRY]: pageComponent() }),
			createHandlerOptions(),
		);
		expect(entries).toHaveBeenCalledTimes(1);
		expect(new Set(pages.keys())).toEqual(new Set(['/posts/sync-one', '/posts/sync-two']));

		const throwing = [
			new RenderRoute({
				path: '/posts/:slug',
				entry: ENTRY,
				prerender: true,
				entries: () => {
					throw new Error('sync entries exploded');
				},
			}),
		];
		await expect(
			prerenderRoutes(
				createManifest(throwing, { [ENTRY]: pageComponent() }),
				createHandlerOptions(),
			),
		).rejects.toThrow('sync entries exploded');
	});

	it('validates the records an entries function returns like an array', async () => {
		class Record {
			constructor() {
				this.slug = 'instance';
			}
		}
		for (const returned of [
			[{ slug: 'ok' }, { slug: 'ok', extra: 'x' }],
			[{ slug: '' }],
			[{ slug: 7 }],
			[new Record()],
			['ok'],
			[{ slug: 'a b' }],
			[{ slug: 'a/b' }],
		]) {
			const routes = [
				new RenderRoute({
					path: '/posts/:slug',
					entry: ENTRY,
					prerender: true,
					entries: async () => /** @type {any} */ (returned),
				}),
			];
			await expect(
				prerenderRoutes(
					createManifest(routes, { [ENTRY]: pageComponent() }),
					createHandlerOptions(),
				),
			).rejects.toThrow(/\/posts\/:slug/);
		}
	});

	it('invokes an async entries function at prerender time and validates its result', async () => {
		const entries = vi.fn(async () => [{ slug: 'later' }]);
		const routes = [
			new RenderRoute({ path: '/posts/:slug', entry: ENTRY, prerender: true, entries }),
		];
		const pages = await prerenderRoutes(
			createManifest(routes, { [ENTRY]: pageComponent() }),
			createHandlerOptions(),
		);
		expect(entries).toHaveBeenCalledTimes(1);
		expect([...pages.keys()]).toEqual(['/posts/later']);

		const bad = [
			new RenderRoute({
				path: '/posts/:slug',
				entry: ENTRY,
				prerender: true,
				entries: () => /** @type {any} */ ({ slug: 'x' }),
			}),
		];
		await expect(
			prerenderRoutes(createManifest(bad, { [ENTRY]: pageComponent() }), createHandlerOptions()),
		).rejects.toThrow(/\/posts\/:slug/);

		const missing = [
			new RenderRoute({
				path: '/posts/:slug',
				entry: ENTRY,
				prerender: true,
				entries: () => [{ id: 'x' }],
			}),
		];
		await expect(
			prerenderRoutes(
				createManifest(missing, { [ENTRY]: pageComponent() }),
				createHandlerOptions(),
			),
		).rejects.toThrow(/\/posts\/:slug/);

		const failing = [
			new RenderRoute({
				path: '/posts/:slug',
				entry: ENTRY,
				prerender: true,
				entries: async () => {
					throw new Error('entries exploded');
				},
			}),
		];
		await expect(
			prerenderRoutes(
				createManifest(failing, { [ENTRY]: pageComponent() }),
				createHandlerOptions(),
			),
		).rejects.toThrow('entries exploded');
	});

	it('fills the pattern with the values as written', async () => {
		const Post = pageComponent();
		const Doc = pageComponent();
		const routes = [
			new RenderRoute({
				path: '/posts/:slug',
				entry: ENTRY,
				prerender: true,
				entries: [{ slug: 'hello-world' }],
			}),
			new RenderRoute({
				path: '/docs/*rest',
				entry: './src/Doc.tsrx',
				prerender: true,
				entries: [{ rest: 'guide/getting-started' }],
			}),
		];
		const pages = await prerenderRoutes(
			createManifest(routes, { [ENTRY]: Post, './src/Doc.tsrx': Doc }),
			createHandlerOptions(),
		);

		expect(new Set(pages.keys())).toEqual(
			new Set(['/posts/hello-world', '/docs/guide/getting-started']),
		);
		expect(Post.mock.calls[0][0].params).toEqual({ slug: 'hello-world' });
		expect(Doc.mock.calls[0][0].params).toEqual({ rest: 'guide/getting-started' });
		expect(
			parseRippleData(/** @type {string} */ (pages.get('/docs/guide/getting-started'))).params,
		).toEqual({ rest: 'guide/getting-started' });
	});

	it('fills every placeholder of a multi-parameter pattern', async () => {
		const Profile = pageComponent();
		const File = pageComponent();
		const routes = [
			new RenderRoute({
				path: '/users/:user/posts/:post',
				entry: ENTRY,
				prerender: true,
				entries: [{ user: 'ada', post: 'intro' }],
			}),
			new RenderRoute({
				path: '/files/:id/*idSuffix',
				entry: './src/File.tsrx',
				prerender: true,
				entries: [{ id: 'a', idSuffix: 'b/c' }],
			}),
		];
		const pages = await prerenderRoutes(
			createManifest(routes, { [ENTRY]: Profile, './src/File.tsrx': File }),
			createHandlerOptions(),
		);

		expect(new Set(pages.keys())).toEqual(new Set(['/users/ada/posts/intro', '/files/a/b/c']));
		expect(Profile.mock.calls[0][0].params).toEqual({ user: 'ada', post: 'intro' });
		expect(File.mock.calls[0][0].params).toEqual({ id: 'a', idSuffix: 'b/c' });
		expect(
			parseRippleData(/** @type {string} */ (pages.get('/users/ada/posts/intro'))).params,
		).toEqual({ user: 'ada', post: 'intro' });
		expect(parseRippleData(/** @type {string} */ (pages.get('/files/a/b/c'))).params).toEqual({
			id: 'a',
			idSuffix: 'b/c',
		});
	});

	it('reads each parameter kind from its own segment', () => {
		const spanning = new RenderRoute({
			path: '/files/:id/*idSuffix',
			entry: ENTRY,
			prerender: true,
			entries: [{ id: 'a/b', idSuffix: 'rest' }],
		});
		expect(() => resolveRippleConfig({ router: { routes: [spanning] } })).toThrow(
			/\/files\/:id\/\*idSuffix/,
		);
		const valid = new RenderRoute({
			path: '/files/:id/*idSuffix',
			entry: ENTRY,
			prerender: true,
			entries: [{ id: 'a', idSuffix: 'b/rest' }],
		});
		expect(() => resolveRippleConfig({ router: { routes: [valid] } })).not.toThrow();
	});

	it('rejects a value that would leave an empty segment', () => {
		expectValidEntriesAccepted();
		for (const rest of ['/', 'a//b', '/guide', 'guide/']) {
			const route = new RenderRoute({
				path: '/docs/*rest',
				entry: ENTRY,
				prerender: true,
				entries: [{ rest }],
			});
			expect(() => resolveRippleConfig({ router: { routes: [route] } })).toThrow(/\/docs\/\*rest/);
		}
		const spanning = new RenderRoute({
			path: '/docs/*rest',
			entry: ENTRY,
			prerender: true,
			entries: [{ rest: 'guide/getting-started' }],
		});
		expect(() => resolveRippleConfig({ router: { routes: [spanning] } })).not.toThrow();
	});

	it('rejects a value a path cannot hold as written', () => {
		expectValidEntriesAccepted();
		for (const entries of [
			[{ slug: 'a/b' }],
			[{ slug: 'a b' }],
			[{ slug: 'a?b' }],
			[{ slug: 'a#b' }],
			[{ slug: 'a%b' }],
			[{ slug: '\ud800' }],
		]) {
			const route = new RenderRoute({
				path: '/posts/:slug',
				entry: ENTRY,
				prerender: true,
				entries: /** @type {any} */ (entries),
			});
			expect(() => resolveRippleConfig({ router: { routes: [route] } })).toThrow(/\/posts\/:slug/);
		}
		// a catch-all spans segments, but each of them still has to be usable
		const catchAll = new RenderRoute({
			path: '/docs/*rest',
			entry: ENTRY,
			prerender: true,
			entries: [{ rest: 'guide/a b' }],
		});
		expect(() => resolveRippleConfig({ router: { routes: [catchAll] } })).toThrow(/\/docs\/\*rest/);
		// a pathname carries these as written, so the value stands
		const literal = new RenderRoute({
			path: '/posts/:slug',
			entry: ENTRY,
			prerender: true,
			entries: [{ slug: 'x&y' }, { slug: 'a=b' }, { slug: "o'brien" }],
		});
		expect(() => resolveRippleConfig({ router: { routes: [literal] } })).not.toThrow();
	});

	it('normalizes dot segments like a request path before matching and keying', async () => {
		const Doc = pageComponent();
		const About = pageComponent();
		const routes = [
			new RenderRoute({ path: '/about', entry: './src/About.tsrx', prerender: true }),
			new RenderRoute({
				path: '/docs/*rest',
				entry: './src/Doc.tsrx',
				prerender: true,
				entries: [{ rest: '../about' }, { rest: 'guide/./intro' }, { rest: 'guide/intro' }],
			}),
		];
		const pages = await prerenderRoutes(
			createManifest(routes, { './src/Doc.tsrx': Doc, './src/About.tsrx': About }),
			createHandlerOptions(),
		);

		expect(new Set(pages.keys())).toEqual(new Set(['/about', '/docs/guide/intro']));
		for (const key of pages.keys()) {
			expect(key.split('/')).not.toContain('..');
		}
		expect(About).toHaveBeenCalledTimes(1);
		expect(Doc).toHaveBeenCalledTimes(1);
		expect(Doc.mock.calls[0][0].params).toEqual({ rest: 'guide/intro' });
	});

	it('renders each concrete pathname once and lets a more specific route claim it', async () => {
		const Post = pageComponent();
		const About = pageComponent();
		const routes = [
			new RenderRoute({ path: '/posts/about', entry: './src/About.tsrx', prerender: true }),
			new RenderRoute({
				path: '/posts/:slug',
				entry: ENTRY,
				prerender: true,
				entries: [{ slug: 'hello' }, { slug: 'hello' }, { slug: 'about' }],
			}),
		];
		const pages = await prerenderRoutes(
			createManifest(routes, { [ENTRY]: Post, './src/About.tsrx': About }),
			createHandlerOptions(),
		);

		expect(new Set(pages.keys())).toEqual(new Set(['/posts/about', '/posts/hello']));
		expect(Post).toHaveBeenCalledTimes(1);
		expect(About).toHaveBeenCalledTimes(1);
	});

	it('fails when a listed page normalizes to a pathname no route answers', async () => {
		const routes = [
			new RenderRoute({
				path: '/posts/:slug',
				entry: ENTRY,
				prerender: true,
				entries: [{ slug: '.' }],
			}),
		];
		await expect(
			prerenderRoutes(createManifest(routes, { [ENTRY]: pageComponent() }), createHandlerOptions()),
		).rejects.toThrow(/\/posts/);
	});

	it('fails the way serving the page would when rendering it throws', async () => {
		const fromPage = [
			new RenderRoute({
				path: '/posts/:slug',
				entry: ENTRY,
				prerender: true,
				entries: [{ slug: 'boom' }],
			}),
		];
		await expect(
			prerenderRoutes(
				createManifest(fromPage, {
					[ENTRY]: () => {
						throw new Error('page exploded');
					},
				}),
				createHandlerOptions(),
			),
		).rejects.toThrow(/\/posts\/boom/);

		const routes = [
			new RenderRoute({
				path: '/posts/:slug',
				entry: ENTRY,
				prerender: true,
				entries: [{ slug: 'boom' }],
				before: [
					async () => {
						throw new Error('middleware exploded');
					},
				],
			}),
		];
		await expect(
			prerenderRoutes(createManifest(routes, { [ENTRY]: pageComponent() }), createHandlerOptions()),
		).rejects.toThrow(/\/posts\/boom/);
	});

	it('fails with the pathname when a page does not render with status 200', async () => {
		const routes = [
			new RenderRoute({
				path: '/posts/:slug',
				entry: ENTRY,
				prerender: true,
				entries: [{ slug: 'gone' }],
				before: [
					async (context, next) => {
						if (context.params.slug === 'gone') return new Response('nope', { status: 404 });
						return next();
					},
				],
			}),
		];
		await expect(
			prerenderRoutes(createManifest(routes, { [ENTRY]: pageComponent() }), createHandlerOptions()),
		).rejects.toThrow(/\/posts\/gone/);
	});
});

describe('prerenderRoutes crawling', () => {
	it('follows same-origin anchors into prerenderable routes and ignores the rest', async () => {
		const Home = pageComponent(
			'<nav>' +
				'<a href="/posts/one">one</a>' +
				'<a href="posts/two?ref=nav#top">two</a>' +
				'<a href="http://localhost/posts/three">three</a>' +
				'<a href="https://example.com/posts/four">four</a>' +
				'<a href="/live">live</a>' +
				'<a href="/api/hello">api</a>' +
				'<a href="/nowhere">nowhere</a>' +
				'<a href="mailto:hi@example.com">mail</a>' +
				'<a href="/about">about</a>' +
				'</nav>',
		);
		const Post = pageComponent((props) => `<a href="/posts/${props.params.slug}">self</a>`);
		const routes = [
			new RenderRoute({ path: '/', entry: './src/Home.tsrx', prerender: true, crawl: true }),
			new RenderRoute({ path: '/about', entry: './src/About.tsrx', prerender: true }),
			new RenderRoute({ path: '/live', entry: './src/Live.tsrx' }),
			new RenderRoute({ path: '/posts/:slug', entry: ENTRY, prerender: true, entries: [] }),
			new ServerRoute({ path: '/api/hello', handler: () => new Response('hi') }),
		];
		const pages = await prerenderRoutes(
			createManifest(routes, {
				'./src/Home.tsrx': Home,
				'./src/About.tsrx': pageComponent(),
				'./src/Live.tsrx': pageComponent(),
				[ENTRY]: Post,
			}),
			createHandlerOptions(),
		);

		expect(new Set(pages.keys())).toEqual(
			new Set(['/', '/about', '/posts/one', '/posts/two', '/posts/three']),
		);
		expect(Post).toHaveBeenCalledTimes(3);
		expect(parseRippleData(/** @type {string} */ (pages.get('/posts/two'))).params).toEqual({
			slug: 'two',
		});
	});

	it('crawls discovered pages recursively when their route has crawl, and terminates on cycles', async () => {
		const Doc = pageComponent((props) => {
			const rest = /** @type {string} */ (props.params.rest);
			if (rest === 'intro')
				return '<a href="/docs/guide/setup">setup</a><a href="/docs/intro">me</a>';
			if (rest === 'guide/setup')
				return '<a href="/docs/intro">back</a><a href="/docs/deep">deep</a>';
			return '<a href="/docs/intro">back</a>';
		});
		const Leaf = pageComponent('<a href="/docs/never">never</a>');
		const routes = [
			new RenderRoute({
				path: '/docs/*rest',
				entry: './src/Doc.tsrx',
				prerender: true,
				crawl: true,
				entries: [{ rest: 'intro' }],
			}),
			new RenderRoute({ path: '/leaf', entry: './src/Leaf.tsrx', prerender: true }),
			new RenderRoute({
				path: '/start',
				entry: './src/Start.tsrx',
				prerender: true,
				crawl: true,
			}),
		];
		const pages = await prerenderRoutes(
			createManifest(routes, {
				'./src/Doc.tsrx': Doc,
				'./src/Leaf.tsrx': Leaf,
				'./src/Start.tsrx': pageComponent('<a href="/leaf">leaf</a>'),
			}),
			createHandlerOptions(),
		);

		// /leaf is not crawled (no crawl flag) so /docs/never is never rendered
		expect(new Set(pages.keys())).toEqual(
			new Set(['/docs/intro', '/docs/guide/setup', '/docs/deep', '/leaf', '/start']),
		);
		expect(Doc).toHaveBeenCalledTimes(3);
	});

	it('resolves crawled links against the rendering origin', async () => {
		const Home = pageComponent(
			'<a href="https://site.test/posts/abs">abs</a><a href="http://localhost/posts/local">local</a>',
		);
		const routes = [
			new RenderRoute({ path: '/', entry: './src/Home.tsrx', prerender: true, crawl: true }),
			new RenderRoute({ path: '/posts/:slug', entry: ENTRY, prerender: true, entries: [] }),
		];
		const pages = await prerenderRoutes(
			createManifest(routes, { './src/Home.tsrx': Home, [ENTRY]: pageComponent() }),
			createHandlerOptions(),
			'https://site.test',
		);
		expect(new Set(pages.keys())).toEqual(new Set(['/', '/posts/abs']));
	});

	it('resolves crawled links the way a browser reading the page would', async () => {
		const Home = pageComponent(
			'<head><base href="/posts/"></head>' +
				'<body><a href="two">two</a><a href="/posts/root">root</a></body>',
		);
		const routes = [
			new RenderRoute({
				path: '/elsewhere',
				entry: './src/Home.tsrx',
				prerender: true,
				crawl: true,
			}),
			new RenderRoute({ path: '/posts/:slug', entry: ENTRY, prerender: true, entries: [] }),
		];
		const pages = await prerenderRoutes(
			createManifest(routes, { './src/Home.tsrx': Home, [ENTRY]: pageComponent() }),
			createHandlerOptions(),
		);

		expect(new Set(pages.keys())).toEqual(new Set(['/elsewhere', '/posts/two', '/posts/root']));
	});

	it('ignores a crawled link whose pathname carries an empty segment', async () => {
		const Doc = pageComponent();
		const routes = [
			new RenderRoute({ path: '/', entry: './src/Home.tsrx', prerender: true, crawl: true }),
			new RenderRoute({
				path: '/docs/*rest',
				entry: './src/Doc.tsrx',
				prerender: true,
				entries: [],
			}),
		];
		const pages = await prerenderRoutes(
			createManifest(routes, {
				'./src/Home.tsrx': pageComponent(
					'<a href="/docs/a/">trailing</a><a href="/docs/b//c">interior</a>' +
						'<a href="/docs/plain">plain</a>',
				),
				'./src/Doc.tsrx': Doc,
			}),
			createHandlerOptions(),
		);

		expect(new Set(pages.keys())).toEqual(new Set(['/', '/docs/plain']));
		expect(Doc).toHaveBeenCalledTimes(1);
	});

	it('leaves a character reference without its semicolon alone', async () => {
		const Post = pageComponent();
		const routes = [
			new RenderRoute({ path: '/', entry: './src/Home.tsrx', prerender: true, crawl: true }),
			new RenderRoute({ path: '/posts/:slug', entry: ENTRY, prerender: true, entries: [] }),
		];
		const pages = await prerenderRoutes(
			createManifest(routes, {
				'./src/Home.tsrx': pageComponent(
					'<a href="/posts/&#x63;losed">closed</a><a href="/posts/x&ampy">open</a>',
				),
				[ENTRY]: Post,
			}),
			createHandlerOptions(),
		);

		expect(new Set(pages.keys())).toEqual(new Set(['/', '/posts/closed', '/posts/x&ampy']));
	});

	it('decodes a decimal character reference as well as a hex one', async () => {
		const Post = pageComponent();
		const routes = [
			new RenderRoute({ path: '/', entry: './src/Home.tsrx', prerender: true, crawl: true }),
			new RenderRoute({ path: '/posts/:slug', entry: ENTRY, prerender: true, entries: [] }),
		];
		const pages = await prerenderRoutes(
			createManifest(routes, {
				'./src/Home.tsrx': pageComponent(
					'<a href="/posts/&#98;ar">decimal</a>' +
						'<a href="/posts/&#x62;az">hex</a>' +
						'<a href="/posts/x&#38;y">decimal ampersand</a>',
				),
				[ENTRY]: Post,
			}),
			createHandlerOptions(),
		);

		expect(new Set(pages.keys())).toEqual(new Set(['/', '/posts/bar', '/posts/baz', '/posts/x&y']));
		expect(new Set(Post.mock.calls.map(([props]) => props.params.slug))).toEqual(
			new Set(['bar', 'baz', 'x&y']),
		);
	});

	it('reads a character reference once', async () => {
		const Post = pageComponent();
		const routes = [
			new RenderRoute({ path: '/', entry: './src/Home.tsrx', prerender: true, crawl: true }),
			new RenderRoute({ path: '/posts/:slug', entry: ENTRY, prerender: true, entries: [] }),
		];
		const pages = await prerenderRoutes(
			createManifest(routes, {
				// `&amp;` yields an ampersand; what follows it is text, not a
				// second reference to decode
				'./src/Home.tsrx': pageComponent('<a href="/posts/keep&amp;#x63;">escaped</a>'),
				[ENTRY]: Post,
			}),
			createHandlerOptions(),
		);

		expect(new Set(pages.keys())).toEqual(new Set(['/', '/posts/keep&']));
	});

	it('fails with the crawled pathname when a discovered page does not render with status 200', async () => {
		const routes = [
			new RenderRoute({ path: '/', entry: './src/Home.tsrx', prerender: true, crawl: true }),
			new RenderRoute({
				path: '/posts/:slug',
				entry: ENTRY,
				prerender: true,
				entries: [],
				before: [
					async (context, next) => {
						if (context.params.slug === 'broken') return new Response('boom', { status: 500 });
						return next();
					},
				],
			}),
		];
		await expect(
			prerenderRoutes(
				createManifest(routes, {
					'./src/Home.tsrx': pageComponent('<a href="/posts/broken">broken</a>'),
					[ENTRY]: pageComponent(),
				}),
				createHandlerOptions(),
			),
		).rejects.toThrow(/\/posts\/broken/);
	});

	it('reads real anchor elements only, with quoted attributes and character references', async () => {
		const Home = pageComponent(
			'<a title="2 > 1" href="/posts/gt">gt</a>' +
				"<a class='x' href='/posts/single'>single</a>" +
				'<A HREF=/posts/upper>upper</A>' +
				'<a href="/posts/amp?a=1&amp;b=2">amp</a>' +
				'<a href="/posts/o&apos;brien">apostrophe</a>' +
				'<a href="/posts/q&quot;t&lt;u&gt;v">quote angle</a>' +
				'<a href="/posts/a&lt;b">lt</a>' +
				'<a href="/posts/a&gt;b">gt escape</a>' +
				'<a href="/posts/x&constructor;">not a reference</a>' +
				'<a href="/posts/&#x63;ode">code</a>' +
				'<abbr href="/posts/abbr">abbr</abbr>' +
				'<!-- <a href="/posts/commented">commented</a> -->' +
				'<script>const s = \'<a href="/posts/scripted">s</a>\';</script>' +
				'<style>a[href="/posts/styled"] { color: red }</style>' +
				'<textarea><a href="/posts/typed">typed</a></textarea>' +
				'<title><a href="/posts/titled">titled</a></title>' +
				'<a href="/posts/after">after</a>',
		);
		const Post = pageComponent();
		const routes = [
			new RenderRoute({ path: '/', entry: './src/Home.tsrx', prerender: true, crawl: true }),
			new RenderRoute({ path: '/posts/:slug', entry: ENTRY, prerender: true, entries: [] }),
		];
		const pages = await prerenderRoutes(
			createManifest(routes, { './src/Home.tsrx': Home, [ENTRY]: Post }),
			createHandlerOptions(),
		);

		expect(new Set(pages.keys())).toEqual(
			new Set([
				'/',
				'/posts/gt',
				'/posts/single',
				'/posts/upper',
				'/posts/amp',
				"/posts/o'brien",
				'/posts/x&constructor;',
				'/posts/code',
				'/posts/after',
			]),
		);
		expect(new Set(Post.mock.calls.map(([props]) => props.params.slug))).toEqual(
			new Set(['gt', 'single', 'upper', 'amp', "o'brien", 'x&constructor;', 'code', 'after']),
		);
		expect(Post).toHaveBeenCalledTimes(8);
		// decoded, the quote and the angle brackets need percent escapes, so
		// those links are not pages; left undecoded they would have been
		for (const key of pages.keys()) {
			expect(key).not.toContain('quot');
			expect(key).not.toContain('%22');
			expect(key).not.toContain('lt;');
			expect(key).not.toContain('gt;');
			expect(key).not.toContain('%3C');
			expect(key).not.toContain('%3E');
		}
	});
});

/**
 * Type-checks a source file against the package's shipped declarations with
 * the repository's own compiler, from a directory inside the package so that
 * its dependencies resolve exactly as they do for a consumer.
 *
 * @param {string} source
 * @returns {{ status: number, output: string }}
 */
function typeCheck(source) {
	const packageDir = REPO_ROOT + 'packages/vite-plugin/';
	const directory = mkdtempSync(packageDir + '.types-');
	try {
		writeFileSync(
			directory + '/tsconfig.json',
			JSON.stringify({ extends: '../tsconfig.json', include: ['./fixture.ts'] }),
		);
		writeFileSync(directory + '/fixture.ts', source);
		const compiler = ['tsgo', 'tsc']
			.map((name) => REPO_ROOT + 'node_modules/.bin/' + name)
			.find((candidate) => existsSync(candidate));
		if (compiler === undefined) {
			throw new Error('no TypeScript compiler in node_modules/.bin');
		}
		const result = spawnSync(compiler, ['--noEmit', '-p', directory + '/tsconfig.json'], {
			cwd: REPO_ROOT,
			encoding: 'utf-8',
		});
		return { status: result.status ?? 1, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
}

describe('the declared and documented surface', () => {
	it('declares both options for TypeScript consumers', () => {
		const { status, output } = typeCheck(`import { RenderRoute } from '../types/index';

const entry = './src/Post.tsrx';

new RenderRoute({
	path: '/posts/:slug',
	entry,
	prerender: true,
	entries: [{ slug: 'a' }],
	crawl: true,
});

new RenderRoute({
	path: '/docs/*rest',
	entry,
	prerender: true,
	entries: () => [{ rest: 'guide/intro' }],
});

new RenderRoute({
	path: '/docs/*rest',
	entry,
	prerender: true,
	entries: async () => [{ rest: 'guide/intro' }],
});
`);
		expect(output.match(/error TS\d+[^\n]*/g) ?? []).toEqual([]);
		expect(status).toBe(0);
	});

	it('documents both options in the application guide', () => {
		for (const guide of [
			'website-new/docs/guide/application.md',
			'website/docs/guide/application.md',
		]) {
			const text = readRepoFile(guide);
			const heading = text.match(/^(#{1,6})[ \t]+Static Generation[ \t]*$/m);
			expect(heading, `no Static Generation heading in ${guide}`).not.toBeNull();
			const body = text.slice(/** @type {number} */ (heading?.index) + heading[0].length);
			const next = body.search(new RegExp(`^#{1,${heading[1].length}}[ \t]`, 'm'));
			const section = next === -1 ? body : body.slice(0, next);
			expect(section).toContain('entries');
			expect(section).toContain('crawl');
		}
	});
});
