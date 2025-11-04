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
npm install ripple-language-server -g
```

## Editor Integration

This language server can be integrated into any editor that supports LSP. There are also specialized plugins for popular editors.

#### VS Code

Use the [official extension](https://marketplace.visualstudio.com/items?itemName=ripple-ts.vscode-plugin
It uses this language server internally.

#### WebStorm/IntelliJ

1. Install the language server:
    ```bash
    npm install ripple-language-server -g
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
     "trueadm/ripple",
     dir = "packages/ripple-nvim-plugin",
     config = true,
   }
   ```

   </details>

   If you're using another plugin manager and wish to share installation instructions, please consider opening a PR.

#### Sublime Text

Until the plugin lands on Package Control you need to install it from the packaged release:

1. Make sure [Package Control](https://packagecontrol.io/installation) is installed, then install the [LSP](https://packagecontrol.io/packages/LSP) package (`Tools → Command Palette… → Package Control: Install Package → LSP`).
2. Download the latest `Ripple.sublime-package` from the Ripple Sublime Text plugin (see `packages/ripple-sublime-text-plugin/README.md` in this repository for details).
3. In Sublime Text, open `Preferences → Browse Packages…`, go up one level, and open the `Installed Packages/` directory.
4. Copy the `Ripple.sublime-package` file into `Installed Packages/` and restart Sublime Text.

Ensure Node.js `>= 18` is available on your `PATH`, then open a `.ripple` file to start receiving diagnostics, completions, and other language features.
