from lsp_utils import NpmClientHandler
import os


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
