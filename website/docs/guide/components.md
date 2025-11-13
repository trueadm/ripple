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
may rerun if they contain reactive variables within them. Therefore, it is
advisable to only write pure code within your components, and place side-effects
within `effect()` to ensure they only run when intended.

## Children

To pass elements to be nested within a component, simply nest them as you would
write HTML. By default, Ripple will make the content available as the
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

<Code>

```ripple
component Composite({ PropComp, InlineComp }) {
	<PropComp />
	<InlineComp />
}

component Separate() {
	<p>{`I'm a separate component.`}</p>
}

export component App() {
	<Composite PropComp={Separate}>
		component InlineComp() {
			<p>{`I'm an inline component.`}</p>
		}
	</Composite>
}
```

</Code>

## Example: Card Component Using Child Composition

Using what we've learnt, let's make a versatile card component that can display
an optional header and footer.

This pattern is commonly achieved with "slots" from Vue/Web
Components, "render props" from React, and "snippets" from Svelte.

<Code>

```ripple
component Card({ children, Header, Footer }) {
	<fieldset>
		<Header />
		<hr />
		<children />
		<hr />
		<Footer />
	</fieldset>
}

component CustomHeader() {
	<h1>{'Card Title'}</h1>
}

export component App() {
	<Card Header={CustomHeader}> // <- Header passed in as a prop
		<p>{'Card content here'}</p>
		component Footer() {     // <- Footer passed in as a inline component
			<button>{'Cancel'}</button>
			<button>{'OK'}</button>
		}
	</Card>
}
```

</Code>

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

## Portal Component

The `Portal` component allows you to render (teleport) content anywhere in the DOM tree, breaking out of the normal component hierarchy. This is particularly useful for modals, tooltips, and notifications.

```ripple
import { Portal } from 'ripple';

export component App() {
	<div class="app">
		<h1>{'My App'}</h1>

		{/* This will render inside document.body, not inside the .app div */}
		<Portal target={document.body}>
			<div class="modal">
				<h2>{'I am rendered in document.body!'}</h2>
				<p>{'This content escapes the normal component tree.'}</p>
			</div>
		</Portal>
	</div>
}
```
