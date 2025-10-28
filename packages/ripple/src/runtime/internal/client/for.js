/** @import { Block, Tracked } from '#client' */

import { IS_CONTROLLED, IS_INDEXED } from '../../../constants.js';
import { branch, destroy_block, destroy_block_children, render } from './blocks.js';
import { FOR_BLOCK, TRACKED_ARRAY } from './constants.js';
import { create_text, next_sibling } from './operations.js';
import { active_block, set, tracked, untrack } from './runtime.js';
import { array_from, is_array } from './utils.js';

/**
 * @template V
 * @param {Node} anchor
 * @param {V} value
 * @param {number} index
 * @param {(anchor: Node, value: V | Tracked, index?: any) => Block} render_fn
 * @param {boolean} is_indexed
 * @param {boolean} is_keyed
 * @returns {Block}
 */
function create_item(anchor, value, index, render_fn, is_indexed, is_keyed) {
	var b = branch(() => {
		var tracked_index;
		/** @type {V | Tracked} */
		var tracked_value = value;

		if (is_indexed || is_keyed) {
			var block = /** @type {Block} */ (active_block);

			if (block.s === null) {
				if (is_indexed) {
					tracked_index = tracked(index, block);
				}
				if (is_keyed) {
					tracked_value = tracked(value, block);
				}

				block.s = {
					start: null,
					end: null,
					i: tracked_index,
					v: tracked_value,
				};
			} else {
				if (is_indexed) {
					tracked_index = block.s.i;
				}
				if (is_keyed) {
					tracked_index = block.s.v;
				}
			}
			render_fn(anchor, tracked_value, tracked_index);
		} else {
			render_fn(anchor, tracked_value);
		}
	});
	return b;
}

/**
 * @param {Block} block
 * @param {Element} anchor
 * @returns {void}
 */
function move(block, anchor) {
	var node = block.s.start;
	var end = block.s.end;

	if (node === end) {
		anchor.before(node);
		return;
	}
	while (node !== null) {
		var next_node = /** @type {Node} */ (next_sibling(node));
		anchor.before(node);
		node = next_node;
		if (node === end) {
			anchor.before(end);
			break;
		}
	}
}

/**
 * @template V
 * @param {V[] | Iterable<V>} collection
 * @returns {V[]}
 */
function collection_to_array(collection) {
	var array = is_array(collection) ? collection : collection == null ? [] : array_from(collection);

	// If we are working with a tracked array, then we need to get a copy of
	// the elements, as the array itself is proxied, and not useful in diffing
	if (TRACKED_ARRAY in array) {
		array = array_from(array);
	}

	return array;
}

/**
 * @template V
 * @param {Element} node
 * @param {() => V[] | Iterable<V>} get_collection
 * @param {(anchor: Node, value: V | Tracked, index?: any) => Block} render_fn
 * @param {number} flags
 * @returns {void}
 */
export function for_block(node, get_collection, render_fn, flags) {
	var is_controlled = (flags & IS_CONTROLLED) !== 0;
	var is_indexed = (flags & IS_INDEXED) !== 0;
	var anchor = /** @type {Element | Text} */ (node);

	if (is_controlled) {
		anchor = node.appendChild(create_text());
	}

	render(
		() => {
			var block = /** @type {Block} */ (active_block);
			var collection = get_collection();
			var array = collection_to_array(collection);

			untrack(() => {
				reconcile_by_ref(anchor, block, array, render_fn, is_controlled, is_indexed);
			});
		},
		null,
		FOR_BLOCK,
	);
}

/**
 * @template V
 * @template K
 * @param {Element} node
 * @param {() => V[] | Iterable<V>} get_collection
 * @param {(anchor: Node, value: V | Tracked, index?: any) => Block} render_fn
 * @param {number} flags
 * @param {(item: V) => K} [get_key]
 * @returns {void}
 */
