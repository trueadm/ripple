---
title: Event Handling in Ripple
---

# Events

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
  let $message = "";

  <div>
    <button onClick={() => $message = "Clicked!"}>{"Click me"}</button>
    <input onInput={(e) => $message = e.target.value} />
    <p>{$message}</p>
  </div>
}
```
