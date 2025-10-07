# eslint-parser-ripple

ESLint parser for Ripple (.ripple files). This parser enables ESLint to understand and lint `.ripple` files by leveraging Ripple's built-in compiler.

## Installation

```bash
pnpm add --save-dev eslint-parser-ripple ripple
# or
npm install --save-dev eslint-parser-ripple ripple
# or
yarn add --dev eslint-parser-ripple ripple
```

**Note:** This parser requires `ripple` as a peer dependency.

## Usage

### Flat Config (ESLint 9+)

```js
// eslint.config.js
import rippleParser from 'eslint-parser-ripple';
import ripplePlugin from 'eslint-plugin-ripple';

export default [
  {
    files: ['**/*.ripple'],
    languageOptions: {
      parser: rippleParser,
    },
    plugins: {
      ripple: ripplePlugin,
    },
    rules: {
      ...ripplePlugin.configs.recommended.rules,
    },
  },
];
```

### Legacy Config (.eslintrc)

```json
{
  "overrides": [
    {
      "files": ["*.ripple"],
      "parser": "eslint-parser-ripple",
      "plugins": ["ripple"],
      "extends": ["plugin:ripple/recommended"]
    }
  ]
}
```

## How It Works

This parser uses Ripple's compiler (`ripple/compiler`) to parse `.ripple` files into an ESTree-compatible AST that ESLint can analyze. The Ripple compiler already outputs ESTree-compliant ASTs, making integration straightforward.

The parser:
1. Loads the Ripple compiler
2. Parses the `.ripple` source code
3. Returns the ESTree AST to ESLint
4. Allows ESLint rules to analyze Ripple-specific patterns

## Supported Syntax

The parser supports all Ripple syntax including:

- `component` declarations
- `track()` reactive values
- `@` unboxing operator
- `#[]` and `#{}` reactive collections
- JSX-like templating inside components
- All standard JavaScript/TypeScript syntax

## Example

Given a `.ripple` file:

```ripple
import { track } from 'ripple';

export component Counter() {
  let count = track(0);

  <div>
    <button onClick={() => @count++}>Increment</button>
    <span>{@count}</span>
  </div>
}
```

The parser will successfully parse this and allow ESLint rules (like those from `eslint-plugin-ripple`) to check for:
- Track calls at module scope
- Missing @ operators
- Component export requirements
- And more

## Limitations

- The parser requires Node.js runtime as it uses `require()` to load the Ripple compiler
- Browser-based linting is not currently supported

## Related Packages

- [eslint-plugin-ripple](https://www.npmjs.com/package/eslint-plugin-ripple) - ESLint rules for Ripple
- [ripple](https://ripplejs.com) - The Ripple framework
- [vite-plugin-ripple](https://www.npmjs.com/package/vite-plugin-ripple) - Vite plugin for Ripple
- [prettier-plugin-ripple](https://www.npmjs.com/package/prettier-plugin-ripple) - Prettier plugin for Ripple

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
