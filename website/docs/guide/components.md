---
title: Components in Ripple
---

# Components

## Children

Use `$children` prop and then use it in the form of `<$children />` for component composition.

When you pass in children to a component, it gets implicitly passed as the `$children` prop, in the form of a component.

```jsx
import type { Component } from 'ripple';

component Card(props: { $children: Component }) {
  <div class="card">
    <props.$children />
  </div>
}

// Usage
<Card>
  <p>{"Card content here"}</p>
</Card>
```

You could also explicitly write the same code as shown:

```jsx
import type { Component } from 'ripple';

component Card(props: { $children: Component }) {
  <div class="card">
    <props.$children />
  </div>
}

// Usage with explicit component
<Card>
  component $children() {
    <p>{"Card content here"}</p>
  }
</Card>
```

## Reactive Props

See [Reactivity](/docs/guide/reactivity#Props-and-Attributes).

## Prop Shorthands
```ripple
// Object spread
<div {...properties}>{"Content"}</div>

// Shorthand props (when variable name matches prop name)
<div {onClick} {className}>{"Content"}</div>

// Equivalent to:
<div onClick={onClick} className={className}>{"Content"}</div>
```
