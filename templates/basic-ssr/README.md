# Ripple SSR Template

A Ripple application template with server-side rendering (SSR), TypeScript, and Vite.

## Features

- Server-side rendering for better SEO and initial load performance
- Hot module replacement in development
- TypeScript support
- ESLint and Prettier configured

> **Note:** Hydration is not yet fully implemented. Currently, the client re-renders the entire app after receiving the server-rendered HTML. True hydration (attaching event handlers without re-rendering) is coming soon.

## Getting Started

1. Install dependencies:

    ```bash
    npm install # or pnpm or yarn
    ```

2. Start the SSR development server:

    ```bash
    npm run dev
    ```

    This starts the Ripple SSR server with hot reloading support.

3. Build for production:
    ```bash
    npm run build
    ```

## How SSR Works

The `ripple serve` command starts a development server that:

1. Renders your Ripple components on the server
2. Sends pre-rendered HTML to the browser
3. Hydrates the HTML with client-side JavaScript for interactivity
4. Provides hot module replacement for fast development

### HTML Template

The `index.html` file contains special SSR placeholders:

- `<!--ssr-head-->` - Server-rendered head content (styles, meta tags)
- `<!--ssr-body-->` - Server-rendered body content

### Hydration (Coming Soon)

> **Note:** True hydration is not yet implemented. The `hydrate: true` option is a placeholder for future support.

The client-side entry (`src/index.ts`) calls `mount()` with `hydrate: true`. Currently this re-renders the app, but once hydration is implemented, it will attach event handlers to the server-rendered HTML without re-rendering.

## Scripts

- `npm run dev` - Start the SSR development server
- `npm run build` - Build for production
- `npm run preview` - Preview the production build
- `npm run lint` - Run ESLint
- `npm run format` - Format all files with Prettier
- `npm run format:check` - Check if files are formatted

## Learn More

- [Ripple Documentation](https://github.com/Ripple-TS/ripple)
- [Vite Documentation](https://vitejs.dev/)