export function for_block_keyed(node, get_collection, render_fn, flags, get_key) {
	var is_controlled = (flags & IS_CONTROLLED) !== 0;
	var is_indexed = (flags & IS_INDEXED) !== 0;
	var anchor = /** @type {Element | Text} */ (node);

	if (is_controlled) {
		anchor = node.appendChild(create_text());
	}

	render(
		() => {
			var block = /** @type {Block} */ (active_block);
			var collection = get_collection();
			var array = collection_to_array(collection);

			untrack(() => {
				reconcile_by_key(
					anchor,
					block,
					array,
					render_fn,
					is_controlled,
					is_indexed,
					/** @type {(item: V) => K} */ (get_key),
				);
			});
		},
		null,
		FOR_BLOCK,
	);
}

/**
 * @template V
 * @param {Element | Text} anchor
 * @param {Block} block
 * @param {V[]} array
 * @returns {void}
 */
function reconcile_fast_clear(anchor, block, array) {
	var state = block.s;
	var parent_node = /** @type {Element} */ (anchor.parentNode);
	parent_node.textContent = '';
	destroy_block_children(block);
	parent_node.append(anchor);
	state.array = array;
	state.blocks = [];
}

/**
 * @param {Block} block
 * @param {number} index
 * @returns {void}
 */
function update_index(block, index) {
	set(block.s.i, index);
}

/**
 * @param {Block} block
 * @param {any} value
 * @returns {void}
 */
function update_value(block, value) {
	set(block.s.v, value);
}

/**
 * @template V
 * @template K
 * @param {Element | Text} anchor
 * @param {Block} block
 * @param {V[]} b
 * @param {(anchor: Node, value: V | Tracked, index?: any) => Block} render_fn
 * @param {boolean} is_controlled
 * @param {boolean} is_indexed
 * @param {(item: V) => K} get_key
 * @returns {void}
 */
