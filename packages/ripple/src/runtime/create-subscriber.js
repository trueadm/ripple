/** @import { createSubscriber } from '#public' */
import { untrack, queue_microtask } from './internal/client/runtime.js';
import { effect } from './internal/client/blocks.js'

/** @type {createSubscriber} */
export function createSubscriber(start) {
	let subscribers = 0;
	/** @type {(() => void) | void} */
	let stop;

	return () => {
		effect(() => {
			if (subscribers === 0) {
				stop = untrack(start);
			}

			subscribers += 1;

			return () => {
				queue_microtask(() => {
					// Only count down after a microtask, else we would reach 0 before our own render effect reruns,
					// but reach 1 again when the tick callback of the prior teardown runs. That would mean we
					// re-subcribe unnecessarily and create a memory leak because the old subscription is never cleaned up.
					subscribers -= 1;

					if (subscribers === 0) {
						stop?.();
						stop = undefined;
					}
				});
			};
		});
	};
}
