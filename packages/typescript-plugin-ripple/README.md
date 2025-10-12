# typescript-plugin-ripple

TypeScript plugin for Ripple that provides language support for `.ripple` files.

## Usage

### VS Code

**If you're using VS Code with the Ripple extension, you don't need to configure this plugin!** The Ripple language server handles everything automatically.

### Other Editors or Standalone Usage

For editors that don't use the Ripple language server (like WebStorm, Sublime Text, or command-line `tsc`), add this plugin to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "jsx": "preserve",
    "jsxImportSource": "ripple",
    "plugins": [
      {
        "name": "typescript-plugin-ripple"
      }
    ]
  }
}
```

## What it does

This plugin:
- Registers `.ripple` files as a recognized TypeScript language
- Transforms Ripple syntax to TypeScript for type checking
- Integrates with Volar for virtual code generation and source mapping

## Architecture Note

This plugin uses Volar's TypeScript plugin system. When configured in `tsconfig.json`, TypeScript's tsserver will load this plugin and create a language service instance.

The Ripple VS Code extension uses a language server instead, which provides the same functionality plus additional features like diagnostics and formatting. Both can coexist (they create separate instances), but you only need one.
