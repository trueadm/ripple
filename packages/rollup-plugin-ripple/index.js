const path = require('path');
const fs = require('fs');
const { resolve } = require('resolve.exports');
const { createFilter } = require('@rollup/pluginutils');
const { compile } = require('ripple/compiler');

const PREFIX = '[rollup-plugin-ripple]';

const plugin_options = new Set([
	'emitCss',
	'exclude',
	'extensions',
	'include',
	'onwarn',
	'preprocess',
]);

/**
 * @param [options] {Partial<import('.').Options>}
 * @returns {import('rollup').Plugin}
 */
module.exports = function (options = {}) {
	const { compilerOptions = {}, ...rest } = options;
	const extensions = ['.ripple'];
	const filter = createFilter(rest.include, rest.exclude);

	// [filename]:[chunk]
	const cache_emit = new Map();
	const { onwarn, emitCss = true } = rest;

	if (emitCss) {
		const cssOptionValue = 'external';
		if (compilerOptions.css) {
			console.warn(
				`${PREFIX} Forcing \`"compilerOptions.css": ${
					typeof cssOptionValue === 'string' ? `"${cssOptionValue}"` : cssOptionValue
				}\` because "emitCss" was truthy.`,
			);
		}
		compilerOptions.css = cssOptionValue;
	} else {
		compilerOptions.css = 'injected';
	}

	return {
		name: 'ripple',

		/**
		 * Returns CSS contents for a file, if ours
		 */
		load(id) {
			return cache_emit.get(id) || null;
		},

		/**
		 * Transforms a `.ripple` file into a `.js` file.
		 * NOTE: If `emitCss`, append static `import` to virtual CSS file.
		 */
		async transform(code, id) {
			if (!filter(id) || !id.endsWith('.ripple')) return null;

			const extension = path.extname(id);
			if (!~extensions.indexOf(extension)) return null;

			const filename = path.relative(process.cwd(), id);

			const { js, css } = await compile(code, filename, id);

			if (emitCss && css && css.code) {
				const fname = id.replace(new RegExp(`\\${extension}$`), '.css');
				js.code += `\nimport ${JSON.stringify(fname)};\n`;
				cache_emit.set(fname, css);
			}
			return js;
		},
	};
};
