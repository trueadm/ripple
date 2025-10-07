import noModuleScopeTrack from './rules/no-module-scope-track.js';
import requireComponentExport from './rules/require-component-export.js';
import preferOnInput from './rules/prefer-oninput.js';
import noReturnInComponent from './rules/no-return-in-component.js';
import unboxTrackedValues from './rules/unbox-tracked-values.js';

const plugin = {
  meta: {
    name: 'eslint-plugin-ripple',
    version: '0.1.0',
  },
  rules: {
    'no-module-scope-track': noModuleScopeTrack,
    'require-component-export': requireComponentExport,
    'prefer-oninput': preferOnInput,
    'no-return-in-component': noReturnInComponent,
    'unbox-tracked-values': unboxTrackedValues,
  },
  configs: {
    recommended: {
      plugins: ['ripple'],
      rules: {
        'ripple/no-module-scope-track': 'error',
        'ripple/require-component-export': 'warn',
        'ripple/prefer-oninput': 'warn',
        'ripple/no-return-in-component': 'error',
        'ripple/unbox-tracked-values': 'error',
      },
    },
    strict: {
      plugins: ['ripple'],
      rules: {
        'ripple/no-module-scope-track': 'error',
        'ripple/require-component-export': 'error',
        'ripple/prefer-oninput': 'error',
        'ripple/no-return-in-component': 'error',
        'ripple/unbox-tracked-values': 'error',
      },
    },
  },
};

export default plugin;
