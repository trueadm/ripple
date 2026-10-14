# @ripple-ts/vite-plugin

```js
import { ripple } from '@ripple-ts/vite-plugin';

export default {
  plugins: [ripple()],
};
```

## Plugin and compiler options

The options passed to `ripple()` configure the Vite integration. `rootBoundary`
controls runtime code in the bundle, `excludeRippleExternalModules` skips the
initial package scan, and `textTypes` manages a TypeScript project whose per-file
`textTypeFacts` are passed to the compiler. They belong at the top level of the
plugin options, not in `CompileOptions`.

Vite derives the compiler's `mode`, `dev`, `hmr`, and `hydration` options from the
build environment and the plugin's `ssr` option. When using
[`compile()` directly](../tsrx-ripple/README.md), pass compiler options as its
third argument; the Rollup plugin accepts them under `compilerOptions`.

## Static generation

Mark a render route with `prerender: true` to render it at build time:

```ts
new RenderRoute({ path: '/', entry: './src/Home.tsrx', prerender: true });
```

After the server build the plugin renders each marked route through the built
server entry, buffered with every boundary settled, and writes
`<outDir>/client<path>/index.html`. The node and bun adapters serve that file for
the route before the server renders anything, and the page hydrates like a
server-rendered one. A path with `:param` or `*` segments names its pages with
`entries`, an array of records giving every parameter a string or a function
returning one at build time, and `crawl` follows the same-origin links of a
route's prerendered pages into other prerendered routes:

```ts
new RenderRoute({
  path: '/posts/:slug',
  entry: './src/Post.tsrx',
  prerender: true,
  entries: [{ slug: 'hello' }, { slug: 'world' }],
});
new RenderRoute({
  path: '/',
  entry: './src/Home.tsrx',
  prerender: true,
  crawl: true,
});
```

Crawled links resolve as a browser reading the page would, including through a
`<base>` element. Each pathname is normalized and matched like a request URL, and
rendered once. `prerender()` from `ripple/server` does the same for a component
outside the plugin.

## Client-only builds

An app that never hydrates server-rendered HTML can say so:

```js
ripple({ ssr: false });
```

Components then compile to bare DOM reads instead of the hydration cursor,
`track()` calls carry no serialization hashes, and the runtime's hydration paths
are left out of the bundle. `hydrate()` throws in such a build, and the option is
rejected when `ripple.config.ts` declares render routes, which are server rendered
and hydrated. `ssr: true` is the opposite override: every module compiles for the
server, for an adapter that drives the build itself.

## Root boundary

`mount()` and `hydrate()` render the app under a default try/pending/catch
boundary. An app that renders without one, passing `rootBoundary: false` to
`mount()`, can leave the boundary runtime out of its bundle:

```js
ripple({ rootBoundary: false });
```

A `rootBoundary` option on `mount()` or `hydrate()` then throws, the option is
rejected when `ripple.config.ts` configures a root boundary, and `trackAsync()`
must sit inside a user `@try` block.

## Module preload polyfill

Production builds leave Vite's `modulepreload` polyfill out: every current browser
supports `<link rel="modulepreload">`, and the polyfill only matters for dynamic
imports with preloadable dependencies. Set `build.modulePreload` in your Vite
config to keep it.

## Optional TypeScript text inference

To use the TypeScript checker to recognize primitive DOM children from imported
types and function return types, enable `textTypes`:

```js
ripple({ textTypes: { tsconfig: 'tsconfig.json' } });
```

The tsconfig path resolves from Vite's project root. Install TypeScript 5.9.3 or
newer and enable `strictNullChecks`. The option applies only to one-shot
production builds. Development servers, HMR, and watched builds use local syntax
inference.

Ripple's automatic client/server build shares one checker snapshot and fails if
its inputs change during the build. Independently invoked client and server builds
must use the same option, tsconfig, and stable source tree. Each fresh build
reevaluates imported types and recompiles eligible cached modules.

See [`@tsrx/ripple`](../tsrx-ripple/README.md#primitive-text-inference) for the
inference boundaries and the direct compiler API.

## Custom serialization

Define `transport` handlers in a module and name it in `ripple.config.ts` to share
custom types between the server and browser. The same handlers serialize
`trackAsync` hydration results and RPC arguments/results in both directions:

```ts
// src/transport.ts
import type { Transport } from 'ripple';
import { Money } from './money';

export const transport: Transport = {
  Money: {
    encode: (value) => value instanceof Money && [value.amount, value.currency],
    decode: ([amount, currency]) => new Money(amount, currency),
  },
};
```

```ts
// ripple.config.ts
import { defineConfig } from '@ripple-ts/vite-plugin';

export default defineConfig({
  transport: ['transport', '/src/transport.ts'],
});
```

A path alone uses the module's default export. The browser's hydration entry
imports this module (and the `rootBoundary` component modules) directly, never
`ripple.config.ts`, so the config's adapter, middlewares and their imports stay on
the server.

Handlers are synchronous and must run in both environments, so the module's
imports must be browser compatible. `encode` returns truthy serializable data when
it recognizes a value, or `false`/`undefined` otherwise. Wrap falsy encoded data
in an array or object. `decode` reconstructs the value from that data. Encoders
can also recognize plain objects by shape.

Without a transport, or with an empty one, plain data in hydration payloads
travels as raw JSON; values requiring devalue retain its built-in encoding. A
nonempty transport uses devalue for all hydration payloads so every value can be
offered to the encoders. RPC always uses devalue. The plugin registers the
transport automatically before rendering, hydration, and RPC handling.
