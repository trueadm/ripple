---
title: Events in Ripple
---

# {{ $frontmatter.title }}


### Event Handling

Events follow React-style naming (`onClick`, `onPointerMove`, etc.):

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

For capture phase events, add `Capture` suffix:
- `onClickCapture`
- `onPointerDownCapture`
