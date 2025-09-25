import { DERIVED, UNINITIALIZED } from "../client/constants";
import { is_tracked_object } from "../client/utils";

export { escape } from '../../../utils/escaping.js';

class Output {
	head = '';
	body = '';
	#parent = null;

	constructor(parent) {
		this.#parent = parent;
	}

  component() {
    return new Output(this);
  }

	push(str) {
		this.body += str;
	}
}

export async function renderToString(component) {
	const output = new Output(null);

	// TODO add expando "async" property to component functions during SSR
	if (component.async) {
		await component(output, {});
	} else {
		component(output, {});
	}

	const { head, body } = output;

	return { head, body };
}

export function push_component() {
	// TODO
}

export function pop_component() {
	// TODO
}

export async function async(fn) {
	// TODO
}

function get_derived(tracked) {
  let v = tracked.v;

  if (v === UNINITIALIZED) {
    v = tracked.fn();
    tracked.v = v;
  }
  return v;
}

export function get(tracked) {
  // reflect back the value if it's not boxed
  if (!is_tracked_object(tracked)) {
    return tracked;
  }

  return (tracked.f & DERIVED) !== 0
    ? get_derived(/** @type {Derived} */ (tracked))
    : tracked.v;
}
