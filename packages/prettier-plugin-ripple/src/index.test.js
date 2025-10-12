import { describe, it, expect } from 'vitest';
import prettier from 'prettier';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

expect.extend({
	toBeWithNewline(received, expected) {
		const expectedWithNewline = expected.endsWith('\n')
			? expected
			: expected + '\n';

		const pass = received === expectedWithNewline;

		return {
			pass,
			message: () => {
				const { printExpected, printReceived, matcherHint } = this.utils;
				return (
					matcherHint('toBeWithNewline') +
					'\n\nExpected:\n' +
					`  ${printExpected(expectedWithNewline)}\n` +
					'Received:\n' +
					`  ${printReceived(received)}`
				);
			},
		};
	},
});

describe('prettier-plugin-ripple', () => {
	/**
	 * @param {string} code
	 * @param {import('prettier').Options} [options]
	 */
	const format = async (code, options = {}) => {
		return await prettier.format(code, {
			parser: 'ripple',
			plugins: [join(__dirname, 'index.js')],
			...options,
		});
	};

	/**
	 * @param {string} code
	 * @param {Partial<import('prettier').CursorOptions>} options
	 */
	const formatWithCursorHelper = async (code, options = {}) => {
		return await prettier.formatWithCursor(code, /** @type {import('prettier').CursorOptions} */({
			parser: 'ripple',
			plugins: [join(__dirname, 'index.js')],
			...options,
		}));
	};

	describe('basic formatting', () => {
		it('should format a simple component', async () => {
			const input = `export component Test(){let count=0;<div>{"Hello"}</div>}`;
			const expected = `export component Test() {
  let count = 0;
  <div>{'Hello'}</div>
}`;
			const result = await format(input, { singleQuote: true });
			expect(result).toBeWithNewline(expected);
		});

		it('should format a simple component with cursorOffset', async () => {
			const input = `export component Test(){let count=0;<div>{"Hello"}</div>}`;
			const expected = `export component Test() {
  let count = 0;
  <div>{'Hello'}</div>
}`;
			const result = await formatWithCursorHelper(input, {
				singleQuote: true,
				cursorOffset: 50,
			});
			expect(result.formatted).toBeWithNewline(expected);
			expect(typeof result.cursorOffset).toBe('number');
		});

		it('should format whitespace correctly', async () => {
			const input = `export component Test(){
        let count=0

        // comment

        <div>{"Hello"}</div>
        <div>
          let two=2

          {"Hello"}
        </div>
    }`;
			const expected = `export component Test() {
  let count = 0;

  // comment
  <div>{'Hello'}</div>
  <div>
    let two = 2;

    {'Hello'}
  </div>
}`;
			const result = await format(input, { singleQuote: true });
			expect(result).toBeWithNewline(expected);
		});

		it('should format whitespace correctly #2', async () => {
			const input = `export component Test(){
        let count=0

          const x = () => {
            console.log("test");


            if (x) {
              console.log('test');
              return null;
            }

            if (y) {

              return null;

            }


            return x;
          }

        <div>{"Hello"}</div>
        <div>
          let two=2

          {"Hello"}
        </div>
    }`;
			const expected = `export component Test() {
  let count = 0;

  const x = () => {
    console.log('test');

    if (x) {
      console.log('test');

      return null;
    }

    if (y) {
      return null;
    }

    return x;
  };

  <div>{'Hello'}</div>
  <div>
    let two = 2;

    {'Hello'}
  </div>
}`;
			const result = await format(input, { singleQuote: true });
			expect(result).toBeWithNewline(expected);
		});

		it('formatting already formatted code should not change it', async () => {
			const already_formatted = `export component App() {
  let $node;

  const createRef = (node) => {
    $node = node;
    console.log('mounted', node);

    return () => {
      $node = undefined;
      console.log('unmounted', node);
    };
  };

  const arr = [1, 2, 3];
  const obj = {
    a: 1,
    b: 2,
    c: 3,
  };

  <div {ref createRef}>{'Hello world'}</div>

  <style>
    div {
      color: blue;
    }
  </style>
}

function foo() {
  // comment
}

export default component Basic() {
  <div class="container">
    <h1>{'Welcome to Ripple!'}</h1>
    const items = [];

    <div class="counter">
      let $count = 0;

      <button onClick={() => $count--}>{'-'}</button>
      <span class="count">{$count}</span>
      <button onClick={() => $count++}>{'+'}</button>
    </div>
    <div>
      const foo = 'foo';

      <p>{'This is a basic Ripple application template.'}</p>
      <p>
        {'Edit '}
        <code>{'src/App.ripple'}</code>
        {' to get started.'}
      </p>
    </div>
  </div>
}`;
			const formatted = await format(already_formatted, { singleQuote: true });

			expect(formatted).toBeWithNewline(already_formatted);
		});

		it('formatting already formatted code should not change it #2', async () => {
			const already_formatted = `import type { Component } from 'ripple';

export default component App() {
  <div class="container">
    let $count = 0;

    <button onClick={() => $count++}>{$count}</button>

    if ($count > 1) {
      <div>{'Greater than 1!'}</div>
    }
  </div>

  <style>
    button {
      padding: 1rem;
      font-size: 1rem;
      cursor: pointer;
    }
  </style>
}`;
			const formatted = await format(already_formatted, { singleQuote: true });

			expect(formatted).toBeWithNewline(already_formatted);
		});

		it('should handle arrow functions with block bodies', async () => {
			const input = `export component Test(){const handler=()=>{};handler}`;
			const expected = `export component Test() {
  const handler = () => {};
  handler;
}`;
			const result = await format(input, { singleQuote: true });
			expect(result).toBeWithNewline(expected);
		});

		it('should handle style tags inside component body', async () => {
			const input = `export component Test(){<div>{"Test"}</div><style>div{color:red}</style>}`;
			const expected = `export component Test() {
  <div>{'Test'}</div>

  <style>
    div {
      color: red;
    }
  </style>
}`;
			const result = await format(input, { singleQuote: true });
			expect(result).toBeWithNewline(expected);
		});

		it('should handle TypeScript types and interfaces', async () => {
			const input = `export component Test(){interface User{id:number;name:string}let user:User={id:1,name:"test"};user}`;
			const expected = `export component Test() {
  interface User {
    id: number;
    name: string;
  }

  let user: User = {
    id: 1,
    name: 'test',
  };
  user;
}`;
			const result = await format(input, { singleQuote: true });
			expect(result).toBeWithNewline(expected);
		});

		it('should handle async/await in component body', async () => {
			const input = `export component Test(){const data=await fetchData();data}`;
			const expected = `export component Test() {
  const data = await fetchData();
  data;
}`;
			const result = await format(input, { singleQuote: true });
			expect(result).toBeWithNewline(expected);
		});

		it('should handle for...of loops in component body', async () => {
			const input = `export component Test(){const items=[1,2,3];for(const item of items){<li>{item}</li>}}`;
			const expected = `export component Test() {
  const items = [1, 2, 3];
  for (const item of items) {
    <li>{item}</li>
  }
}`;
			const result = await format(input, { singleQuote: true });
			expect(result).toBeWithNewline(expected);
		});

		it('should handle TypeScript function return type', async () => {
			const input = `export component FooBar() { function Foo() : string { return ""; }}`;
			const expected = `export component FooBar() {
  function Foo(): string {
    return '';
  }
}`;
			const result = await format(input, { singleQuote: true });
			expect(result).toBeWithNewline(expected);
		});

		it('should handle TypeScript method return type', async () => {
			const input = `class Foo { bar() : number { return 1; }}`;
			const expected = `class Foo {
  bar(): number {
    return 1;
  }
}`;
			const result = await format(input, { singleQuote: true });
			expect(result).toBeWithNewline(expected);
		});

		it('should handle import type statements', async () => {
			const input = `import { type Component } from 'ripple';
import { Something, type Props, track } from 'ripple';`;
			const expected = `import { type Component } from 'ripple';
import { Something, type Props, track } from 'ripple';`;
			const result = await format(input, { singleQuote: true });
			expect(result).toBeWithNewline(expected);
		});

		it('should handle @ prefix', async () => {
			const input = `export default component App() {
  <div>
    let count = track(0);
    @count = 2;
    console.log(@count);
    console.log(count);
    if (@count > 1) {
      <button onClick={() => @count++}>{@count}</button>
    }
  </div>
}`;
			const expected = `export default component App() {
  <div>
    let count = track(0);
    @count = 2;
    console.log(@count);
    console.log(count);
    if (@count > 1) {
      <button onClick={() => @count++}>{@count}</button>
    }
  </div>
}`;
			const result = await format(input, { singleQuote: true });
			expect(result).toBeWithNewline(expected);
		});

		it('should handle type annotations in object params', async () => {
			const input = `interface Props {
  a: number;
  b: string;
}

export component Test({ a, b }: Props) {}`;

			const expected = `interface Props {
  a: number;
  b: string;
}

export component Test({ a, b }: Props) {}`;
			const result = await format(input, { singleQuote: true });
			expect(result).toBeWithNewline(expected);
		});

		it('should handle inline type annotations in object params', async () => {
			const input = `export component Test({ a, b}: { a: number; b: string }) {}`;
			const expected = `export component Test({ a, b }: { a: number; b: string }) {}`;
			const result = await format(input, { singleQuote: true });
			expect(result).toBeWithNewline(expected);
		});

		it('respects the semi false option', async () => {
			const input = `export component Test() {
  const a = 1
  const b = 2
  <div>{a + b}</div>
}`;
			const expected = `export component Test() {
  const a = 1
  const b = 2
  <div>{a + b}</div>
}`;
			const result = await format(input, { singleQuote: true, semi: false });
			expect(result).toBeWithNewline(expected);
		});

		it('respects the semi true option', async () => {
			const input = `export component Test() {
  const a = 1
  const b = 2
  <div>{a + b}</div>
}`;
			const expected = `export component Test() {
  const a = 1;
  const b = 2;
  <div>{a + b}</div>
}`;
			const result = await format(input, { singleQuote: true, semi: true });
			expect(result).toBeWithNewline(expected);
		});

		it('should break up attributes on new lines if line length exceeds printWidth', async () => {
			const expected = `component One() {
  <button
    class="some-class another-class yet-another-class class-with-a-long-name"
    id="this-is-a-button"
  >
    {'this is a button'}
  </button>
}`;

			const result = await format(expected, { singleQuote: true, printWidth: 40 });
			expect(result).toBeWithNewline(expected);
		});

		it('should handle bracketSameLine correctly', async () => {
			const input = `component One() {
  <button
    class="some-class another-class yet-another-class class-with-a-long-name"
    id="this-is-a-button"
  >
    {'this is a button'}
  </button>
}`;

			const expected = `component One() {
  <button
    class="some-class another-class yet-another-class class-with-a-long-name"
    id="this-is-a-button">
    {'this is a button'}
  </button>
}`;

			const result = await format(input, { singleQuote: true, printWidth: 40, bracketSameLine: true });
			expect(result).toBeWithNewline(expected);
		});

		it('should respect singleAttributePerLine set to true setting', async () => {
			const input = `component One() {
  <button
    class="some-class" something="should" not="go" wrong="at all"
    id="this-is-a-button"
  >
    {'this is a button'}
  </button>
}`;

			const expected = `component One() {
  <button
    class="some-class"
    something="should"
    not="go"
    wrong="at all"
    id="this-is-a-button"
  >
    {'this is a button'}
  </button>
}`;

			const result = await format(input, { singleQuote: true, printWidth: 100, singleAttributePerLine: true });
			expect(result).toBeWithNewline(expected);
		});

		it('should respect singleAttributePerLine set to false setting', async () => {
			const input = `component One() {
  <button
    class="some-class"
    something="should"
    not="go"
    wrong="at all"
    id="this-is-a-button"
  >
    {'this is a button'}
  </button>
}`;

		const expected = `component One() {
  <button class="some-class" something="should" not="go" wrong="at all" id="this-is-a-button">
    {'this is a button'}
  </button>
}`;

			const result = await format(input, { singleQuote: true, printWidth: 100, singleAttributePerLine: false });
			expect(result).toBeWithNewline(expected);
		});

		it('should not format function parameter spread', async () => {
			const expected = `component Two({ arg1, ...rest }) {}`;

			const result = await format(expected, { singleQuote: true, printWidth: 100 });
			expect(result).toBeWithNewline(expected);
		});

		it('should break up long function parameter spread on new lines if line length exceeds printWidth', async () => {
			const input = `component Three({ argumentOne, argumentTwo, ArgumentThree, ArgumentFour, ArgumentFive, ArgumentSix, ArgumentSeven }) {}`;
			const expected = `component Three({
  argumentOne,
  argumentTwo,
  ArgumentThree,
  ArgumentFour,
  ArgumentFive,
  ArgumentSix,
  ArgumentSeven,
}) {}`;

			const result = await format(input, { singleQuote: true, printWidth: 60 });
			expect(result).toBeWithNewline(expected);
		});

		it('should not strip @ from dynamic @tag', async () => {
			const expected = `export component Four() {
  let tag = track('div');

  <@tag {href} {...props}>
    <@children />
  </@tag>
}`;
			const result = await format(expected, { singleQuote: true, printWidth: 100 });
			expect(result).toBeWithNewline(expected);
		});

		it('should not include a comma after the last rest parameter', async () => {
			const expected = `component Foo({
  lorem,
  ipsum,
  dolor,
  sit,
  amet,
  consectetur,
  adipiscing,
  ...rest
}) {}`;

			const result = await format(expected, { singleQuote: true, printWidth: 60 });
			expect(result).toBeWithNewline(expected);
		});

		it('keeps a new line between comments above and code if one is present', async () => {
			const expected = `// comment

import { useCount, incrementCount } from './useCount';
import { effect, track } from 'ripple';`;

			const result = await format(expected, { singleQuote: true, printWidth: 100 });
			expect(result).toBeWithNewline(expected);
		});

		it('should format properly an array of objects', async () => {
			const expected = `obj = {
  test: [
    { a: 1, b: 2, c: 3, d: 4 },
    { a: 1, b: 2 },
    { c: 3, d: 4 },
  ],
};`;
			const result = await format(expected, { singleQuote: true, printWidth: 100 });
			expect(result).toBeWithNewline(expected);
		});

		it('should keep chained expression intact', async () => {
			const expected = `const doc = getRootNode?.()?.ownerDocument ?? document;`;
			const result = await format(expected, { singleQuote: true, printWidth: 100 });
			expect(result).toBeWithNewline(expected);
		});
	});

	describe('edge cases', () => {
		it('should handle empty component', async () => {
			const input = 'export component Empty() {}';
			const result = await format(input);
			expect(result).toBeWithNewline('export component Empty() {}');
		});

		it('should handle component with only style', async () => {
			const input = `export component Styled(){<style>body{background:#fff}</style>}`;
			const expected = `export component Styled() {
  <style>
    body {
      background: #fff;
    }
  </style>
}`;
			const result = await format(input);
			expect(result).toBeWithNewline(expected);
		});

		it('should handle empty component using cursor', async () => {
			const input = 'export component Empty() {}';
			const result = await format(input);
			expect(result).toBeWithNewline('export component Empty() {}');
		});

		it('should handle component with only style', async () => {
			const input = `export component Styled(){<style>body{background:#fff}</style>}`;
			const expected = `export component Styled() {
  <style>
    body {
      background: #fff;
    }
  </style>
}`;
			const result = await formatWithCursorHelper(input, { cursorOffset: 50 });
			expect(result.formatted).toBeWithNewline(expected);
		});

		it('should correctly handle call expressions', async () => {
			const input = `export component App() {
	const context = track(globalContext.get().theme);
	<div>
		<TypedComponent />
		{@context}
	</div>
}`;

			const expected = `export component App() {
  const context = track(globalContext.get().theme);
  <div>
    <TypedComponent />
    {@context}
  </div>
}`;

			const result = await format(input);
			expect(result).toBeWithNewline(expected);
		});

		it('should correctly handle TS syntax', async () => {
			const input = `type User = { name: string; age: number };
let message: string[] = [];

// comments should be preserved

message.push(greet(\`Ripple\`));
message.push(\`User: \${JSON.stringify({ name: 'Alice', age: 30 } as User)}\`);`;

			const expected = `type User = { name: string; age: number };

let message: string[] = [];

// comments should be preserved
message.push(greet(\`Ripple\`));
message.push(\`User: \${JSON.stringify({
  name: "Alice",
  age: 30,
} as User)}\`);`;

			const result = await format(input);
			expect(result).toBeWithNewline(expected);
		});
	});

	it('should correctly handle inline jsx like comments', async () => {
		const input = `let message: string[] = []; // comments should be preserved

message.push(/* Some test comment */ greet(\`Ripple\`));
`;

		const expected = `let message: string[] = []; // comments should be preserved

message.push(/* Some test comment */ greet(\`Ripple\`));`;

		const result = await format(input);
		expect(result).toBeWithNewline(expected);
	});

	it('should correctly handle inline document like comments', async () => {
		const input = `let message: string[] = []; // comments should be preserved

message.push(/* Some test comment */ greet( /* Some text */ \`Ripple\`));
`;

		const expected = `let message: string[] = []; // comments should be preserved

message.push(/* Some test comment */ greet(/* Some text */ \`Ripple\`));`;

		const result = await format(input);
		expect(result).toBeWithNewline(expected);
	});

	it('should correctly handle for loops with variable declarations', async () => {
		const input = `for (let i = 0, len = array.length; i < len; i++) {
  console.log(i);
}`;
		const expected = `for (let i = 0, len = array.length; i < len; i++) {
  console.log(i);
}`;
		const result = await format(input);
		expect(result).toBeWithNewline(expected);
	});

	it('should correctly render attributes in template', async () => {
		const input = `export component App() {
  <div>
   <Expand name='' startingLength={20} />
  </div>
}`;

		const expected = `export component App() {
  <div><Expand name="" startingLength={20} /></div>
}`;

		const result = await format(input);
		expect(result).toBeWithNewline(expected);
	});

	it('should handle different attribute value types correctly', async () => {
		const input = `export component Test() {
  <div
    stringProp="hello"
    numberProp={42}
    booleanProp={true}
    falseProp={false}
    nullProp={null}
    expression={x + 1}
  />
}`;

		const expected = `export component Test() {
  <div stringProp="hello" numberProp={42} booleanProp={true} falseProp={false} nullProp={null} expression={x + 1} />
}`;

		const result = await format(input, { singleQuote: true, printWidth: 120 });
		expect(result).toBeWithNewline(expected);
	});

	it('should handle default arguments correctly', async () => {
		const input = `component Expand({ name, startingLength = 10 }: { name: string; startingLength?: number }) {
  <div></div>
}`;

		const expected = `component Expand({ name, startingLength = 10 }: {
  name: string;
  startingLength?: number
}) {
  <div />
}`;

		const result = await format(input);
		expect(result).toBeWithNewline(expected);
	});

	it('should handle array and object patterns correctly', async () => {
		const input = `for (const [i = 0, item] of items.entries()) {}
for (const {i = 0, item} of items.entries()) {}`;

		const expected = `for (const [ i = 0, item ] of items.entries()) {}
for (const { i = 0, item } of items.entries()) {}`;

		const result = await format(input);
		expect(result).toBeWithNewline(expected);
	});

	it('should handle various other TS things', async () => {
		const input = `const globalContext = new Context<{ theme: string, array: number[] }>({ theme: 'light', array: [] });
const items = [] as unknown[];`

		const expected = `const globalContext = new Context<{ theme: string; array: number[] }>({
  theme: "light",
  array: [],
});
const items = [] as unknown[];`

		const result = await format(input);
		expect(result).toBeWithNewline(expected);
	});

	it('should correctly handle for loop with index syntax, plus comments', async () => {
		const input = `const test = () => {
  // some comments
  for (const item of []; index i) {
    // comment
  }
  debugger;

  // some comments
  const test = ""; // some comments 2
};`;

		const result = await format(input);
		expect(result).toBeWithNewline(input);

	});

	it('should format {html string} syntax correctly', async () => {
		const input = `export component App() {
  let source = \`
<h1>My Blog Post</h1>
<p>Hi! I like JS and Ripple.</p>
\`

  <article>
    {html source}
  </article>
}`;

		const expected = `export component App() {
  let source = \`
<h1>My Blog Post</h1>
<p>Hi! I like JS and Ripple.</p>
\`;

  <article>{html source}</article>
}`;

		const result = await format(input, { singleQuote: true });
		expect(result).toBeWithNewline(expected);
	});

	it('should format {html expression} with different expressions', async () => {
		const input = `export component App(){
<div>{html myHtml}</div>
<div>{html "hello"}</div>
<div>{html \`<b>test</b>\`}</div>
}`;

		const expected = `export component App() {
  <div>{html myHtml}</div>
  <div>{html 'hello'}</div>
  <div>{html \`<b>test</b>\`}</div>
}`;

		const result = await format(input, { singleQuote: true });
		expect(result).toBeWithNewline(expected);
	});

	it('should not insert a new line between js and jsx if not provided', async () => {
		const expected = `export component App() {
  let text = 'something';
  <div>{String(text)}</div>
}`;

		const result = await format(expected, { singleQuote: true, arrowParens: 'always', printWidth: 100 });
		expect(result).toBeWithNewline(expected);
	});

	it('should keep a new line between js and jsx if provided', async () => {
		const expected = `export component App() {
  let text = 'something';
  <div>{String(text)}</div>
}`;

		const result = await format(expected, { singleQuote: true, arrowParens: 'always', printWidth: 100 });
		expect(result).toBeWithNewline(expected);
	});

	it('should not format html elements that fit on one line', async () => {
		const expected = `export component App() {
  <div class="container">
    <p>{'Some Random text'}</p>
  </div>
}`;

		const result = await format(expected, { singleQuote: true, arrowParens: 'always', printWidth: 100 });

		expect(result).toBeWithNewline(expected);
	});

	it('should format html elements that fit on one line', async () => {
		const input = `export component App() {
  <div class="container">
    <p>
      {'Some Random text'}
    </p>
  </div>
}`;

		const expected = `export component App() {
  <div class="container">
    <p>{'Some Random text'}</p>
  </div>
}`;

		const result = await format(input, { singleQuote: true, arrowParens: 'always', printWidth: 100 });

		expect(result).toBeWithNewline(expected);
	});

	it('should support jsxSingleQuote option', async () => {
		const input = `export component App() {
  <div class="container">
    <p>{'Some Random text'}</p>
  </div>
}`;

		const expected = `export component App() {
  <div class='container'>
    <p>{'Some Random text'}</p>
  </div>
}`;
		const result = await format(input, { singleQuote: true, jsxSingleQuote: true });

		expect(result).toBeWithNewline(expected);
	});

	describe('TypeScript types', () => {
		it('should format all basic TypeScript primitive types', async () => {
			const input = `component TypeTest() {
        type t0 = undefined;
        type t1 = number;
        type t2 = string;
        type t3 = boolean;
        type t4 = null;
        type t5 = symbol;
        type t6 = bigint;
        type t7 = any;
        type t8 = unknown;
        type t9 = never;
        type t10 = void;
        <div>{"test"}</div>
      }`;

			const expected = `component TypeTest() {
  type t0 = undefined;
  type t1 = number;
  type t2 = string;
  type t3 = boolean;
  type t4 = null;
  type t5 = symbol;
  type t6 = bigint;
  type t7 = any;
  type t8 = unknown;
  type t9 = never;
  type t10 = void;

  <div>{'test'}</div>
}`;

			const result = await format(input, { singleQuote: true });
			expect(result).toBeWithNewline(expected);
		});

		it('should format TypeScript utility types', async () => {
			const input = `component UtilityTypeTest() {
        type t11 = { a: number; b: string };
        type t12 = keyof t11;
        const T0: t17 = { x: 1 };
        type t13 = typeof T0;
        type t14 = Partial<t11>;
        type t15 = Required<t14>;
        type t16 = Readonly<t15>;
        type t17 = Record<string, number>;
        type t18 = Pick<t11, 'a'>;
        type t19 = Omit<t11, 'b'>;
        type t20 = ReturnType<() => string>;
        type t21 = Parameters<(x: number, y: string) => void>;
        type t27 = new () => object;
        type t41 = ReturnType<typeof Math.max>;
        <div>{"test"}</div>
      }`;

			const expected = `component UtilityTypeTest() {
  type t11 = { a: number; b: string };
  type t12 = keyof t11;

  const T0: t17 = {
    x: 1,
  };
  type t13 = typeof T0;
  type t14 = Partial<t11>;
  type t15 = Required<t14>;
  type t16 = Readonly<t15>;
  type t17 = Record<string, number>;
  type t18 = Pick<t11, 'a'>;
  type t19 = Omit<t11, 'b'>;
  type t20 = ReturnType<() => string>;
  type t21 = Parameters<(x: number, y: string) => void>;
  type t27 = new () => object;
  type t41 = ReturnType<typeof Math.max>;

  <div>{'test'}</div>
}`;

			const result = await format(input, { singleQuote: true });
			expect(result).toBeWithNewline(expected);
		});

		it('should format TypeScript generics in variable declarations', async () => {
			const input = `component GenericTest() {
        let open: Tracked<boolean> = track(false);
        let items: Array<string> = [];
        let map: Map<string, number> = new Map();
        <div>{"test"}</div>
      }`;

			const expected = `component GenericTest() {
  let open: Tracked<boolean> = track(false);
  let items: Array<string> = [];
  let map: Map<string, number> = new Map();
  <div>{'test'}</div>
}`;

			const result = await format(input, { singleQuote: true });
			expect(result).toBeWithNewline(expected);
		});

		it('should format TypeScript union and intersection types', async () => {
			const input = `component UnionTest() {
        type StringOrNumber = string | number;
        type Props = { a: string } & { b: number };
        let value: string | null = null;
        <div>{"test"}</div>
      }`;

			const expected = `component UnionTest() {
  type StringOrNumber = string | number;
  type Props = { a: string } & { b: number };

  let value: string | null = null;
  <div>{'test'}</div>
}`;

			const result = await format(input, { singleQuote: true });
			expect(result).toBeWithNewline(expected);
		});

		it('should format TypeScript tuple types (TSTupleType)', async () => {
			const input = `type T = [string, number, boolean];`;
			const expected = `type T = [string, number, boolean];`;
			const result = await format(input);
			expect(result).toBeWithNewline(expected);
		});

		it('should format TypeScript index signatures (TSIndexSignature)', async () => {
			const input = `interface Dict { [key: string]: number; readonly [id: number]: string }`;
			const expected = `interface Dict {\n  [key: string]: number;\n  readonly [id: number]: string;\n}`;
			const result = await format(input);
			expect(result).toBeWithNewline(expected);
		});

		it('should format TypeScript constructor types (TSConstructorType)', async () => {
			const input = `type Ctor = new (x: number, y: string) => Foo;`;
			const expected = `type Ctor = new (x: number, y: string) => Foo;`;
			const result = await format(input);
			expect(result).toBeWithNewline(expected);
		});

		it('should format TypeScript conditional types (TSConditionalType)', async () => {
			const input = `type T = string extends string ? number : boolean;`;
			const expected = `type T = string extends string ? number : boolean;`;
			const result = await format(input);
			expect(result).toBeWithNewline(expected);
		});

		it('should format TypeScript mapped types (TSMappedType)', async () => {
			const input = `type ReadonlyPartial<T> = { readonly [K in keyof T]?: T[K] }`;
			const expected = `type ReadonlyPartial<T> = { readonly [K in keyof T]?: T[K] };`;
			const result = await format(input);
			expect(result).toBeWithNewline(expected);
		});

		it('should format TypeScript qualified names (TSQualifiedName)', async () => {
			const input = `type T = Foo.Bar;`;
			const expected = `type T = Foo.Bar;`;
			const result = await format(input);
			expect(result).toBeWithNewline(expected);
		});

		it('should format TypeScript indexed access types (TSIndexedAccessType)', async () => {
			const input = `type V = Props["value"]; type W = Map<string, number>["size"]; type X = T[K];`;
			const expected = `type V = Props["value"];\ntype W = Map<string, number>["size"];\ntype X = T[K];`;
			const result = await format(input);
			expect(result).toBeWithNewline(expected);
		});

		it('respects arrowParens option', async () => {
			const input = `function inputRef(node) {
	const removeListener = on(node, 'input', e => { value = e.target.value; console.log(value) });

	return () => { removeListener(); }
}`;

			const expected = `function inputRef(node) {
  const removeListener = on(node, 'input', (e) => {
    value = e.target.value;
    console.log(value);
  });

  return () => {
    removeListener();
  };
}`;

			const result = await format(input, { singleQuote: true, arrowParens: 'always' });
			expect(result).toBeWithNewline(expected);
		});

		it('keeps one new line between comment blocks and code if 1 or more exist', async () => {
			const input = `// comments
//comments


//comments
function inputRef(node) {
  console.log('ref called');
  const removeListener = on(node, 'input', (e) => { value = e.target.value; console.log(value) });
  return () => {
    removeListener();
  }
}

// some comment
// more comments here

//now more comments
// and some more








//yet more`;

			const expected = `// comments
//comments

//comments
function inputRef(node) {
  console.log('ref called');
  const removeListener = on(node, 'input', (e) => {
    value = e.target.value;
    console.log(value);
  });
  return () => {
    removeListener();
  };
}

// some comment
// more comments here

//now more comments
// and some more

//yet more`;

			const result = await format(input, { singleQuote: true, arrowParens: 'always' });
			expect(result).toBeWithNewline(expected);
		});

		it('keeps one new line comments and functions when 1 or more exist', async () => {
			const input = `export component App() {
  // try {
    doSomething()
  // } catch {
  //   somethingElse()
  // }



try {
	doSomething();
  } catch {
	somethingElse();
  }
}`;

			const expected = `export component App() {
  // try {
  doSomething();
  // } catch {
  //   somethingElse()
  // }

  try {
    doSomething();
  } catch {
    somethingElse();
  }
}`;

			const result = await format(input, { singleQuote: true, arrowParens: 'always' });
			expect(result).toBeWithNewline(expected);
		});

		it('correctly formats array of objects and keys as either literals or identifiers', async () => {
			const input = `const tt = [
  {
    "id": "toast:2",
    "stacked": false,
  },
  {
    "id": "toast:3",
    "stacked": false,
  },
  {
    "id": "toast:4",
    "stacked": false,
  },
  {
    "id-literal": "toast:5",
    "stacked": false,
  },
  {
    "id": "toast:6",
    "stacked": false,
  }
];`;

			const expected = `const tt = [
  {
    id: 'toast:2',
    stacked: false,
  },
  {
    id: 'toast:3',
    stacked: false,
  },
  {
    id: 'toast:4',
    stacked: false,
  },
  {
    'id-literal': 'toast:5',
    stacked: false,
  },
  {
    id: 'toast:6',
    stacked: false,
  },
];`;

			const result = await format(input, { singleQuote: true, arrowParens: 'always' });
			expect(result).toBeWithNewline(expected);
		});

		it('properly formats components markup and new lines and leaves one new line between components and <style> if one or more exits', async () => {
			const input = `export component App() {
  <div>
    <RowList rows={#[{id: 'a'}, {id: 'b'}, {id: 'c'}]}>
      component Row({id, index, isHighlighted = (index) => (index % 2) === 0}) {
        <div class={{highlighted: isHighlighted(index)}}>{index}{' - '}{id}</div>

        <style>
          .highlighted {
            background-color: lightgray;
            color: black;
          }
        </style>
      }
    </RowList>
  </div>
}

component RowList({ rows, Row }) {
  for (const { id } of rows; index i;) {
    <Row index={i} {id} />
  }
}`;

			const expected = `export component App() {
  <div>
    <RowList rows={#[{id: 'a'}, {id: 'b'}, {id: 'c'}]}>
      component Row({ id, index, isHighlighted = (index) => index % 2 === 0 }) {
        <div class={{highlighted: isHighlighted(index)}}>
          {index}
          {' - '}
          {id}
        </div>

        <style>
          .highlighted {
            background-color: lightgray;
            color: black;
          }
        </style>
      }
    </RowList>
  </div>
}

component RowList({ rows, Row }) {
  for (const { id } of rows; index i) {
    <Row index={i} {id} />
  }
}`;
			const result = await format(input, { singleQuote: true, arrowParens: 'always', printWidth: 100 });
			expect(result).toBeWithNewline(expected);
		});

		it('leaves the shorthand reactive declaration intact and formats the same way as plain objects', async () => {
			const input = `export component App() {
  const obj = #{ a: 1, b: 2, c: 3 };
  let singleUser = #{name:"Test Me", email: "abc@example.com"}
}`;

			const expected = `export component App() {
  const obj = #{ a: 1, b: 2, c: 3 };
  let singleUser = #{ name: 'Test Me', email: 'abc@example.com' };
}`;
			const result = await format(input, { singleQuote: true, arrowParens: 'always', printWidth: 100 });
			expect(result).toBeWithNewline(expected);
		});

		it('formats single line reactive object into multiline when printWidth is exceeded', async () => {
			const input = `export component App() {
  const obj = #{a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8, i: 9, j: 10, k: 11, l: 12, m: 13, n: 14, o: 15};
  let singleUser = #{name:"Test Me", email: "abc@example.com"}
}`;

			const expected = `export component App() {
  const obj = #{
    a: 1,
    b: 2,
    c: 3,
    d: 4,
    e: 5,
    f: 6,
    g: 7,
    h: 8,
    i: 9,
    j: 10,
    k: 11,
    l: 12,
    m: 13,
    n: 14,
    o: 15,
  };
  let singleUser = #{ name: 'Test Me', email: 'abc@example.com' };
}`;
			const result = await format(input, { singleQuote: true, arrowParens: 'always', printWidth: 100 });
			expect(result).toBeWithNewline(expected);
		});

		it('leaves the shorthand reactive array declaration intact and formats the same way as regular array', async () => {
			const input = `export component App() {
  const arr = #[ {a: 1}, { b:2}, {c:3 }   ];
  let multi = #[{a: 1}, {b: 2}, {c: 3}, {d: 4}, {e:5}, {f:6}, {g: 7}, {h: 8}, {i:9}, {j: 10}, {k: 11}];
}`;

			const expected = `export component App() {
  const arr = #[{ a: 1 }, { b: 2 }, { c: 3 }];
  let multi = #[
    { a: 1 },
    { b: 2 },
    { c: 3 },
    { d: 4 },
    { e: 5 },
    { f: 6 },
    { g: 7 },
    { h: 8 },
    { i: 9 },
    { j: 10 },
    { k: 11 },
  ];
}`;
			const result = await format(input, { singleQuote: true, arrowParens: 'always', printWidth: 100 });
			expect(result).toBeWithNewline(expected);
		});

		it('preserves typescript parameter types with a default value', async () => {
			const expected = `function getString(e: string = 'test') {
  return e;
}`;
			const result = await format(expected, { singleQuote: true });
			expect(result).toBeWithNewline(expected);
		})
	});

	describe('regex formatting', () => {
		it('preserves regex literals in method calls', async () => {
			const expected = `export component App() {
  let text = 'Hello <span>world</span>';
  let result = text.match(/<span>/);
  <div>{String(result)}</div>
}`;

			const result = await format(expected, { singleQuote: true, arrowParens: 'always', printWidth: 100 });

			expect(result).toBeWithNewline(expected);

		});

		it('preserves multiple regex patterns', async () => {
			const expected = `export component App() {
  let html = '<div>Hello</div><span>World</span>';
  let divMatch = html.match(/<div>/g);
  let spanReplace = html.replace(/<span>/g, '[SPAN]');
  let allTags = html.split(/<br>/);
}`;

			const result = await format(expected, { singleQuote: true, arrowParens: 'always', printWidth: 100 });

			expect(result).toBeWithNewline(expected);
		});

		it('preserves regex literals in variable assignments', async () => {
			const expected = `export component App() {
  let spanRegex = /<span>/g;
  let divRegex = /<div>/;
  let simpleRegex = /<br>/g;
}`;

			const result = await format(expected, { singleQuote: true, arrowParens: 'always', printWidth: 100 });

			expect(result).toBeWithNewline(expected);
		});

		it('distinguishes regex from JSX', async () => {
			const expected = `export component App() {
  let htmlString = '<p>Paragraph</p>';
  let paragraphs = htmlString.match(/<p>/g);
  <div class="container">
    <p>{'Some Random text'}</p>
  </div>
}`;

			const result = await format(expected, { singleQuote: true, arrowParens: 'always', printWidth: 100 });

			expect(result).toBeWithNewline(expected);
		});

		it('should handle edge case regex patterns', async () => {
			const expected = `export component Test() {
  let text = '<<test>> <span>content</span>';
  let multiAngle = text.match(/<span>/);
  let simplePattern = text.match(/<>/);
}`;

			const result = await format(expected, { singleQuote: true, arrowParens: 'always', printWidth: 100 });

			expect(result).toBeWithNewline(expected);
		});
	});
});
