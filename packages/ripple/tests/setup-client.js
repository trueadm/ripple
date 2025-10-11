import { beforeEach, afterEach } from 'vitest';
import { mount } from 'ripple';

/**
 * @param {() => void} component 
 */
globalThis.render = function render(component) {
	mount(component, {
		target: /** @type {HTMLDivElement} */ (globalThis.container)
	});
}

beforeEach(() => {
	globalThis.container = /** @type {HTMLDivElement} */ (document.createElement('div'));
	document.body.appendChild(globalThis.container);

	globalThis.error = undefined;
});

afterEach(() => {
	// Container is guaranteed to exist in all tests, so it was easier to type it without undefined.
	// And when we unset it, we just type-cast it to HTMLDivElement to avoid TS errors, because we
	// know it's guaranteed to exist in the next test again.
	document.body.removeChild(/** @type {HTMLDivElement} */ (globalThis.container));
	globalThis.container = /** @type {HTMLDivElement} */ (/** @type {unknown} */(undefined));

	globalThis.error = undefined;
});
