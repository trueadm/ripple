# Ripple Neovim Plugin

Neovim integration for the [Ripple](https://github.com/trueadm/ripple) language.

## Requirements

- Neovim 0.9 or newer
- [nvim-treesitter](https://github.com/nvim-treesitter/nvim-treesitter)
- [nvim-lspconfig](https://github.com/neovim/nvim-lspconfig)
- [`ripple-language-server`](https://www.npmjs.com/package/ripple-language-server) (`npm install -g ripple-language-server` or project-local)

## Installation

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

### Tree-sitter

`require("ripple").setup()` registers the Ripple parser with `nvim-treesitter` and points it at the bundled grammar source:

- Repository: `https://github.com/trueadm/ripple`
- Subdirectory: `packages/tree-sitter-ripple`
- Files: `src/parser.c`, `src/scanner.c`

### Language Server

The plugin registers a `ripple` server in `lspconfig` that uses the existing `ripple-language-server`.
You can keep the npm package either globally (`npm install -g ripple-language-server`) or locally within your project (`npm install --save-dev ripple-language-server`).
