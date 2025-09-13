---
title: Reactivity in Ripple
---

# Reactivity

## Reactive Variables

Variables prefixed with `$` are automatically reactive:

```ts
let $name = 'World';
let $count = 0;

// Updates automatically trigger re-renders
$count++;
```

Object properties prefixed with `$` are also automatically reactive:

```ts
let counter = { $current: 0 };

// Updates automatically trigger re-renders
counter.$current++;
```

Derived values are simply `$` variables that combined different parts of state:

```ts
let $count = 0;
let $double = $count * 2;
let $quadruple = $double * 2;
```

That means `$count` itself might be derived if it were to reference another reactive property. For example:

```jsx
component Counter({ $startingCount }) {
  let $count = $startingCount;
  let $double = $count * 2;
  let $quadruple = $double * 2;
}
```

Now given `$startingCount` is reactive, it would mean that `$count` might reset each time an incoming change to `$startingCount` occurs. That might not be desirable, so Ripple provides a way to `untrack` reactivity in those cases:

```jsx
import { untrack } from 'ripple';

component Counter({ $startingCount }) {
  let $count = untrack(() => $startingCount);
  let $double = $count * 2;
  let $quadruple = $double * 2;
}
```

Now `$count` will only reactively create its value on initialization.

> Note: you cannot define reactive variables in module/global scope, they have to be created on access from an active component


## Props and Attributes
If you want a prop to be reactive, you should also give it a `$` prefix.

```jsx
component Button(props: { $text: string, onClick: () => void }) {
  <button onClick={props.onClick}>
    {props.$text}
  </button>
}

// Usage
<Button $text={some_text} onClick={() => console.log("Clicked!")} />
```

This also applies to DOM elements, if you want an attribute or property to be reactive, it needs to have a `$` prefix.

```tsx
<div $class={props.$someClass} $id={$someId}>
  {$someText}
</div>
```

Otherwise changes to the attribute or property will not be reactively updated.

## Transporting Reactivity

Ripple doesn't constrain reactivity to components only. Reactivity can be used inside other functions (and classes in the future) and be composed in a way to improve expressitivity and co-location.

Ripple provides a very nice way to transport reactivity between boundaries so that it's persisted – using objects and arrays. Here's an example using arrays to transport reactivity:

```jsx
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

You can do the same with objects too:

```jsx
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

Just remember, reactive state must be connected to a component and it can't be global or created within the top-level of a module – because then Ripple won't be able to link it to your component tree.

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

## Effects
When dealing with reactive state, you might want to be able to create side-effects based upon changes that happen upon updates.
To do this, you can use `effect`:

```jsx
import { effect } from 'ripple';

export component App() {
  let $count = 0;

  effect(() => {
    console.log($count);
  });

  <button onClick={() => $count++}>{'Increment'}</button>
}
```

## Untracking Reactivity
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

## Reactive Collection Primitives <Badge type="warning" text="Experimental" />

Because Ripple isn't based on Signals, there is no mechanism with which we can
hijack collection mutations. Thus, you'll need to use the reactive collection
primitives that Ripple for reactivity for an entire collection.

### Reactive Arrays

Just like, objects, you can use the `$` prefix in an array literal to specify that the field is reactive.

```js
let $first = 0;
let $second = 0;
const arr = [$first, $second];

const $total = arr.reduce((a, b) => a + b, 0);
```

Like shown in the above example, you can compose normal arrays with reactivity and pass them through props or boundaries.

However, if you need the entire array to be fully reactive, including when
new elements get added, you should use the reactive array that Ripple provides.

You'll need to import the `RippleArray` class from Ripple. It extends the standard JS `Array` class, and supports all of its methods and properties.

```js
import { RippleArray } from 'ripple';

// using the new constructor
const arr = new RippleArray(1, 2, 3);

// using static from method
const arr = RippleArray.from([1, 2, 3]);

// using static of method
const arr = RippleArray.of(1, 2, 3);
```

The `RippleArray` is a reactive array, and that means you can access properties normally using numeric index. However,
accessing the `length` property of a `RippleArray` will be not be reactive, instead you should use `$length`.

### Reactive Set

The `RippleSet` extends the standard JS `Set` class, and supports all of its methods and properties. However,
accessing the `size` property of a `RippleSet` will be not be reactive, instead you should use `$size`.

```js
import { RippleSet } from 'ripple';

const set = new RippleSet([1, 2, 3]);
```

RippleSet's reactive methods or properties can be used directly or assigned to reactive variables.

```jsx
import { RippleSet } from 'ripple';

export component App() {
  const set = new RippleSet([1, 2, 3]);

  // direct usage
  <p>{"Direct usage: set contains 2: "}{set.has(2)}</p>

  // reactive assignment with prefixed `$`
  let $has = set.has(2);
  <p>{"Assigned usage: set contains 2: "}{$has}</p>

  <button onClick={() => set.delete(2)}>{"Delete 2"}</button>
  <button onClick={() => set.add(2)}>{"Add 2"}</button>
}
```

### Reactive Map

The `RippleMap` extends the standard JS `Map` class, and supports all of its methods and properties. However,
accessing the `size` property of a `RippleMap` will be not be reactive, instead you should use `$size`.

```js
import { RippleMap } from 'ripple';

const map = new RippleMap([[1,1], [2,2], [3,3], [4,4]]);
```

RippleMap's reactive methods or properties can be used directly or assigned to reactive variables.

```jsx
import { RippleMap } from 'ripple';

export component App() {
  const map = new RippleMap([[1,1], [2,2], [3,3], [4,4]]);

  // direct usage
  <p>{"Direct usage: map has an item with key 2: "}{map.has(2)}</p>

  // reactive assignment with prefixed `$`
  let $has = map.has(2);
  <p>{"Assigned usage: map has an item with key 2: "}{$has}</p>

  <button onClick={() => map.delete(2)}>{"Delete item with key 2"}</button>
  <button onClick={() => map.set(2, 2)}>{"Add key 2 with value 2"}</button>
}
```