function reconcile_by_key(anchor, block, b, render_fn, is_controlled, is_indexed, get_key) {
	var state = block.s;

	// Variables used in conditional branches - declare with initial values
	/** @type {number} */
	var a_start = 0;
	/** @type {number} */
	var b_start = 0;
	/** @type {number} */
	var a_left = 0;
	/** @type {number} */
	var b_left = 0;
	/** @type {Int32Array} */
	var sources = new Int32Array(0);
	/** @type {boolean} */
	var moved = false;
	/** @type {number} */
	var pos = 0;
	/** @type {number} */
	var patched = 0;
	/** @type {number} */
	var i = 0;

	if (state === null) {
		state = block.s = {
			array: [],
			blocks: [],
			keys: null,
		};
	}

	var a = state.array;
	var a_length = a.length;
	var b_length = b.length;
	var j = 0;

	// Fast-path for clear
	if (is_controlled && b_length === 0) {
		if (a_length > 0) {
			reconcile_fast_clear(anchor, block, b);
		}
		return;
	}
	var b_blocks = Array(b_length);
	var b_keys = b.map(get_key);

	// Fast-path for create
	if (a_length === 0) {
		for (; j < b_length; j++) {
			b_blocks[j] = create_item(anchor, b[j], j, render_fn, is_indexed, true);
		}
		state.array = b;
		state.blocks = b_blocks;
		state.keys = b_keys;
		return;
	}

	var a_blocks = state.blocks;
	var a_keys = state.keys;
	var a_val = a[j];
	var b_val = b[j];
	var a_key = a_keys[j];
	var b_key = b_keys[j];
	var a_end = a_length - 1;
	var b_end = b_length - 1;
	var b_block;

	outer: {
		while (a_key === b_key) {
			a[j] = b_val;
			b_block = b_blocks[j] = a_blocks[j];
			if (is_indexed) {
				update_index(b_block, j);
			}
			update_value(b_block, b_val);
			++j;
			if (j > a_end || j > b_end) {
				break outer;
			}
			a_val = a[j];
			b_val = b[j];
			a_key = a_keys[j];
			b_key = b_keys[j];
		}

		a_val = a[a_end];
		b_val = b[b_end];
		a_key = a_keys[a_end];
		b_key = b_keys[b_end];

		while (a_key === b_key) {
			a[a_end] = b_val;
			b_block = b_blocks[b_end] = a_blocks[a_end];
			if (is_indexed) {
				update_index(b_block, b_end);
			}
			update_value(b_block, b_val);
			a_end--;
			b_end--;
			if (j > a_end || j > b_end) {
				break outer;
			}
			a_val = a[a_end];
			b_val = b[b_end];
			a_key = a_keys[a_end];
			b_key = b_keys[b_end];
		}
	}

	var fast_path_removal = false;

	if (j > a_end) {
		if (j <= b_end) {
			while (j <= b_end) {
				b_val = b[j];
				var target = j >= a_length ? anchor : a_blocks[j].s.start;
				b_blocks[j] = create_item(target, b_val, j, render_fn, is_indexed, true);
				j++;
			}
		}
	} else if (j > b_end) {
		while (j <= a_end) {
			destroy_block(a_blocks[j++]);
		}
	} else {
		a_start = j;
		b_start = j;
		a_left = a_end - j + 1;
		b_left = b_end - j + 1;
		sources = new Int32Array(b_left + 1);
		moved = false;
		pos = 0;
		patched = 0;
		i = 0;

		fast_path_removal = is_controlled && a_left === a_length;

		// When sizes are small, just loop them through
		if (b_length < 4 || (a_left | b_left) < 32) {
			for (i = a_start; i <= a_end; ++i) {
				a_val = a[i];
				a_key = a_keys[i];
				if (patched < b_left) {
					for (j = b_start; j <= b_end; j++) {
						b_val = b[j];
						b_key = b_keys[j];
						if (a_key === b_key) {
							sources[j - b_start] = i + 1;
							if (fast_path_removal) {
								fast_path_removal = false;
								while (a_start < i) {
									destroy_block(a_blocks[a_start++]);
								}
							}
							if (pos > j) {
								moved = true;
							} else {
								pos = j;
							}
							b_block = b_blocks[j] = a_blocks[i];
							if (is_indexed) {
								update_index(b_block, j);
							}
							update_value(b_block, b_val);
							++patched;
							break;
						}
					}
					if (!fast_path_removal && j > b_end) {
						destroy_block(a_blocks[i]);
					}
				} else if (!fast_path_removal) {
					destroy_block(a_blocks[i]);
				}
			}
		} else {
			var map = new Map();

			for (i = b_start; i <= b_end; ++i) {
				map.set(b_keys[i], i);
			}

			for (i = a_start; i <= a_end; ++i) {
				a_val = a[i];
				a_key = a_keys[i];

				if (patched < b_left) {
					j = map.get(a_key);

					if (j !== undefined) {
						if (fast_path_removal) {
							fast_path_removal = false;
							while (i > a_start) {
								destroy_block(a[a_start++]);
							}
						}
						sources[j - b_start] = i + 1;
						if (pos > j) {
							moved = true;
						} else {
							pos = j;
						}
						block = b_blocks[j] = a_blocks[i];
						b_val = b[j];
						if (is_indexed) {
							update_index(block, j);
						}
						update_value(b_block, b_val);
						++patched;
					} else if (!fast_path_removal) {
						destroy_block(a_blocks[i]);
					}
				} else if (!fast_path_removal) {
					destroy_block(a_blocks[i]);
				}
			}
		}
	}

	if (fast_path_removal) {
		reconcile_fast_clear(anchor, block, []);
		reconcile_by_key(anchor, block, b, render_fn, is_controlled, is_indexed, get_key);
		return;
	} else if (moved) {
		var next_pos = 0;
		var seq = lis_algorithm(sources);
		j = seq.length - 1;

		for (i = b_left - 1; i >= 0; i--) {
			if (sources[i] === 0) {
				pos = i + b_start;
				b_val = b[pos];
				next_pos = pos + 1;

				var target = next_pos < b_length ? b_blocks[next_pos].s.start : anchor;
				b_blocks[pos] = create_item(target, b_val, pos, render_fn, is_indexed, true);
			} else if (j < 0 || i !== seq[j]) {
				pos = i + b_start;
				b_val = b[pos];
				next_pos = pos + 1;

				var target = next_pos < b_length ? b_blocks[next_pos].s.start : anchor;
				move(b_blocks[pos], target);
			} else {
				j--;
			}
		}
	} else if (patched !== b_left) {
		for (i = b_left - 1; i >= 0; i--) {
			if (sources[i] === 0) {
				pos = i + b_start;
				b_val = b[pos];
				next_pos = pos + 1;

				var target = next_pos < b_length ? b_blocks[next_pos].s.start : anchor;
				b_blocks[pos] = create_item(target, b_val, pos, render_fn, is_indexed, true);
			}
		}
	}

	state.array = b;
	state.blocks = b_blocks;
	state.keys = b_keys;
}

