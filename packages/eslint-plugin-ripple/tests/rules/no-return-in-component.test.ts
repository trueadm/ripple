import { describe, it } from 'vitest';
import { RuleTester } from 'eslint';
import rule from '../../src/rules/no-return-in-component.js';

const ruleTester = new RuleTester({
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
});

describe('no-return-in-component', () => {
  it('should validate correctly', () => {
    ruleTester.run('no-return-in-component', rule, {
      valid: [
        // Valid: JSX as statement
        {
          code: `
            component App() {
              <div>Hello</div>
            }
          `,
        },
        // Valid: return non-JSX
        {
          code: `
            component App() {
              function helper() {
                return 42;
              }
            }
          `,
        },
        // Valid: early return without JSX
        {
          code: `
            component App() {
              if (condition) return;
              <div>Hello</div>
            }
          `,
        },
      ],
      invalid: [
        // Invalid: returning JSX element
        {
          code: `
            component App() {
              return <div>Hello</div>;
            }
          `,
          errors: [
            {
              messageId: 'noReturn',
            },
          ],
        },
        // Invalid: returning JSX fragment
        {
          code: `
            component App() {
              return <>Hello</>;
            }
          `,
          errors: [
            {
              messageId: 'noReturn',
            },
          ],
        },
      ],
    });
  });
});
