---
title: Event Binding in Ripple
---

# Event Binding with Props

Like React, Ripple deviates from the standard with event handlers. Here, events
are camelCased props that start with 'on', unlike standard HTML.

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


```ripple
component EventExample() {
  let message = track("");

  <div>
    <button onClick={() => @message = "Clicked!"}>{"Click me"}</button>
    <input onInput={(e) => @message = e.target.value} />
    <p>{$message}</p>
  </div>
}
```

### `on()`

Attaches an event handler to an element and returns a function to remove it.
Unlike using `addEventListener`, `on()` guarantees proper execution order with
respect to attribute-based handlers such as `onClick`, and is optimized
with event delegation for events that support it.

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
