local M = {}

---Entrypoint invoked by plugin managers.
---@param opts? {treesitter?: table|boolean, lsp?: table|boolean}
function M.setup(opts)
	opts = opts or {treesitter = { ensure_installed = true }, lsp = {}}

	if opts.treesitter ~= false then
		require("ripple.treesitter").setup(opts.treesitter or {})
	end

	if opts.lsp ~= false then
		require("ripple.lsp").setup(opts.lsp or {})
	end
end

return M
