---
'@ripple-ts/vite-plugin': minor
---

feat: prerender parameterized render routes. `entries` on a `RenderRoute` names the pages of a `:param` or `*` path to render at build time, as records or a function returning them, and `crawl` follows the same-origin links of a prerendered route's pages into other prerendered routes. Every pathname is normalized and goes through the request router, and renders once.
