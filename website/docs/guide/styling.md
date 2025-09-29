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

## Dynamic Inline Styles

Sometimes you might need to dynamically set inline styles. For this, you can use the `style` attribute, passing either a string or an object to it:
```ripple
let color = track('red');

<div style={`color: ${@color}; font-weight: bold`}></div>
<div style={{ color: @color, fontWeight: 'bold' }}></div>
```
Both examples above will render a `<div>` with red text and bold font weight.

::: info
Note: When passing an object to the `style` attribute, use camelCase for CSS property names (e.g., `fontWeight` instead of `font-weight`).
:::