/**
 * @template V
 * @param {Element | Text} anchor
 * @param {Block} block
 * @param {V[]} b
 * @param {(anchor: Node, value: V | Tracked, index?: any) => Block} render_fn
 * @param {boolean} is_controlled
 * @param {boolean} is_indexed
 * @returns {void}
 */
function reconcile_by_ref(anchor, block, b, render_fn, is_controlled, is_indexed) {
	var state = block.s;

	// Variables used in conditional branches - declare with initial values
	/** @type {number} */
	var a_start = 0;
	/** @type {number} */
	var b_start = 0;
	/** @type {number} */
	var a_left = 0;
	/** @type {number} */
	var b_left = 0;
	/** @type {Int32Array} */
	var sources = new Int32Array(0);
	/** @type {boolean} */
	var moved = false;
	/** @type {number} */
	var pos = 0;
	/** @type {number} */
	var patched = 0;
	/** @type {number} */
	var i = 0;

	if (state === null) {
		state = block.s = {
			array: [],
			blocks: [],
			keys: null,
		};
	}

	var a = state.array;
	var a_length = a.length;
	var b_length = b.length;
	var j = 0;

	// Fast-path for clear
	if (is_controlled && b_length === 0) {
		if (a_length > 0) {
			reconcile_fast_clear(anchor, block, b);
		}
		return;
	}
	var b_blocks = Array(b_length);

	// Fast-path for create
	if (a_length === 0) {
		for (; j < b_length; j++) {
			b_blocks[j] = create_item(anchor, b[j], j, render_fn, is_indexed, false);
		}
		state.array = b;
		state.blocks = b_blocks;
		return;
	}

	var a_blocks = state.blocks;
	var a_val = a[j];
	var b_val = b[j];
	var a_end = a_length - 1;
	var b_end = b_length - 1;
	var b_block;

	outer: {
		while (a_val === b_val) {
			a[j] = b_val;
			b_block = b_blocks[j] = a_blocks[j];
			if (is_indexed) {
				update_index(b_block, j);
			}
			++j;
			if (j > a_end || j > b_end) {
				break outer;
			}
			a_val = a[j];
			b_val = b[j];
		}

		a_val = a[a_end];
		b_val = b[b_end];

		while (a_val === b_val) {
			a[a_end] = b_val;
			b_block = b_blocks[b_end] = a_blocks[a_end];
			if (is_indexed) {
				update_index(b_block, b_end);
			}
			a_end--;
			b_end--;
			if (j > a_end || j > b_end) {
				break outer;
			}
			a_val = a[a_end];
			b_val = b[b_end];
		}
	}

	var fast_path_removal = false;

	if (j > a_end) {
		if (j <= b_end) {
			while (j <= b_end) {
				b_val = b[j];
				var target = j >= a_length ? anchor : a_blocks[j].s.start;
				b_blocks[j] = create_item(target, b_val, j, render_fn, is_indexed, false);
				j++;
			}
		}
	} else if (j > b_end) {
		while (j <= a_end) {
			destroy_block(a_blocks[j++]);
		}
	} else {
		a_start = j;
		b_start = j;
		a_left = a_end - j + 1;
		b_left = b_end - j + 1;
		sources = new Int32Array(b_left + 1);
		moved = false;
		pos = 0;
		patched = 0;
		i = 0;

		fast_path_removal = is_controlled && a_left === a_length;

		// When sizes are small, just loop them through
		if (b_length < 4 || (a_left | b_left) < 32) {
			for (i = a_start; i <= a_end; ++i) {
				a_val = a[i];
				if (patched < b_left) {
					for (j = b_start; j <= b_end; j++) {
						b_val = b[j];
						if (a_val === b_val) {
							sources[j - b_start] = i + 1;
							if (fast_path_removal) {
								fast_path_removal = false;
								while (a_start < i) {
									destroy_block(a_blocks[a_start++]);
								}
							}
							if (pos > j) {
								moved = true;
							} else {
								pos = j;
							}
							b_block = b_blocks[j] = a_blocks[i];
							if (is_indexed) {
								update_index(b_block, j);
							}
							++patched;
							break;
						}
					}
					if (!fast_path_removal && j > b_end) {
						destroy_block(a_blocks[i]);
					}
				} else if (!fast_path_removal) {
					destroy_block(a_blocks[i]);
				}
			}
		} else {
			var map = new Map();

			for (i = b_start; i <= b_end; ++i) {
				map.set(b[i], i);
			}

			for (i = a_start; i <= a_end; ++i) {
				a_val = a[i];

				if (patched < b_left) {
					j = map.get(a_val);

					if (j !== undefined) {
						if (fast_path_removal) {
							fast_path_removal = false;
							while (i > a_start) {
								destroy_block(a[a_start++]);
							}
						}
						sources[j - b_start] = i + 1;
						if (pos > j) {
							moved = true;
						} else {
							pos = j;
						}
						block = b_blocks[j] = a_blocks[i];
						if (is_indexed) {
							update_index(block, j);
						}
						++patched;
					} else if (!fast_path_removal) {
						destroy_block(a_blocks[i]);
					}
				} else if (!fast_path_removal) {
					destroy_block(a_blocks[i]);
				}
			}
		}
	}

	if (fast_path_removal) {
		reconcile_fast_clear(anchor, block, []);
		reconcile_by_ref(anchor, block, b, render_fn, is_controlled, is_indexed);
		return;
	} else if (moved) {
		var next_pos = 0;
		var seq = lis_algorithm(sources);
		j = seq.length - 1;

		for (i = b_left - 1; i >= 0; i--) {
			if (sources[i] === 0) {
				pos = i + b_start;
				b_val = b[pos];
				next_pos = pos + 1;

				var target = next_pos < b_length ? b_blocks[next_pos].s.start : anchor;
				b_blocks[pos] = create_item(target, b_val, pos, render_fn, is_indexed, false);
			} else if (j < 0 || i !== seq[j]) {
				pos = i + b_start;
				b_val = b[pos];
				next_pos = pos + 1;

				var target = next_pos < b_length ? b_blocks[next_pos].s.start : anchor;
				move(b_blocks[pos], target);
			} else {
				j--;
			}
		}
	} else if (patched !== b_left) {
		for (i = b_left - 1; i >= 0; i--) {
			if (sources[i] === 0) {
				pos = i + b_start;
				b_val = b[pos];
				next_pos = pos + 1;

				var target = next_pos < b_length ? b_blocks[next_pos].s.start : anchor;
				b_blocks[pos] = create_item(target, b_val, pos, render_fn, is_indexed, false);
			}
		}
	}

	state.array = b;
	state.blocks = b_blocks;
}

