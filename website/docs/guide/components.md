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

To pass elements to be nested within a component, simply nest it as you would
writing HTML. By default, Ripple will make the content available as the
`children` prop, which you can then render using `<props.children />` (or simply
`<children />` if you destructured your props).

```ripple
import type { Component } from 'ripple';

component Card(props: { children: Component }) {
	<div class="card">
		<props.children />
	</div>
}

export component App() {
	// Use implicitly...
	<Card>
		<p>{"Card content here"}</p>
	</Card>

	// or explicitly!
	<Card>
		component children() {
			<p>{"Card content here"}</p>
		}
	</Card>
}
```

### Named Children

If you need to pass more than one child to a component, you can either pass the
child as a prop or define a component with the same name as the prop within the
scope of the parent.

::: warning Note
The child you pass in MUST be a component, not just templates!
:::

```ripple
component Composite({ PropComp, InlineComp }) {
	<PropComp />
	<InlineComp />
}

component Seperate() {
	<p>{`I'm a seperate component.`}</p>
}

export component App() {
	<Composite PropComp={Seperate}>
		component InlineComp() {
			<p>{`I'm an inline component.`}</p>
		}
	</Composite>
}
```

### Slots Pattern

With all that in place, we can now recreate the pattern of "slots" from Vue/Web
Components and "snippets" from Svelte:

```ripple
component Card({ children, Header, Footer }) {
	<fieldset>
		<Header />  // <-- Slot named `Header`
		<hr />
		<children />
		<hr />
		<Footer />  // <-- Slot named `Footer`
	</fieldset>
}

component CustomHeader() {
	<h1>{'Card Title'}</h1>
}

export component App() {
	<Card Header={CustomHeader}> // <- Header passed in as a prop
		<p>{'Card content here'}</p>
		component Footer() {     // <- Footer passed in as a "named slot"
			<button>{'Cancel'}</button>
			<button>{'OK'}</button>
		}
	</Card>
}
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
