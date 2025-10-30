# Ripple Extension for Zed

This extension provides Ripple language support for the [Zed editor](https://zed.dev).

## Installation

### From Zed Extensions

Once published to the Zed extensions registry:

1. Open Zed
2. Press `Cmd/Ctrl + Shift + X` to open extensions
3. Search for "Ripple"
4. Click "Install"

### Development Installation

1. Clone this repository
2. Install Rust with the wasm32-wasip1 target:
   ```bash
   rustup target add wasm32-wasip1
   ```
3. Open Zed
4. Press `Cmd/Ctrl + Shift + P`
5. Run "zed: install dev extension"
6. Select the `packages/ripple-zed-plugin` directory

## Language Server Setup

The extension automatically downloads the Ripple Language Server the first time it runs. The version is pinned via the `config.ripple-language-server` entry in this package's `package.json`. If you'd prefer to manage the dependency yourself, install it via npm:

```bash
npm install -g ripple-language-server
```

Project-local installations (`node_modules/.bin/ripple-language-server`) are also detected automatically.
