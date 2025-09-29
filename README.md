<a href="https://ripplejs.com">
  <picture>
    <source media="(min-width: 768px)" srcset="assets/ripple-desktop.png">
    <img src="assets/ripple-mobile.png" alt="Ripple - the elegant TypeScript UI framework" />
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

## Features

- **Reactive State Management**: Built-in reactivity with `track` and `@` reactive syntax
- **Component-Based Architecture**: Clean, reusable components with props and children
- **JSX-like Syntax**: Familiar templating with Ripple-specific enhancements
- **Performance**: Fine-grain rendering, with industry-leading performance, bundle-size and memory usage
- **TypeScript Support**: Full TypeScript integration with type checking
- **VSCode Integration**: Rich editor support with diagnostics, syntax highlighting, and IntelliSense
- **Prettier Support**: Full Prettier formatting support for `.ripple` modules

## Missing Features

- **SSR**: Ripple is currently an SPA only. It will have SSR soon! Hydration to follow after.

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

You use `track` to create a single tracked value. The `track` function will created a boxed `Tracked<V>` object that
is not accessible from the outside, and instead you must use `@` to unbox the `Tracked<V>` object to read or write its underlying value. You can pass the `Tracked<V>` object between components, functions and context
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

#### track with get / set

The optional get and set parameters of the `track` function let you customize how a tracked value is read or written, similar to property accessors but expressed as pure functions. The get function receives the current stored value and its return value is exposed when the tracked value is accessed / unboxed with `@`. The set function should return the value that will actually be stored and receives two parameters: the first is the one being assigned and the second with the previous value. The get and set functions may be useful for tasks such as logging, validating, or transforming values before they are exposed or stored.

```jsx
import { track } from 'ripple';

export component App() {
  let count = track(0,
    (current) => {
      console.log(current);
      return current;
    },
    (next, prev) => {
      console.log(prev);
      if (typeof next === 'string') {
        next = Number(next);
      }

      return next;
    }
  );
}
```

> Note: If no value is returned from either `get` or `set`, `undefined` is either exposed (for get) or stored (for set). Also, if only supplying the `set`, the `get` parameter must be set to `undefined`.

#### trackSplit Function

The `trackSplit` "splits" a plain object — such as component props — into specified tracked variables and an extra `rest` property containing the remaining unspecified object properties.

```jsx
const [children, count, rest] = trackSplit(props, ['children', 'count']);
```

When working with component props, destructuring is often useful — both for direct use as variables and for collecting remaining properties into a `rest` object (which can be named arbitrarily). If destructuring happens in the component argument, e.g. `component Child({ children, value, ...rest })`, Ripple automatically links variable access to the original props — for example, `value` is compiled to `props.value`, preserving reactivity.

However, destructuring inside the component body, e.g. `const { children, value, ...rest } = props`, for read-only reactive props, does not preserve reactivity (too complicated to implement due to many edge cases). To ensure destructured read-only reactive props remain reactive in this case, use the `trackSplit` function.

> Note: boxed / wrapped Tracked objects are always reactive since the cross boundaries by reference. Props that were not declared with `track()` are never reactive and always render the same value that was initially passed in.

A full example utilizing various Ripple constructs demonstrates the `split` option usage:

```jsx
import { track, trackSplit } from 'ripple';
import type { PropsWithChildren, Tracked } from 'ripple';

component Child(props: PropsWithChildren<{ count: Tracked<number>, className: string }>) {
  // children, count are always reactive
  // but className is passed in as a read-only reactive value
  const [children, count, className, rest] = trackSplit(props, ['children', 'count', 'class']);

  <button class={@className} {...@rest}><@children /></button>
  <pre>{`Count is: ${@count}`}</pre>
  <button onClick={() => @count++}>{'Increment Count'}</button>
}

export component App() {
    let count = track(0,
    (current) => {
      console.log('getter', current);
      return current;
    },
    (next) => {
      console.log('setter', next);
      return next;
    }
  );
  let className = track('shadow');
  let name = track('Click Me');

  function buttonRef(el) {
    console.log('ref called with', el);
    return () => {
      console.log('cleanup ref for', el);
    };
  }

  <Child
    class={@className}
    onClick={() => { @name === 'Click Me' ? @name = 'Clicked' : @name = 'Click Me'; @className = ''}}
    count={count}
    {ref buttonRef}
  >{@name}</Child>;
}
```

With the regular destructuring, such as the one below, the `count` and `class` properties would lose their reactivity:

