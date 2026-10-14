---
title: Creating a Ripple application
---

# Creating a Ripple application

We'll start with this code snippet, and break it down step by step.

```js
import { mount } from 'ripple';
// @ts-expect-error: known issue, we're working on it
import { App } from './App.tsrx';

mount(App, {
	target: document.getElementById('app')!,
});
```

## The Root Component

The `App` "object" we've imported is actually a component. Every app requires a
"root component" that can contain other components as its children.

While many examples in this guide only need a single component, most real
applications are organized into a tree of nested, reusable components. For
example, a Todo application's component tree might look like this:

```text
App (root component)
├─ TodoList
│  └─ TodoItem
│     ├─ TodoDeleteButton
│     └─ TodoEditButton
└─ TodoFooter
   ├─ TodoClearButton
   └─ TodoStatistics
```

In later sections of the guide, we will discuss how to define and compose multiple
components together. Before that, we will focus on what happens inside a single
component.

## Mounting the App

To bring the app to life, we'll use the `mount` function that we imported to
attach the application to the DOM.

`mount()` expects a component, and an options object. Inside the options object,
we'll use `document.getElementById()` to acquire a reference to the DOM element we
want the app to be attached to the `target` property.

## Hydration

When using server-side rendering (SSR), the server pre-renders your components to
HTML. The client then needs to "hydrate" this HTML by attaching event listeners
and making it interactive, without re-creating the DOM elements.

Ripple provides the `hydrate()` function for this purpose:

```js
import { hydrate } from 'ripple';
import { App } from './App.tsrx';

hydrate(App, {
  target: document.getElementById('app')!,
});
```

### When to use `mount()` vs `hydrate()`

| Function    | Use Case                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------- |
| `mount()`   | Client-side only rendering (SPA). Clears the target element and renders fresh.              |
| `hydrate()` | Server-side rendering (SSR). Adopts existing server-rendered HTML and makes it interactive. |

### Client-Only Builds

An app that only ever calls `mount()` can tell the Vite plugin so, and its
bundle shrinks: components compile to plain DOM reads instead of the hydration
cursor, `track()` calls carry no serialization hashes, and the runtime's
hydration paths are left out entirely.

```js
// vite.config.js
import { defineConfig } from 'vite';
import { ripple } from '@ripple-ts/vite-plugin';

export default defineConfig({
  plugins: [ripple({ ssr: false })],
});
```

`hydrate()` throws in such a build, and the option is rejected when
`ripple.config.ts` declares render routes, since those are server rendered and
hydrated. The opposite override, `ssr: true`, compiles every module for the
server; it is meant for an adapter that drives the build itself. Leave the
option unset for an app with render routes so Vite's client and server
environments each get the output they need.

The default root try/pending/catch boundary can be left out the same way. An
app that mounts with `rootBoundary: false` never uses it, so
`ripple({ rootBoundary: false })` drops the boundary runtime from the bundle; a
`rootBoundary` option on `mount()` or `hydrate()` then throws, the plugin
option is rejected when `ripple.config.ts` configures a root boundary, and
`trackAsync()` must sit inside a user `@try` block.

### Server-Side Rendering

On the server, use `render()` from `ripple/server`. It is asynchronous — the
returned promise resolves once all async work (`trackAsync`) has settled — and
it resolves an object, not a string:

- `body` — HTML for the app's insertion point, including hydration markers.
- `head` — HTML for the document head, collected from `<head>` writes such as
  `<title>` and `<meta>`.
- `css` — a `Set` of scoped style hashes collected during the render. Pass it
  to `getCss()` and emit the result in a `<style data-ripple-ssr>`
  tag so hydration can later swap it for the client styles.
- `topLevelError` — the error that reached the root boundary, if any.

```js
// server.js
import { render, getCss } from 'ripple/server';
import { App } from './App.tsrx';

const { head, body, css } = await render(App);

res.send(`
  <!DOCTYPE html>
  <html>
    <head>
      ${head}
      <style data-ripple-ssr>${getCss(css)}</style>
    </head>
    <body>
      <div id="app">${body}</div>
      <script type="module" src="/client.js"></script>
    </body>
  </html>
