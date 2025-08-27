// import { anthropic } from '@ai-sdk/anthropic';
// import { generateText } from 'ai';

// const default_prompt = `
//   Ripple is a web-based JavaScript framework for building user interfaces. It's syntax and design is inspired by React and Svelte 5. 
//   It uses JSX for templating inside '.ripple' modules. These modules allow for custom syntax that is not JavaScript compliant.
  
//   One of the core differences is that it allows for a new type of JavaScript declaration which is a 'component', which is like a 'function' but is only allowed in '.ripple' modules:

//   \`\`\`js
//     component HelloComponent(props) {
//         const title = 'Hello ';

//         <div>{title + props.name}</div>;
//     }
//   \`\`\`

//   Another difference is that 'component' declaration bodies allow for JSX templating. Except this JSX templating isn't "expression" based, but rather "statement" based. That
//   means that 'return' is not valid syntax in a component declaration body. Nor is creating a variable that references JSX. Instead, JSX is directly written in the body of the component declaration.
//   This means that the ordering is important, as JSX that is written first will be rendered first. This is different from React.

//   Another difference from JSX in other frameworks is that JSXText is not allowed here. That's because JSX is now statement based, and not expression based. This means that all JSX must be wrapped in a JSXExpressionContainer.

//   For example, this is invalid Ripple code:

//   \`\`\`js
//     <button>=</button>
//   \`\`\`

//   The correct version is:

//   \`\`\`js
//     <button>{"="}</button>
//   \`\`\`

//   Another core difference is that Ripple defines reactive variables by their usage of a "$" prefix. If the variable declaration does not have a dollar prefix, it is not reactive.

//   \`\`\`js
//     component HelloComponent(props) {
//         let $count = 0;

//         <div>{$count}</div>;
//         <button onClick={() => $count++}>{"Increment"}</button>;
//     }
//   \`\`\`

//   Object properties can also be reactive if the property name starts with a "$" prefix.

//   \`\`\`js
//     component HelloComponent(props) {
//         let state = { $count: 0 };

//         <div>{state.$count}</div>;
//         <button onClick={() => state.$count++}>{"Increment"}</button>;
//     }
//   \`\`\`

//   Ripple doesn't allow for inline expressions with JSX for conditionals or for collections such as arrays or objects.
//   Instead, prefer using normal JavaScript logic where you have a "if" or "for" statement that wraps the JSX.

//   Here is valid Ripple code:

//   \`\`\`js
//     export component Counter() {
//         let $count = 0;

//         if ($count > 5) {
//           <div>{$count}</div>;
//         }

//         <div>
//           if ($count > 5) {
//             <div>{$count}</div>;
//           }
//         </div>;

//         for (const item of items) {
//           <div>{item}</div>;
//         }

//         <ul>
//           for (const item of items) {
//             <li>{item}</li>;
//           }
//         </ul>;
//     }
//   \`\`\`

//   Ripple allows for shorthand props on components, so '<Child state={state} />' can be written as '<Child {state} />'.

//   Ripple also allows for a singular "<style>" JSX element at the top level of the component declaration body. This is used for styling any JSX elements within the component.
//   The style element can contain any valid CSS, and can also contain CSS variables. CSS variables are defined with a "--" prefix. This is the preferred way of doing styling over inline styles.
  
//   If inline styles are to be used, then they should be done using the HTML style attribute approach rather than the JSX style attribute property approach.

//   In Ripple variables that are created with an identifier that starts with a "$" prefix are considered reactive. If declaration init expression also references reactive variables, or function expressions, then
//   this type of variable is considered "computed". Computed reactive declarations will re-run when any of the reactive variables they reference change. If this is not desired then the "untrack" function call should
//   be used to prevent reactivity.

//   \`\`\`js
//     import { untrack } from 'ripple';

//     component Counter({ $initial }) {
//         let $count = untrack(() => $initial);
//     }
//   \`\`\`

//   An important part of Ripple's reactivity model is that passing reactivity between boundaries can only happen via two ways:
//   - the usage of closures, where a value is referenced in a function or property getter
//   - the usage of objects and/or arrays, where the object or array is passed as a property with a "$" prefix so its reactivity is kept

//   For example if you were to create a typical Ripple hook function, then you should pass any reactive values through using objects. Otherwise, the
//   hook will act as a computed function and re-run every time the reactive value changes – which is likely not the desired behaviour of a "hook" function.

//   \`\`\`js
//     function useCounter(initial) {
//       let $count = initial;
//       const $double = $count * 2;

//       const increment = () => $count++;

//       return { $double, increment };
//     }

//     component Counter({ $count }) {
//       const { $double, increment } = useCounter($count);

//       <button onClick={increment}>{"Increment"}</button>;
//       <div>{$double}</div>;
//     }
//   \`\`\`

//   If a value needs to be mutated from within a hook, then it should be referenced by the hook in its object form instead:

//   \`\`\`js
//     function useCounter(state) {
//       const $double = state.$count * 2;

//       const increment = () => state.$count++;

//       return { $double, increment };
//     }

//     component Counter({ $count }) {
//       let $count = 0;

//       const { $double, increment } = useCounter({ $count });

//       <button onClick={increment}>{"Increment"}</button>;
//       <div>{$double}</div>;
//     }
//   \`\`\`

//   It should be noted that in this example, the "$count" inside the "Counter" component will not be mutated by the "increment" function.

//   If this is desired, then the call to "useCounter" needs to provide a getter and setter for the "$count" value:

//   \`\`\`js
//     function useCounter(state) {
//       const $double = state.$count * 2;

//       const increment = () => state.$count++;

//       return { $double, increment };
//     }

//     component Counter({ $count }) {
//       let $count = 0;

//       const { $double, increment } = useCounter({ get $count() { return $count }, set $count(value) { $count = value } });

//       <button onClick={increment}>{"Increment"}</button>;
//       <div>{$double}</div>;
//     }
//   \`\`\`

//   Normally, you shouldn't provide getters/setters in the object returned from a hook, especially if the usage site intends to destruct the object.

//   Ripple also provides a way of handling Suspense and asynchronous data fetching. This requires two parts:
//   - a "try" block, that has an "async" block that shows the fallback pending UI. These blocks can only be used inside Ripple components
//   - an "await" that must happen at the top-level of the component body

//   Here is an example:

//   \`\`\`js
//     export component App() {
//       try {
//         <Child />;
//       } async {
//         <div>{"Loading..."}</div>;
//       }
//     }

//     component Child() {
//       const $pokemons = await fetch('https://pokeapi.co/api/v2/pokemon/').then((res) => res.json());

//       for (const pokemon of $pokemons.results) {
//         <div>{pokemon.name}</div>;
//       }
//     }
//   \`\`\`

//   It's important that the transformed code never uses an async fetch() call inside an effect function. This is an anti-pattern, instead the "await" expression should be used
//   directly inside the fragment or component body. Also when using "await" then loading states should be handled using the "try" and "async" blocks, so this isn't required in the
//   output code.

//   Ripple also supports "fragment" syntax, which is similar to the "component" syntax but allows for multiple arguments:

//   \`\`\`js
//     fragment foo() {
//       <div>{"Hello World"}</div>;
//     }

//     component App() {
//       {fragment foo()};
//     }
//   \`\`\`

//   Fragments can be seen as reactive functions that can take arguments and using the "{@fragment fragment(...args)}" syntax, they can be rendered as if they were JSX elements.

//   Ripple denotes attributes and properties on JSX elements as being reactive when they also have a "$" prefix. This means that if a property is reactive, then the element will re-render when the property changes.

//   Ripple does not support both a non-reactive and reactive version of a prop – so having "$ref" and "ref" is not allowed. If a prop could be possibly reactive, then it should always have a "$" prefix to ensure maximum compatibility.

//   There are also some special attributes that such as "$ref" and "$children" that always start with a "$" prefix.

//   When creating an implicit children fragment from a JSX component, such as:

//   \`\`\`js
//     <ChildComponent>
//       {"Hello World"}
//     </ChildComponent>
//   \`\`\`

//   This can also be written as:

//   \`\`\`js
//     fragment $children() {
//       {"Hello World"};
//     }

//     <ChildComponent {$children} />;
//   \`\`\`

//   Which is the same as the previous example.

//   The "Hello world" will be passed as a "$children" prop to the "ChildComponent" and it will be of the type of "Fragment". Which means that it's not a string, or JSX element, but rather a special kind of thing.

//   To render a type of "Fragment" the {@fragment thing()} syntax should be used. This will render the "thing" as if it was a JSX element. Here's an example:

//   \`\`\`js
//     component Child({ $children }) {
//       <div>
//         {@fragment $children()};
//       </div>;
//     }
//   \`\`\`

//   Ripple uses for...of blocks for templating over collections or lists. While loops, standard for loops and while loops are not permitted in Ripple components or fragments.

//   For example, to render a list of items:

//   \`\`\`js
//     <ul>
//       for (const num of [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]) {
//         <li>{num}</li>;
//       }
//     </ul>;
//   \`\`\`


// `;

// export async function validate_with_ai(source) {
// 	const { text } = await generateText({
// 		model: anthropic('claude-3-7-sonnet-20250219'),
// 		messages: [
// 			{
// 				role: 'user',
// 				content: default_prompt,
// 				providerOptions: {
// 					anthropic: { cacheControl: { type: 'ephemeral' } }
// 				}
// 			},
// 			{
// 				role: 'user',
// 				content: `Please validate the following Ripple code and provide feedback on any issues:\n\n${source}`
// 			}
// 		]
// 	});
// 	return text;
// }
