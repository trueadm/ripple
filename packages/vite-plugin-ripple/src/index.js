import { compile } from 'ripple/compiler';
import fs from 'node:fs';

const VITE_FS_PREFIX = '/@fs/';
const IS_WINDOWS = process.platform === 'win32';

function existsInRoot(filename, root) {
  if (filename.startsWith(VITE_FS_PREFIX)) {
    return false; // vite already tagged it as out of root
  }
  return fs.existsSync(root + filename);
}

function createVirtualImportId(filename, root, type) {
  const parts = ['ripple', `type=${type}`];
  if (type === 'style') {
    parts.push('lang.css');
  }
  if (existsInRoot(filename, root)) {
    filename = root + filename;
  } else if (filename.startsWith(VITE_FS_PREFIX)) {
    filename = IS_WINDOWS
      ? filename.slice(VITE_FS_PREFIX.length) // remove /@fs/ from /@fs/C:/...
      : filename.slice(VITE_FS_PREFIX.length - 1); // remove /@fs from /@fs/home/user
  }
  // return same virtual id format as vite-plugin-vue eg ...App.ripple?ripple&type=style&lang.css
  return `${filename}?${parts.join('&')}`;
}

export function ripple(inlineOptions) {
  const api = {};

  let root;

  const cssCache = new Map();

  const plugins = [
    {
      name: 'vite-plugin-ripple',
      // make sure our resolver runs before vite internal resolver to resolve ripple field correctly
      enforce: 'pre',
      api,

      async configResolved(config) {
        root = config.root;
      },

      async load(id, opts) {
        if (cssCache.has(id)) {
          return cssCache.get(id);
        }
      },

      transform: {
        filter: { id: /\.ripple$/ },

        async handler(code, id, opts) {
          const filename = id.replace(root, '');
          const ssr = this.environment.config.consumer === 'server';

          const { js, css } = await compile(code, filename, {
            mode: ssr ? 'server' : 'client',
          });



          if (css !== '') {
            const cssId = createVirtualImportId(filename, root, 'style');
            cssCache.set(cssId, css);
            js.code += `\nimport ${JSON.stringify(cssId)};\n`;
          }

          return js;
        },
      },
    },
  ];

  return plugins;
}
