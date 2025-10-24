/** @import { Block, Derived } from '#client' */
import { safe_scope, tracked, get, derived, set } from './internal/client/runtime.js';

var init = false;

export class TrackedDate extends Date {
	#time;
	/** @type {Map<keyof Date, Derived>} */
	#deriveds = new Map();
	/** @type {Block} */
	#block;

	/** @param {any[]} params */
	constructor(...params) {
		// @ts-ignore
		super(...params);

		var block = this.#block = safe_scope();
		this.#time = tracked(super.getTime(), block);

		if (!init) this.#init();
	}

	#init() {
		init = true;

		var proto = TrackedDate.prototype;
		var date_proto = Date.prototype;

		var methods = /** @type {Array<keyof Date & string>} */ (
			Object.getOwnPropertyNames(date_proto)
		);

		for (const method of methods) {
			if (method.startsWith('get') || method.startsWith('to') || method === 'valueOf') {
				// @ts-ignore
				proto[method] = function (...args) {
					// don't memoize if there are arguments
					// @ts-ignore
					if (args.length > 0) {
						get(this.#time);
						// @ts-ignore
						return date_proto[method].apply(this, args);
					}

					var d = this.#deriveds.get(method);

					if (d === undefined) {
						d = derived(() => {
							get(this.#time);
							// @ts-ignore
							return date_proto[method].apply(this, args);
						}, this.#block);

						this.#deriveds.set(method, d);
					}

					return get(d);
				};
			}

			if (method.startsWith('set')) {
				// @ts-ignore
				proto[method] = function (...args) {
					// @ts-ignore
					var result = date_proto[method].apply(this, args);
					set(this.#time, date_proto.getTime.call(this));
					return result;
				};
			}
		}
	}
}
