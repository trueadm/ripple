local M = {}

---@param opts? table
function M.setup(opts)
	opts = opts or {}

	local ok, lspconfig = pcall(require, "lspconfig")
	if not ok then
		vim.schedule(function()
			vim.notify("[ripple] nvim-lspconfig not found; skipping LSP setup", vim.log.levels.WARN)
		end)
		return
	end

	local configs = require("lspconfig.configs")
	local util = require("lspconfig.util")

	local default_cmd = { "ripple-language-server", "--stdio" }
	local default_root = util.root_pattern("package.json", "pnpm-workspace.yaml", ".git")

	if not configs.ripple then
		configs.ripple = {
			default_config = {
				cmd = default_cmd,
				filetypes = { "ripple" },
				root_dir = default_root,
				settings = {},
				single_file_support = true,
			},
			docs = {
				description = [[
https://github.com/trueadm/ripple

Ripple language server providing diagnostics, IntelliSense, and navigation for .ripple files.
]],
				default_config = {
					cmd = default_cmd,
					root_dir = "vim.fs.find({ 'package.json', 'pnpm-workspace.yaml', '.git' }, { upward = true })",
				},
			},
		}
	end

	local server_opts = vim.tbl_deep_extend("force", {}, opts)
	server_opts.cmd = server_opts.cmd or default_cmd
	server_opts.filetypes = server_opts.filetypes or { "ripple" }
	server_opts.settings = server_opts.settings or {}
	if server_opts.single_file_support == nil then
		server_opts.single_file_support = true
	end

	if type(server_opts.root_dir) ~= "function" then
		server_opts.root_dir = default_root
	end

	lspconfig.ripple.setup(server_opts)
end

return M
