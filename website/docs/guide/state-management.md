---
title: State management in Ripple
---

# State management

## Context

Ripple has the concept of `context` where a value or reactive object can be shared through the component tree –
like in other frameworks. This all happens from the `createContext` function that is imported from `ripple`.

When you create a context, you can `get` and `set` the values, but this must happen within the component. Using them
outside will result in an error being thrown.

```ripple
import { createContext } from 'ripple';

const MyContext = createContext(null);

component Child() {
  // Context is read in the Child component
  const value = MyContext.get(MyContext);

  // value is "Hello from context!"
  console.log(value);
}

component Parent() {
  const value = MyContext.get(MyContext);

  // Context is read in the Parent component, but hasn't yet
  // been set, so we fallback to the initial context value.
  // So the value is `null`
  console.log(value);

  // Context is set in the Parent component
  MyContext.set("Hello from context!");

  <Child />
}
```
