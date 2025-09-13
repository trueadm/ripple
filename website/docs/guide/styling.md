---
title: Styling in Ripple
---

# Styling

Ripple supports native CSS styling that is localized to the given component using the `<style>` element.

```jsx
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
