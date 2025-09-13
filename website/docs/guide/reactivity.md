---
title: Reactivity in Ripple
---

# {{ $frontmatter.title }}

## Reactive Variables

Variables prefixed with `$` are automatically reactive and trigger re-renders:

```ripple
export component Counter() {
  let $count = 0;
  let $double = $count * 2;  // Derived reactive value

  <div>
    <p>{"Count: "}{$count}</p>
    <p>{"Double: "}{$double}</p>
    <button onClick={() => $count++}>{"Increment"}</button>
  </div>
}
```

Object properties can also be reactive:
```ripple
let counter = { $current: 0 };
counter.$current++;  // Triggers reactivity
```

## Props and Reactivity

Reactive props must be prefixed with `$`:

```ripple
component DisplayValue(props: { $value: string, label: string }) {
  <div>
    <span>{props.label}{": "}</span>
    <span>{props.$value}</span>  // Reactive prop
  </div>
}

// Usage
<DisplayValue $value={$someReactiveValue} label="Current Value" />
```

## Transporting Reactivity

**Critical Concept**: Ripple doesn't constrain reactivity to components only. Reactivity can be transported between boundaries using objects and arrays to improve expressivity and co-location.

## Array Transport Pattern

```ripple
import { effect } from 'ripple';

function createDouble([ $count ]) {
  const $double = $count * 2;

  effect(() => {
    console.log('Count:', $count)
  });

  return [ $double ];
}

export component App() {
  let $count = 0;

  const [ $double ] = createDouble([ $count ]);

  <div>{'Double: ' + $double}</div>
  <button onClick={() => { $count++; }}>{'Increment'}</button>
}
```

## Object Transport Pattern

```ripple
import { effect } from 'ripple';

function createDouble({ $count }) {
  const $double = $count * 2;

  effect(() => {
    console.log('Count:', $count)
  });
  return { $double };
}

export component App() {
  let $count = 0;
  const { $double } = createDouble({ $count });

  <div>{'Double: ' + $double}</div>
  <button onClick={() => { $count++; }}>{'Increment'}</button>
}
```

**Transport Rules:**
- Reactive state must be connected to a component
- Cannot be global or created at module top-level
- Use arrays `[ $var ]` or objects `{ $var }` to transport reactivity
- Functions can accept and return reactive state using these patterns
- This enables composable reactive logic outside of component boundaries

### Effects
```ripple
import { effect } from 'ripple';

export component App() {
  let $count = 0;

  effect(() => {
    console.log("Count changed:", $count);
  });

  <button onClick={() => $count++}>{"Increment"}</button>
}
```

### Untracking Reactivity
```ripple
import { untrack } from 'ripple';

component Counter({ $startingCount }) {
  let $count = untrack(() => $startingCount);  // Initialize once, don't track changes
  let $double = $count * 2;

  <div>
    <p>{"Count: "}{$count}</p>
    <button onClick={() => $count++}>{"Increment"}</button>
  </div>
}
```
