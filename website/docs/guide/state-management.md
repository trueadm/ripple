---
title: State management in Ripple
---

# State management

## Context

Ripple has the concept of `context` where a value or reactive object can be shared through the component tree –
like in other frameworks. This all happens from the `createContext` function that is imported from `ripple`.

When you create a context, you can `get` and `set` the values, but this must happen within the context of a component (they can physically live anywhwere, they just need to be called from a component context). Using them outside will result in an error being thrown.

<Code console>

```ripple
import { createContext } from 'ripple';

const MyContext = createContext(null);

component Parent() {
	const value = MyContext.get();

	// Context is read in the Parent component, but hasn't yet
	// been set, so we fallback to the initial context value.
	// So the value is `null`
	console.log(value);

	// Context is set in the Parent component
	MyContext.set("Hello from context!");

	<Child />
}

component Child() {
	// Context is read in the Child component
	const value = MyContext.get();

	// value is "Hello from context!"
	console.log(value);
}
```

</Code>
