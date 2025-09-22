---
title: Reactivity in Ripple
---

# Reactivity

## Reactive Variables

You use `track` to create a single tracked value. The `track` function will created a `Tracked<T>` object that
is not accessible from the outside, and instead you must use `@` to read or write to the tracked value. You can pass the `Tracked<T>` object between components, functions and context
to read and write to the value in different parts of your codebase.

```ts
import { track } from 'ripple';

let name = track('World');
let count = track(0);

// Updates automatically trigger re-renders
@count++;
```

Objects can also contain tracked values with `@` to access the reactive object property:

```ts
import { track } from 'ripple';

let counter = { current: track(0) };

// Updates automatically trigger re-renders
counter.@current++;
```

Tracked derived values are also `Tracked<T>` objects, except you pass a function to `track` rather than a value:

```ts
let count = track(0);
let double = track(() => @count * 2);
let quadruple = track(() => @double * 2);

console.log(@quadruple);
```

If you want to use a tracked value inside a reactive context, such as an effect but you don't want that value to be a tracked dependency, you can use `untrack`:

```ts
let count = track(0);
let double = track(() => @count * 2);
let quadruple = track(() => @double * 2);

effect(() => {
  // This effect will never fire again, as we've untracked the only dependency it has
  console.log(untrack(() => @quadruple));
})
```

### Split Option

The `track` function also offers a `split` option to "split" a plain object, such as component props, into specifed tracked variables and an extra `rest` (can be any name) containing the remaining unspecified object properties.

```jsx
const [children, count, rest] = track(props, {split: ['children', 'count']});
```

Frequently when processing properties passed in to a component, a `rest` destructuring is highly desirable to apply any number of supplied properties to an element or another child component.  To make sure that the `rest` is reactive as it may have none, all or a mixture of reactive properties – depending on what was passed in to the component, applying `track` with a `split` option guarantees `rest`'s reactivity.

A full example utilizing various Ripple constructs demonstrates its usage.

```jsx
import { track } from 'ripple';
import type { PropsWithChildren, Tracked } from 'ripple';

component Child(props: PropsWithChildren<{ count: Tracked<number> }>) {
  const [children, count, rest] = track(props, {split: ['children', 'count']});

  <button {...@rest}><@children /></button>
  <pre>{`Count is: ${@count}`}</pre>
  <button onClick={() => @count++}>{'Increment Count'}</button>
}

export component App() {
  let count = track(0);
  let name = track('Click Me');

  function buttonRef(el) {
    console.log('ref called with', el);
    return () => {
      console.log('cleanup ref for', el);
    };
  }

  <Child
    class="my-button"
    onClick={() => @name === 'Click Me' ? @name = 'Clicked' : @name = 'Click Me'}
    count:={() => @count, (v) => {console.log('inside setter'); @count++}}
    {ref buttonRef}
  >{@name}</Child>;
}
```

::: info Note
You cannot create `Tracked` objects in module/global scope, they have to be created on access from an active component context.
:::

## Transporting Reactivity

Ripple doesn't constrain reactivity to components only. `Tracked<T>` objects can simply be passed by reference between boundaries:

```ripple
import { effect, track } from 'ripple';

function createDouble([ count ]) {
  const double = track(() => @count * 2);

  effect(() => {
    console.log('Count:', @count)
  });

  return [ double ];
}

export component App() {
  let count = track(0);

  const [ double ] = createDouble([ count ]);

  <div>{'Double: ' + @double}</div>
  <button onClick={() => { @count++; }}>{'Increment'}</button>
}
```

You can do the same with objects too:

```ripple
import { effect, track } from 'ripple';

function createDouble({ count }) {
  const double = track(() => @count * 2);

  effect(() => {
    console.log('Count:', @count)
  });

  return { double };
}

export component App() {
  let count = track(0);
  const { double } = createDouble({ count });

  <div>{'Double: ' + @double}</div>
  <button onClick={() => { @count++; }}>{'Increment'}</button>
}
```

## Array Transport Pattern

```ripple
import { effect, track } from 'ripple';

function createDouble([ count ]) {
  const double = track(() => @count * 2);

  effect(() => {
    console.log('Count:', @count)
  });

  return [ double ];
}

export component App() {
  let count = track(0);

  const [ double ] = createDouble([ count ]);

  <div>{'Double: ' + @double}</div>
  <button onClick={() => { @count++; }}>{'Increment'}</button>
}
```

## Object Transport Pattern

```ripple
import { effect, track } from 'ripple';

function createDouble({ count }) {
  const double = track(() => @count * 2);

  effect(() => {
    console.log('Count:', @count)
  });
  return { double };
}

export component App() {
  let count = track(0);
  const { double } = createDouble({ count });

  <div>{'Double: ' + @double}</div>
  <button onClick={() => { @count++; }}>{'Increment'}</button>
}
```

