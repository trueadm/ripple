local M = {}

function M.setup()
	require("ripple.treesitter").setup()
	require("ripple.lsp").setup()
end

return M
