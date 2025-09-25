import { DERIVED, TRACKED, UNINITIALIZED } from './internal/client/constants';
import { is_tracked_object } from './internal/client/utils';

export { create_context as createContext } from './internal/server/context.js';

export function effect() {
	// NO-OP
}

export const TrackedArray = Array;

export function track(v, o) {
	var is_tracked = is_tracked_object(v);

	if (is_tracked) {
		return v;
	}

	if (typeof v === 'function') {
		return {
			f: TRACKED | DERIVED,
			fn: v,
			v: UNINITIALIZED,
		};
	}

	return {
		f: TRACKED,
		v,
	};
}

