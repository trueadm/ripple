local M = {}

local SERVER_NAME = "ripple"
local LSP_PACKAGE = "@ripple-ts/language-server"
local LSP_BIN = "ripple-language-server"
local EXACT_VERSION_PATTERN = "^%d+%.%d+%.%d+$"

local function is_windows()
	local uname = vim.loop.os_uname()
	return uname and uname.version and uname.version:match("Windows")
end

local function file_exists(path)
	local stat = vim.loop.fs_stat(path)
	return stat and stat.type == "file"
end

local function plugin_package_json_path()
	local plugin_root = debug.getinfo(1, "S").source:sub(2)
	return vim.fs.find("package.json", { upward = true, path = vim.fs.dirname(plugin_root) })[1]
end

local function read_json(path)
	local stat = vim.loop.fs_stat(path)
	if not stat or stat.type ~= "file" then
		return nil
	end

	local ok, contents = pcall(vim.fn.readfile, path)
	if not ok or type(contents) ~= "table" then
		return nil
	end

	local json_string = table.concat(contents, "")

	local decoded
	local ok_decode, value = pcall(vim.json.decode, json_string)
	if ok_decode then
		decoded = value
	end

	if type(decoded) ~= "table" then
		return nil
	end

	return decoded
end

local function resolve_required_version()
	local package_json_path = plugin_package_json_path()

	local package_json = read_json(package_json_path)
	if not package_json then
		return nil, "unable to read plugin package.json"
	end

	local config = package_json.config or {}

	local spec = config["@ripple-ts/language-server"]

	if type(spec) ~= "string" or spec == "" then
		return nil, "missing config['@ripple-ts/language-server'] field in package.json"
	end

	spec = spec:gsub("^%s+", ""):gsub("%s+$", "")

	if not spec:match(EXACT_VERSION_PATTERN) then
		return nil, ("unsupported version spec '%s'; please pin an exact semver"):format(spec)
	end

	return spec, nil
end

local function installed_version(install_dir)
	local pkg = read_json(install_dir .. "/node_modules/" .. LSP_PACKAGE .. "/package.json")
	if not pkg or type(pkg.version) ~= "string" then
		return nil
	end
	return pkg.version
end

local function local_server_binary()
	local buf = vim.api.nvim_buf_get_name(0)
	local start_dir = buf ~= "" and vim.fs.dirname(buf) or vim.loop.cwd()

	if not start_dir then
		return nil
	end

	local node_modules_dir = vim.fs.find("node_modules", {
		upward = true,
		path = start_dir,
		type = "directory",
		limit = 1,
	})[1]

	if not node_modules_dir then
		return nil
	end

	local base = node_modules_dir .. "/.bin/" .. LSP_BIN

	if is_windows() and file_exists(base .. ".cmd") then
		return base .. ".cmd"
	end

	if file_exists(base) then
		return base
	end

	return nil
end

local function global_server_binary()
	local exepath = vim.fn.exepath(LSP_BIN)
	if type(exepath) == "string" and exepath ~= "" then
		return exepath
	end

	if is_windows() then
		local with_cmd = LSP_BIN .. ".cmd"
		if vim.fn.executable(with_cmd) == 1 then
			local cmd_path = vim.fn.exepath(with_cmd)
			if type(cmd_path) == "string" and cmd_path ~= "" then
				return cmd_path
			end
		end
	end

	return nil
end

local function ensure_server_binary()
	local bin = local_server_binary()
	if bin then
		return bin
	end

	bin = global_server_binary()
	if bin then
		return bin
	end

	local required_version, err = resolve_required_version()
	if not required_version then
		vim.notify("[ripple] " .. err, vim.log.levels.ERROR)
		return nil
	end

	local install_dir = vim.fn.stdpath("data") .. "/" .. LSP_PACKAGE
	bin = install_dir .. "/node_modules/.bin/" .. LSP_BIN

	if is_windows() then
		bin = bin .. ".cmd"
	end

	local function version_matches()
		local version = installed_version(install_dir)
		return version == required_version
	end

	if vim.fn.executable(bin) == 1 and version_matches() then
		return bin
	end

	vim.fn.mkdir(install_dir, "p")
	vim.notify(("[ripple] Installing %s@%s..."):format(LSP_PACKAGE, required_version), vim.log.levels.INFO)

	local out = vim.fn.system({
		"npm",
		"install",
		("%s@%s"):format(LSP_PACKAGE, required_version),
		"--prefix",
		install_dir,
		"--no-audit",
		"--no-fund",
	})

	if vim.v.shell_error ~= 0 then
		vim.notify("[ripple] npm install failed:\n" .. out, vim.log.levels.ERROR)
		return nil
	end

	if not version_matches() then
		local found = installed_version(install_dir) or "unknown"
		vim.notify(
			("[ripple] Installed %s but required %s"):format(found, required_version),
			vim.log.levels.ERROR
		)
		return nil
	end

	return bin
end

function M.setup()
	local bin = ensure_server_binary()
	if not bin then
		return
	end

	local base_config = {
		cmd = { bin, "--stdio" },
		filetypes = { "ripple" },
		root_markers = { "package.json", "pnpm-workspace.yaml", ".git" },
	}

	vim.lsp.config(SERVER_NAME, base_config)
	vim.lsp.enable(SERVER_NAME)
end

return M
