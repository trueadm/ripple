---
title: State management in Ripple
---

# State management

## Context

Ripple has the concept of `context` where a value or reactive object can be
shared through the component tree – like in other frameworks. This all happens
from the `Context` class that is imported from `ripple`.

Creating contexts may take place anywhere. Contexts can contain anything
including tracked values or objects. However, context cannot be read via `get`
or written to via `set` inside an event handler or at the module level as it
must happen within the context of a component. A good strategy is to assign
the contents of a context to a variable via the `.get()` method during the
component initialization and use this variable for reading and writing.

When Child components overwrite a context's value via `.set()`, this new
value will only be seen by its descendants. Components higher up in the tree
will continue to see the original value.

Example with tracked / reactive contents:

<Code>

```ripple
import { track, Context } from "ripple"

// create context with an empty object
const context  = new Context({});
const context2 = new Context();

export component App() {
  // get reference to the object
  const obj = context.get();
  // set your reactive value
  obj.count = track(0);

  // create another tracked variable
  const count2 = track(0);
  // context2 now contains a trackrf variable
  context2.set(count2);

  <button onClick={() => { obj.@count++; @count2++ }}>
    {'Click Me'}
  </button>

  // context's reactive property count gets updated
  <pre>{'Context: '}{context.get().@count}</pre>
  <pre>{'Context2: '}{@count2}</pre>
}
```

</Code>

::: info
`@(context2.get())` usage with `@()` wrapping syntax will be enabled in the near future
:::

Passing data between components:

<Code console>

```ripple
import { Context } from 'ripple';

const MyContext = new Context(null);

component Child() {
  // Context is read in the Child component
  const value = MyContext.get();

  // value is "Hello from context!"
  console.log(value);
}

export component Parent() {
  const value = MyContext.get();

  // Context is read in the Parent component, but hasn't yet
  // been set, so we fallback to the initial context value.
  // So the value is `null`
  console.log(value);

  // Context is set in the Parent component
  MyContext.set("Hello from context!");

  <Child />
}
```

</Code>
