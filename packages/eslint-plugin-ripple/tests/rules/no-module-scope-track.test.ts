import { describe, it } from 'vitest';
import { RuleTester } from 'eslint';
import rule from '../../src/rules/no-module-scope-track.js';

const ruleTester = new RuleTester({
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
});

describe('no-module-scope-track', () => {
  it('should validate correctly', () => {
    ruleTester.run('no-module-scope-track', rule, {
      valid: [
        // Valid: track() inside component
        {
          code: `
            component App() {
              let count = track(0);
            }
          `,
        },
        // Valid: track() inside function
        {
          code: `
            function createCounter() {
              return track(0);
            }
          `,
        },
        // Valid: track() inside arrow function
        {
          code: `
            const createState = () => {
              return track({ count: 0 });
            };
          `,
        },
      ],
      invalid: [
        // Invalid: track() at module scope
        {
          code: `
            let count = track(0);
          `,
          errors: [
            {
              messageId: 'moduleScope',
            },
          ],
        },
        // Invalid: track() at module scope even with import
        {
          code: `
            import { track } from 'ripple';
            let globalCount = track(0);
          `,
          errors: [
            {
              messageId: 'moduleScope',
            },
          ],
        },
      ],
    });
  });
});