/** @type {Int32Array} */
let result;
/** @type {Int32Array} */
let p;
let max_len = 0;
// https://en.wikipedia.org/wiki/Longest_increasing_subsequence
/**
 * @param {Int32Array} arr
 * @returns {Int32Array}
 */
function lis_algorithm(arr) {
	let arrI = 0;
	let i = 0;
	let j = 0;
	let k = 0;
	let u = 0;
	let v = 0;
	let c = 0;
	var len = arr.length;

	if (len > max_len) {
		max_len = len;
		result = new Int32Array(len);
		p = new Int32Array(len);
	}

	for (; i < len; ++i) {
		arrI = arr[i];

		if (arrI !== 0) {
			j = result[k];
			if (arr[j] < arrI) {
				p[i] = j;
				result[++k] = i;
				continue;
			}

			u = 0;
			v = k;

			while (u < v) {
				c = (u + v) >> 1;
				if (arr[result[c]] < arrI) {
					u = c + 1;
				} else {
					v = c;
				}
			}

			if (arrI < arr[result[u]]) {
				if (u > 0) {
					p[i] = result[u - 1];
				}
				result[u] = i;
			}
		}
	}

	u = k + 1;
	var seq = new Int32Array(u);
	v = result[u - 1];

	while (u-- > 0) {
		seq[u] = v;
		v = p[v];
		result[u] = 0;
	}

	return seq;
}
