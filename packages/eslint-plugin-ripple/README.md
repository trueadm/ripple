# eslint-plugin-ripple

ESLint plugin for [Ripple](https://ripplejs.com) - helps enforce best practices and catch common mistakes when writing Ripple applications.

Works just like `eslint-plugin-react` - simply install and use the recommended config!

## Installation

```bash
npm install --save-dev eslint-plugin-ripple
# or
yarn add --dev eslint-plugin-ripple
# or
pnpm add --save-dev eslint-plugin-ripple
```

## Usage

### Flat Config (ESLint 9+)

```js
// eslint.config.js
import ripple from 'eslint-plugin-ripple';

export default [...ripple.configs.recommended];
```

The plugin automatically:
- Detects and uses `eslint-parser-ripple` if installed for `.ripple` files
- Excludes `.d.ts` files, `node_modules`, `dist`, and `build` directories from linting
- Works with both `.ts`/`.tsx` and `.ripple` files

### Legacy Config (.eslintrc)

```json
{
  "plugins": ["ripple"],
  "extends": ["plugin:ripple/recommended"]
}
```

## Configurations

### `recommended`

The recommended configuration enables all rules at their default severity levels (errors and warnings).

```js
import ripple from 'eslint-plugin-ripple';

export default [
  {
    plugins: { ripple },
    rules: ripple.configs.recommended.rules,
  },
];
```

### `strict`

The strict configuration enables all rules as errors.

```js
import ripple from 'eslint-plugin-ripple';

export default [
  {
    plugins: { ripple },
    rules: ripple.configs.strict.rules,
  },
];
```

## Rules

### `ripple/no-module-scope-track` (error)

Prevents calling `track()` at module scope. Tracked values must be created within a component context.

❌ **Incorrect:**

```js
import { track } from 'ripple';

// This will cause runtime errors
let globalCount = track(0);

export component App() {
  <div>{@globalCount}</div>
}
```

✅ **Correct:**

```js
import { track } from 'ripple';

export component App() {
  // track() called within component
  let count = track(0);

  <div>{@count}</div>
}
```

### `ripple/require-component-export` (warning)

Warns when capitalized components are not exported. This helps ensure components are reusable across modules.

❌ **Incorrect:**

```js
component MyButton() {
  <button>Click me</button>
}
// MyButton is defined but not exported
```

✅ **Correct:**

```js
export component MyButton() {
  <button>Click me</button>
}
```

### `ripple/prefer-oninput` (warning, fixable)

Recommends using `onInput` instead of `onChange` for form inputs. Unlike React, Ripple doesn't have synthetic events, so `onInput` is the correct event handler.

❌ **Incorrect:**

```jsx
<input onChange={handleChange} />
```

✅ **Correct:**

```jsx
<input onInput={handleInput} />
```

This rule is auto-fixable with `--fix`.

### `ripple/no-return-in-component` (error)

Prevents returning JSX from Ripple components. In Ripple, JSX should be used as statements, not expressions.

❌ **Incorrect:**

```js
export component App() {
  return <div>Hello World</div>;
}
```

✅ **Correct:**

```js
export component App() {
  <div>Hello World</div>
}
```

### `ripple/unbox-tracked-values` (error)

Ensures tracked values are unboxed with the `@` operator when used in JSX expressions.

❌ **Incorrect:**

```js
export component App() {
  let count = track(0);

  // Missing @ operator
  <div>{count}</div>
}
```

✅ **Correct:**

```js
export component App() {
  let count = track(0);

  // Properly unboxed with @
  <div>{@count}</div>
}
```

## Custom Configuration

You can customize individual rules in your ESLint config:

```js
export default [
  {
    plugins: { ripple },
    rules: {
      'ripple/no-module-scope-track': 'error',
      'ripple/require-component-export': 'off', // Disable this rule
      'ripple/prefer-oninput': 'error', // Make this an error instead of warning
      'ripple/no-return-in-component': 'error',
      'ripple/unbox-tracked-values': 'error',
    },
  },
];
```

## Using with TypeScript

This plugin works seamlessly with TypeScript. Make sure you have `@typescript-eslint/parser` configured:

```js
import ripple from 'eslint-plugin-ripple';
import tsParser from '@typescript-eslint/parser';

export default [
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.ripple'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: { ripple },
    rules: ripple.configs.recommended.rules,
  },
];
```

## Using with .ripple Files

Full support for `.ripple` files is available via the `eslint-parser-ripple` package:

```bash
npm install --save-dev eslint-parser-ripple
```

Then configure your ESLint to use the Ripple parser for `.ripple` files:

```js
import ripple from 'eslint-plugin-ripple';
import rippleParser from 'eslint-parser-ripple';

export default [
  {
    files: ['**/*.ripple'],
    languageOptions: {
      parser: rippleParser,
    },
    plugins: { ripple },
    rules: ripple.configs.recommended.rules,
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: { ripple },
    rules: ripple.configs.recommended.rules,
  },
];
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Related

- [Ripple](https://ripplejs.com) - The Ripple framework
- [vite-plugin-ripple](https://www.npmjs.com/package/vite-plugin-ripple) - Vite plugin for Ripple
- [prettier-plugin-ripple](https://www.npmjs.com/package/prettier-plugin-ripple) - Prettier plugin for Ripple
