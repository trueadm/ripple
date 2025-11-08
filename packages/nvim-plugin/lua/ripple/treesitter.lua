local M = {}

function M.setup(dir)
	local ok, parsers = pcall(require, "nvim-treesitter.parsers")
	if not ok then
		vim.schedule(function()
			vim.notify("[ripple] nvim-treesitter not found; skipping parser registration", vim.log.levels.WARN)
		end)
		return
	end

	local parser_config = parsers.get_parser_configs()
	local default_install = {
		url = dir,
		files = {
			"src/parser.c",
			"src/scanner.c",
		},
		branch = "main",
		location = "packages/tree-sitter",
	}

	local config = parser_config.ripple or {}
	local install_info = config.install_info or {}
	config.install_info = vim.tbl_deep_extend("force", default_install, install_info)
	config.filetype = config.filetype or "ripple"
	config.used_by = config.used_by or { "ripple" }
	parser_config.ripple = config

	local ok_install, install = pcall(require, "nvim-treesitter.install")
	if ok_install and type(install.ensure_installed) == "function" then
		install.ensure_installed("ripple")
	else
		vim.schedule(function()
			vim.notify("[ripple] Install nvim-treesitter parser manually via :TSInstall ripple", vim.log.levels.INFO)
		end)
	end
end

return M