`);
```

`render()` takes the component itself. To render with props, wrap the
component in a function that applies them, and pass the same props to
`hydrate()` on the client:

```js
// server.js
const Root = () => App({ title: 'Hello world!' });
const { head, body, css } = await render(Root);
```

```js
// client.js
import { hydrate } from 'ripple';
import { App } from './App.tsrx';

hydrate(App, {
  target: document.getElementById('app')!,
  props: { title: 'Hello world!' }
});
```

### Root Boundaries

`render()` accepts a `rootBoundary`: app-level `pending` and `catch`
components wrapped around the root, used when no `@try` boundary inside the
app handles a suspension or an error. Pass the same `rootBoundary` to
`hydrate()` so the server and client agree on the boundary structure.

```js
const { head, body, css } = await render(App, {
  rootBoundary: {
    pending: LoadingScreen,
    catch: ErrorScreen,
  },
});
```

### Streaming SSR

Buffered rendering holds the whole response until the slowest data has
resolved. Streaming sends bytes as soon as they exist:

1. The **shell** flushes immediately: all synchronous HTML, with each
   suspended `@try` boundary showing its `@pending` fallback, plus all CSS
   collected so far. The browser starts painting and fetching assets while the
   server is still waiting on data.
2. As each boundary's async work settles, its HTML streams as a
   self-contained chunk — carrying its own CSS, serialized `trackAsync`
   results, and `<head>` content — and a small inline runtime (shipped once
   with the shell) swaps it into the boundary's slot. Chunks arrive in
   whatever order the data resolves; parent boundaries always arrive before
   nested ones.
3. A boundary with only `@catch` streams an empty slot that later resolves to
   its body — or to the server-rendered catch HTML if the data failed. An
   error whose boundary is already on the wire is handed to the client
   boundary during hydration instead.

Async work must sit under a `@try` boundary that has `@pending` (or under the
root boundary's `pending`) — the fallback is what occupies the slot in the
shell.

Enable streaming by passing a `stream` sink. `streamTemplate` wraps the stream
in a document: `before` and `between` frame the SSR head content and the shell
body in the first write, and `after` is pushed once the last chunk has
streamed.

```js
import { render, createStream } from 'ripple/server';
import { App } from './App.tsrx';

const { stream, sink } = createStream();

render(App, {
  stream: sink,
  rootBoundary: { pending: LoadingScreen },
  streamTemplate: {
    before: '<!DOCTYPE html><html><head>',
    between: '</head><body><div id="app">',
    after: '</div><script type="module" src="/client.js"></script></body></html>',
  },
});

return new Response(stream, {
  headers: { 'Content-Type': 'text/html; charset=utf-8' },
});
```

`hydrate()` needs no extra configuration for streaming: content that arrived
before hydration is adopted normally, and chunks that arrive afterwards
activate their boundary in place without re-rendering. Set
`closeStream: false` when you need the sink to stay open for writes of your
own after rendering finishes.

### Streaming With The Vite Plugin

Apps built on `@ripple-ts/vite-plugin` do not call `render()` directly. Enable
streaming for render routes in `ripple.config.ts`:

```ts
export default {
  ssr: {
    streaming: true,
  },
};
```

The plugin splits `index.html` at the `<!--ssr-head-->` and `<!--ssr-body-->`
markers to build the stream scaffold, so both markers must stay in the
template. When they are missing, the plugin falls back to buffered SSR and
logs a warning.

Root boundaries are configured the same way — set `rootBoundary` in
`ripple.config.ts` and the plugin applies it to the server render and to
client hydration for every render route. Name each component by module, like a
route `entry`: a path uses the module's default export (or else its first
capitalized function export), and an `[exportName, path]` tuple picks a named
export. The browser imports these modules directly; `ripple.config.ts` stays
on the server with the adapter and middlewares.

```ts
export default {
  rootBoundary: {
    pending: '/src/LoadingScreen.tsrx',
    catch: ['ErrorScreen', '/src/screens.tsrx'],
  },
  ssr: {
    streaming: true,
  },
};
```

