<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/ripple-dark.png">
  <img src="assets/ripple-light.png" alt="Ripple - the elegant UI framework for the web" />
</picture>

# What is Ripple?

> Currently, this project is still in early development, and should not be used in production.

Ripple is a TypeScript UI framework for the web.

I wrote Ripple as a love letter for frontend web – and this is largely a project that I built in less than a week, so it's very raw.

Personally, I ([@trueadm](https://github.com/trueadm)) have been involved in some truly amazing frontend frameworks along their journeys – from [Inferno](https://github.com/infernojs/inferno), where it all began, to [React](https://github.com/facebook/react) and the journey of React Hooks, to creating [Lexical](https://github.com/facebook/lexical), to [Svelte 5](https://github.com/sveltejs/svelte) and its new compiler and signal-based reactivity runtime. Along that journey, I collected ideas, and intriguing thoughts that may or may not pay off. Given my time between roles, I decided it was the best opportunity to try them out, and for open source to see what I was cooking.

Ripple was designed to be a JS/TS-first framework, rather than HTML-first. Ripple modules have their own `.ripple` extension and these modules
fully support TypeScript. By introducing a new extension, it affords Ripple to invent its own superset language, that plays really nicely with
TypeScript and JSX, but with a few interesting touches. In my experience, this has led to better DX not only for humans, but also for LLMs.

Right now, there will be plenty of bugs, things just won't work either and you'll find TODOs everywhere. At this stage, Ripple is more of an early alpha version of something that _might_ be, rather than something you should try and adopt. If anything, maybe some of the ideas can be shared and incubated back into other frameworks. There's also a lot of similarities with Svelte 5, and that's not by accident, that's because of my recent time working on Svelte 5.

## Features

- **Reactive State Management**: Built-in reactivity with `$` prefixed variables
- **Component-Based Architecture**: Clean, reusable components with props and children
- **JSX-like Syntax**: Familiar templating with Ripple-specific enhancements
- **TypeScript Support**: Full TypeScript integration with type checking
- **VSCode Integration**: Rich editor support with diagnostics, syntax highlighting, and IntelliSense

## Missing Features

- **SSR**: Ripple is currently an SPA only, this is because I haven't gotten around to it
- **Testing & Types**: The codebase is very raw with limited types (I've opted for JavaScript only to avoid build problems). There aren't any tests either – I've been using the `playground` directory to manually test things as I go

## Quick Start

### Installation

```bash
pnpm i --save ripple
```

You'll also need Vite and Ripple's Vite plugin to compile Ripple:

```bash
pnpm i --save-dev vite-plugin-ripple
```

You can see a working example in the [playground demo app](https://github.com/trueadm/ripple/tree/main/playground).

### Mounting your app

You can use the `mount` API from the `ripple` package to render your Ripple component, using the `target`
option to specify what DOM element you want to render the component.

```ts
// index.ts
import { mount } from 'ripple';
import { App } from '/App.ripple';

mount(App, {
  props: {
    title: 'Hello world!'
  },
  target: document.getElementById('root')
});
```

## Key Concepts

### Components

Define reusable components with the `component` keyword. These are similar to functions in that they have `props`, but crucially,
they allow for a JSX-like syntax to be defined alongside standard TypeScript. That means you do not _return JSX_ like in other frameworks,
but you instead use it like a JavaScript statement, as shown:

```ripple
component Button(props: { text: string, onClick: () => void }) {
  <button onClick={props.onClick}>
    {props.text}
  </button>
}

// Usage
<Button text="Click me" onClick={() => console.log("Clicked!")} />
```

### Reactive Variables

Variables prefixed with `$` are automatically reactive:

```ts
let $name = "World";
let $count = 0;

// Updates automatically trigger re-renders
$count++;
```

Object properties prefixed with `$` are also automatically reactive:

```ts
let counter = { $current: 0 };

// Updates automatically trigger re-renders
counter.$current++;
```

Derived values are simply `$` variables that combined different parts of state:

```ts
let $count = 0;
let $double = $count * 2;
let $quadruple = $double * 2;
```

That means `$count` itself might be derived if it were to reference another reactive property. For example:

```ripple
component Counter({ $startingCount }) {
  let $count = $startingCount;
  let $double = $count * 2;
  let $quadruple = $double * 2;
}
```

Now given `$startingCount` is reactive, it would mean that `$count` might reset each time an incoming change to `$startingCount` occurs. That might not be desirable, so Ripple provides a way to `untrack` reactivity in those cases:

```ripple
import { untrack } from 'ripple';

component Counter({ $startingCount }) {
  let $count = untrack(() => $startingCount);
  let $double = $count * 2;
  let $quadruple = $double * 2;
}
```

Now `$count` will only reactively create its value on initialization.

> Note: you cannot define reactive variables in module/global scope, they have to be created on access from an active component

### Effects

When dealing with reactive state, you might want to be able to create side-effects based upon changes that happen upon updates.
To do this, you can use `effect`:

```ripple
import { effect } from 'ripple';

component App() {
  let $count = 0;

  effect(() => {
    console.log($count);
  });

  <button onClick={() => $count++}>Increment</button>
}
```

### Control flow

The JSX-like syntax might take some time to get used to if you're coming from another framework. For one, templating in Ripple
can only occur _inside_ a `component` body – you can't create JSX inside functions, or assign it to variables as an expression.

```ripple
<div>
  // you can create variables inside the template!
  const str = "hello world";

  console.log(str); // and function calls too!

  debugger; // you can put breakpoints anywhere to help debugging!

  {str}
</div>
```

Note that strings inside the template need to be inside `{"string"}`, you can't do `<div>hello</div>` as Ripple
has no idea if `hello` is a string or maybe some JavaScript code that needs evaluating, so just ensure you wrap them
in curly braces. This shouldn't be an issue in the real-world anyway, as you'll likely use an i18n library that means
using JavaScript expressions regardless.

### If statements

If blocks work seemlessly with Ripple's templating language, you can put them inside the JSX-like
statements, making control-flow far easier to read and reason with.

```ripple
component Truthy({ x }) {
  <div>
    if (x) {
      <span>
        {"x is truthy"}
      </span>
    } else {
      <span>
        {"x is truthy"}
      </span>
    }
  </div>
}
```

### For statements

You can render collections using a `for...of` block, and you don't need to specify a `key` prop like
other frameworks.

```ripple
component ListView({ title, items }) {
  <h2>{title}</h2>
  <ul>
    for (const item of items) {
      <li>{item.text}</li>
    }
  </ul>
}
```

### Try statements

Try blocks work to building the foundation for **error boundaries**, when the runtime encounters
an error in the `try` block, you can easily render a fallback in the `catch` block.

```ripple
import { reportError } from 'some-library';

component ErrorBoundary() {
  <div>
    try {
      <ComponentThatFails />
    } catch (e) {
      reportError(e);

      <div>{"An error occured! " + e.message}</div>
    }
  </div>
}
```

### Props

If you want a prop to be reactive, you should also give it a `$` prefix.

```ripple
component Button(props: { $text: string, onClick: () => void }) {
  <button onClick={props.onClick}>
    {props.$text}
  </button>
}

// Usage
<Button $text={some_text} onClick={() => console.log("Clicked!")} />
```

### Children

Use `$children` prop and the `<$component />` directive for component composition.

When you pass in children to a component, it gets implicitly passed as the `$children` prop, in the form of a component.

```ripple
import type { Component } from 'ripple';

component Card(props: { $children: Component }) {
  <div class="card">
    <$component />
  </div>
}

// Usage
<Card>
  <p>{"Card content here"}</p>
</Card>
```

You could also explicitly write the same code as shown:

```ripple
import type { Component } from 'ripple';

component Card(props: { $children: Component }) {
  <div class="card">
    <$component />
  </div>
}

// Usage with explicit component
<Card>
  component $children() {
    <p>{"Card content here"}</p>
  }
</Card>
```

### Events

Like React, events are props that start with `on` and then continue with an uppercase character, such as:

- `onClick`
- `onPointerMove`
- `onPointerDown`
- `onKeyDown`

For `capture` phase events, just add `Capture` to the end of the prop name:

- `onClickCapture`
- `onPointerMoveCapture`
- `onPointerDownCapture`
- `onKeyDownCapture`

> Note: Some events are automatically delegated where possible by Ripple to improve runtime performance.

### Styling

Ripple supports native CSS styling that is localized to the given component using the `<style>` element.

```ripple
component MyComponent() {
  <div class="container">
    <h1>{"Hello World"}</h1>
  </div>
  
  <style>
    .container {
      background: blue;
      padding: 1rem;
    }
    
    h1 {
      color: white;
      font-size: 2rem;
    }
  </style>
}
```

> Note: the `<style>` element must be top-level within a `component`.

## VSCode Extension

The Ripple VSCode extension provides:

- **Syntax Highlighting** for `.ripple` files
- **Real-time Diagnostics** for compilation errors
- **TypeScript Integration** for type checking
- **IntelliSense** for autocompletion

Clone the repository, and manually install the extension from the `packages/ripple-vscode-plugin/` directory.

## Playground

Feel free to play around with how Ripple works. If you clone the repo, you can then:

```bash
pnpm i && cd playground && pnpm dev
```

The playground uses Ripple's Vite plugin, where you can play around with things inside the `playground/src` directory.