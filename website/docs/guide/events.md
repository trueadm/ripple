---
title: Event Binding in Ripple
---

# Event Binding with Props

Ripple deviates slightly from standard JS in terms of event names. Like most
frameworks except for React, we rely on the native event system of the browser.
However, Ripple doesn't use the same all-lowercase props/attributes to bind
events — a camelCase convention is used instead, shown below:

- `onclick` -> `onClick`
- `onpointermove` -> `onPointerMove`
- `onpointerdown` -> `onPointerDown`
- `onkeydown` -> `onKeyDown`

For `capture` phase events, just add `Capture` to the end of the prop name:

- `onClickCapture`
- `onPointerMoveCapture`
- `onPointerDownCapture`
- `onKeyDownCapture`

::: info
Some events are automatically delegated by the compiler where possible
to improve runtime performance.
:::

<Code>

```ripple
import { track } from '@ripple-ts/ripple';

export component EventExample() {
	let message = track("");

	<div>
		<button onClick={() => @message = "Clicked!"}>{"Click me"}</button>
		<input onInput={(e) => @message = e.target.value}/>
		<p>{@message}</p>
	</div>
}
```

</Code>

### `on()`

Attaches an event handler to an element and returns a function to remove it.

Unlike using `addEventListener`, `on()` guarantees proper execution order with
respect to attribute-based handlers such as `onClick`, and is also optimized
with event delegation for events that support it.

<Code console>

```ripple
import { effect, on } from '@ripple-ts/ripple';

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

</Code>
