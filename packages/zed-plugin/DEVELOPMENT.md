# Zed Extension Development Guide

## Building the Extension

1. **Install Rust toolchain** with WebAssembly target:
   ```bash
   rustup target add wasm32-wasip1
   ```

2. **Build the extension**:
   ```bash
   cargo build --target wasm32-wasip1 --release
   ```

3. **Install as dev extension** in Zed:
   - Open Zed
   - Press `Cmd/Ctrl + Shift + P`
   - Run "zed: install dev extension"
   - Select this directory (`packages/zed-ripple`)

## Testing

1. Open a `.ripple` file in Zed
2. Verify:
   - Syntax highlighting works
   - Language server connects (check status bar)
   - Code completion works
   - Outline view shows components/functions

## File Structure

```
zed-ripple/
├── extension.toml           # Extension metadata and configuration
├── Cargo.toml              # Rust dependencies
├── src/
│   └── lib.rs              # Language server integration logic
├── languages/
│   └── ripple/
│       ├── config.toml     # Language configuration
│       ├── highlights.scm  # Syntax highlighting queries
│       ├── brackets.scm    # Bracket matching
│       ├── outline.scm     # Code structure/outline
│       ├── folds.scm       # Code folding
│       └── injections.scm  # Language injections
├── LICENSE                 # MIT License
├── README.md              # User documentation
└── .gitignore             # Git ignore rules
```

## Publishing to Zed Extensions Registry

1. **Fork** https://github.com/zed-industries/extensions
   - Must fork to personal account, not organization

2. **Add as submodule**:
   ```bash
   cd /path/to/forked/extensions
   git submodule add https://github.com/trueadm/ripple.git extensions/ripple
   ```
   **Important**: Use HTTPS URL, not SSH

3. **Update extensions.toml**:
   ```toml
   [ripple]
   submodule = "extensions/ripple"
   version = "0.1.0"
   ```

4. **Create Pull Request** to zed-industries/extensions

5. **Once merged**, the extension will automatically publish to the registry

## Updating the Extension

### After Grammar Changes

If you update the tree-sitter grammar in `packages/tree-sitter-ripple`:

1. Update query files in `languages/ripple/` if needed
2. Update the `rev` field in `extension.toml` to the new commit SHA
3. Test locally
4. Bump version in `extension.toml`
5. Submit PR to zed-extensions repo (if published)

### After Language Server Changes

The extension just launches the language server binary - no changes needed to the extension itself unless:
- Binary name changes
- Command-line arguments change
- Installation method changes

## Troubleshooting

### Language server not found

Make sure `ripple-language-server` is installed:
```bash
npm install -g ripple-language-server
```

Or in your project:
```bash
npm install --save-dev ripple-language-server
```

### Syntax highlighting not working

1. Check that tree-sitter grammar compiled successfully
2. Verify query files are valid (no syntax errors)
3. Check Zed logs: `Cmd/Ctrl + Shift + P` → "zed: open log"

### Extension won't build

1. Ensure Rust toolchain is installed: `rustc --version`
2. Ensure wasm32-wasip1 target is installed: `rustup target list --installed`
3. Check Cargo.toml has correct `zed_extension_api` version

## Resources

- [Zed Extensions Docs](https://zed.dev/docs/extensions)
- [Language Extensions Guide](https://zed.dev/docs/extensions/languages)
- [Extension API Reference](https://docs.rs/zed_extension_api/latest/)
- [Tree-sitter Query Documentation](https://tree-sitter.github.io/tree-sitter/using-parsers#pattern-matching-with-queries)
