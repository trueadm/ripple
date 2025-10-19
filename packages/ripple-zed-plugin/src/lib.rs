use zed_extension_api as zed;

struct RippleExtension;

impl RippleExtension {
    fn language_server_binary_path(
        &mut self,
        _language_server_id: &zed::LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<String, String> {
        // First check if ripple-language-server is in PATH
        if let Some(path) = worktree.which("ripple-language-server") {
            return Ok(path);
        }

        // Check if it's installed via npm in node_modules
        if let Some(path) = worktree.which("node_modules/.bin/ripple-language-server") {
            return Ok(path);
        }

        Err(
            "ripple-language-server not found. Please install it:\n\
             npm install -g ripple-language-server\n\
             or add it to your project:\n\
             npm install --save-dev ripple-language-server"
                .to_string(),
        )
    }
}

impl zed::Extension for RippleExtension {
    fn new() -> Self {
        Self
    }

    fn language_server_command(
        &mut self,
        language_server_id: &zed::LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<zed::Command, String> {
        let binary_path = self.language_server_binary_path(language_server_id, worktree)?;

        Ok(zed::Command {
            command: binary_path,
            args: vec!["--stdio".to_string()],
            env: worktree.shell_env(),
        })
    }
}

zed::register_extension!(RippleExtension);
