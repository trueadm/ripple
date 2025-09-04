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

    it('should format whitespace correctly', async () => {
      const input = `export component Test(){
        let count=0


        <div>{"Hello"}</div>
        <div>
          let two=2
          
          {"Hello"}
        </div>
    }`;
      const expected = `export component Test() {
  let count = 0;

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
      const already_formatted = `export default component App() {
  let $node;

  const ref = node => {
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

  <div {@use ref}>{'Hello world'}</div>

  <style>
    div {
      color: blue;
    }
  </style>
}

export default component App() {
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
  });
});
