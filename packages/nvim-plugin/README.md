# Ripple Neovim Plugin

Neovim integration for the [Ripple](https://github.com/trueadm/ripple) language.

## Requirements

- Neovim 0.11 or newer
- [nvim-treesitter](https://github.com/nvim-treesitter/nvim-treesitter)
- Node.js v18 or newer

## Installation

<details>
<summary>with lazy.nvim</summary>

```lua
{
  "Ripple-TS/ripple",
  config = function(plugin)
    vim.opt.rtp:append(plugin.dir .. "/packages/nvim-plugin")
    require("ripple").setup(plugin)
  end
}
```

</details>

If you're using another plugin manager and wish to share installation instructions, please consider opening a PR.

### Tree-sitter

`require("ripple").setup()` registers the Ripple parser with `nvim-treesitter` and points it at the bundled grammar source:

- Repository: `https://github.com/trueadm/ripple`
- Subdirectory: `packages/tree-sitter`
- Files: `src/parser.c`, `src/scanner.c`