```jsx
// ❌ WRONG Reactivity would be lost
let { children, count, class: className, ...rest } = props;
```

> Note: Make sure the resulting `rest`, if it's going to be spread onto a dom element, does not contain `Tracked` values. Otherwise, you'd be spreading not the actual values but the boxed ones, which are objects that will appear as `[Object object]` on the dom element.

#### Transporting Reactivity

Ripple doesn't constrain reactivity to components only. `Tracked<V>` objects can simply be passed by reference between boundaries:

```jsx
import { effect, track } from 'ripple';

function createDouble(count) {
  const double = track(() => @count * 2);

  effect(() => {
    console.log('Count:', @count)
  });

  return double;
}

export component App() {
  let count = track(0);

  const double = createDouble(count);

  <div>{'Double: ' + @double}</div>
  <button onClick={() => { @count++; }}>{'Increment'}</button>
}
```

#### Dynamic Components

Ripple has built-in support for dynamic components, a way to render different components based on reactive state. Instead of hardcoding which component to show, you can store a component in a `Tracked` via `track()`, and update it at runtime. When the tracked value changes, Ripple automatically unmounts the previous component and mounts the new one. Dynamic components are written with the `<@Component />` tag, where the @ both unwraps the tracked reference and tells the compiler that the component is dynamic. This makes it straightforward to pass components as props or swap them directly within a component, enabling flexible, state-driven UIs with minimal boilerplate.

```jsx
export component App() {
  let swapMe = track(() => Child1);

  <Child {swapMe} />

  <button onClick={() => @swapMe = @swapMe === Child1 ? Child2 : Child1}>{'Swap Component'}</button>
}

component Child({ swapMe }: {swapMe: Tracked<Component>}) {
  <@swapMe />
}

component Child1(props) {
  <pre>{'I am child 1'}</pre>
}

component Child2(props) {
  <pre>{'I am child 2'}</pre>
}
```

#### Simple Reactive Arrays

Just like objects, you can use the `Tracked<V>` objects in any standard JavaScript object, like arrays:

```js
let first = track(0);
let second = track(0);
const arr = [first, second];

const total = track(() => arr.reduce((a, b) => a + @b, 0));

console.log(@total);
```

Like shown in the above example, you can compose normal arrays with reactivity and pass them through props or boundaries.

However, if you need the entire array to be fully reactive, including when new elements get added, you should use the reactive array that Ripple provides.

#### Fully Reactive Array

`TrackedArray` class from Ripple extends the standard JS `Array` class, and supports all of its methods and properties. Import it from the `'ripple'` namespace or use the provided syntactic sugar for a quick creation via the bracketed notation. All elements existing or new of the `TrackedArray` are reactive and respond to the various array operations such as push, pop, shift, unshift, etc. Even if you reference a non-existent element, once it added, the original reference will react to the change. You do NOT need to use the unboxing `@` with the elements of the array.

```jsx
import { TrackedArray } from 'ripple';

// using syntactic sugar `#`
const arr = #[1, 2, 3];

// using the new constructor
const arr = new TrackedArray(1, 2, 3);

// using static from method
const arr = TrackedArray.from([1, 2, 3]);

// using static of method
const arr = TrackedArray.of(1, 2, 3);
```

Usage Example:

```jsx
export component App() {
  const items = #[1, 2, 3];

  <div>
    <p>{"Length: "}{items.length}</p>  // Reactive length
    for (const item of items) {
      <div>{item}</div>
    }
    <button onClick={() => items.push(items.length + 1)}>{"Add"}</button>
  </div>
}
```

#### Reactive Object

`TrackedObject` class extends the standard JS `Object` class, and supports all of its methods and properties. Import it from the `'ripple'` namespace or use the provided syntactic sugar for a quick creation via the curly brace notation. `TrackedObject` fully supports shallow reactivity and any property on the root level is reactive. You can even reference non-existent properties and once added the original reference reacts to the change. You do NOT need to use the unboxing `@` with the properties of the `TrackedObject`.

```jsx
import { TrackedObject } from 'ripple';

// using syntactic sugar `#`
const arr = #{a: 1, b: 2, c: 3};

// using the new constructor
const arr = new TrackedObject({a: 1, b: 2, c: 3});
```

Usage Example:

```jsx
export component App() {
  const obj = #{a: 0}

  obj.a = 0;

  <pre>{'obj.a is: '}{obj.a}</pre>
  <pre>{'obj.b is: '}{obj.b}</pre>
  <button onClick={() => { obj.a++; obj.b = obj.b ?? 5; obj.b++; }}>{'Increment'}</button>
}
```

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

<!-- prettier-ignore -->
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

#### Reactive Date

The `TrackedDate` extends the standard JS `Date` class, and supports all of its methods and properties.

```js
import { TrackedDate } from 'ripple';

