---
title: Ripple Component Syntax
---

# Component Syntax

Ripple's syntax is a superset of JSX, with one notable difference: components
and elements (which we'll call templates) are written as statements rather than
expressions.

Ripple's compiler then transforms your components into optimized JavaScript code
that surgically applies fine-grained state changes to the DOM.

## Defining a Ripple Component

To define a component in Ripple, we can use the `component` keyword, in place of
where we'd normally use a `function` keyword. Internally, Ripple's compiler will
transform that into a function that it can call.

<Code>

```ripple
component Hello() {
	<span>{'Hello World!'}</span>
}
```

</Code>

::: info Notice Anything Missing?
The lack of a return statement, unlike a (functional-style) JSX component isn't
errorneous. As explained above, templates are statements rather than expressions,
unlike JSX. We'll explore what you can do with that later!
:::

## Caveat: Templates Must be within Components

Unlike JSX, Ripple can only have templates within the body of a component.
This means that helper functions should not (and cannot) return any templates,
but rather just data. This design enforces clear separation between component
templates and regular JavaScript logic, making code more predictable and easier
to analyze.

```ripple
// ❌ Wrong - Templates outside component
const element = <div>{"Hello"}</div>;  // Compilation error

function regularFunction() {
	return <span>{"Not allowed"}</span>;  // Compilation error
}

const myTemplate = (
	<div>{"Cannot assign JSX"}</div>  // Compilation error
);

// ✅ Correct - Templates only inside components
component MyComponent() {
	// Template syntax is valid here
	<div>{"Hello World"}</div>

	// You can have JavaScript code mixed with templates
	const message = "Dynamic content";
	console.log("This JavaScript works");

	<p>{message}</p>
}

// ✅ Correct - Helper functions return data, not templates
function getMessage() {
	return "Hello from function";  // Return data, not JSX
}

component App() {
	<div>{getMessage()}</div>  // Use function result in template
}
```

## Concept: Expressions

In Ripple (and JSX), we can interpolate expressions into the template with a
pair of {braces}. Inside the braces, we can put a JavaScript expression, which
will then be converted to a string (if it is not already) to be inserted into
the DOM.

## Example: Displaying Text

This is the first place we can notice the difference between Ripple and JSX.
You'll need to place your text inside {braces} to make start an expression.
Again, this is because Ripple templates are statements rather than expressions,
so we cannot have text in the middle of the template, as it would be akin to
writing text in the middle of your code.

```ripple
// ✅ Correct - Text is an expression
<span>{'Hello World!'}</span>

// ❌ Wrong - Compilation error
<span>Hello World!</span>
```

```js
// Think of it like this:
let greet_text = 'Hello World!';
// compared to this:
let greet_text = Hello World!;
```

## Example: Text Interpolation

The most basic form of data-binding is text interpolation. In the below example,
we'll declared a `<span>` element as a statement, then use a pair of {braces} to
declare an expression, inside which we put our string expression, like we would
in plain JavaScript.

```ripple
<span>{`Message: ${msg}`}</span>
<span>{'Message: ' + msg}</span>
```

## Concept: Templates as Lexical Scopes

TODO: Rewrite for humans

In Ripple, templates act as lexical scopes, allowing you to declare variables,
call functions, and execute JavaScript statements directly within JSX elements -
similar to block statements in regular JavaScript.

<Code console>

```ripple
component TemplateScope() {
	<div>
		// Variable declarations inside templates
		const message = "Hello from template scope";
		let count = 42;

		// Function calls and expressions
		console.log("This runs during render");

		// Conditional logic
		const isEven = count % 2 === 0;

		<h1>{message}</h1>
		<p>{"Count is: "}{count}</p>

		if (isEven) {
			<span>{"Count is even"}</span>
		}

		// Nested scopes work too
		<section>
			const sectionData = "Nested scope variable";
			<p>{sectionData}</p>
		</section>

		// You can even put debugger statements
		debugger;
	</div>
}
```

</Code>

**Key Benefits:**

- **Inline Logic**: Execute JavaScript directly where you need it in the template
- **Local Variables**: Declare variables scoped to specific parts of your template
- **Debugging**: Place `console.log()` or `debugger` statements anywhere in templates
- **Dynamic Computation**: Calculate values inline without helper functions

**Scope Rules:**

- Variables declared in templates are scoped to that template block
- Nested elements create nested scopes
- Variables from outer scopes are accessible in inner scopes
- Template variables don't leak to the component function scope

## Attribute Binding

Attribute Binding in Ripple is acheieved the same way as JSX. To bind an
expression to an attribute, we write the attribute's name and an equal sign,
like plain HTML, but instead of quotes, we use {braces}, within which, we can
write a JS expression that evaluates to our desired value.

```ripple
<span data-my-attr={attr_val}>Hi there!</span>
```

::: info
Plain attributes can still be used.

```ripple
<input type="textarea" />
```

:::

## Raw HTML

TODO, unimplemented for now.
