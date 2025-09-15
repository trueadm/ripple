import path from 'path';
import { createFilter } from '@rollup/pluginutils';
import { compile } from 'ripple/compiler';

const PREFIX = '[rollup-plugin-ripple]';

/**
 * @param [options] {Partial<import('.').Options>}
 * @returns {import('rollup').Plugin}
 */
export default function (options = {}) {
	const { compilerOptions = {}, ...rest } = options;
	const extensions = ['.ripple'];
	const filter = createFilter(rest.include, rest.exclude);

	// [filename]:[chunk]
	const cache_emit = new Map();
	const { emitCss = true } = rest;

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
			}
			return js;
		},
	};
}
