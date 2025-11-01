from __future__ import annotations

import os
import shutil
from typing import Iterable, Optional

import sublime
from lsp_utils import NpmClientHandler


def plugin_loaded() -> None:
    LspRipplePlugin.setup()


def plugin_unloaded() -> None:
    LspRipplePlugin.cleanup()


class LspRipplePlugin(NpmClientHandler):
    package_name = __package__
    server_directory = 'language-server'
    server_binary_path = os.path.join(
        server_directory,
        'node_modules',
        'ripple-language-server',
        'bin',
        'ripple-language-server.js'
    )

    @classmethod
    def required_node_version(cls) -> str:
        return '>=18.0.0'

    @classmethod
    def on_start(
        cls,
        window: sublime.Window,
        initiating_view: Optional[sublime.View],
        workspace_folders: Iterable,
        configuration: 'ClientConfig'
    ) -> bool:
        external_binary = cls._determine_external_binary(initiating_view, workspace_folders)
        if external_binary:
            configuration.command = [external_binary, '--stdio']
        return super().on_start(window, initiating_view, workspace_folders, configuration)

    @classmethod
    def _determine_external_binary(
        cls,
        initiating_view: Optional[sublime.View],
        workspace_folders: Iterable
    ) -> Optional[str]:
        local_binary = cls._find_local_binary(initiating_view, workspace_folders)
        if local_binary:
            return local_binary

        global_binary = cls._find_global_binary()
        if global_binary:
            return global_binary

        return None

    @classmethod
    def _find_local_binary(
        cls,
        initiating_view: Optional[sublime.View],
        workspace_folders: Iterable
    ) -> Optional[str]:
        script_name = cls._binary_name()
        candidates = []

        if initiating_view and initiating_view.file_name():
            candidates.extend(cls._node_modules_dirs_from_path(initiating_view.file_name()))

        for folder in workspace_folders or []:
            folder_path = cls._workspace_folder_path(folder)
            if folder_path:
                candidates.extend(cls._node_modules_dirs_from_path(folder_path))

        seen = set()
        for node_modules_path in candidates:
            if node_modules_path in seen:
                continue
            seen.add(node_modules_path)

            script_path = os.path.join(node_modules_path, '.bin', script_name)
            windows_script = cls._maybe_windows_script(script_path)

            if windows_script and os.path.isfile(windows_script):
                return windows_script

            if os.path.isfile(script_path):
                return script_path

        return None

    @classmethod
    def _node_modules_dirs_from_path(cls, path: str) -> Iterable[str]:
        if not path:
            return []

        directories = []
        current = os.path.abspath(path)

        if os.path.isfile(current):
            current = os.path.dirname(current)

        while True:
            directories.append(os.path.join(current, 'node_modules'))
            parent = os.path.dirname(current)
            if parent == current:
                break
            current = parent

        return directories

    @classmethod
    def _find_global_binary(cls) -> Optional[str]:
        script_name = cls._binary_name()
        for candidate in (script_name, cls._maybe_windows_script(script_name)):
            if candidate:
                path = shutil.which(candidate)
                if path:
                    return path
        return None

    @staticmethod
    def _workspace_folder_path(folder: object) -> Optional[str]:
        path = getattr(folder, 'path', None)
        if isinstance(path, str) and path:
            return path

        uri = getattr(folder, 'uri', None)
        if isinstance(uri, str) and uri:
            return sublime.uri_to_file_name(uri)

        return None

    @classmethod
    def _binary_name(cls) -> str:
        return 'ripple-language-server'

    @classmethod
    def _maybe_windows_script(cls, script_path: str) -> Optional[str]:
        if script_path and sublime.platform() == 'windows':
            return script_path + '.cmd' if not script_path.endswith('.cmd') else script_path
        return None
