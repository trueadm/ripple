import { describe, it, expect } from 'vitest';
import prettier from 'prettier';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('prettier-plugin-ripple', () => {
  const format = async (code, options = {}) => {
    return await prettier.format(code, {
      parser: 'ripple',
      plugins: [join(__dirname, 'index.js')],
      ...options,
    });
  };

  const formatWithCursorHelper = async (code, options = {}) => {
    return await prettier.formatWithCursor(code, {
      parser: 'ripple',
      plugins: [join(__dirname, 'index.js')],
      ...options,
    });
  };

  describe('basic formatting', () => {
    it('should format a simple component', async () => {
      const input = `export component Test(){let count=0;<div>{"Hello"}</div>}`;
      const expected = `export component Test() {
  let count = 0;

  <div>{'Hello'}</div>
}`;
      const result = await format(input, { singleQuote: true });
      expect(result).toBe(expected);
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
      expect(result.formatted).toBe(expected);
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
      expect(result).toBe(expected);
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
      expect(result).toBe(expected);
    });

    it('formatting already formatted code should not change it', async () => {
      const already_formatted = `export component App() {
  let $node;

  const createRef = node => {
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
  <div class='container'>
    <h1>{'Welcome to Ripple!'}</h1>
    const items = [];

    <div class='counter'>
      let $count = 0;

      <button onClick={() => $count--}>{'-'}</button>
      <span class='count'>{$count}</span>
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

      expect(formatted).toBe(already_formatted);
    });

    it('formatting already formatted code should not change it #2', async () => {
      const already_formatted = `import type { Component } from 'ripple';

export default component App() {
  <div class='container'>
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

      expect(formatted).toBe(already_formatted);
    });

    it('should handle arrow functions with block bodies', async () => {
      const input = `export component Test(){const handler=()=>{};handler}`;
      const expected = `export component Test() {
  const handler = () => {};
  handler;
}`;
      const result = await format(input, { singleQuote: true });
      expect(result).toBe(expected);
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
      expect(result).toBe(expected);
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
      expect(result).toBe(expected);
    });

    it('should handle async/await in component body', async () => {
      const input = `export component Test(){const data=await fetchData();data}`;
      const expected = `export component Test() {
  const data = await fetchData();
  data;
}`;
      const result = await format(input, { singleQuote: true });
      expect(result).toBe(expected);
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
      expect(result).toBe(expected);
    });

    it('should handle TypeScript function return type', async () => {
      const input = `export component FooBar() { function Foo() : string { return ""; }}`;
      const expected = `export component FooBar() {
  function Foo(): string {
    return '';
  }
}`;
      const result = await format(input, { singleQuote: true });
      expect(result).toBe(expected);
    });

    it('should handle TypeScript method return type', async () => {
      const input = `class Foo { bar() : number { return 1; }}`;
      const expected = `class Foo {
  bar(): number {
    return 1;
  }
}`;
      const result = await format(input, { singleQuote: true });
      expect(result).toBe(expected);
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
      expect(result).toBe(expected);
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
      expect(result).toBe(expected);
    });

    it('should handle inline type annotations in object params', async () => {
      const input = `export component Test({ a, b}: { a: number; b: string }) {}`;
      const expected = `export component Test({ a, b }: { a: number; b: string }) {}`;
      const result = await format(input, { singleQuote: true });
      expect(result).toBe(expected);
    });
  });

  describe('edge cases', () => {
    it('should handle empty component', async () => {
      const input = 'export component Empty() {}';
      const result = await format(input);
      expect(result).toBe('export component Empty() {}');
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
      expect(result).toBe(expected);
    });

    it('should handle empty component using cursor', async () => {
      const input = 'export component Empty() {}';
      const result = await format(input);
      expect(result).toBe('export component Empty() {}');
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
      expect(result.formatted).toBe(expected);
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
      expect(result).toBe(expected);
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
      expect(result).toBe(expected);
    });
  });

  it('should correctly handle inline jsx like comments', async () => {
    const input = `let message: string[] = []; // comments should be preserved

message.push(/* Some test comment */ greet(\`Ripple\`));
`;

    const expected = `let message: string[] = []; // comments should be preserved

message.push(/* Some test comment */ greet(\`Ripple\`));`;

    const result = await format(input);
    expect(result).toBe(expected);
  });

  it('should correctly handle inline document like comments', async () => {
    const input = `let message: string[] = []; // comments should be preserved

message.push(/* Some test comment */ greet( /* Some text */ \`Ripple\`));
`;

    const expected = `let message: string[] = []; // comments should be preserved

message.push(/* Some test comment */ greet(/* Some text */ \`Ripple\`));`;

    const result = await format(input);
    expect(result).toBe(expected);
  });

  it('should correctly handle for loops with variable declarations', async () => {
    const input = `for (let i = 0, len = array.length; i < len; i++) {
  console.log(i);
}`;
    const expected = `for (let i = 0, len = array.length; i < len; i++) {
  console.log(i);
}`;
    const result = await format(input);
    expect(result).toBe(expected);
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
    expect(result).toBe(expected);
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

    const result = await format(input);
    expect(result).toBe(expected);
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
    expect(result).toBe(expected);
  });

  it('should handle array and object patterns correctly', async () => {
    const input = `for (const [i = 0, item] of items.entries()) {}
for (const {i = 0, item} of items.entries()) {}`;

    const expected = `for (const [ i = 0, item ] of items.entries()) {}
for (const { i = 0, item } of items.entries()) {}`;

    const result = await format(input);
    expect(result).toBe(expected);
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
    expect(result).toBe(expected);
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
    expect(result).toBe(input);

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
    expect(result).toBe(expected);
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
    expect(result).toBe(expected);
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
      expect(result).toBe(expected);
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
  type t21 = Parameters<() => void>;

  <div>{'test'}</div>
}`;

      const result = await format(input, { singleQuote: true });
      expect(result).toBe(expected);
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
      expect(result).toBe(expected);
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
      expect(result).toBe(expected);
    });
  });
});
