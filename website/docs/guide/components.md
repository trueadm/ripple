---
title: Components in Ripple
---

# Components

## Lifecycle

::: details Glossary

- **Pure**: The idea that a function should produce no side-effects.
- **Side-effect**: A permanent, externally observable state change.
  :::

Ripple's component lifecycle is akin to Vue/Svelte/Solid. The root scope of your
component only runs once, akin to the "setup" scope in Vue/Svelte/Solid. However,
all child scopes such as nested template scopes, and blocks like `if` and `for`,
may rerun if they have reactive variables within them. Therefore, it is
advisable to only write pure code within your components, and place side-effects
within `effect()` to ensure they only run when intended.

## Children

Use `children` prop and then use it in the form of `<children />` for component
composition. When you pass in children to a component, it gets implicitly passed
as the `children` prop, in the form of a component.

```ripple
import type { Component } from 'ripple';

component Card(props: { children: Component }) {
  <div class="card">
    <props.children />
  </div>
}

// Usage
<Card>
	<p>{"Card content here"}</p>
</Card>
```

You could also explicitly write the same code as shown:

```ripple
import type { Component } from 'ripple';

component Card(props: { children: Component }) {
  <div class="card">
    <props.children />
  </div>
}

// Usage with explicit component
<Card>
	component children() {
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
