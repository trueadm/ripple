import { describe, it, expect } from 'vitest';
import prettier from 'prettier';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

expect.extend({
	toBeWithNewline(received, expected) {
		const expectedWithNewline = expected.endsWith('\n') ? expected : expected + '\n';

		const pass = received === expectedWithNewline;

		return {
			pass,
			message: () => {
				const { matcherHint, EXPECTED_COLOR, RECEIVED_COLOR } = this.utils;

				// Just apply color without modifying the string
				const formatWithColor = (str, colorFn) => {
					return colorFn(str);
				};

				return (
					matcherHint('toBeWithNewline') +
					'\n\nExpected:\n' +
					formatWithColor(expectedWithNewline, EXPECTED_COLOR) +
					'\nReceived:\n' +
					formatWithColor(received, RECEIVED_COLOR)
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
		return await prettier.formatWithCursor(
			code,
			/** @type {import('prettier').CursorOptions} */ ({
				parser: 'ripple',
				plugins: [join(__dirname, 'index.js')],
				...options,
			}),
		);
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

		it('should format a component with an object property notation component markup', async () => {
			const expected = `component Card(props) {
  <div class="card">
    <props.children />
  </div>
}`;

			const result = await format(expected, { singleQuote: true });
			expect(result).toBeWithNewline(expected);
		});

		it('should format a component with an object reactive property notation props.@children', async () => {
			const expected = `component Card(props) {
  <div class="card">
    <props.@children />
  </div>
}`;

			const result = await format(expected, { singleQuote: true });
			expect(result).toBeWithNewline(expected);
		});

		it('should format a component with an object reactive bracketed property notation props.@["children"]', async () => {
			const expected = `component Card(props) {
  <div class="card">
    <props.@['children'] />
  </div>
}`;

			const result = await format(expected, { singleQuote: true });
			expect(result).toBeWithNewline(expected);
		});

		it('should respect print width when using ternary expressions', async () => {
			const input = `function printMemberExpressionSimple(node, options, computed = false) {
  if (node.type === 'MemberExpression') {
    const prop = node.computed
      ? (node.property.tracked ? '.@[' : '[') + printMemberExpressionSimple(node.property, options, node.computed) + ']'
      : (node.property.tracked ? '.@' : '.') + printMemberExpressionSimple(node.property, options, node.computed);
  }
}`;

			const expected = `function printMemberExpressionSimple(
  node,
  options,
  computed = false,
) {
  if (node.type === 'MemberExpression') {
    const prop = node.computed
      ? (node.property.tracked ? '.@[' : '[') +
        printMemberExpressionSimple(
          node.property,
          options,
          node.computed,
        ) +
        ']'
      : (node.property.tracked ? '.@' : '.') +
        printMemberExpressionSimple(
          node.property,
          options,
          node.computed,
        );
  }
}`;

			const result = await format(input, { singleQuote: true, printWidth: 70 });
			expect(result).toBeWithNewline(expected);
		});

		it('should print nested ternary expressions with indentation', async () => {
			const input = `const children_fn = b.arrow(
    [b.id('__compat')],
    needs_fragment
        ? b.call(
            '__compat._jsxs',
            b.id('__compat.Fragment'),
            b.object([
                b.prop(
                    'init',
                    b.id('children'),
                    b.array(normalized_children.map((child) => visit(child, state))),
                ),
            ]),
        )
        : visit(normalized_children[0], state),
);`;

			const expected = `const children_fn = b.arrow(
  [b.id('__compat')],
  needs_fragment
    ? b.call(
        '__compat._jsxs',
        b.id('__compat.Fragment'),
        b.object([
          b.prop(
            'init',
            b.id('children'),
            b.array(normalized_children.map((child) => visit(child, state))),
          ),
        ]),
      )
    : visit(normalized_children[0], state),
);`;

			const result = await format(input, { singleQuote: true, printWidth: 80 });
			expect(result).toBeWithNewline(expected);
		});

		it('should properly format template literals with ternaries', async () => {
			const input = `const handle_static_attr = (name, value) => {
  const attr_str = \` \${name}\${is_boolean_attribute(name) && value === true
      ? ''
      : \`="\${value === true ? '' : escape_html(value, true)}"\`
    }\`;

  if (is_spreading) {
    // For spread attributes, store just the actual value, not the full attribute string
    const actual_value =
      is_boolean_attribute(name) && value === true
        ? b.literal(true)
        : b.literal(value === true ? '' : value);
    spread_attributes.push(b.prop('init', b.literal(name), actual_value));
  } else {
    state.init.push(b.stmt(b.call(b.member(b.id('__output'), b.id('push')), b.literal(attr_str))));
  }
};`;

			const expected = `const handle_static_attr = (name, value) => {
  const attr_str = \` \${name}\${
    is_boolean_attribute(name) && value === true
      ? ''
      : \`="\${value === true ? '' : escape_html(value, true)}"\`
  }\`;

  if (is_spreading) {
    // For spread attributes, store just the actual value, not the full attribute string
    const actual_value =
      is_boolean_attribute(name) && value === true
        ? b.literal(true)
        : b.literal(value === true ? '' : value);
    spread_attributes.push(b.prop('init', b.literal(name), actual_value));
  } else {
    state.init.push(b.stmt(b.call(b.member(b.id('__output'), b.id('push')), b.literal(attr_str))));
  }
};`;

			const result = await format(input, { singleQuote: true, printWidth: 100 });
			expect(result).toBeWithNewline(expected);
		});

		it('should format conditional expressions correctly', async () => {
			const expected = `const consequentDoc =
  hasUnparenthesizedNestedConditional &&
  node.consequent.type === 'ConditionalExpression' &&
  !node.consequent.metadata?.parenthesized
    ? path.call(
        (childPath) => print(childPath, { isNestedConditional: true }),
        'consequent',
      )
    : path.call(print, 'consequent');
const alternateDoc =
  hasUnparenthesizedNestedConditional &&
  node.alternate.type === 'ConditionalExpression' &&
  !node.alternate.metadata?.parenthesized
    ? path.call(
        (childPath) => print(childPath, { isNestedConditional: true }),
        'alternate',
      )
    : path.call(print, 'alternate');`;

			const result = await format(expected, { singleQuote: true, printWidth: 80 });
			expect(result).toBeWithNewline(expected);
		});

		it('should format nested template literals correctly', async () => {
			const expected = `const handle_static_attr = (name, value) => {
  const attr_str = \` \${name}\${
    is_boolean_attribute(name) && value === true
      ? ''
      : \`="\${value === true ? '' : escape_html(value, true)}"\`
  }\`;
};`;

			const result = await format(expected, { singleQuote: true, printWidth: 80 });
			expect(result).toBeWithNewline(expected);
		});

		it('should respect print width when using conditional expressions with arrays', async () => {
			const input = `const openingTag = group([
    '<',
    tagName,
    hasAttributes
        ? indent(
            concat([
                ...path.map((attrPath) => {
                    return concat([attrLineBreak, print(attrPath)]);
                }, 'attributes'),
            ]),
        )
        : '',
    shouldUseSelfClosingSyntax
        ? hasAttributes
            ? line
            : ''
        : hasAttributes && !options.bracketSameLine
            ? softline
            : '',
    shouldUseSelfClosingSyntax ? (hasAttributes ? '/>' : ' />') : '>',
]);`;

			const expected = `const openingTag = group([
  '<',
  tagName,
  hasAttributes
    ? indent(
        concat([
          ...path.map((attrPath) => {
            return concat([attrLineBreak, print(attrPath)]);
          }, 'attributes'),
        ]),
      )
    : '',
  shouldUseSelfClosingSyntax
    ? hasAttributes
      ? line
      : ''
    : hasAttributes && !options.bracketSameLine
      ? softline
      : '',
  shouldUseSelfClosingSyntax ? (hasAttributes ? '/>' : ' />') : '>',
]);`;

			const result = await format(input, { singleQuote: true, printWidth: 70 });
			expect(result).toBeWithNewline(expected);
		});

		it('should keep jsdoc on same line, spaces between, and parentheses', async () => {
			const input = `/** @type {import('prettier').CursorOptions} */({});
const start = /** @type {any} */ (node).start;
/** @type {SomeType} */ (a) = 5;
function test() {
  /** @type {SomeType} */ (a) = 5;
}
(node.trailingComments ||= []).push(
  /** @type {CommentWithLocation} */(comments.shift()),
);
/** @type {number} */ (char.codePointAt(0)) >= 160`;
			const expected = `/** @type {import('prettier').CursorOptions} */ ({});
const start = /** @type {any} */ (node).start;
/** @type {SomeType} */ (a) = 5;
function test() {
  /** @type {SomeType} */ (a) = 5;
}
(node.trailingComments ||= []).push(
  /** @type {CommentWithLocation} */ (comments.shift()),
);
/** @type {number} */ (char.codePointAt(0)) >= 160;`;

			const result = await format(input, { singleQuote: true });
			expect(result).toBeWithNewline(expected);
		});

		it('should not change formatting for function object properties and properties in square brackets', async () => {
			const expected = `export component App() {
  const SYMBOL_PROP = Symbol();

  const obj = {
    count: 0,
    increment() {
      this.count++;
    },
    [SYMBOL_PROP]() {
      this.count++;
    },
  };
}`;

			const result = await format(expected, { singleQuote: true });
			expect(result).toBeWithNewline(expected);
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
  let user: User = { id: 1, name: 'test' };
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

		it('should preserve @ symbol in JSX attributes and shorthand syntax', async () => {
			const input = `component App() {
	const count = track(0);

	<Counter count={@count} />
	<Counter {@count} />
}`;

			const expected = `component App() {
  const count = track(0);

  <Counter {@count} />
  <Counter {@count} />
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

		it('should keep semi with tables in a for of loop', async () => {
			const expected = `<table>
  <tbody>
    for (const row of items) {
      const id = row.id;

      <tr>
        <td class="col-md-6" />
      </tr>
    }
  </tbody>
</table>`;

			const result = await format(expected, { singleQuote: true, semi: true });
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

			const result = await format(input, {
				singleQuote: true,
				printWidth: 40,
				bracketSameLine: true,
			});
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

			const result = await format(input, {
				singleQuote: true,
				printWidth: 100,
				singleAttributePerLine: true,
			});
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

			const result = await format(input, {
				singleQuote: true,
				printWidth: 100,
				singleAttributePerLine: false,
			});
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

		it('does not add spaces around inlined array elements in destructured arguments', async () => {
			const expected = `for (const [key, value] of Object.entries(attributes).filter(([_key, value]) => value !== '')) {}
const [obj1, obj2] = arrayOfObjects;`;
			const result = await format(expected, { singleQuote: true, printWidth: 100 });
			expect(result).toBeWithNewline(expected);
		});

		it('properly formats for of loops where the parent has no attributes', async () => {
			const expected = `<tbody>
  for (const [key, value] of Object.entries(attributes).filter(([_key, value]) => value !== '')) {
    <tr class="not-last:border-b border-border/50">
      <td class="py-2 font-mono w-48">
        <Kbd>{key}</Kbd>
      </td>
      <td class="py-2">{value}</td>
    </tr>
  }
</tbody>`;

			const result = await format(expected, { singleQuote: true, printWidth: 100 });
			expect(result).toBeWithNewline(expected);
		});

		it('should keep a new line between elements or component if provided', async () => {
			const expected = `<Something>
  <div>{'Hello'}</div>
</Something>

<Child class="test" />`;

			const result = await format(expected, { singleQuote: true, printWidth: 100 });
			expect(result).toBeWithNewline(expected);
		});

		it('should keep proper formatting between css declarations', async () => {
			const expected = `export component App() {
  <style>
    div {
      background-color: red;
    }
    .even-class {
      color: green;
    }
    .odd-class {
      color: blue;
    }
  </style>
}`;
			const result = await format(expected, { singleQuote: true, printWidth: 100 });
			expect(result).toBeWithNewline(expected);
		});

		it('should keep one new line between css declarations if one or more is provided', async () => {
			const input = `export component App() {
  <style>
    div {
      background-color: red;
    }

    .even-class {
      color: green;
    }


    .odd-class {
      color: blue;
    }
  </style>
}`;

			const expected = `export component App() {
  <style>
    div {
      background-color: red;
    }

    .even-class {
      color: green;
    }

    .odd-class {
      color: blue;
    }
  </style>
}`;
			const result = await format(input, { singleQuote: true, printWidth: 100 });
			expect(result).toBeWithNewline(expected);
		});

		it('should keep style tag intact when wrapped in parent outside a component', async () => {
			const expected = `<head>
  <style>
    div {
      background: purple;
    }
    p {
      background: blue;
    }
    .div {
      color: red;
    }
    .p {
      color: green;
    }
  </style>
</head>`;

			const result = await format(expected, { singleQuote: true, printWidth: 100 });
			expect(result).toBeWithNewline(expected);
		});

		it('should keep style tag intact when wrapped in parent inside component', async () => {
			const expected = `component App() {
  <head>
    <style>
      div {
        background: purple;
      }
      p {
        background: blue;
      }
      .div {
        color: red;
      }
      .p {
        color: green;
      }
    </style>
  </head>
}`;

			const result = await format(expected, { singleQuote: true, printWidth: 100 });
			expect(result).toBeWithNewline(expected);
		});

		it('should keep css siblings formatting intact', async () => {
			const expected = `export component App() {
  <style>
    div + .div > div,
    p,
    #id + .div ~ div,
    #id {
      color: red;
    }
  </style>
}`;
			const result = await format(expected, { singleQuote: true, printWidth: 100 });
			expect(result).toBeWithNewline(expected);
		});

		it('should format & parent nested selector correctly', async () => {
			const expected = `export component App() {
  <div>
    <h1>{'Hello'}</h1>
  </div>
  <style>
    div {
      & > * {
        color: blue;
      }
    }
  </style>
}`;
			const result = await format(expected, { singleQuote: true, printWidth: 100 });
			expect(result).toBeWithNewline(expected);
		});

		it('should keep TrackedMap short syntax intact', async () => {
			const expected = `const map = new #Map([['key1', 'value1'], ['key2', 'value2']]);
const set = new #Set([1, 2, 3]);`;

			const result = await format(expected, { singleQuote: true, printWidth: 100 });
			expect(result).toBeWithNewline(expected);
		});

		it('should not remove blank lines between components and types if provided', async () => {
			const expected = `export component App() {
  console.log('test');
}

type RootNode = ShadowRoot | Document | Node;
type GetRootNode = () => RootNode;`;

			const result = await format(expected, { singleQuote: true, printWidth: 100 });
			expect(result).toBeWithNewline(expected);
		});

		it('should preserve a blank line between components and js declarations if one is provided', async () => {
			const expected = `export component App() {
  <Card>
    component children() {
      <p class="highlighted">{'Card content here'}</p>
    }
  </Card>

  const test = 5;

  <div>{test}</div>
}`;

			const result = await format(expected, { singleQuote: true, printWidth: 100 });
			expect(result).toBeWithNewline(expected);
		});

		it('should preserve blank line between component with nested markup and js', async () => {
			const expected = `component App() {
  <div>
    const a = 1;
    <div>
      const b = 1;
    </div>
    <div>
      const b = 1;
    </div>
  </div>
  <div>
    const a = 2;
    <div>
      const b = 1;
    </div>
  </div>
}

render(App);`;

			const result = await format(expected, { singleQuote: true, printWidth: 100 });
			expect(result).toBeWithNewline(expected);
		});

		it('should not remove async from arrow functions', async () => {
			const expected = `describe('ripple-compat-react', async () => {
  const something = 10;
});`;

			const result = await format(expected, { singleQuote: true, printWidth: 100 });
			expect(result).toBeWithNewline(expected);
		});

		it('should preserve blank lines between components and various TS declarations', async () => {
			const expected = `export component App() {
  console.log('test');
}

interface Props {
  value: string;
}

type Result = string | number;

enum Status {
  Active,
  Inactive,
  Pending,
}`;

			const result = await format(expected, { singleQuote: true, printWidth: 100 });
			expect(result).toBeWithNewline(expected);
		});

		it('should preserve blank lines between ts and import statements', async () => {
			const expected = `export interface PortalActionProps {
  disabled?: boolean | undefined;
  container?: HTMLElement | undefined;
  getRootNode?: GetRootNode | undefined;
}

import { Portal as RipplePortal } from 'ripple';`;

			const result = await format(expected, { singleQuote: true, printWidth: 100 });
			expect(result).toBeWithNewline(expected);
		});

		it('should preserve blank lines between export statements and import statements or comments', async () => {
			const expected = `export { handler } from './test.ripple';

import { Portal as RipplePortal } from 'ripple';

// export { something } from './test.ripple;

import { GetRootNode } from './somewhere';`;

			const result = await format(expected, { singleQuote: true, printWidth: 100 });
			expect(result).toBeWithNewline(expected);
		});

		it('should preserve export interface with extends as provided', async () => {
			const expected = `export interface TrackedArray<T> extends Array<T> {}`;

			const result = await format(expected, { singleQuote: true, printWidth: 100 });
			expect(result).toBeWithNewline(expected);
		});

		it('should preserve ternaries and jsdoc type assertions with parens and space', async () => {
			const expected = `/**
 * @param {unknown} maybe_tracked
 * @param {'contentRect' | 'contentBoxSize' | 'borderBoxSize' | 'devicePixelContentBoxSize'} type
 */
function bind_element_rect(maybe_tracked, type) {
  if (!is_tracked_object(maybe_tracked)) {
    throw not_tracked_type_error(\`bind\${type.charAt(0).toUpperCase() + type.slice(1)}()\`);
  }

  var tracked = /** @type {Tracked<any>} */ (maybe_tracked);
  var observer =
    type === 'contentRect' || type === 'contentBoxSize'
      ? resize_observer_content_box
      : type === 'borderBoxSize'
        ? resize_observer_border_box
        : resize_observer_device_pixel_content_box;

  return (/** @type {HTMLElement} */ element) => {
    var unsubscribe = observer.observe(
      element,
      /** @param {any} entry */ (entry) => set(tracked, entry[type]),
    );

    effect(() => unsubscribe);
  };
}`;

			const result = await format(expected, { singleQuote: true, printWidth: 100 });
			expect(result).toBeWithNewline(expected);
		});

		it('should preserve block comments formatting inside curly braces and inside markup', async () => {
			const expected = `<div class="container">{/* Dynamic SVG - the original problem case */}</div>`;

			const result = await format(expected, { singleQuote: true, printWidth: 100 });
			expect(result).toBeWithNewline(expected);
		});

		it('should preserve block comments formatting inside curly braces and inside nested markup', async () => {
			const expected = `<div class="container">
  {/* Dynamic SVG - the original problem case */}
  <span>{'Content'}</span>
  {/* Static SVG - always worked */}
  <span>{'More Content'}</span>
</div>`;

			const result = await format(expected, { singleQuote: true, printWidth: 100 });
			expect(result).toBeWithNewline(expected);
		});

		it('should format function calls with long string literals correctly', async () => {
			const input = `for (const quasi of template.quasis) {
    quasi.value.raw = sanitize_template_string(/** @type {string} */(quasi.value.cooked));
}`;

			const expected = `for (const quasi of template.quasis) {
  quasi.value.raw = sanitize_template_string(
    /** @type {string} */ (quasi.value.cooked),
  );
}`;

			const result = await format(input, { singleQuote: true, printWidth: 80 });
			expect(result).toBeWithNewline(expected);
		});

		it('should break up call expressions on new lines with inline jsdoc comments with printWidth 100', async () => {
			const input = `for (const quasi of template.quasis) {
  quasi.value.raw = sanitize_template_string(/** @type {string} */ (quasi.value.cooked));
}

const program = /** @type {Program} */ (walk(/** @type {Node} */ (analysis.ast), { ...state, namespace: 'html' }, visitors));`;

			const expected = `for (const quasi of template.quasis) {
  quasi.value.raw = sanitize_template_string(/** @type {string} */ (quasi.value.cooked));
}

const program = /** @type {Program} */ (
  walk(/** @type {Node} */ (analysis.ast), { ...state, namespace: 'html' }, visitors)
);`;

			const result = await format(input, { singleQuote: true, printWidth: 100 });
			expect(result).toBeWithNewline(expected);
		});

		it('should break up call expressions on new lines with inline jsdoc comments with printWidth 30', async () => {
			const input = `for (const quasi of template.quasis) {
  quasi.value.raw = sanitize_template_string(/** @type {string} */ (quasi.value.cooked));
}

const program = /** @type {Program} */ (walk(/** @type {Node} */ (analysis.ast), { ...state, namespace: 'html' }, visitors));`;

			const expected = `for (const quasi of template.quasis) {
  quasi.value.raw =
    sanitize_template_string(
      /** @type {string} */ (
        quasi.value.cooked
      ),
    );
}

const program =
  /** @type {Program} */ (
    walk(
      /** @type {Node} */ (
        analysis.ast
      ),
      {
        ...state,
        namespace: 'html',
      },
      visitors,
    )
  );`;

			const result = await format(input, { singleQuote: true, printWidth: 30 });
			expect(result).toBeWithNewline(expected);
		});

		it('should properly format long jsdoc with call expressions', async () => {
			const input = `const js = /** @type {ReturnType<typeof print> & { post_processing_changes?: PostProcessingChanges, line_offsets?: number[] }} */ (
  print(program, language_handler, {
    sourceMapContent: source,
    sourceMapSource: path.basename(filename),
  })
);`;

			const expected = `const js =
  /** @type {ReturnType<typeof print> & { post_processing_changes?: PostProcessingChanges, line_offsets?: number[] }} */ (
    print(program, language_handler, {
      sourceMapContent: source,
      sourceMapSource: path.basename(filename),
    })
  );`;

			const result = await format(input, { singleQuote: true, printWidth: 100 });
			expect(result).toBeWithNewline(expected);
		});

		it('should expand call arguments containing a regex literal with a block callback', async () => {
			const input = String.raw`js.code = js.code.replace(/^(export\s+)declare\s+(function\s+\w+[^{\n]*;)$/gm, (match, p1, p2, offset) => {
  const replacement = p1 + p2;
  const line = offset_to_line(offset);
  const delta = replacement.length - match.length; // negative (removing 'declare ')

  // Track first change offset and total delta per line
  if (!line_deltas.has(line)) {
	line_deltas.set(line, { offset, delta });
  } else {
    // Additional change on same line - accumulate delta
    // @ts-ignore
    line_deltas.get(line).delta += delta;
  }
  return replacement;
});`;

			const expected = String.raw`js.code = js.code.replace(
  /^(export\s+)declare\s+(function\s+\w+[^{\n]*;)$/gm,
  (match, p1, p2, offset) => {
    const replacement = p1 + p2;
    const line = offset_to_line(offset);
    const delta = replacement.length - match.length; // negative (removing 'declare ')

    // Track first change offset and total delta per line
    if (!line_deltas.has(line)) {
      line_deltas.set(line, { offset, delta });
    } else {
      // Additional change on same line - accumulate delta
      // @ts-ignore
      line_deltas.get(line).delta += delta;
    }
    return replacement;
  },
);`;

			const result = await format(input, { singleQuote: true, printWidth: 80 });
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
message.push(\`User: \${JSON.stringify({ name: "Alice", age: 30 } as User)}\`);`;

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

	it("should correctly handle comments according to Ripple's syntax", async () => {
		const input = `// input
<section>
  // TODO
  {'Hello'}
</section>

// input
<section>
  // TODO
</section>

// input
<section>
      // TODO
  <span>{'Hello'}</span>
</section>`;

		const expected = `// input
<section>
  // TODO
  {'Hello'}
</section>

// input
<section>
  // TODO
</section>

// input
<section>
  // TODO
  <span>{'Hello'}</span>
</section>`;

		const result = await format(input, { singleQuote: true });
		expect(result).toBeWithNewline(expected);
	});

	it('should keep comments inside function with one statement at the top', async () => {
		const expected = `component App() {
  const something = 5;
  // comment
}

function test() {
  const something = 5;
  // comment
}`;

		const result = await format(expected, { singleQuote: true });
		expect(result).toBeWithNewline(expected);
	});

	it('should preserve trailing comments in function parameters', async () => {
		const expected = `function test(
  // comment in params
  a,
  // comment in params
  b,
  // comment in params
  c,
  // comment in params
) {}`;

		const result = await format(expected, { singleQuote: true });
		expect(result).toBeWithNewline(expected);
	});

	it('should preserve trailing comments in call arguments', async () => {
		const expected = `fn(
  arg1,
  // comment in args
  arg2,
  // comment in args
  arg3,
  // comment in args
);`;

		const result = await format(expected, { singleQuote: true });
		expect(result).toBeWithNewline(expected);
	});

	it('should preserve trailing comments in arrow function parameters', async () => {
		const expected = `const test = (
  // comment in params
  a,
  // comment in params
  b,
  // comment in params
  c,
  // comment in params
) => {};`;

		const result = await format(expected, { singleQuote: true });
		expect(result).toBeWithNewline(expected);
	});

	it('should preserve trailing comments in class body', async () => {
		const expected = `class MyClass {
  /* comment 1 */
  method1() {}
  //comment 2

  method2() {}
  // comment 3
}`;

		const result = await format(expected, { singleQuote: true });
		expect(result).toBeWithNewline(expected);
	});

	it('should preserve comments in object and tracked object expressions', async () => {
		const expected = `const obj = {
  /* comment 1 */
  a: 1,

  // comment 2
  b: 2,
  // comment 3
};

const obj2 = #{
  /* comment 1 */
  a: 1,

  // comment 2
  b: 2,
  // comment 3
};`;

		const result = await format(expected, { singleQuote: true });
		expect(result).toBeWithNewline(expected);
	});

	it('should preserve comments in switch statement cases', async () => {
		const input = `switch (x) {
  case 1:
    foo();
    // comment 1
  case 2:
    bar();
    // comment 2
}`;

		const expected = `switch (x) {
  case 1:
    foo();
  // comment 1
  case 2:
    bar();
  // comment 2
}`;

		const result = await format(input, { singleQuote: true });
		expect(result).toBeWithNewline(expected);
	});

	it('should preserve comments in arrays with width 80', async () => {
		const input = `const arr = [
  1,
  /* comment 1 */
  2,
  3,
  // comment 2
];`;

		const expected = `const arr = [
  1, /* comment 1 */
  2, 3,
  // comment 2
];`;

		const result = await format(input, { singleQuote: true, printWidth: 80 });
		expect(result).toBeWithNewline(expected);
	});

	it('should preserve comments in arrays width printWidth 3', async () => {
		const input = `const arr = #[
  1,
  /* comment 1 */
  2,
  3,
  // comment 2
];`;

		const expected = `const arr =
  #[
    1,
    /* comment 1 */
    2,
    3,
    // comment 2
  ];`;

		const result = await format(input, { singleQuote: true, printWidth: 3 });
		expect(result).toBeWithNewline(expected);
	});

	it('should preserve comments in arrays width printWidth 13', async () => {
		const input = `const arr =
  #[
    1 /* comment 1 */,
    2, 3,
    // comment 2
  ];`;

		const expected = `const arr = #[
  1 /* comment 1 */,
  2, 3,
  // comment 2
];`;

		const result = await format(input, { singleQuote: true, printWidth: 13 });
		expect(result).toBeWithNewline(expected);
	});

	it('should properly format array with various sized strings and 100 printWidth', async () => {
		const expected = `component App() {
  const d = [
    'm14 12 4 4 4-4',
    'M18 16V7',
    'm2 16 4.039-9.69a.5.5 0 0 1 .923 0L11 16',
    'M3.304 13h6.392',
  ];
}`;

		const result = await format(expected, { singleQuote: true, printWidth: 100 });
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
  <div>
    <Expand name="" startingLength={20} />
  </div>
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

		const expected = `component Expand({
  name,
  startingLength = 10,
}: {
  name: string;
  startingLength?: number;
}) {
  <div />
}`;

		const result = await format(input, { singleQuote: true, printWidth: 80 });
		expect(result).toBeWithNewline(expected);
	});

	it('should handle default arguments correctly in functions', async () => {
		const input = `function expand({ name, startingLength = 10 }: { name: string; startingLength?: number }) {
  return null;
}`;

		const expected = `function expand({
  name,
  startingLength = 10,
}: {
  name: string;
  startingLength?: number;
}) {
  return null;
}`;

		const result = await format(input, { singleQuote: true, printWidth: 80 });
		expect(result).toBeWithNewline(expected);
	});

	it('should handle default arguments correctly in arrow functions', async () => {
		const input = `const expand = ({ name, startingLength = 10 }: { name: string; startingLength?: number }) => {
  return null;
};`;

		const expected = `const expand = ({
  name,
  startingLength = 10,
}: {
  name: string;
  startingLength?: number;
}) => {
  return null;
};`;

		const result = await format(input, { singleQuote: true, printWidth: 80 });
		expect(result).toBeWithNewline(expected);
	});

	it('should handle array and object patterns correctly', async () => {
		const input = `for (const [i = 0, item] of items.entries()) {}
for (const {i = 0, item} of items.entries()) {}`;

		const expected = `for (const [i = 0, item] of items.entries()) {}
for (const { i = 0, item } of items.entries()) {}`;

		const result = await format(input);
		expect(result).toBeWithNewline(expected);
	});

	it('should handle various other TS things', async () => {
		const input = `const globalContext = new Context<{ theme: string, array: number[] }>({ theme: 'light', array: [] });
const items = [] as unknown[];`;

		const expected = `const globalContext = new Context<{ theme: string; array: number[] }>({
  theme: 'light',
  array: [],
});
const items = [] as unknown[];`;

		const result = await format(input, { singleQuote: true, printWidth: 80 });
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

		const result = await format(expected, {
			singleQuote: true,
			arrowParens: 'always',
			printWidth: 100,
		});
		expect(result).toBeWithNewline(expected);
	});

	it('should keep a new line between js and jsx if provided', async () => {
		const expected = `export component App() {
  let text = 'something';
  <div>{String(text)}</div>
}`;

		const result = await format(expected, {
			singleQuote: true,
			arrowParens: 'always',
			printWidth: 100,
		});
		expect(result).toBeWithNewline(expected);
	});

	it('should not format html elements that fit on one line', async () => {
		const expected = `export component App() {
  <div class="container">
    <p>{'Some Random text'}</p>
  </div>
}`;

		const result = await format(expected, {
			singleQuote: true,
			arrowParens: 'always',
			printWidth: 100,
		});

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

		const result = await format(input, {
			singleQuote: true,
			arrowParens: 'always',
			printWidth: 100,
		});

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

		it('should properly format TSParenthesizedType', async () => {
			const expected = `const logs: (number | undefined)[] = [];`;
			const result = await format(expected);
			expect(result).toBeWithNewline(expected);
		});

		it('should retain templated declarations', async () => {
			const expected = `function Wrapper() {
  return {
    unwrap: function <T>() {
      return null as unknown as T;
    },
  };
}

class Box<T> {
  value: T;

  method<T>(): T {
    return this.value;
  }
}

function Wrapper2<T>(arg: T) {
  let x: T = arg;
  return {
    unwrap: function <T>() {
      return null as unknown as T;
    },
    do: function (): T {
      return x;
    },
  };
}

const fn = <T>(arg: T): T => arg;`;

			const result = await format(expected, { singleQuote: true });
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
			const result = await format(input, {
				singleQuote: true,
				arrowParens: 'always',
				printWidth: 100,
			});
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
			const result = await format(input, {
				singleQuote: true,
				arrowParens: 'always',
				printWidth: 100,
			});
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
			const result = await format(input, {
				singleQuote: true,
				arrowParens: 'always',
				printWidth: 100,
			});
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
			const result = await format(input, {
				singleQuote: true,
				arrowParens: 'always',
				printWidth: 100,
			});
			expect(result).toBeWithNewline(expected);
		});

		it('preserves typescript parameter types with a default value', async () => {
			const expected = `function getString(e: string = 'test') {
  return e;
}`;
			const result = await format(expected, { singleQuote: true });
			expect(result).toBeWithNewline(expected);
		});

		it('should format TypeScript enums', async () => {
			const input = `enum Color{Red,Green,Blue}`;
			const expected = `enum Color {
  Red,
  Green,
  Blue,
}`;
			const result = await format(input, { singleQuote: true });
			expect(result).toBeWithNewline(expected);
		});

		it('should format TypeScript enums with values', async () => {
			const input = `enum Status{Active=1,Inactive=0,Pending=2}`;
			const expected = `enum Status {
  Active = 1,
  Inactive = 0,
  Pending = 2,
}`;
			const result = await format(input, { singleQuote: true });
			expect(result).toBeWithNewline(expected);
		});

		it('should format const enums', async () => {
			const input = `const enum Direction{Up,Down,Left,Right}`;
			const expected = `const enum Direction {
  Up,
  Down,
  Left,
  Right,
}`;
			const result = await format(input, { singleQuote: true });
			expect(result).toBeWithNewline(expected);
		});

		it('should respect trailingComma option for enums', async () => {
			const input = `enum Size{Small,Medium,Large}`;
			const expected = `enum Size {
  Small,
  Medium,
  Large
}`;
			const result = await format(input, { singleQuote: true, trailingComma: 'none' });
			expect(result).toBeWithNewline(expected);
		});

		it('should format enums with string values', async () => {
			const input = `enum Colors{Red='red',Green='green',Blue='blue'}`;
			const expected = `enum Colors {
  Red = 'red',
  Green = 'green',
  Blue = 'blue',
}`;
			const result = await format(input, { singleQuote: true });
			expect(result).toBeWithNewline(expected);
		});

		it('should keep the return type annotation intact on an arrow function', async () => {
			const expected = `const getParams = (): Params<T> => ({});
interface Params<T> {}`;

			const result = await format(expected, { singleQuote: true });
			expect(result).toBeWithNewline(expected);
		});
	});

	describe('regex formatting', () => {
		it('preserves regex literals in method calls', async () => {
			const expected = `export component App() {
  let text = 'Hello <span>world</span>';
  let result = text.match(/<span>/);
  <div>{String(result)}</div>
}`;

			const result = await format(expected, {
				singleQuote: true,
				arrowParens: 'always',
				printWidth: 100,
			});

			expect(result).toBeWithNewline(expected);
		});

		it('preserves multiple regex patterns', async () => {
			const expected = `export component App() {
  let html = '<div>Hello</div><span>World</span>';
  let divMatch = html.match(/<div>/g);
  let spanReplace = html.replace(/<span>/g, '[SPAN]');
  let allTags = html.split(/<br>/);
}`;

			const result = await format(expected, {
				singleQuote: true,
				arrowParens: 'always',
				printWidth: 100,
			});

			expect(result).toBeWithNewline(expected);
		});

		it('preserves regex literals in variable assignments', async () => {
			const expected = `export component App() {
  let spanRegex = /<span>/g;
  let divRegex = /<div>/;
  let simpleRegex = /<br>/g;
}`;

			const result = await format(expected, {
				singleQuote: true,
				arrowParens: 'always',
				printWidth: 100,
			});

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

			const result = await format(expected, {
				singleQuote: true,
				arrowParens: 'always',
				printWidth: 100,
			});

			expect(result).toBeWithNewline(expected);
		});

		it('should handle edge case regex patterns', async () => {
			const expected = `export component Test() {
  let text = '<<test>> <span>content</span>';
  let multiAngle = text.match(/<span>/);
  let simplePattern = text.match(/<>/);
}`;

			const result = await format(expected, {
				singleQuote: true,
				arrowParens: 'always',
				printWidth: 100,
			});

			expect(result).toBeWithNewline(expected);
		});
	});

	describe('blank line rules', () => {
		describe('Rule A: Collapse multiple blank lines to one', () => {
			it('collapses multiple blank lines between statements', async () => {
				const input = `export component App() {
  let a = 1;


  let b = 2;
}`;

				const expected = `export component App() {
  let a = 1;

  let b = 2;
}`;

				const result = await format(input, { singleQuote: true });
				expect(result).toBeWithNewline(expected);
			});

			it('collapses multiple blank lines in element children', async () => {
				const input = `export component App() {
  <div>
    <span>{'First'}</span>


    <span>{'Second'}</span>
  </div>
}`;

				const expected = `export component App() {
  <div>
    <span>{'First'}</span>

    <span>{'Second'}</span>
  </div>
}`;

				const result = await format(input, { singleQuote: true });
				expect(result).toBeWithNewline(expected);
			});
		});

		describe('Rule B: Remove leading/trailing blank lines at file and block boundaries', () => {
			it('remove all blank lines in empty statement', async () => {
				const input = `export component App() {



}`;

				const expected = `export component App() {}`;

				const result = await format(input, { singleQuote: true });
				expect(result).toBeWithNewline(expected);
			});

			it('removes leading blank line at file start', async () => {
				const input = `

export component App() {
  let x = 1;
}`;

				const expected = `export component App() {
  let x = 1;
}`;

				const result = await format(input, { singleQuote: true });
				expect(result).toBeWithNewline(expected);
			});

			it('removes trailing blank line at file end (preserves single newline)', async () => {
				const input = `export component App() {
  let x = 1;
}

`;

				const expected = `export component App() {
  let x = 1;
}`;

				const result = await format(input, { singleQuote: true });
				expect(result).toBeWithNewline(expected);
			});

			it('removes blank lines immediately after opening brace', async () => {
				const input = `export component App() {

  let x = 1;
  let y = 2;
}`;

				const expected = `export component App() {
  let x = 1;
  let y = 2;
}`;

				const result = await format(input, { singleQuote: true });
				expect(result).toBeWithNewline(expected);
			});

			it('removes blank lines immediately before closing brace', async () => {
				const input = `export component App() {
  let x = 1;
  let y = 2;

}`;

				const expected = `export component App() {
  let x = 1;
  let y = 2;
}`;

				const result = await format(input, { singleQuote: true });
				expect(result).toBeWithNewline(expected);
			});

			it('removes leading blank line inside if block', async () => {
				const input = `export component App() {
  if (true) {

    console.log('test');
  }
}`;

				const expected = `export component App() {
  if (true) {
    console.log('test');
  }
}`;

				const result = await format(input, { singleQuote: true });
				expect(result).toBeWithNewline(expected);
			});

			it('removes trailing blank line inside if block', async () => {
				const input = `export component App() {
  if (true) {
    console.log('test');

  }
}`;

				const expected = `export component App() {
  if (true) {
    console.log('test');
  }
}`;

				const result = await format(input, { singleQuote: true });
				expect(result).toBeWithNewline(expected);
			});
		});

		describe('Rule C: Preserve internal blank lines in multi-line structures', () => {
			it('preserves blank lines between array elements when multi-line', async () => {
				const input = `export component App() {
  let arr = [
    1,

    2,

    3
  ];
}`;

				const expected = `export component App() {
  let arr = [
    1,

    2,

    3,
  ];
}`;

				const result = await format(input, { singleQuote: true });
				expect(result).toBeWithNewline(expected);
			});

			it('preserves blank lines between object properties when multi-line', async () => {
				const input = `export component App() {
  let obj = {
    a: 1,

    b: 2,

    c: 3
  };
}`;

				const expected = `export component App() {
  let obj = {
    a: 1,

    b: 2,

    c: 3,
  };
}`;

				const result = await format(input, { singleQuote: true });
				expect(result).toBeWithNewline(expected);
			});

			it('preserves blank lines between function parameters when multi-line', async () => {
				const input = `export component App() {
  function test(
    a,

    b,

    c
  ) {
    return a + b + c;
  }
}`;

				const expected = `export component App() {
  function test(
    a,

    b,

    c,
  ) {
    return a + b + c;
  }
}`;

				const result = await format(input, { singleQuote: true });
				expect(result).toBeWithNewline(expected);
			});

			it('preserves blank lines between call arguments when multi-line', async () => {
				const input = `export component App() {
  console.log(
    'first',

    'second',

    'third',
  );
}`;

				const expected = `export component App() {
  console.log(
    'first',

    'second',

    'third',
  );
}`;

				const result = await format(input, { singleQuote: true });
				expect(result).toBeWithNewline(expected);
			});

			it('preserves blank lines between JSX element children', async () => {
				const input = `export component App() {
  <div>
    <span>{'First'}</span>

    <span>{'Second'}</span>

    <span>{'Third'}</span>
  </div>
}`;

				const expected = `export component App() {
  <div>
    <span>{'First'}</span>

    <span>{'Second'}</span>

    <span>{'Third'}</span>
  </div>
}`;

				const result = await format(input, { singleQuote: true });
				expect(result).toBeWithNewline(expected);
			});
		});

		describe('Rule D: Remove blank lines immediately after opening or before closing delimiters', () => {
			it('removes blank line immediately after opening paren in params', async () => {
				const input = `export component App() {
  function foo(

    a,
    b
  ) {
    return a + b;
  }
}`;

				const expected = `export component App() {
  function foo(a, b) {
    return a + b;
  }
}`;

				const result = await format(input, { singleQuote: true });
				expect(result).toBeWithNewline(expected);
			});

			it('removes blank line immediately before closing paren in params', async () => {
				const input = `export component App() {
  function foo(
    a,
    b

  ) {
    return a + b;
  }
}`;

				const expected = `export component App() {
  function foo(a, b) {
    return a + b;
  }
}`;

				const result = await format(input, { singleQuote: true });
				expect(result).toBeWithNewline(expected);
			});

			it('removes blank line immediately after opening paren in call', async () => {
				const input = `export component App() {
  foo(

    'a',
    'b'
  );
}`;

				const expected = `export component App() {
  foo('a', 'b');
}`;

				const result = await format(input, { singleQuote: true });
				expect(result).toBeWithNewline(expected);
			});

			it('removes blank line immediately after opening bracket in array', async () => {
				const input = `export component App() {
  let arr = [

    1,
    2,
    3
  ];
}`;

				const expected = `export component App() {
  let arr = [1, 2, 3];
}`;

				const result = await format(input, { singleQuote: true });
				expect(result).toBeWithNewline(expected);
			});

			it('removes blank line immediately before closing bracket in array', async () => {
				const input = `export component App() {
  let arr = [
    1,
    2,
    3

  ];
}`;

				const expected = `export component App() {
  let arr = [1, 2, 3];
}`;

				const result = await format(input, { singleQuote: true });
				expect(result).toBeWithNewline(expected);
			});

			it('removes blank line immediately after opening brace in object', async () => {
				const input = `export component App() {
  let obj = {

    a: 1,
    b: 2
  };
}`;

				const expected = `export component App() {
  let obj = {
    a: 1,
    b: 2,
  };
}`;

				const result = await format(input, { singleQuote: true });
				expect(result).toBeWithNewline(expected);
			});

			it('removes blank line immediately before closing brace in object', async () => {
				const input = `export component App() {
  let obj = {
    a: 1,
    b: 2

  };
}`;

				const expected = `export component App() {
  let obj = {
    a: 1,
    b: 2,
  };
}`;

				const result = await format(input, { singleQuote: true });
				expect(result).toBeWithNewline(expected);
			});
		});

		describe('Combined rules: preserve internal, remove leading/trailing', () => {
			it('preserves internal blank lines but removes leading/trailing in params', async () => {
				const input = `export component App() {
  function foo(

    a,

    b,

    c

  ) {
    return a + b + c;
  }
}`;

				const expected = `export component App() {
  function foo(
    a,

    b,

    c,
  ) {
    return a + b + c;
  }
}`;

				const result = await format(input, { singleQuote: true });
				expect(result).toBeWithNewline(expected);
			});

			it('preserves internal blank lines but removes leading/trailing in arrays', async () => {
				const input = `export component App() {
  let arr = [

    1,

    2,

    3

  ];
}`;

				const expected = `export component App() {
  let arr = [
    1,

    2,

    3,
  ];
}`;

				const result = await format(input, { singleQuote: true });
				expect(result).toBeWithNewline(expected);
			});

			it('preserves internal blank lines but removes leading/trailing in objects', async () => {
				const input = `export component App() {
  let obj = {

    a: 1,

    b: 2,

    c: 3

  };
}`;

				const expected = `export component App() {
  let obj = {
    a: 1,

    b: 2,

    c: 3,
  };
}`;

				const result = await format(input, { singleQuote: true });
				expect(result).toBeWithNewline(expected);
			});
		});

		describe('Statement-level blank lines (should be preserved)', () => {
			it('preserves blank lines between top-level statements', async () => {
				const input = `export component App() {
  let x = 1;

  let y = 2;

  console.log(x, y);
}`;

				const expected = `export component App() {
  let x = 1;

  let y = 2;

  console.log(x, y);
}`;

				const result = await format(input, { singleQuote: true });
				expect(result).toBeWithNewline(expected);
			});

			it('preserves blank lines between class members', async () => {
				const input = `class Foo {
  method1() {
    return 1;
  }

  method2() {
    return 2;
  }

  method3() {
    return 3;
  }
}`;

				const expected = `class Foo {
  method1() {
    return 1;
  }

  method2() {
    return 2;
  }

  method3() {
    return 3;
  }
}`;

				const result = await format(input, { singleQuote: true });
				expect(result).toBeWithNewline(expected);
			});

			it('should keep blank line between components with a trailing comment at the end of the first', async () => {
				const expected = `component SVG({ children }) {
  <svg width={20} height={20} fill="blue" viewBox="0 0 30 10" preserveAspectRatio="none">
    let test = track(8);
    {test}
    <polygon points="0,0 30,0 15,10" />
  </svg>
  // <div><children /></div>
}

component Polygon() {
  <polygon points="0,0 30,0 15,10" />
}`;

				const result = await format(expected, { singleQuote: true, printWidth: 100 });
				expect(result).toBeWithNewline(expected);
			});
		});

		describe('Arrays with printWidth constraints', () => {
			it('inlines array elements when they fit within printWidth', async () => {
				const input = `export component App() {
  let arr = [1, 2, 3, 4, 5,

    6, 7,

    8];
}`;

				const expected = `export component App() {
  let arr = [
    1, 2, 3, 4, 5,

    6, 7,

    8,
  ];
}`;

				const result = await format(input, { singleQuote: true, printWidth: 100 });
				expect(result).toBeWithNewline(expected);
			});

			// Note: Known limitation - fill() doesn't account for parent bracket breaking
			// With very small printWidth, bracket should break adding extra indent
			// but fill() calculates widths before knowing about parent break
			it('breaks array elements when they exceed printWidth 10', async () => {
				const input = `export component App() {
  let arr = [1, 2, 3, 4, 5,

    6, 7,

    8];
}`;

				// With printWidth 10, all elements break to separate lines
				// Because even "6, 7," is 5 chars + indentation = exceeds 10
				const expected = `export component App() {
  let arr =
    [
      1,
      2,
      3,
      4,
      5,

      6,
      7,

      8,
    ];
}`;

				const result = await format(input, { singleQuote: true, printWidth: 10 });
				expect(result).toBeWithNewline(expected);
			});

			it('fits elements on same line with printWidth 11', async () => {
				const input = `export component App() {
  let arr = [1, 2, 3, 4, 5,

    6, 7,

    8];
}`;

				// With printWidth 11: "    6, 7," is exactly 9 chars, should fit
				const expected = `export component App() {
  let arr =
    [
      1, 2,
      3, 4,
      5,

      6, 7,

      8,
    ];
}`;

				const result = await format(input, { singleQuote: true, printWidth: 11 });
				expect(result).toBeWithNewline(expected);
			});

			it('fits more elements with printWidth 15', async () => {
				const input = `export component App() {
  let arr = [1, 2, 3, 4, 5,

    6, 7,

    8];
}`;

				// With printWidth 15: "    1, 2, 3," is 12 chars, should fit 1, 2, 3 together
				const expected = `export component App() {
  let arr = [
    1, 2, 3, 4,
    5,

    6, 7,

    8,
  ];
}`;

				const result = await format(input, { singleQuote: true, printWidth: 15 });
				expect(result).toBeWithNewline(expected);
			});

			it('fits even more elements with printWidth 18', async () => {
				const input = `export component App() {
  let arr = [1, 2, 3, 4, 5,

    6, 7,

    8];
}`;

				// With printWidth 18: "    1, 2, 3, 4," is 15 chars, should fit 1, 2, 3, 4 together
				const expected = `export component App() {
  let arr = [
    1, 2, 3, 4, 5,

    6, 7,

    8,
  ];
}`;

				const result = await format(input, { singleQuote: true, printWidth: 18 });
				expect(result).toBeWithNewline(expected);
			});

			it('places each object on its own line when array contains objects where each has multiple properties', async () => {
				const input = `export component App() {
  let arr = [{ a: 1, b: 2 }, { c: 3, d: 4 }, { e: 5, f: 6 }];
}`;

				// Each object should be on its own line when all objects have >1 property
				const expected = `export component App() {
  let arr = [
    { a: 1, b: 2 },
    { c: 3, d: 4 },
    { e: 5, f: 6 },
  ];
}`;

				const result = await format(input, { singleQuote: true });
				expect(result).toBeWithNewline(expected);
			});

			it('allows inline when array has single-property objects', async () => {
				const input = `export component App() {
  let arr = [{ a: 1 }, { b: 2 }, { c: 3 }];
}`;

				// Single-property objects can stay inline
				const expected = `export component App() {
  let arr = [{ a: 1 }, { b: 2 }, { c: 3 }];
}`;

				const result = await format(input, { singleQuote: true });
				expect(result).toBeWithNewline(expected);
			});

			it('allows inline when array has mix of single and multi-property objects', async () => {
				const input = `export component App() {
  let arr = [{ a: 1 }, { b: 2, c: 3 }, { d: 4 }];
}`;

				// Mixed property counts - can stay inline (rule only applies when ALL objects have >1 property)
				const expected = `export component App() {
  let arr = [{ a: 1 }, { b: 2, c: 3 }, { d: 4 }];
}`;

				const result = await format(input, { singleQuote: true });
				expect(result).toBeWithNewline(expected);
			});

			it('respects original formatting when array has mixture of inline and multi-line objects', async () => {
				const input = `export component App() {
  let arr = [{ a: 1, b: 2 }, {
    c: 3,
    d: 4
  }, { e: 5, f: 6 }];
}`;

				// Objects originally inline stay inline, originally multi-line stay multi-line
				// Each object on its own line because all have >1 property
				const expected = `export component App() {
  let arr = [
    { a: 1, b: 2 },
    {
      c: 3,
      d: 4,
    },
    { e: 5, f: 6 },
  ];
}`;

				const result = await format(input, { singleQuote: true });
				expect(result).toBeWithNewline(expected);
			});
		});

		describe('<tsx:react>', () => {
			it('should format JSX inside <tsx:react> tags', async () => {
				const input = `component App() {
	<div>
		<h1>{"Hello, from Ripple!"}</h1>
		<tsx:react>
			<div className="123">Welcome from React!</div>
		</tsx:react>
	</div>
}`;

				const expected = `component App() {
  <div>
    <h1>{'Hello, from Ripple!'}</h1>
    <tsx:react>
      <div className="123">Welcome from React!</div>
    </tsx:react>
  </div>
}`;

				const result = await format(input, { singleQuote: true });
				expect(result).toBeWithNewline(expected);
			});

			it('should format JSXFragment inside <tsx:react> tags', async () => {
				const input = `component App() {
	<div>
		<h1>{"Hello, from Ripple!"}</h1>
		<tsx:react>
			<div className="123">
				<>
					Text content
				</>
			</div>
		</tsx:react>
	</div>
}`;

				const expected = `component App() {
  <div>
    <h1>{'Hello, from Ripple!'}</h1>
    <tsx:react>
      <div className="123">
        <>Text content</>
      </div>
    </tsx:react>
  </div>
}`;

				const result = await format(input, { singleQuote: true });
				expect(result).toBeWithNewline(expected);
			});

			it('should format empty JSXFragment', async () => {
				const input = `component App() {
	<tsx:react>
		<div>
			<></>
		</div>
	</tsx:react>
}`;

				const expected = `component App() {
  <tsx:react>
    <div><></></div>
  </tsx:react>
}`;

				const result = await format(input, { singleQuote: true });
				expect(result).toBeWithNewline(expected);
			});

			it('should format JSXFragment with multiple children', async () => {
				const input = `component App() {
	<tsx:react>
		<>
			<div>First</div>
			<div>Second</div>
			<span>Third</span>
		</>
	</tsx:react>
}`;

				const expected = `component App() {
  <tsx:react>
    <>
      <div>First</div>
      <div>Second</div>
      <span>Third</span>
    </>
  </tsx:react>
}`;

				const result = await format(input, { singleQuote: true });
				expect(result).toBeWithNewline(expected);
			});

			it('should format nested JSXFragments', async () => {
				const input = `component App() {
	<tsx:react>
		<div className="wrapper">
			<>
				<span>Outer fragment</span>
				<>
					<span>Inner fragment</span>
				</>
			</>
		</div>
	</tsx:react>
}`;

				const expected = `component App() {
  <tsx:react>
    <div className="wrapper">
      <>
        <span>Outer fragment</span>
        <>
          <span>Inner fragment</span>
        </>
      </>
    </div>
  </tsx:react>
}`;

				const result = await format(input, { singleQuote: true });
				expect(result).toBeWithNewline(expected);
			});

			it('should format JSXFragment with text and elements mixed', async () => {
				const input = `component App() {
	<tsx:react>
		<>
			Some text before
			<div>Element in middle</div>
			Some text after
		</>
	</tsx:react>
}`;

				const expected = `component App() {
  <tsx:react>
    <>
      Some text before
      <div>Element in middle</div>
      Some text after
    </>
  </tsx:react>
}`;

				const result = await format(input, { singleQuote: true });
				expect(result).toBeWithNewline(expected);
			});

			it('should format JSXFragment with expressions', async () => {
				const input = `component App() {
	<tsx:react>
		<>
			{value}
			<span>Text</span>
			{otherValue}
		</>
	</tsx:react>
}`;

				const expected = `component App() {
  <tsx:react>
    <>
      {value}
      <span>Text</span>
      {otherValue}
    </>
  </tsx:react>
}`;

				const result = await format(input, { singleQuote: true });
				expect(result).toBeWithNewline(expected);
			});

			it('should preserve @ symbol in JSX attributes inside <tsx:react>', async () => {
				const input = `component App() {
	const count = track(0);

	<div>
		<h1>{'Hello, from Ripple!'}</h1>
		<tsx:react>
			<Counter count={@count} />
		</tsx:react>
	</div>
}`;

				const expected = `component App() {
  const count = track(0);

  <div>
    <h1>{'Hello, from Ripple!'}</h1>
    <tsx:react>
      <Counter count={@count} />
    </tsx:react>
  </div>
}`;

				const result = await format(input, { singleQuote: true });
				expect(result).toBeWithNewline(expected);
			});
		});
	});
});
