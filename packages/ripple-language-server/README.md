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

### Editor Integration

This language server can be integrated into any editor that supports LSP:

#### VS Code

Use the [official extension](https://marketplace.visualstudio.com/items?itemName=ripplejs.ripple-vscode-plugin) instead.
It uses this language server internally.

#### WebStorm/IntelliJ

1. Install the [LSP4IJ plugin](https://plugins.jetbrains.com/plugin/23257-lsp4ij).
2. Add a new language server in it
3. Specify `ripple-language-server --stdio` as the command in it.
4. Go to `Mappings` —> `File name patterns` and add a new value with `File name patterns` set to `*.ripple` and `Language Id` set to `ripple.

#### Neovim

TODO Write instructions

#### Sublime Text

TODO Write instructions
