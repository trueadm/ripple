---
title: Styling in Ripple
---

# Styling

Ripple supports native CSS styling that is localized to the given component using the `<style>` element.

```ripple
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
::: info
Note: the `<style>` element must be top-level within a `component`.
:::

## Dynamic Classes

In Ripple, the `class` attribute can accept more than just a string — it also supports objects and arrays. Truthy values are included as class names, while falsy values are omitted. This behavior is powered by the `clsx` library.

Examples:

```ripple
let includeBaz = track(true);
<div class={{ foo: true, bar: false, baz: @includeBaz }}></div>
// becomes: class="foo baz"

<div class={['foo', {baz: false}, 0 && 'bar', [true && 'bat'] ]}></div>
// becomes: class="foo bat"

let count = track(3);
<div class={['foo', {bar: @count > 2}, @count > 3 && 'bat']}></div>
// becomes: class="foo bar"
```
