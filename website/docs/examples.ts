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
		title: 'Nested Components',
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

export default component App() {
	<List items={['apple', 'banana', 'cherry']} />
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
]
