---
title: Styling in Ripple
---

# Styling

Ripple supports native CSS styling that's scoped (localized) to the given
component using the `<style>` element.

```ripple
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
The `<style>` element must be top-level within a `component`.
:::

## Dynamic Classes

In Ripple, the `class` attribute can accept more than just a string — it also
supports objects and arrays. Truthy values are included as class names, while
falsy values are omitted. This behavior is powered by the `clsx` library.

Examples:

```ripple
let includeBaz = track(true);
<div class={{ foo: true, bar: false, baz: @includeBaz }}></div>
// becomes: class="foo baz"

<div class={['foo', {baz: false}, 0 && 'bar', [true && 'bat'] ]}></div>
// becomes: class="foo bat"

let count = track(3);
<div class={['foo', {bar: @count > 2}, @count > 3 && 'bat']}></div>
// becomes: class="foo bar"
```

## Dynamic Inline Styles

Sometimes you might need to dynamically set inline styles. For this,
you can use the `style` attribute, passing either a string or an object to it:

```ripple
let color = track('red');

<div style={`color: ${@color}; font-weight: bold; background-color: gray`}></div>
<div style={{ color: @color, fontWeight: 'bold', 'background-color': 'gray' }}></div>

const style = {
  @color,
  fontWeight: 'bold',
  'background-color': 'gray',
};

// using object spread
<div style={{...style}}></div>

// using object directly
<div style={style}></div>
```

Both examples above will render the same inline styles, however, it's
recommended to use the object notation as it's typically more performance optimized.

::: info
When passing an object to the `style` attribute, you can use either camelCase
or kebab-case for CSS property names.
:::

## Global Styles

By default, all styles in Ripple are scoped to the component. To apply global
styles, use the `:global()` pseudo-class or `:global` block:

<Code>

```ripple
export component App() {
  <div class="container">
    <Child />
  </div>

  <style>
    /* Scoped to Parent only */
    .container {
      padding: 1rem;
    }

    /* Global - Not Recommended - applies to any .highlight in any component */
    :global(.highlight) {
      color: red;
      font-weight: bold;
    }

    /* Global: - Recommended - scoped parent with global child selector */
    .container :global(.nested) {
      margin-left: 2rem;
    }

    /* Global block - everything inside is global */
    div :global {
      .header {
        font-size: 3rem;
      }
    }
  </style>
}

component Child() {
  // The div should have its font-size at 2rem from parent
  <div>
    <h2 class="header">{'This is a header with font-size 3rem'}</h2>
    <span class="highlight">{'This will be red and bold'}</span>
    <p class="nested">{'This will have left margin'}</p>
  </div>
}
```

</Code>

### Global Keyframes

Keyframes are scoped by default. To create global keyframes that can be shared across components, prefix the animation name with `-global-`:

<Code>

```ripple
export component App() {
  <div class="parent">
    <Child />
  </div>

  <style>
    /* Scoped keyframe - only usable within Parent */
    @keyframes slideIn {
      from { transform: translateX(-100%); }
      to { transform: translateX(0); }
    }

    /* Global keyframe - usable in any component */
    @keyframes -global-fadeIn {
      0% { opacity: 0; }
      100% { opacity: 1; }
    }

    .parent {
      animation: slideIn 1s;
    }
  </style>
}

component Child() {
  <div class="child">{'Child content'}</div>

  <style>
    .child {
      animation: fadeIn 1s; /* Uses global fadeIn from Parent */
    }
  </style>
}
```

</Code>
