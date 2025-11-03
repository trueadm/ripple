<a href="https://ripple-ts.com">
  <picture>
    <source media="(min-width: 768px)" srcset="assets/ripple-desktop.png">
    <img src="assets/ripple-mobile.png" alt="Ripple - the elegant TypeScript UI framework" />
  </picture>
</a>

[![CI](https://github.com/trueadm/ripple/actions/workflows/ci.yml/badge.svg)](https://github.com/trueadm/ripple/actions/workflows/ci.yml)
[![Discord](https://img.shields.io/badge/Discord-Join%20Server-7289da?logo=discord&logoColor=white)](https://discord.gg/JBF2ySrh2W)
[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz_small.svg)](https://stackblitz.com/github/trueadm/ripple/tree/main/templates/basic)

# RippleTS

RippleTS is a TypeScript UI framework that combines the best parts of React, Solid, and Svelte. Created by [@trueadm](https://github.com/trueadm), who has contributed to [Inferno](https://github.com/infernojs/inferno), [React](https://github.com/facebook/react), [Lexical](https://github.com/facebook/lexical), and [Svelte 5](https://github.com/sveltejs/svelte).

**Key Philosophy:** Ripple is TS-first with its own `.ripple` file extension, allowing seamless TypeScript integration and a unique syntax that enhances both human and LLM developer experience.

📚 **[Full Documentation](https://www.ripple-ts.com/docs)** | 🎮 **[Interactive Playground](https://www.ripple-ts.com/playground)**

## Features

- ⚡ **Fine-grained Reactivity**: `track` and `@` syntax with signals-based reactivity
- 🔥 **Performance**: Industry-leading rendering speed, bundle size, and memory usage
- 📦 **Reactive Collections**: `#[]` arrays and `#{}` objects with full reactivity
- 🎯 **TypeScript First**: Complete type safety with `.ripple` file extension
- 🛠️ **Developer Tools**: VSCode extension, Prettier, and ESLint support
- 🎨 **Scoped Styling**: Component-level CSS with automatic scoping

> **Note:** SSR support is coming soon! Currently SPA-only.

## 🚀 Quick Start

### Using CLI (Recommended)

```bash
npx create-ripple
cd my-app
npm install && npm run dev
```

### Using Template

```bash
npx degit trueadm/ripple/templates/basic my-app
cd my-app
npm install && npm run dev
```

### Add to Existing Project

```bash
npm install ripple vite-plugin-ripple
```

**[→ Full Installation Guide](https://www.ripple-ts.com/docs/quick-start)**

### Mounting Your App

```ts
// index.ts
import { mount } from 'ripple';
import { App } from './App.ripple';

mount(App, {
  props: { title: 'Hello world!' },
  target: document.getElementById('root'),
});
```

## 🔧 VSCode Extension

Install the [Ripple VSCode extension](https://marketplace.visualstudio.com/items?itemName=ripplejs.ripple-vscode-plugin) for:

- Syntax highlighting
- TypeScript integration
- Real-time diagnostics
- IntelliSense autocomplete

**[→ Editor Setup Guide](https://www.ripple-ts.com/docs/quick-start#vs-code)**

## Core Concepts

### Components

Define components with the `component` keyword. Unlike React, you don't return JSX—you write it directly:

```jsx
component Button(props: { text: string, onClick: () => void }) {
  <button onClick={props.onClick}>
    {props.text}
  </button>
}

export component App() {
  <Button text="Click me" onClick={() => console.log("Clicked!")} />
}
```

**[→ Component Guide](https://www.ripple-ts.com/docs/guide/components)**

### Reactivity

Create reactive state with `track` and access it with the `@` operator:

```jsx
import { track } from 'ripple';

export component App() {
  let count = track(0);

  <div>
    <p>{"Count: "}{@count}</p>
    <button onClick={() => @count++}>{"Increment"}</button>
  </div>
}
```

**Derived values** automatically update:

```jsx
import { track } from 'ripple';

export component App() {
  let count = track(0);
  let double = track(() => @count * 2);
  let quadruple = track(() => @double * 2);

  <div>
    <p>{"Count: "}{@count}</p>
    <p>{"Double: "}{@double}</p>
    <p>{"Quadruple: "}{@quadruple}</p>
    <button onClick={() => @count++}>{"Increment"}</button>
  </div>
}
```

**Reactive collections** with shorthand syntax:

```jsx
export component App() {
  const items = #[1, 2, 3];  // TrackedArray
  const obj = #{a: 1, b: 2}; // TrackedObject

  <div>
    <p>{"Items: "}{items.join(', ')}</p>
    <p>{"Object: a="}{obj.a}{", b="}{obj.b}{", c="}{obj.c}</p>
    <button onClick={() => items.push(items.length + 1)}>{"Add Item"}</button>
    <button onClick={() => obj.c = (obj.c ?? 0) + 1}>{"Increment c"}</button>
  </div>
}
```

**[→ Reactivity Guide](https://www.ripple-ts.com/docs/guide/reactivity)**

### Transporting Reactivity

Pass reactive state across function boundaries:

```jsx
import { track } from 'ripple';

function createDouble(count) {
  return track(() => @count * 2);
}

export component App() {
  let count = track(0);
  const double = createDouble(count);

  <div>
    <p>{"Double: "}{@double}</p>
    <button onClick={() => @count++}>{"Increment"}</button>
  </div>
}
```

**[→ Transporting Reactivity Guide](https://www.ripple-ts.com/docs/guide/reactivity#transporting-reactivity)**

### Effects & Side Effects

```jsx
import { effect, track } from 'ripple';

export component App() {
  let count = track(0);

  effect(() => {
    console.log('Count changed:', @count);
  });

  <button onClick={() => @count++}>{'Increment'}</button>
}
```

**[→ Effects & Reactivity Guide](https://www.ripple-ts.com/docs/guide/reactivity#effects)**

### Control Flow

**Conditionals:**

```jsx
import { track } from 'ripple';

export component App() {
  let condition = track(true);

  <div>
    if (@condition) {
      <div>{'True'}</div>
    } else {
      <div>{'False'}</div>
    }
    <button onClick={() => @condition = !@condition}>{"Toggle"}</button>
  </div>
}
```

**Loops:**

```jsx
export component App() {
  const items = #[
    {id: 1, name: 'Item 1'},
    {id: 2, name: 'Item 2'},
    {id: 3, name: 'Item 3'}
  ];

  <div>
    for (const item of items; index i; key item.id) {
      <div>{item.name}{" (index: "}{i}{")"}</div>
    }
    <button onClick={() => items.push({id: items.length + 1, name: `Item ${items.length + 1}`})}>{"Add Item"}</button>
  </div>
}
```

**Error Boundaries:**

```jsx
import { track } from 'ripple';

component ComponentThatMayFail(props: { shouldFail: boolean }) {
  if (props.shouldFail) {
    throw new Error('Component failed!');
    {'This will never render'}
  }

  <div>{"Component working fine"}</div>
}

export component App() {
  let shouldFail = track(false);

  <div>
    try {
      <ComponentThatMayFail shouldFail={@shouldFail} />
    } catch (e) {
      <div>{'Error: ' + e.message}</div>
    }
    <button onClick={() => @shouldFail = !@shouldFail}>{"Toggle Error"}</button>
  </div>
}
```

**[→ Control Flow Guide](https://www.ripple-ts.com/docs/guide/control-flow)**

### DOM Refs

Capture DOM elements with the `{ref fn}` syntax:

```jsx
export component App() {
  <div {ref (node) => console.log(node)}>{"Hello"}</div>
}
```

**[→ DOM Refs Guide](https://www.ripple-ts.com/docs/guide/dom-refs)**

### Events

Use React-style event handlers:

```jsx
import { track } from 'ripple';

export component App() {
  let value = track('');

  <div>
    <button onClick={() => console.log('Clicked')}>{'Click'}</button>
    <input onInput={(e) => @value = e.target.value} />
    <p>{"You typed: "}{@value}</p>
  </div>
}
```

**[→ Events Guide](https://www.ripple-ts.com/docs/guide/events)**

### Styling

**Scoped CSS:**

```jsx
export component App() {
  <div class="container">{"Content"}</div>

  <style>
    .container {
      padding: 1rem;
      background: lightblue;
      border-radius: 8px;
    }
  </style>
}
```

**Dynamic styles:**

```jsx
import { track } from 'ripple';

export component App() {
  let color = track('red');

  <div>
    <div style={{ color: @color, fontWeight: 'bold' }}>{"Styled text"}</div>
    <button onClick={() => @color = @color === 'red' ? 'blue' : 'red'}>{"Toggle Color"}</button>
  </div>
}
```

**[→ Styling Guide](https://www.ripple-ts.com/docs/guide/styling)**

## Advanced Features

### Context API

Share state across the component tree:

```jsx
import { Context, track } from 'ripple';

const ThemeContext = new Context();

component Child() {
  const theme = ThemeContext.get();
  <div>{"Theme: " + @theme}</div>
}

export component App() {
  let theme = track('light');

  ThemeContext.set(theme);

  <div>
    <Child />
    <button onClick={() => @theme = @theme === 'light' ? 'dark' : 'light'}>{"Toggle Theme"}</button>
  </div>
}
```

**[→ State Management Guide](https://www.ripple-ts.com/docs/guide/state-management#context)**

### Portals

Render content outside the component hierarchy:

```jsx
import { Portal, track } from 'ripple';

export component App() {
  let showModal = track(false);

  <div>
    <button onClick={() => @showModal = !@showModal}>{"Toggle Modal"}</button>

    if (@showModal) {
      <Portal target={document.body}>
        <div class="modal">
          <p>{'Modal content'}</p>
          <button onClick={() => @showModal = false}>{"Close"}</button>
        </div>
      </Portal>
    }
  </div>
}
```

**[→ Portal & Component Guide](https://www.ripple-ts.com/docs/guide/components#portal-component)**

## Resources

- 📚 **[Full Documentation](https://www.ripple-ts.com/docs)** - Complete guide and API reference
- 🎮 **[Interactive Playground](https://www.ripple-ts.com/playground)** - Try Ripple in your browser
- 🐛 **[GitHub Issues](https://github.com/trueadm/ripple/issues)** - Report bugs or request features
- 💬 **[Discord Community](https://discord.gg/JBF2ySrh2W)** - Get help and discuss Ripple
- 📦 **[npm Package](https://www.npmjs.com/package/ripple)** - Install from npm

## Contributing

Contributions are welcome! Please see our [contributing guidelines](CONTRIBUTING.md).

## License

MIT License - see [LICENSE](LICENSE) for details.
