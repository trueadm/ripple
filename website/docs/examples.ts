export const examples: Array<{ title: string; code: string }> = [
	{
		title: 'Hello World',
		code: `export default component App() {
  <div>{"Hello World"}</div>
}`,
	},
	{
		title: 'Dynamic Content',
		code: `export default component App() {
	const message = "Hello Ripple!";

  <div>{message}</div>
}`,
	},
	{
		title: 'Styling',
		code: `export default component App() {
  <div class="message">{"Hello Ripple!"}</div>

	<style>
		.message {
			color: #3e95ff;
			font-weight: bold;
			font-size: 2rem;
			text-align: center;
			padding: 1rem;
		}
	</style>
}`,
	},
	{
		title: 'Components',
		code: `component Card() {
	<div class="card">
		<p>{"Card content here"}</p>
	</div>
	<style>
		.card {
      background: white;
      padding: 20px;
      margin: 20px;
      border-radius: 5px;
      border: 1px solid lightgray;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
		}
	</style>
}

export default component App() {
	<Card />
}
		`,
	},
	{
		title: 'Props',
		code: `export default component App() {
	<Card message={"A Card"} />

	const message = "Another card";
	<Card {message} /> // props shorthand

	const props = {
    message: "A clickable card",
    className: "clickable",
    onClick: () => { alert("Card clicked!") }
  };
	<Card {...props} /> // props spread
}

component Card(props: { message: string, className?: string, onClick?: () => void }) {
	<div class={\`card \${props.className}\`} onclick={props.onClick || (() => {})}>
		<p>{props.message}</p>
	</div>
	<style>
		.card {
      background: white;
      padding: 20px;
      margin: 20px;
      border-radius: 5px;
      border: 1px solid lightgray;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
		}
    .clickable:hover {
      cursor: pointer;
      background: #f5f5f5;
    }
	</style>
}
`,
	},
	{
		title: 'Children',
		code: `import type { Component } from 'ripple';

component Card(props: { children: Component }) {
  <div class="card">
    <props.children />
  </div>
}

// Usage
export default component App() {
	<Card>
		<p>{"Card content here"}</p>
	</Card>
}
`,
	},
	{
		title: 'If Statements',
		code: `component Truthy({ x }) {
  <div>
    if (x) {
      <span>{'x is truthy'}</span>
    } else {
      <span>{'x is falsy'}</span>
    }
  </div>
}

export default component App() {
  <Truthy x={true} />
  <Truthy x={false} />
}
`,
	},
	{
		title: 'For Loops',
		code: `component List({ items }) {
	<ul>
		for (const item of items) {
			<li>{item}</li>
		}
	</ul>
}

component ListWithIndex({ items }) {
  <ul>
    for (const item of items; index i) {
      <li>{\`\${i}: \${item}\`}</li>
    }
  </ul>
}

export default component App() {
  const items = ['apple', 'banana', 'cherry']
	<List {items} />
	<ListWithIndex {items} />
}
`,
	},
	{
		title: 'Try Catch',
		code: `const reportError = (e) => {
	console.warn(e);
}

component ComponentThatFails(props) {
	<div>{props.foo.bar}</div>
}

export default component ErrorBoundary() {
  <div>
    try {
      <ComponentThatFails />
    } catch (e) {
      reportError(e);

      <div>{'An error occurred! ' + e.message}</div>
    }
  </div>
}`,
	},
	{
		title: 'Async',
		code: `component AsyncComponent() {
  const delay = new Promise(resolve => setTimeout(resolve, 2000));
  await delay;
  <p>{'Async content loaded!'}</p>
}

export default component SuspenseBoundary() {
	try {
		<AsyncComponent />
	} pending {
		<p>{'Loading...'}</p> // fallback
	}
}
`,
	},
	{
		title: 'Reactive Variables',
		code: `import { track } from 'ripple';

export default component Counter() {
	let count = track(0);  // Reactive variable
	let double = track(() => @count * 2);  // Derived reactive value
	let quadruple = track(() => @double * 2);

	<div class="container">
		<p>{"Count: "}{@count}</p>
		<p>{"Double: "}{@double}</p>
		<p>{"Quadruple: "}{@quadruple}</p>
		<button onClick={() => @count++}>{"Increment"}</button>
		<button onClick={() => @count = 0}>{"Reset"}</button>
	</div>

	<style>
    .container {
      text-align: center;
    }
		button {
			margin: 20px;
			padding: 10px;
		}
	</style>
}`,
	},
	{
		title: 'Effects',
		code: `import { track, effect } from 'ripple';
import confetti from 'canvas-confetti';

export default component App() {
  let count = track(0);

  effect(() => {
    console.log(@count);
    if (@count > 0) {
      confetti();
    }
  });

  <button onClick={() => @count++}>{'Increment'}</button>
}
`,
	},
	{
		title: 'Reactive Arrays',
		code: `import { effect, track } from 'ripple';

export default component App() {
	let first = track(1);
	let second = track(2);
	const arr = [first, second];

	const total = track(() => arr.reduce((a, b) => a + @b, 0));

	effect(() => {
		console.log(@total);
	})
}
`,
	},
	{
		title: 'TrackedArray',
		code: `import { TrackedArray, track } from 'ripple';

export default component App() {
  // create a TrackedArray using syntactic sugar \`#\`
  const arr = #[1, 2, 3];

  // using the new constructor
  // const arr = new TrackedArray(1, 2, 3);

  // using static from method
  // const arr = TrackedArray.from([1, 2, 3]);

  // using static of method
  // const arr = TrackedArray.of(1, 2, 3);

  // array methods can be used as usual
  <p>{"arr: "}{arr.join(", ")}</p>
  <p>{"double: "}{arr.map(x => x * 2).join(", ")}</p>
  <p>{"even: "}{arr.filter(x => x % 2 === 0).join(", ")}</p>
  console.log(arr instanceof Array);

  // reactive assignment
  let sum = track(() => arr.reduce((a, b) => a + b, 0));
  <p>{"sum: "}{@sum}</p>

  let count = track(3);
  const inc = () => @count++;
  const dec = () => { if (@count > 0) @count-- };
  <button onClick={() => { dec(); arr.pop(); }}>{"pop"}</button>
  <button onClick={() => { inc(); arr.push(@count); }}>{"push"}</button>

  <style>
    button {
      margin: 5px;
    }
  </style>
}
`,
	},
	{
		title: 'TrackedSet',
		code: `import { TrackedSet, track } from 'ripple';

export default component App() {
  const set = new TrackedSet([1, 2, 3]);

  // direct usage
  <p>{"Direct usage: set contains 2: "}{set.has(2)}</p>

  // reactive assignment
  let has = track(() => set.has(2));
  <p>{"Assigned usage: set contains 2: "}{@has}</p>

  <button onClick={() => set.delete(2)}>{"Delete 2"}</button>
  <button onClick={() => set.add(2)}>{"Add 2"}</button>
}
`,
	},
	{
		title: 'TrackedMap',
		code: `import { TrackedMap, track } from 'ripple';

export default component App() {
  const map = new TrackedMap([[1,1], [2,2], [3,3], [4,4]]);

  // direct usage
  <p>{"Direct usage: map has an item with key 2: "}{map.has(2)}</p>

  // reactive assignment
  let has = track(() => map.has(2));
  <p>{"Assigned usage: map has an item with key 2: "}{@has}</p>

  <button onClick={() => map.delete(2)}>{"Delete item with key 2"}</button>
  <button onClick={() => map.set(2, 2)}>{"Add key 2 with value 2"}</button>
}
`,
	},
	{
		title: 'Tracked with get/set',
		code: `import { track } from 'ripple';

export default component App() {
  let count = track(0,
    (current) => {
      console.log(current);
      return current;
    },
    (next, prev) => {
      console.log(prev);
      if (typeof next === 'string') {
        next = Number(next);
      }

      return next;
    }
  );

  <div class="container">
    <p>{@count}</p>
    <button onClick={() => @count++}>{"Increment"}</button>
    <button onClick={() => @count = 0}>{"Reset"}</button>
  </div>

	<style>
    .container {
      text-align: center;
    }
		button {
			margin: 20px;
			padding: 10px;
		}
	</style>
}
`,
	},
	{
		title: 'trackSplit',
		code: `import { track, trackSplit } from 'ripple';
import type { PropsWithChildren, Tracked } from 'ripple';

component Child(props: PropsWithChildren<{ count: Tracked<number> }>) {
  const [children, count, className, rest] = trackSplit(props, ['children', 'count', 'class']);

  <button class={@className} {...@rest}><@children /></button>
  <pre>{\`Count is: \${@count}\`}</pre>
  <button onClick={() => @count++}>{'Increment Count'}</button>
}

export default component App() {
    let count = track(0,
    (current) => {
      console.log('getter', current);
      return current;
    },
    (next) => {
      console.log('setter', next);
      return next;
    }
  );
  let className = track('shadow');
  let name = track('Click Me');

  function buttonRef(el) {
    console.log('ref called with', el);
    return () => {
      console.log('cleanup ref for', el);
    };
  }

  <Child
    class={@className}
    onClick={() => { @name === 'Click Me' ? @name = 'Clicked' : @name = 'Click Me'; @className = ''}}
    count={count}
    {ref buttonRef}
  >{@name}</Child>;
}`,
	},
	{
		title: 'Transporting Reactivity',
		code: `import { effect, track } from 'ripple';

function createDouble([ count ]) {
  const double = track(() => @count * 2);
  effect(() => {
    console.log('Count:', @count)
  });
  return [ double ];
}

function createQuad({ count }) {
  const quad = track(() => @count * 4);
  effect(() => {
    console.log('Count:', @count)
  });
  return { quad };
}

export default component App() {
  let count = track(0);

  const [ double ] = createDouble([ count ]); // array
  <p>{'Double: ' + @double}</p>

  const { quad } = createQuad({ count }); // object
  <p>{'Quadruple: ' + @quad}</p>

  <button onClick={() => { @count++; }}>{'Increment'}</button>
}
`,
	},
	{
		title: 'Dynamic Components',
		code: `import { track } from 'ripple';

export default component App() {
  let swapMe = track(() => Child1);

  <Child {swapMe} />

  <button onClick={() => @swapMe = @swapMe === Child1 ? Child2 : Child1}>
		{'Swap Component'}
	</button>
}

component Child({ swapMe }: {swapMe: Tracked<Component>}) {
  <@swapMe />
}

component Child1(props) {
  <pre>{'I am child 1'}</pre>
}

component Child2(props) {
  <pre>{'I am child 2'}</pre>
}
`,
	},
	{
		title: 'Component Transport Pattern',
		code: `import { track } from 'ripple';

export default component App() {
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
  <button onClick={() => alert('Clicked')}>
		<children />
	</button>
}

component basic() {
  <div>{'Basic Component'}</div>
}
`,
	},
	{
		title: 'Untracking Reactivity',
		code: `import { effect, track, untrack } from 'ripple';

export default component App() {
  let count = track(10);
  let double = track(() => @count * 2);
  let quadruple = track(() => @double * 2);

  effect(() => {
    // This effect will never fire again, as we've untracked the only dependency it has
    console.log(untrack(() => @quadruple));
  })
}
`,
	},
	{
		title: 'Events',
		code: `import { track, effect, on } from 'ripple';

export default component App() {
  let message = track('');

  <div>
		<p>{'Try resizing the window!'}</p>
    <button onClick={() => @message = 'Clicked!'}>{'Click me'}</button>
    <input onInput={(e) => @message = e.target.value} />
    <p>{@message}</p>
  </div>

  effect(() => {
    // on component mount
    const removeListener = on(window, 'resize', () => {
      console.log('Window resized!');
    });

    // return the removeListener when the component unmounts
    return removeListener;
  });
}
`,
	},
	{
		title: 'DOM References',
		code: `import { track } from 'ripple';

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
`,
	},
	{
		title: 'createRefKey',
		code: `import { createRefKey, track } from 'ripple';

export default component App() {
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

  <input type="text" {...props} />
  <div>{@value}</div>
}
`,
	},
	{
		title: 'Context',
		code: `import { createContext } from 'ripple';

const MyContext = createContext(null);

export default component Parent() {
	const value = MyContext.get();

	// Context is read in the Parent component, but hasn't yet
	// been set, so we fallback to the initial context value.
	// So the value is \`null\`
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
`,
	},
]
