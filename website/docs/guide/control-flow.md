---
title: Control flow in Ripple
---

# Control flow

The JSX-like syntax might take some time to get used to if you're coming from
another framework. For one, templating in Ripple can only occur _inside_ a
`component` body – you can't create JSX inside functions, or assign it to
variables as an expression.

```ripple
<div>
  // you can create variables inside the template!
  const str = "hello world";

  console.log(str); // and function calls too!

  debugger; // you can put breakpoints anywhere to help debugging!

  {str}
</div>
```

::: info Note
Strings inside the template need to be inside `{"string"}`, you can't
do `<div>hello</div>` as Ripple has no idea if `hello` is a string or maybe some
JavaScript code that needs evaluating, so just ensure you wrap them in curly
braces. This shouldn't be an issue in the real-world anyway, as you'll likely
use an i18n library that means using JavaScript expressions regardless.
:::

## If statements

If blocks work seamlessly with Ripple's templating language, you can put them
inside the JSX-like statements, making control-flow far easier to read and
reason with.

<Code>

```ripple
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

</Code>

## For statements

You can render collections using a `for...of` loop.

<Code>

```ripple
component ListView({ title, items }) {
  <h2>{title}</h2>
  <ul>
    for (const item of items) {
      <li>{item.text}</li>
    }
  </ul>
}

// usage
export default component App() {
	<ListView
		title="My List"
		items={[
			{ text: "Item 1" },
			{ text: "Item 2" },
			{ text: "Item 3" },
		]}
	/>
}
```

</Code>

The `for...of` loop has also a built-in support for accessing the loops
numerical index. The `label` index declares a variable that will used to assign
the loop's index.

```ripple
  for (const item of items; index i) {
    <div>{item}{' at index '}{i}</div>
  }
```

You can use Ripple's reactive arrays to easily compose contents of an array.

<Code>

```ripple
import { TrackedArray } from 'ripple';

component Numbers() {
  const array = new TrackedArray(1, 2, 3);

  for (const item of array; index i) {
    <div>{item}{' at index '}{i}</div>
  }

  <button onClick={() => array.push(array.length + 1)}>{"Add Item"}</button>
}
```

</Code>

Clicking the `<button>` will create a new item.

::: info Note
`for...of` loops inside components must contain either dom elements or
components. Otherwise, the loop can be run inside an `effect` or function.
:::

## Try statements

Try blocks work to build the foundation for **error boundaries**, when the
runtime encounters an error in the `try` block, you can easily render a fallback
in the `catch` block.

```ripple
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

## Async (Suspense boundaries) <Badge type="warning" text="Experimental" />

```ripple
component SuspenseBoundary() {
	try {
		<AsyncComponent />
	} pending {
		<p>{'Loading...'}</p> // fallback
	}
}
```
