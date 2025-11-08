local M = {}

function M.setup(plugin)
	vim.filetype.add {
		extension = {
			ripple = "ripple",
		},
	}

	require("ripple.treesitter").setup("Z:/ripple/ripple")
	require("ripple.lsp").setup()
end

return M