const date = new TrackedDate(2026, 0, 1); // January 1, 2026
```

TrackedDate's reactive methods or properties can be used directly or assigned to reactive variables. All getter methods (`getFullYear()`, `getMonth()`, `getDate()`, etc.) and formatting methods (`toISOString()`, `toDateString()`, etc.) are reactive and will update when the date is modified.

```jsx
import { TrackedDate, track } from 'ripple';

export component App() {
  const date = new TrackedDate(2025, 0, 1, 12, 0, 0);

  // direct usage
  <p>{"Direct usage: Current year is "}{date.getFullYear()}</p>
  <p>{"ISO String: "}{date.toISOString()}</p>

  // reactive assignment
  let year = track(() => date.getFullYear());
  let month = track(() => date.getMonth());
  <p>{"Assigned usage: Year "}{@year}{", Month "}{@month}</p>

  <button onClick={() => date.setFullYear(2027)}>{"Change to 2026"}</button>
  <button onClick={() => date.setMonth(11)}>{"Change to December"}</button>
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

### After Update tick()

The `tick()` function returns a Promise that resolves after all pending reactive updates have been applied to the DOM. This is useful when you need to ensure that DOM changes are complete before executing subsequent code, similar to Vue's `nextTick()` or Svelte's `tick()`.

```jsx
import { effect, track, tick } from 'ripple';

export component App() {
  let count = track(0);

  effect(() => {
    @count;

    if (@count === 0) {
      console.log('initial run, skipping');
      return;
    }

    tick().then(() => {
      console.log('after the update');
    });
  });

  <button onClick={() => @count++}>{'Increment'}</button>
}
```

### Control flow

The JSX-like syntax might take some time to get used to if you're coming from another framework. For one, templating in Ripple
can only occur _inside_ a `component` body – you can't create JSX inside functions, or assign it to variables as an expression.

<!-- prettier-ignore -->
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

You can render collections using a `for...of` loop.

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

The `for...of` loop has also a built-in support for accessing the loops numerical index. The `label` index declares a variable that will used to assign the loop's index.

```jsx
  for (const item of items; index i) {
    <div>{item}{' at index '}{i}</div>
  }
```

You can use Ripple's reactive arrays to easily compose contents of an array.

```jsx
import { TrackedArray } from 'ripple';

component Numbers() {
  const array = new TrackedArray(1, 2, 3);

  for (const item of array; index i) {
    <div>{item}{' at index '}{i}</div>
  }

  <button onClick={() => array.push(`Item ${array.length + 1}`)}>{"Add Item"}</button>
}
```

Clicking the `<button>` will create a new item.

> Note: `for...of` loops inside components must contain either dom elements or components. Otherwise, the loop can be run inside an `effect` or function.

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

### Refs

Ripple provides a consistent way to capture the underlying DOM element – refs. Specifically, using
the syntax `{ref fn}` where `fn` is a function that captures the DOM element. If you're familiar with other frameworks, then
this is identical to `{@attach fn}` in Svelte 5 and somewhat similar to `ref` in React. The hook function will receive
the reference to the underlying DOM element.

```jsx
export component App() {
  let div = track();

  const divRef = (node) => {
    @div = node;
    console.log("mounted", node);

    return () => {
      @div = undefined;
      console.log("unmounted", node);
    };
  };

  <div {ref divRef}>{"Hello world"}</div>
}
```

You can also create `{ref}` functions inline.

```jsx
export component App() {
  let div = track();

  <div {ref (node) => {
    @div = node;
    return () => @div = undefined;
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

### Raw HTML

By default, all text nodes in Ripple are escaped to prevent unintended script
injections. If you'd like to render trusted HTML onto your page, you can use the
HTML directive to opt-out:

```jsx
export component App() {
	let source = `
<h1>My Blog Post</h1>
<p>Hi! I like JS and Ripple.</p>
`

	<article>
		{html source}
	</article>
}
```

### Events

#### Event Props

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

However, and important distinction is that Ripple does not have a synthetic event system like React. So for example, you should opt to use
`onInput` instead of `onChange` and things like `onFocus` and `onBlur` do not bubble – instead use `onFocusIn` and `onFocusOut`.

> Note: Some events are automatically delegated where possible by Ripple to improve runtime performance.

#### on

Adds an event handler to an element and returns a function to remove it. Compared to using addEventListener directly, this method guarantees the proper execution order with respect to attribute-based handlers such as `onClick`, and similarly optimized through event delegation for those events that support it. We strongly advise to use it instead of addEventListener.

```jsx
import { effect, on } from 'ripple';

export component App() {
  effect(() => {
    // on component mount
    const removeListener = on(window, 'resize', () => {
      console.log('Window resized!');
    });

    // return the removeListener when the component unmounts
    return removeListener;
  });
}
```

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

#### Dynamic Classes

In Ripple, the `class` attribute can accept more than just a string — it also supports objects and arrays. Truthy values are included as class names, while falsy values are omitted. This behavior is powered by the `clsx` library.

Examples:

```jsx
let includeBaz = track(true);
<div class={{ foo: true, bar: false, baz: @includeBaz }}></div>
// becomes: class="foo baz"

<div class={['foo', {baz: false}, 0 && 'bar', [true && 'bat'] ]}></div>
// becomes: class="foo bat"

let count = track(3);
<div class={['foo', {bar: @count > 2}, @count > 3 && 'bat']}></div>
// becomes: class="foo bar"
```

#### Dynamic Inline Styles

Sometimes you might need to dynamically set inline styles. For this, you can use the `style` attribute, passing either a string or an object to it:

```jsx
let color = track('red');

<div style={`color: ${@color}; font-weight: bold; background-color: gray`}></div>
<div style={{ color: @color, fontWeight: 'bold', 'background-color': 'gray' }}></div>

 const style = {
  @color,
  fontWeight: 'bold',
  'background-color': gray,
};

// using object spread
<div {...style}></div>
```

Both examples above will render the same inline styles, however, it's recommended to use the object notation as it's typically more performance optimized.

> Note: When passing an object to the `style` attribute, use can either use camelCase or kebab-case for CSS property names.

### Context

Ripple has the concept of `context` where a value or reactive object can be shared through the component tree –
like in other frameworks. This all happens from the `createContext` function that is imported from `ripple`.

Creating contexts may take place anywhere. Contexts can contain anything including tracked values or objects. However, context cannot be read via `get` or written to via `set` inside an event handler or at the module level as it must happen within the context of a component. A good strategy is to assign the contents of a context to a variable via the `.get()` method during the component initialization and use this variable for reading and writing.

Example with tracked / reactive contents:

```jsx
import { track, createContext } from "ripple"

// create context with an empty object
const context  = createContext({});
const context2 = createContext();

export component App() {
  // get reference to the object
  const obj = context.get();
  // set your reactive value
  obj.count = track(0);

  // create another tracked variable
  const count2 = track(0);
  // context2 now contains a trackrf variable
  context2.set(count2);

  <button onClick={() => { obj.@count++; @count2++ }}>
    {'Click Me'}
  </button>

  // context's reactive property count gets updated
  <pre>{'Context: '}{context.get().@count}</pre>
  <pre>{'Context2: '}{@count2}</pre>
}
```

> Note: `@(context2.get())` usage with `@()` wrapping syntax will be enabled in the near future

Passing data between components:

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

You can also pass a reactive `Tracked<V>` object through context and read it at the other side.

```jsx
import { createContext, effect } from 'ripple';

const MyContext = createContext(null);

component Child() {
  const count = MyContext.get();

  effect(() => {
    console.log(@count);
  });
}

component Parent() {
  const count = track(0);

  MyContext.set(count);

  <Child />

  <button onClick={() => @count++}>{"increment count"}</button>
}
```

## Testing

We recommend using Ripple using Ripple's Vite plugin. We also recommend using Vitest for testing. When using Vitest, make sure to configure your `vitest.config.js` according by using this template config:

```js
import { configDefaults, defineConfig } from 'vitest/config';
import { ripple } from 'vite-plugin-ripple';

export default defineConfig({
  plugins: [ripple()],
  resolve: process.env.VITEST ? { conditions: ['browser'] } : undefined,
  test: {
    include: ['**/*.test.ripple'],
    environment: 'jsdom',
    ...configDefaults.test,
  },
});
```

Then you can create a `example.test.ripple` module and put your Vitest test assertions in that module.

## Contributing

We are happy for your interest in contributing. Please see our [contributing guidelines](CONTRIBUTING.md) for more information.

## License

See the [MIT license](LICENSE).
