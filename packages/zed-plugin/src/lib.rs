use std::env;
use std::fs;
use std::path::PathBuf;

use zed_extension_api::{self as zed, serde_json::{self, Value}, LanguageServerId};

struct RippleExtension {
    cached_binary_path: Option<PathBuf>,
    required_version: Option<String>,
}

const PACKAGE_NAME: &str = "@ripple-ts/language-server";

impl RippleExtension {
    fn language_server_binary_path(
        &mut self,
        language_server_id: &LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<String, String> {
        if let Some(path) = self.cached_binary_path.as_ref() {
            if fs::metadata(path).map_or(false, |stat| stat.is_file()) {
                return Ok(path.to_string_lossy().into_owned());
            }
        }

        if let Some(system_path) = Self::system_binary_path(worktree) {
            self.cached_binary_path = Some(system_path.clone());
            return Ok(system_path.to_string_lossy().into_owned());
        }

        let binary_path = self.install_language_server(language_server_id)?;
        Ok(binary_path.to_string_lossy().into_owned())
    }

    fn system_binary_path(worktree: &zed::Worktree) -> Option<PathBuf> {
        let (os, _) = zed::current_platform();
        let candidates: &[&str] = match os {
            zed::Os::Windows => &[
                "language-server.cmd",
                "language-server",
                "node_modules/.bin/language-server.cmd",
                "node_modules/.bin/language-server",
            ],
            _ => &[
                "@ripple-ts/language-server",
                "node_modules/.bin/@ripple-ts/language-server",
            ],
        };

        for candidate in candidates {
            if let Some(path) = worktree.which(candidate) {
                let path_buf = PathBuf::from(path);
                if fs::metadata(&path_buf).map_or(false, |stat| stat.is_file()) {
                    return Some(path_buf);
                }
            }
        }

        None
    }

    fn install_language_server(
        &mut self,
        language_server_id: &LanguageServerId,
    ) -> Result<PathBuf, String> {
        let required_version = self.required_version()?;

        zed::set_language_server_installation_status(
            language_server_id,
            &zed::LanguageServerInstallationStatus::CheckingForUpdate,
        );

        if self.should_install_or_update(&required_version) {
            zed::set_language_server_installation_status(
                language_server_id,
                &zed::LanguageServerInstallationStatus::Downloading,
            );

            if let Err(error) = zed::npm_install_package(PACKAGE_NAME, &required_version) {
                if self
                    .get_installed_version()
                    .as_deref()
                    != Some(required_version.as_str())
                {
                    return Err(error);
                }
            }
        }

        let binary_path = Self::installed_binary_path()
            .map_err(|error| format!("Failed to locate language server binary: {}", error))?;

        self.cached_binary_path = Some(binary_path.clone());

        Ok(binary_path)
    }

    fn should_install_or_update(&self, required_version: &str) -> bool {
        if !Self::binary_exists() {
            return true;
        }

        match self.get_installed_version() {
            Some(installed_version) => installed_version != required_version,
            None => true,
        }
    }

    fn get_installed_version(&self) -> Option<String> {
        zed::npm_package_installed_version(PACKAGE_NAME)
            .ok()
            .flatten()
            .map(|version| version.trim().to_string())
    }

    fn binary_exists() -> bool {
        Self::installed_binary_path().is_ok()
    }

    fn installed_binary_path() -> Result<PathBuf, String> {
        let extension_dir = Self::extension_dir()?;
        let (os, _) = zed::current_platform();

        let binary_name = match os {
            zed::Os::Windows => "ripple-language-server.cmd",
            _ => "ripple-language-server",
        };

        let bin_path = extension_dir
            .join("node_modules")
            .join(".bin")
            .join(binary_name);

        if fs::metadata(&bin_path).map_or(false, |stat| stat.is_file()) {
            return Ok(bin_path);
        }

        let fallback_path = extension_dir
            .join("node_modules")
            .join(PACKAGE_NAME)
            .join("bin")
            .join("ripple-language-server.js");

        if fs::metadata(&fallback_path).map_or(false, |stat| stat.is_file()) {
            return Ok(fallback_path);
        }

        Err(format!(
            "expected a binary at {} or {}",
            bin_path.display(),
            fallback_path.display()
        ))
    }

    fn extension_dir() -> Result<PathBuf, String> {
        env::current_dir().map_err(|err| err.to_string())
    }

    fn required_version(&mut self) -> Result<String, String> {
        if let Some(version) = self.required_version.clone() {
            return Ok(version);
        }

        let version = Self::read_required_version()?;
        self.required_version = Some(version.clone());
        Ok(version)
    }

    fn read_required_version() -> Result<String, String> {
        let package_json: Value = serde_json::from_str(include_str!("../package.json"))
            .map_err(|error| format!("Failed to parse package.json embedded in extension: {}", error))?;

        let spec = package_json
            .get("config")
            .and_then(|config| config.get(PACKAGE_NAME))
            .and_then(|value| value.as_str())
            .map(str::trim)
            .filter(|spec| !spec.is_empty())
            .ok_or_else(|| {
                format!(
                    "Add config.{PACKAGE_NAME} to package.json to pin the language server version."
                )
            })?;

        if !Self::is_exact_semver(spec) {
            return Err(format!(
                "config.{PACKAGE_NAME} in package.json must be an exact semver (e.g. 0.2.0); got '{}'",
                spec
            ));
        }

        Ok(spec.to_string())
    }

    fn is_exact_semver(spec: &str) -> bool {
        let parts: Vec<&str> = spec.split('.').collect();
        if parts.len() != 3 {
            return false;
        }

        parts
            .iter()
            .all(|part| !part.is_empty() && part.chars().all(|c| c.is_ascii_digit()))
    }
}

impl zed::Extension for RippleExtension {
    fn new() -> Self {
        Self {
            cached_binary_path: None,
            required_version: None,
        }
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
