---
title: Referencing DOM Elements in Ripple
---

# DOM Refs

Ripple provides a consistent way to capture the underlying DOM element – refs.
Specifically, using the syntax `{ref fn}` where `fn` is a function that captures
the DOM element. If you're familiar with other frameworks, then this is
identical to `{@attach fn}` in Svelte 5 and somewhat similar to `ref` in React.
The hook function will receive the reference to the underlying DOM element.

<Code console>

```ripple
import { track } from 'ripple';

export default component App() {
  let div = track();

  const divRef = (node) => {
    @div = node;
    console.log("mounted", node);

    return () => {
      @div = undefined;
      console.log("unmounted", node);
    };
  };

  <div {ref divRef}>{"Hello world"}</div>
}
```

</Code>

You can also create `{ref}` functions inline.

<Code console>

```ripple
import { track } from 'ripple';

export component App() {
  let div = track();

  <div {ref (node) => {
    @div = node;
    console.log("mounted", node);
    return () => @div = undefined;
  }}>{"Hello world"}</div>
}
```

</Code>

You can also use function factories to define properties, these are functions
that return functions that do the same thing. However, you can use this pattern
to pass reactive properties.

```ripple
import { fadeIn } from 'some-library';

export component App({ ms }) {
  <div {ref fadeIn({ ms })}>{"Hello world"}</div>
}
```

Lastly, you can use refs on composite components.

```ripple
<Image {ref (node) => console.log(node)} {...props} />
```

When passing refs to composite components (rather than HTML elements) as shown
above, they will be passed a `Symbol` property, as they are not named. This
still means that it can be spread to HTML template elements later on and still
work.

## createRefKey

Creates a unique object key that will be recognised as a ref when the object is
spread onto an element. This allows programmatic assignment of refs without
relying directly on the `{ref ...}` template syntax.

<Code console>

```ripple
import { createRefKey, track } from 'ripple';

export component App() {
  let value = track('');

  const props = {
    id: "example",
    @value,
    [createRefKey()]: (node) => {
      const removeListener = node.addEventListener('input', (e) => {
        @value = e.target.value;
        console.log(@value);
      });

      return () => {
        removeListener();
      }
    }
  };

  // applied to an element
  <input type="text" {...props} />

  // with composite component
  <Input {...props} />
}

component Input({ id, value, ...rest }) {
  <input type="text" {id} {value} {...rest} />
}
```

</Code>
