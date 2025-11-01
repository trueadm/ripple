#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

/**
 * @param {Document} doc
 * @param {number} depth
 * @return {Text}
 */
function indentText(doc, depth) {
	return doc.createTextNode(`\n${'  '.repeat(depth)}`);
}

/**
 * @param {Document} doc
 * @param {any} value
 * @param {number} depth
 * @return {Element}
 */
function createValueNode(doc, value, depth) {
  if (Array.isArray(value)) {
    const array = doc.createElement('array');
    if (value.length > 0) {
      for (const item of value) {
        array.appendChild(indentText(doc, depth + 1));
        array.appendChild(createValueNode(doc, item, depth + 1));
      }
      array.appendChild(indentText(doc, depth));
    }
    return array;
  }

  if (value && typeof value === 'object') {
    const dict = doc.createElement('dict');
    const entries = Object.entries(value);
    if (entries.length > 0) {
      for (const [key, val] of entries) {
        dict.appendChild(indentText(doc, depth + 1));
        const keyNode = doc.createElement('key');
        keyNode.appendChild(doc.createTextNode(key));
        dict.appendChild(keyNode);
        dict.appendChild(indentText(doc, depth + 1));
        dict.appendChild(createValueNode(doc, val, depth + 1));
      }
      dict.appendChild(indentText(doc, depth));
    }
    return dict;
  }

  if (typeof value === 'string') {
    const stringNode = doc.createElement('string');
    stringNode.appendChild(doc.createTextNode(value));
    return stringNode;
  }

  if (typeof value === 'number') {
    const tag = Number.isInteger(value) ? 'integer' : 'real';
    const numberNode = doc.createElement(tag);
    numberNode.appendChild(doc.createTextNode(value.toString()));
    return numberNode;
  }

  if (typeof value === 'boolean') {
    return doc.createElement(value ? 'true' : 'false');
  }

  throw new TypeError(`Unsupported value type: ${value}`);
};

/**
 * @param {string[]} targets
 * @param {string} contents
 * @returns {Promise<void[]>}
 */
function writeTargets(targets, contents) {
  return Promise.all(
    targets.map(async (target) => {
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, contents, 'utf8');
      console.log(`Wrote ${path.relative(rootDir, target)}`);
    }),
  );
};

const __filename = fileURLToPath(import.meta.url);
const rootDir = path.dirname(__filename);

const sourceFile = path.join(rootDir, 'packages/ripple-vscode-plugin/syntaxes/ripple.tmLanguage.json');

const targetFiles = [
  path.join(rootDir, 'assets/Ripple.tmbundle/Syntaxes/Ripple.tmLanguage'),
  path.join(rootDir, 'packages/ripple-sublime-text-plugin/src/Ripple.tmLanguage'),
];

const main = async () => {
  const raw = await readFile(sourceFile, 'utf8');
  const grammar = JSON.parse(/** @type {string} */ (raw));
  if (!Array.isArray(grammar.fileTypes)) {
    grammar.fileTypes = ['ripple'];
  }

  const dom = new JSDOM('<plist/>', { contentType: 'text/xml' });
  const doc = dom.window.document;
  const root = doc.documentElement;
  root.setAttribute('version', '1.0');

  while (root.firstChild) {
    root.removeChild(root.firstChild);
  }

  root.appendChild(indentText(doc, 1));
  root.appendChild(createValueNode(doc, grammar, 1));
  root.appendChild(indentText(doc, 0));

  const serializer = new dom.window.XMLSerializer();
  const plist = serializer.serializeToString(root);
	const xml = `
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
${plist}
`.trim();

  await writeTargets(targetFiles, xml);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
