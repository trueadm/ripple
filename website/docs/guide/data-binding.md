---
title: Data Binding in Ripple
---

# Data Binding

## Accessor Props

When working with props on composite components (`<Foo>` rather than `<div>`), it can sometimes be difficult to debug why a certain value is a certain way. JavaScript gives us a way to do this on objects using the `get` syntax:

```js
let name = 'Bob';

const object = {
  get name() {
    // I can easily debug when this property gets
    // access and track it easily
    console.log(name);
    return name;
  }
}
```

So Ripple provides similar capabilities when working with composite components in a template, specifically using `prop:={}` rather than the typical `prop={}`.

<Code console>

```ripple
import { track } from 'ripple';

component Person(props) {
	<div>{props.name}</div>
}

export default component App() {
	let name = track('Bob');

	const getName = () => {
		// I can easily debug when this property gets
		// access and track it easily
		console.log(@name);
		return @name;
	};

	<Person name:={getName} />
}
```

</Code>

You can also inline the function too:

<Code console>

```ripple
import { track } from 'ripple';

component Person(props) {
	<div>{props.name}</div>
}

export default component App() {
	let name = track('Bob');

	<Person name:={() => {
		// I can easily debug when this property gets
		// access and track it easily
		console.log(@name);
		return @name;
	}} />
}
```

</Code>

Furthermore, just like property accessors in JavaScript, Ripple provides a way of capturing the `set` too, enabling two-way data-flow on composite component props. You just need to provide a second function after the first, separated using a comma:

<Code console>

```ripple
import { track } from 'ripple';

component Person(props) {
	<input
		value={props.name}
		onInput={(e) => props.name = e.target.value}
	/>
}

export default component App() {
	let name = track('Bob');

	const getName = () => {
		console.log('getting name:', @name);
		return @name;
	}

	const setName = (newName) => {
		console.log('setting name:', newName);
		@name = newName;
	}

	<Person name:={getName, setName} />
}
```

</Code>

Or an inlined version:

<Code console>

```ripple
import { track } from 'ripple';

component Person(props) {
	<input
		value={props.name}
		onInput={(e) => props.name = e.target.value}
	/>
}

export default component App() {
	let name = track('Bob');

	<Person name:={
		() => {
			console.log('getting name:', @name);
			return @name;
		},
		(newName) => {
			console.log('setting name:', newName);
			@name = newName;
		}
	} />
}
```

</Code>

Now changes in the `Person` to its `props` will propagate to its parent component:

```ripple
component Person(props) {
  const updateName = (newName) => {
    props.name = newName;
  }

  <NameInput onChange={updateName}>
}
```

**Key Rules:**

- Accessor props use `prop:={}` syntax (colon before equals)
- Must pass function(s), not direct values
- Single function = getter only (read access + debugging)
- Two functions = getter + setter (separated by comma)
- Component can assign directly to `props.name` to trigger setter
- Enables debugging prop access and two-way binding patterns