## Component Transport Pattern

```ripple
import { track } from 'ripple';

export component App() {
  const tracked_basic = track(() => basic);
  const obj = {
    tracked_basic,
  };
  const tracked_object = track(obj);
  const Button = track(() => SomeButton);
  const AnotherButton = track(() => SomeButton);

  <@tracked_object.@tracked_basic />
  <Child {Button}>{'Child Button'}</Child>
  <AnotherChild Button={AnotherButton}>{'Another Child Button'}</AnotherChild>
}

component Child({ Button, children }) {
  <@Button><children /></@Button>
}

component AnotherChild(props) {
  <props.@Button><props.children /></props.@Button>
}

component SomeButton({ children }) {
  <button><children /></button>
}

component basic() {
  <div>{'Basic Component'}</div>
}
```

**Transport Rules:**
- Reactive state must be connected to a component
- Cannot be global or created at module/global scope
- Use arrays `[ trackedVar ]` or objects `{ trackedVar }` to transport reactivity
- Functions can accept and return reactive state using these patterns
- This enables composable reactive logic outside of component boundaries

## Effects
When dealing with reactive state, you might want to be able to create side-effects based upon changes that happen upon updates.
To do this, you can use `effect`:

```ripple
import { effect } from 'ripple';

export component App() {
  let count = track(0);

  effect(() => {
    console.log(@count);
  });

  <button onClick={() => @count++}>{'Increment'}</button>
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

#### Reactive Arrays

Just like objects, you can use the `Tracked<T>` objects in any standard JavaScript object, like arrays:

```ripple
let first = track(0);
let second = track(0);
const arr = [first, second];

const total = track(() => arr.reduce((a, b) => a + @b, 0));

console.log(@total);
```

Like shown in the above example, you can compose normal arrays with reactivity and pass them through props or boundaries.

However, if you need the entire array to be fully reactive, including when
new elements get added, you should use the reactive array that Ripple provides.

You'll need to import the `TrackedArray` class from Ripple. It extends the standard JS `Array` class, and supports all of its methods and properties.

```ripple
import { TrackedArray } from 'ripple';

// using the new constructor
const arr = new TrackedArray(1, 2, 3);

// using static from method
const arr = TrackedArray.from([1, 2, 3]);

// using static of method
const arr = TrackedArray.of(1, 2, 3);
```

The `TrackedArray` is a reactive array, and that means you can access properties normally using numeric index.

#### Reactive Set

The `TrackedSet` extends the standard JS `Set` class, and supports all of its methods and properties.

```ripple
import { TrackedSet } from 'ripple';

const set = new TrackedSet([1, 2, 3]);
```

TrackedSet's reactive methods or properties can be used directly or assigned to reactive variables.

```ripple
import { TrackedSet, track } from 'ripple';

export component App() {
  const set = new TrackedSet([1, 2, 3]);

  // direct usage
  <p>{"Direct usage: set contains 2: "}{set.has(2)}</p>

  // reactive assignment
  let has = track(() => set.has(2));
  <p>{"Assigned usage: set contains 2: "}{@has}</p>

  <button onClick={() => set.delete(2)}>{"Delete 2"}</button>
  <button onClick={() => set.add(2)}>{"Add 2"}</button>
}
```

#### Reactive Map

The `TrackedMap` extends the standard JS `Map` class, and supports all of its methods and properties.

```ripple
import { TrackedMap, track } from 'ripple';

const map = new TrackedMap([[1,1], [2,2], [3,3], [4,4]]);
```

TrackedMap's reactive methods or properties can be used directly or assigned to reactive variables.

```ripple
import { TrackedMap, track } from 'ripple';

export component App() {
  const map = new TrackedMap([[1,1], [2,2], [3,3], [4,4]]);

  // direct usage
  <p>{"Direct usage: map has an item with key 2: "}{map.has(2)}</p>

  // reactive assignment
  let has = track(() => map.has(2));
  <p>{"Assigned usage: map has an item with key 2: "}{@has}</p>

  <button onClick={() => map.delete(2)}>{"Delete item with key 2"}</button>
  <button onClick={() => map.set(2, 2)}>{"Add key 2 with value 2"}</button>
}
```

### Effects

When dealing with reactive state, you might want to be able to create side-effects based upon changes that happen upon updates.
To do this, you can use `effect`:

```ripple
import { effect } from 'ripple';

export component App() {
  let count = track(0);

  effect(() => {
    console.log(@count);
  });

  <button onClick={() => @count++}>{'Increment'}</button>
}
```
