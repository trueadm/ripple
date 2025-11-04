# ripple-language-server

Language Server Protocol (LSP) implementation for Ripple. This package provides language intelligence features for
Ripple files and can be integrated into any editor that supports LSP.

## Features

- TypeScript integration via Volar
- Ripple syntax diagnostics
- IntelliSense and autocomplete
- Go to definition
- Find references
- Hover information

## Installation

```bash
npm install @ripple-ts/language-server -g
```

## Editor Integration

This language server can be integrated into any editor that supports LSP. There are also specialized plugins for popular editors.

#### VS Code

Use the [official extension](https://marketplace.visualstudio.com/items?itemName=ripple-ts.vscode-plugin
It uses this language server internally.

#### WebStorm/IntelliJ

1. Install the language server:
    ```bash
    npm install @ripple-ts/language-server -g
    ```
2. Install the [LSP4IJ plugin](https://plugins.jetbrains.com/plugin/23257-lsp4ij).
3. Add a new language server in it
4. Specify `ripple-language-server --stdio` as the command in it.
5. Go to `Mappings` —> `File name patterns` and add a new value with `File name patterns` set to `*.ripple` and `Language Id` set to `ripple.

#### Neovim (v0.11+)

Use the official plugin.

1. Install [`nvim-treesitter`](https://github.com/nvim-treesitter/nvim-treesitter).
2. Install the plugin.

   <details>
   <summary>with lazy.nvim</summary>

   ```lua
   {
     "Ripple-TS/ripple",
     dir = "packages/nvim-plugin",
     config = true,
   }
   ```

   </details>

   If you're using another plugin manager and wish to share installation instructions, please consider opening a PR.

#### Sublime Text

Until the plugin lands on Package Control you need to install it from the packaged release:

1. Make sure [Package Control](https://packagecontrol.io/installation) is installed, then install the [LSP](https://packagecontrol.io/packages/LSP) package (`Tools → Command Palette… → Package Control: Install Package → LSP`).
2. Clone this repository.
3. Go into `packages/sublime-text-plugin/` directory and run:
   ```bash
   npm run build
   ```
   This will create a `Ripple.sublime-package` file in the same directory.
4. In Sublime Text, open `Preferences → Browse Packages…`, go up one level, and open the `Installed Packages/` directory.
5. Copy the `Ripple.sublime-package` file into `Installed Packages/` and restart Sublime Text.

Diagnostics, completions, and other features should work in `.ripple` files now.

## Standalone Usage

You can use the language server in any other editor that supports LSP. You can install it globally:
```bash
npm install -g @ripple-ts/language-server
```

Then run the server with:
```bash
ripple-language-server --stdio
```

Or you can run it via `npx` without installing:
```bash
npx @ripple-ts/language-server --stdio
```
