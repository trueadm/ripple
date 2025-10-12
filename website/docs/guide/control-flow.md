---
title: Control flow in Ripple
---

# Control flow

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

## Switch statements

Switch statements let you conditionally render content based on a value. They work with both static and reactive values.

<Code>

```ripple
component StatusIndicator({ status }) {
  <div>
    switch (status) {
      case 'loading':
        <p>{'Loading...'}</p>
        break;
      case 'success':
        <p>{'Success!'}</p>
        break;
      case 'error':
        <p>{'Error!'}</p>
        break;
      default:
        <p>{'Unknown status'}</p>
    }
  </div>
}
```

</Code>

You can also use reactive values with switch statements.

<Code>

```ripple
import { track } from 'ripple';

component InteractiveStatus() {
  let status = track('loading');

  <button onClick={() => @status = 'success'}>{'Success'}</button>
  <button onClick={() => @status = 'error'}>{'Error'}</button>

  <div>
    switch (@status) {
      case 'loading':
        <p>{'Loading...'}</p>
        break;
      case 'success':
        <p>{'Success!'}</p>
        break;
      case 'error':
        <p>{'Error!'}</p>
        break;
      default:
        <p>{'Unknown status'}</p>
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
    <div>{item.label}{' at index '}{i}</div>
  }
```

You can also provide a `key` for efficient list updates and reconciliation:

```ripple
  for (const item of items; index i; key item.id) {
    <div>{item.label}{' at index '}{i}</div>
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

## Dynamic Elements

You can render dynamic HTML elements by storing the tag name in a tracked variable and using the `<@tagName>` syntax:

```ripple
export component App() {
	let tag = track('div');

	<@tag class="dynamic">{'Hello World'}</@tag>
	<button onClick={() => @tag = @tag === 'div' ? 'span' : 'div'}>{'Toggle Element'}</button>
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
