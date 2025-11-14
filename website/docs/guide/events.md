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
Some events are automatically delegated by the compiler wherever possible,
to improve runtime performance.
:::

<Code>

```ripple
import { track } from 'ripple';

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

## Event Attribute Objects

Instead of passing a function directly to an event attribute, you can pass an
object that implements the same options that [addEventListener](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener) can specify
along with additional options. This allows you greater flexibility in defining
and controlling Ripple event handling.

### `handleEvent`

**Type:** `(event: Event) => void`

The function that will be called when the event fires. This is the only required
property when using an object as an event handler. [MDN Documentation](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#once)

```ripple
<button onClick={{
	handleEvent: (e) => console.log('clicked!'),
}}>
	{"Click me"}
</button>
```

### `capture`

**Type:** `boolean` (default: `false`)

When `true`, the event is handled during the capture phase instead of the
bubble phase. This is equivalent to using the `Capture` suffix on the event
name. [MDN Documentation](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#capture)

```ripple
import { track } from 'ripple';

export component EventExample() {
	let order = #[];

	<div onClick={{
		handleEvent: () => order.push('outer-capture'),
		capture: true,
	}}>
		<button onClick={() => order.push('inner-bubble')}>
			{"Click"}
		</button>
		<p>{order.join(' → ')}</p>
	</div>
}
// Clicking button outputs: outer-capture → inner-bubble
```

### `once`

**Type:** `boolean` (default: `false`)

When `true`, the event listener is automatically removed after it fires once.
This is useful for one-time setup or cleanup operations. [MDN Documentation](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#once)

```ripple
import { track } from 'ripple';

export component EventExample() {
	let count = track(0);

	<button onClick={{
		handleEvent: () => @count++,
		once: true,
	}}>
		{"Click me (only works once)"}
	</button>
	<p>{`Clicks: ${@count}`}</p>
}
// Button only responds to the first click
```

### `passive`

**Type:** `boolean` (default: `false`)

When `true`, indicates that the event listener will never call `preventDefault()`.
This allows the browser to optimize scrolling and touch event performance. Some
events like `touchstart`, `touchmove`, `wheel`, and `mousewheel` are passive by
default. [MDN Documentation](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#passive)

```ripple
<div onWheel={{
	handleEvent: (e) => {
		// This preventDefault() will be ignored in passive mode
		e.preventDefault();
		console.log('scrolling');
	},
	passive: true,
}}>
	{"Scroll over me"}
</div>
```

::: warning
Attempting to call `preventDefault()` in a passive listener will have no effect
and may trigger a console warning in some browsers.
:::

### `signal`

**Type:** `AbortSignal`

An `AbortSignal` that can be used to remove the event listener programmatically.
This is particularly useful for cleaning up event listeners when a component's
state changes or when an async operation is cancelled. [MDN Documentation](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#signal)

### `delegated`

**Type:** `boolean` (default: `true` for supported events)

Controls whether the event uses Ripple's event delegation system. When `true`
(the default for supported events), multiple event handlers for the same event
type are optimized by attaching a single listener at the root level. Set to
`false` to attach the listener directly to the element.

Event delegation is automatically disabled for:

- Events with `capture`, `passive`, `once`, or `signal` options
- Events that don't support delegation (like `focus`, `blur`, `load`, etc.)

```ripple
export component EventExample() {
	<button onClick={{
		handleEvent: () => console.log('clicked'),
		delegated: false, // Attach listener directly to this button
	}}>
		{"Click me"}
	</button>
}
```

### `customName`

**Type:** `string`

Overrides the event name used for the listener. This is useful for custom events
or when you want to use a different event name than the lower-cased name that's inferred from the
attribute.

```ripple
import { track } from 'ripple';

export component EventExample() {
	let count = track(0);

	<div onMyCustomEvent={{
		handleEvent: (e) => @count += e.detail.value,
		customName: 'MyCustomEvent',
	}}>
		{'Custom event target'}
	</div>
	<p>{`Event count: ${@count}`}</p>
}
// The element listens for 'MyCustomEvent' instead of 'mycustomevent'
```

## `on()`

Attaches an event handler to an element and returns a function to remove it.

Unlike using `addEventListener`, `on()` guarantees proper execution order with
respect to attribute-based handlers such as `onClick`, and is also optimized
with event delegation for events that support it.

The options, exluding `customName`, that can be passed in to `on()` are the
same ones that can be used for event attributes with the object syntax.

<Code console>

```ripple
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

</Code>
