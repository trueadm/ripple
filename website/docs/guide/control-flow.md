---
title: Control flow in Ripple
---

# Control flow

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

## If statements

If blocks work seamlessly with Ripple's templating language, you can put them inside the JSX-like
statements, making control-flow far easier to read and reason with.

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

## For statements

You can render collections using a `for...of` block, and you don't need to specify a `key` prop unlike
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

You can use Ripple's reactive arrays to easily compose contents of an array.

```ripple
import { RippleArray } from 'ripple';

component Numbers() {
  const items = new RippleArray(1, 2, 3);

  for (const item of items) {
    <div>{item}</div>
  }

  <button onClick={() => items.push(`Item ${items.$length + 1}`)}>{"Add Item"}</button>
}
```

Clicking the `<button>` will create a new item, note that `items` is not `$` prefixed, because it's not
reactive, but rather its properties are instead.

## Try statements

Try blocks work to build the foundation for **error boundaries**, when the runtime encounters
an error in the `try` block, you can easily render a fallback in the `catch` block.

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
		<p>Loading...</p> // fallback
	}
}
```
