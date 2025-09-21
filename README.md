<a href="https://ripplejs.com">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/ripple-dark.png">
    <img src="assets/ripple-light.png" alt="Ripple - the elegant TypeScript UI framework" />
  </picture>
</a>

[![CI](https://github.com/trueadm/ripple/actions/workflows/ci.yml/badge.svg)](https://github.com/trueadm/ripple/actions/workflows/ci.yml)
[![Discord](https://img.shields.io/badge/Discord-Join%20Server-7289da?logo=discord&logoColor=white)](https://discord.gg/JBF2ySrh2W)
[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz_small.svg)](https://stackblitz.com/github/trueadm/ripple/tree/main/templates/basic)

# What is RippleJS?

> Currently, this project is still in early development, and should not be used in production.

Ripple is a TypeScript UI framework that takes the best parts of React, Solid and Svelte and combines them into one package.

I wrote Ripple as a love letter for frontend web – and this is largely a project that I built in less than a week, so it's very raw.

Personally, I ([@trueadm](https://github.com/trueadm)) have been involved in some truly amazing frontend frameworks along their journeys – from [Inferno](https://github.com/infernojs/inferno), where it all began, to [React](https://github.com/facebook/react) and the journey of React Hooks, to creating [Lexical](https://github.com/facebook/lexical), to [Svelte 5](https://github.com/sveltejs/svelte) and its new compiler and signal-based reactivity runtime. Along that journey, I collected ideas, and intriguing thoughts that may or may not pay off. Given my time between roles, I decided it was the best opportunity to try them out, and for open source to see what I was cooking.

Ripple was designed to be a JS/TS-first framework, rather than HTML-first. Ripple modules have their own `.ripple` extension, and these modules
fully support TypeScript. By introducing a new extension, it allows Ripple to invent its own superset language, which plays really nicely with
TypeScript and JSX, but with a few interesting touches. In my experience, this has led to better DX not only for humans, but also for LLMs.

Right now, there will be plenty of bugs, things just won't work either and you'll find TODOs everywhere. At this stage, Ripple is more of an early alpha version of something that _might_ be, rather than something you should try and adopt. If anything, maybe some of the ideas can be shared and incubated back into other frameworks. There's also a lot of similarities with Svelte 5, and that's not by accident; that's because of my recent time working on Svelte 5.

If you'd like to know more, join the [Ripple Discord](https://discord.gg/JBF2ySrh2W).

## Features

- **Reactive State Management**: Built-in reactivity with `track` and `@` reactive syntax
- **Component-Based Architecture**: Clean, reusable components with props and children
- **JSX-like Syntax**: Familiar templating with Ripple-specific enhancements
- **Performance**: Fine-grain rendering, with industry-leading performance and memory usage
- **TypeScript Support**: Full TypeScript integration with type checking
- **VSCode Integration**: Rich editor support with diagnostics, syntax highlighting, and IntelliSense
- **Prettier Support**: Full Prettier formatting support for `.ripple` modules

## Missing Features

- **SSR**: Ripple is currently an SPA only, this is because I haven't gotten around to it
- **Types**: The codebase is very raw with limited types; we're getting around to it

## Getting Started

### Try Ripple

> We're working hard on getting an online playground available. Watch this space!

You can try Ripple now by using our basic Vite template either via [StackBlitz](https://stackblitz.com/github/trueadm/ripple/tree/main/templates/basic), or by running these commands in your terminal:

```bash
npx degit trueadm/ripple/templates/basic my-app
cd my-app
npm i # or yarn or pnpm
npm run dev # or yarn or pnpm
```
or use create-ripple interactive CLI tool for creating new Ripple applications with features like Tailwind CSS or Bootstrap setup.
```
npx create-ripple  # or yarn create ripple or pnpm create ripple

```

If you want to install the RippleJS package directly, it is `ripple` on npm:

```bash
npm i --save ripple # or yarn or pnpm
```

## VSCode Extension

The [Ripple VSCode extension](https://marketplace.visualstudio.com/items?itemName=ripplejs.ripple-vscode-plugin) provides:

- **Syntax Highlighting** for `.ripple` files
- **Real-time Diagnostics** for compilation errors
- **TypeScript Integration** for type checking
- **IntelliSense** for autocompletion

You can find the extension on the VS Code Marketplace as [`Ripple for VS Code`](https://marketplace.visualstudio.com/items?itemName=ripplejs.ripple-vscode-plugin).

You can also [manually install the extension](https://github.com/trueadm/ripple/raw/refs/heads/main/packages/ripple-vscode-plugin/published/ripple-vscode-plugin.vsix) `.vsix` that have been manually packaged.

### Mounting your app

You can use the `mount` API from the `ripple` package to render your Ripple component, using the `target`
option to specify what DOM element you want to render the component.

```ts
// index.ts
import { mount } from 'ripple';
import { App } from '/App.ripple';

mount(App, {
  props: {
    title: 'Hello world!',
  },
  target: document.getElementById('root'),
});
```

## Key Concepts

### Components

Define reusable components with the `component` keyword. These are similar to functions in that they have `props`, but crucially,
they allow for a JSX-like syntax to be defined alongside standard TypeScript. That means you do not _return JSX_ like in other frameworks,
but you instead use it like a JavaScript statement, as shown:

```jsx
component Button(props: { text: string, onClick: () => void }) {
  <button onClick={props.onClick}>
    {props.text}
  </button>
}

// Usage
export component App() {
  <Button text="Click me" onClick={() => console.log("Clicked!")} />
}
```

Ripple's templating language also supports shorthands and object spreads too:

```svelte
// you can do a normal prop
<div onClick={onClick}>{text}</div>

// or using the shorthand prop
<div {onClick}>{text}</div>

// and you can spread props
<div {...properties}>{text}</div>
```

### Reactivity

You use `track` to create a single tracked value. The `track` function will created a `Tracked<V>` object that
is not accessible from the outside, and instead you must use `@` to read or write to the tracked value. You can pass the `Tracked<V>` object between components, functions and context
to read and write to the value in different parts of your codebase.

```ts
import { track } from 'ripple';

let name = track('World');
let count = track(0);

// Updates automatically trigger re-renders
@count++;
```

Objects can also contain tracked values with `@` to access the reactive object property:

```ts
import { track } from 'ripple';

let counter = { current: track(0) };

// Updates automatically trigger re-renders
counter.@current++;
```

Tracked derived values are also `Tracked<V>` objects, except you pass a function to `track` rather than a value:

```ts
let count = track(0);
let double = track(() => @count * 2);
let quadruple = track(() => @double * 2);

console.log(@quadruple);
```

If you want to use a tracked value inside a reactive context, such as an effect but you don't want that value to be a tracked dependency, you can use `untrack`:

```ts
let count = track(0);
let double = track(() => @count * 2);
let quadruple = track(() => @double * 2);

effect(() => {
  // This effect will never fire again, as we've untracked the only dependency it has
  console.log(untrack(() => @quadruple));
})
```

> Note: you cannot create `Tracked` objects in module/global scope, they have to be created on access from an active component context.

#### Transporting Reactivity

Ripple doesn't constrain reactivity to components only. `Tracked<V>` objects can simply be passed by reference between boundaries:

```jsx
import { effect, track } from 'ripple';

function createDouble([ count ]) {
  const double = track(() => @count * 2);

  effect(() => {
    console.log('Count:', @count)
  });

  return [ double ];
}

export component App() {
  let count = track(0);

  const [ double ] = createDouble([ count ]);

  <div>{'Double: ' + @double}</div>
  <button onClick={() => { @count++; }}>{'Increment'}</button>
}
```

You can do the same with objects too:

```jsx
import { effect, track } from 'ripple';

function createDouble({ count }) {
  const double = track(() => @count * 2);

  effect(() => {
    console.log('Count:', @count)
  });

  return { double };
}

export component App() {
  let count = track(0);
  const { double } = createDouble({ count });

  <div>{'Double: ' + @double}</div>
  <button onClick={() => { @count++; }}>{'Increment'}</button>
}
```

#### Reactive Arrays

Just like objects, you can use the `Tracked<V>` objects in any standard JavaScript object, like arrays:

```js
let first = track(0);
let second = track(0);
const arr = [first, second];

const total = track(() => arr.reduce((a, b) => a + @b, 0));

console.log(@total);
```

Like shown in the above example, you can compose normal arrays with reactivity and pass them through props or boundaries.

However, if you need the entire array to be fully reactive, including when
new elements get added, you should use the reactive array that Ripple provides.

You'll need to import the `TrackedArray` class from Ripple. It extends the standard JS `Array` class, and supports all of its methods and properties.

```js
import { TrackedArray } from 'ripple';

// using the new constructor
const arr = new TrackedArray(1, 2, 3);

// using static from method
const arr = TrackedArray.from([1, 2, 3]);

// using static of method
const arr = TrackedArray.of(1, 2, 3);
```

The `TrackedArray` is a reactive array, and that means you can access properties normally using numeric index.

#### Reactive Set

The `TrackedSet` extends the standard JS `Set` class, and supports all of its methods and properties.

```js
import { TrackedSet } from 'ripple';

const set = new TrackedSet([1, 2, 3]);
```

TrackedSet's reactive methods or properties can be used directly or assigned to reactive variables.

```jsx
import { TrackedSet, track } from 'ripple';

export component App() {
  const set = new TrackedSet([1, 2, 3]);

  // direct usage
  <p>{"Direct usage: set contains 2: "}{set.has(2)}</p>

  // reactive assignment
  let has = track(() => set.has(2));
  <p>{"Assigned usage: set contains 2: "}{@has}</p>

  <button onClick={() => set.delete(2)}>{"Delete 2"}</button>
  <button onClick={() => set.add(2)}>{"Add 2"}</button>
}
```

#### Reactive Map

The `TrackedMap` extends the standard JS `Map` class, and supports all of its methods and properties.

```js
import { TrackedMap, track } from 'ripple';

const map = new TrackedMap([[1,1], [2,2], [3,3], [4,4]]);
```

TrackedMap's reactive methods or properties can be used directly or assigned to reactive variables.

```jsx
import { TrackedMap, track } from 'ripple';

export component App() {
  const map = new TrackedMap([[1,1], [2,2], [3,3], [4,4]]);

  // direct usage
  <p>{"Direct usage: map has an item with key 2: "}{map.has(2)}</p>

  // reactive assignment
  let has = track(() => map.has(2));
  <p>{"Assigned usage: map has an item with key 2: "}{@has}</p>

  <button onClick={() => map.delete(2)}>{"Delete item with key 2"}</button>
  <button onClick={() => map.set(2, 2)}>{"Add key 2 with value 2"}</button>
}
```

### Effects

When dealing with reactive state, you might want to be able to create side-effects based upon changes that happen upon updates.
To do this, you can use `effect`:

```jsx
import { effect, track } from 'ripple';

export component App() {
  let count = track(0);

  effect(() => {
    console.log(@count);
  });

  <button onClick={() => @count++}>{'Increment'}</button>
}
```

### Control flow

The JSX-like syntax might take some time to get used to if you're coming from another framework. For one, templating in Ripple
can only occur _inside_ a `component` body – you can't create JSX inside functions, or assign it to variables as an expression.

```jsx
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

If blocks work seamlessly with Ripple's templating language, you can put them inside the JSX-like
statements, making control-flow far easier to read and reason with.

```jsx
component Truthy({ x }) {
  <div>
    if (x) {
      <span>{'x is truthy'}</span>
    } else {
      <span>{'x is falsy'}</span>
    }
  </div>
}
```

### For statements

You can render collections using a `for...of` block, and you don't need to specify a `key` prop like
other frameworks.

```jsx
component ListView({ title, items }) {
  <h2>{title}</h2>
  <ul>
    for (const item of items) {
      <li>{item.text}</li>
    }
  </ul>
}
```

You can use Ripple's reactive arrays to easily compose contents of an array.

```jsx
import { TrackedArray } from 'ripple';

component Numbers() {
  const items = new TrackedArray(1, 2, 3);

  for (const item of items) {
    <div>{item}</div>
  }

  <button onClick={() => items.push(`Item ${items.length + 1}`)}>{"Add Item"}</button>
}
```

Clicking the `<button>` will create a new item.

### Try statements

Try blocks work to build the foundation for **error boundaries**, when the runtime encounters
an error in the `try` block, you can easily render a fallback in the `catch` block.

```jsx
import { reportError } from 'some-library';

component ErrorBoundary() {
  <div>
    try {
      <ComponentThatFails />
    } catch (e) {
      reportError(e);

      <div>{'An error occurred! ' + e.message}</div>
    }
  </div>
}
```

### Children

Use `children` prop and then use it in the form of `<children />` for component composition.

When you pass in children to a component, it gets implicitly passed as the `children` prop, in the form of a component.

```jsx
import type { Component } from 'ripple';

component Card(props: { children: Component }) {
  <div class="card">
    <props.children />
  </div>
}

// Usage
<Card>
  <p>{"Card content here"}</p>
</Card>
```

You could also explicitly write the same code as shown:

```jsx
import type { Component } from 'ripple';

component Card(props: { children: Component }) {
  <div class="card">
    <props.children />
  </div>
}

// Usage with explicit component
<Card>
  component children() {
    <p>{"Card content here"}</p>
  }
</Card>
```

### Accessor Props

When working with props on composite components (`<Foo>` rather than `<div>`), it can sometimes be difficult to debug why a certain value is a certain way. JavaScript gives us a way to do this on objects using the `get` syntax:

```js
let name = 'Bob';

const object = {
  get name() {
    // I can easily debug when this property gets
    // access and track it easily
    console.log(name);
    return name;
  }
}
```

So Ripple provides similar capabilities when working with composite components in a template, specifically using `prop:={}` rather than the typical `prop={}`.


```jsx
let name = track('Bob');

const getName = () => {
  // I can easily debug when this property gets
  // access and track it easily
  console.log(@name);
  return @name;
};

<Person name:={getName} />
```

You can also inline the function too:

```jsx
let name = track('Bob');

<Person name:={() => {
  // I can easily debug when this property gets
  // access and track it easily
  console.log(@name);
  return @name;
}} />
```

Furthermore, just like property accessors in JavaScript, Ripple provides a way of capturing the `set` too, enabling two-way data-flow on composite component props. You just need to provide a second function after the first, separated using a comma:

```jsx
let name = track('Bob');

const getName = () => {
  return @name;
}

const setName = (newName) => {
  @name = newName;
}

<Person name:={getName, setName} />
```

Or an inlined version:

```jsx
let name = track('Bob');

<Person name:={() => @name, (newName) => @name = newName} />
```

Now changes in the `Person` to its `props` will propagate to its parent component:

```jsx
component Person(props) {
  const updateName = (newName) => {
    props.name = newName;
  }

  <NameInput onChange={updateName}>
}
```

### Refs

Ripple provides a consistent way to capture the underlying DOM element – refs. Specifically, using
the syntax `{ref fn}` where `fn` is a function that captures the DOM element. If you're familiar with other frameworks, then
this is identical to `{@attach fn}` in Svelte 5 and somewhat similar to `ref` in React. The hook function will receive
the reference to the underlying DOM element.

```jsx
export component App() {
  let node = track();

  const divRef = (node) => {
    @node = node;
    console.log("mounted", node);

    return () => {
      @node = undefined;
      console.log("unmounted", node);
    };
  };

  <div {ref divRef}>{"Hello world"}</div>
}
```

You can also create `{ref}` functions inline.

```jsx
export component App() {
  let node = track();

  <div {ref (node) => {
    @node = node;
    return () => @node = undefined;
  }}>{"Hello world"}</div>
}
```

You can also use function factories to define properties, these are functions that return functions that do the same
thing. However, you can use this pattern to pass reactive properties.

```jsx
import { fadeIn } from 'some-library';

export component App({ ms }) {
  <div {ref fadeIn({ ms })}>{"Hello world"}</div>
}
```

Lastly, you can use refs on composite components.

```jsx
<Image {ref (node) => console.log(node)} {...props} />
```

When passing refs to composite components (rather than HTML elements) as shown above, they will be passed a `Symbol` property, as they are not named. This still means that it can be spread to HTML template elements later on and still work.

#### createRefKey

Creates a unique object key that will be recognised as a ref when the object is spread onto an element.
This allows programmatic assignment of refs without relying directly on the `{ref ...}` template syntax.

```jsx
import { createRefKey } from 'ripple';

export component App() {
  let value = track('');

  const props = {
    id: "example",
    @value,
    [createRefKey()]: (node) => {
      const removeListener = node.addEventListener('input', (e) => @value = e.target.value);

      return () => {
        removeListener();
      }
    }
  };

  // applied to an element
  <input type="text" {...props} />

  // with composite component
  <Input {...props} />
}

component Input({ id, value, ...rest }) {
  <input type="text" {id} {value} {...rest} />
}
```

### Event Props

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

```jsx
component MyComponent() {
  <div class="container"><h1>{'Hello World'}</h1></div>

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

### Context

Ripple has the concept of `context` where a value or reactive object can be shared through the component tree –
like in other frameworks. This all happens from the `createContext` function that is imported from `ripple`.

When you create a context, you can `get` and `set` the values, but this must happen within the context of a component (they can physically live anywhwere, they just need to be called from a component context). Using them outside will result in an error being thrown.

```jsx
import { createContext } from 'ripple';

const MyContext = createContext(null);

component Child() {
  // Context is read in the Child component
  const value = MyContext.get();

  // value is "Hello from context!"
  console.log(value);
}

component Parent() {
  const value = MyContext.get();

  // Context is read in the Parent component, but hasn't yet
  // been set, so we fallback to the initial context value.
  // So the value is `null`
  console.log(value);

  // Context is set in the Parent component
  MyContext.set("Hello from context!");

  <Child />
}
```

## Contributing

We are happy for your interest in contributing. Please see our [contributing guidelines](CONTRIBUTING.md) for more information.

## License

See the [MIT license](LICENSE).
