---
title: Decorators in Ripple
---

# Decorators

Ripple provides a consistent way to capture the underlying DOM element – decorators. Specifically, using
the syntax `{@use fn}` where `fn` is a function that captures the DOM element. If you're familiar with other frameworks, then
this is identical to `{@attach fn}` in Svelte 5 and somewhat similar to `ref` in React. The hook function will receive
the reference to the underlying DOM element.

```jsx
export component App() {
  let $node;

  const ref = (node) => {
    $node = node;
    console.log("mounted", node);

    return () => {
      $node = undefined;
      console.log("unmounted", node);
    };
  };

  <div {@use ref}>{"Hello world"}</div>
}
```

You can also create `{@use}` functions inline.

```jsx
export component App() {
  let $node;

  <div {@use (node) => {
    $node = node;
    return () => $node = null;
  }}>{"Hello world"}</div>
}
```

You can also use function factories to define properties, these are functions that return functions that do the same
thing. However, you can use this pattern to pass reactive properties.

```jsx
import { fadeIn } from 'some-library';

export component App({ $ms }) {
  <div {@use fadeIn({ $ms })}>{"Hello world"}</div>
}
```

Lastly, you can use decorators on composite components.

```jsx
<Image {@use (node) => console.log(node)} {...props} />
```

When passing decorators to composite components (rather than HTML elements) as shown above, they will be passed a `Symbol` property, as they are not named. This still means that it can be spread to HTML template elements later on, and still work.