### Custom Serialization

Use `transport` in `ripple.config.ts` when `trackAsync` or a server function
returns a custom type. Each named handler encodes values for devalue and decodes
them back into application values. Hydration and RPC share these handlers, and
RPC uses them for both arguments and return values.

Define the handlers in their own module and name it in the config: a path uses
the module's default export, and an `[exportName, path]` tuple picks a named
export. The browser imports that module directly, never `ripple.config.ts`.

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

Both handlers must be synchronous, and the module and its imports must be
browser compatible. `encode` returns
truthy serializable data for a value it recognizes, or `false`/`undefined` to
leave it to other handlers and devalue's built-in types. Wrap falsy encoded data
in an array or object. `decode` reconstructs the value from the encoded data.
Handlers can also recognize plain objects by shape.

Without a transport, or with an empty one, plain hydration data travels as raw
JSON. Other values use devalue. Configuring a nonempty transport sends all
hydration results through devalue, allowing encoders to recognize any value.
RPC always uses devalue.

The Vite plugin registers the transport automatically. With your own server and
client entries, call `setTransport(transport)` from `ripple/server` before
rendering or serving RPC and from `ripple` in the browser before `hydrate()`,
`mount()`, or RPC calls. Registration applies to the whole application; use
matching handlers on both sides. Calling `setTransport()` or `setTransport({})`
restores built-in serialization.

### Static Generation

Pages whose content does not depend on the request can be rendered once at
build time. `prerender()` from `ripple/server` is the static counterpart of
`render()`: it is buffered, resolves once every `@try` boundary and
`trackAsync` has settled, and returns the scoped CSS as text:

```ts
import { prerender } from 'ripple/server';
import { App } from './App.tsrx';

const { head, body, css } = await prerender(App);
const html = template
  .replace('<!--ssr-head-->', `${head}<style data-ripple-ssr>${css}</style>`)
  .replace('<!--ssr-body-->', body);
```

With the Vite plugin, mark the render routes to prerender instead:

```ts
import { defineConfig, RenderRoute } from '@ripple-ts/vite-plugin';

export default defineConfig({
  router: {
    routes: [
      new RenderRoute({ path: '/', entry: './src/Home.tsrx', prerender: true }),
      new RenderRoute({ path: '/dashboard', entry: './src/Dashboard.tsrx' }),
    ],
  },
});
```

After the server build, the plugin renders each marked route through the
production server entry and writes `<outDir>/client<path>/index.html`. The
node and bun adapters serve that file for the route before the server renders
anything, with a cache policy that revalidates on every request, and the page
hydrates exactly like a server-rendered one. Routes without the flag keep
rendering per request, so static and dynamic pages mix freely in one app.

A path with a `:param` or `*` segment names its pages with `entries`: an array
of records giving every parameter a string, or a function (sync or async) that
returns one and runs once at build time. A value goes into the pathname as
written, so it has to be one a path can hold: a value percent-encoding would
change is a configuration error, and only a `*` value may span segments. Each
pathname is then normalized like a request URL, with dot segments
collapsed, and routed like a request,
so a more specific route renders the pathnames it claims and every pathname
renders once. `crawl` follows
the same-origin links of a route's prerendered pages into any other prerendered
route, and keeps going through routes that also set `crawl`, so a blog index
can pull in posts its `entries` never listed:

```ts
new RenderRoute({
  path: '/posts/:slug',
  entry: './src/Post.tsrx',
  prerender: true,
  entries: async () => (await listPosts()).map((post) => ({ slug: post.slug })),
}),
new RenderRoute({ path: '/', entry: './src/Home.tsrx', prerender: true, crawl: true }),
```

A prerendered parameterized route without `entries`, or `entries` or `crawl` on
a route that does not fit them, is a configuration error, and a page that does
not render with status 200 fails the build with its pathname.

### Cleanup

Both `mount()` and `hydrate()` return a cleanup function that unmounts the
component:

```js
const cleanup = mount(App, { target: document.getElementById('app')! });

// Later, to unmount:
cleanup();
```
