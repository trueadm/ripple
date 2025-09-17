import { TRACKED_OBJECT } from './constants';
import { old_get_property } from './runtime';

const array_proto = Array.prototype;

/**
 * @template T
 * @param {Array<T>} array
 * @param {(previousValue: T, currentValue: T, currentIndex: number, array: Array<T>) => T} callback
 * @param {T} initial_value
 * @returns {T}
 */
export function array_reduce(array, callback, initial_value) {
	// @ts-expect-error
	var tracked_properties = array[TRACKED_OBJECT];

	if (tracked_properties === undefined || array.reduce !== array_proto.reduce) {
		return array.reduce(callback, initial_value);
	}

	let accumulator = initial_value;

	for (let i = 0; i < array.length; i++) {
		accumulator = callback(accumulator, old_get_property(array, i), i, array);
	}

	return accumulator;
}

/**
 * @template T
 * @param {Array<T>} array
 * @param {string} [separator]
 * @returns {string}
 */
export function array_join(array, separator) {
	// @ts-expect-error
	var tracked_properties = array[TRACKED_OBJECT];
	if (tracked_properties === undefined || array.join !== array_proto.join) {
		return array.join(separator);
	}

	let result = '';
	for (let i = 0; i < array.length; i++) {
		if (i > 0 && separator !== undefined) {
			result += separator;
		}
		result += String(old_get_property(array, i));
	}

	return result;
}

/**
 * @template T
 * @template U
 * @param {Array<T>} array
 * @param {(value: T, index: number, array: Array<T>) => U} callback
 * @returns {Array<U>}
 */
export function array_map(array, callback) {
	// @ts-expect-error
	var tracked_properties = array[TRACKED_OBJECT];
	if (tracked_properties === undefined || array.map !== array_proto.map) {
		return array.map(callback);
	}

	const result = [];
	for (let i = 0; i < array.length; i++) {
		if (i in array) {
			result[i] = callback(old_get_property(array, i), i, array);
		}
	}

	return result;
}

/**
 * @template T
 * @param {Array<T>} array
 * @param {(value: T, index: number, array: Array<T>) => boolean} callback
 * @returns {Array<T>}
 */
export function array_filter(array, callback) {
	// @ts-expect-error
	var tracked_properties = array[TRACKED_OBJECT];
	if (tracked_properties === undefined || array.filter !== array_proto.filter) {
		return array.filter(callback);
	}

	const result = [];
	for (let i = 0; i < array.length; i++) {
		if (i in array) {
			const value = old_get_property(array, i);
			if (callback(value, i, array)) {
				result.push(value);
			}
		}
	}

	return result;
}

/**
 * @template T
 * @param {Array<T>} array
 * @param {(value: T, index: number, array: Array<T>) => boolean} callback
 * @returns {void}
 */
export function array_forEach(array, callback) {
	// @ts-expect-error
	var tracked_properties = array[TRACKED_OBJECT];
	if (tracked_properties === undefined || array.forEach !== array_proto.forEach) {
		return array.forEach(callback);
	}

	for (let i = 0; i < array.length; i++) {
		if (i in array) {
			callback(old_get_property(array, i), i, array);
		}
	}
}

/**
 * @template T
 * @param {Array<T>} array
 * @param {T} value
 * @returns {boolean}
 */
export function array_includes(array, value) {
	// @ts-expect-error
	var tracked_properties = array[TRACKED_OBJECT];
	if (tracked_properties === undefined || array.includes !== array_proto.includes) {
		return array.includes(value);
	}

	for (let i = 0; i < array.length; i++) {
		if (i in array && old_get_property(array, i) === value) {
			return true;
		}
	}

	return false;
}

/**
 * @template T
 * @param {Array<T>} array
 * @param {T} value
 * @returns {number}
 */
export function array_indexOf(array, value) {
	// @ts-expect-error
	var tracked_properties = array[TRACKED_OBJECT];
	if (tracked_properties === undefined || array.indexOf !== array_proto.indexOf) {
		return array.indexOf(value);
	}

	for (let i = 0; i < array.length; i++) {
		if (i in array && old_get_property(array, i) === value) {
			return i;
		}
	}

	return -1;
}

/**
 * @template T
 * @param {Array<T>} array
 * @param {T} value
 * @returns {number}
 */
export function array_lastIndexOf(array, value) {
	// @ts-expect-error
	var tracked_properties = array[TRACKED_OBJECT];
	if (tracked_properties === undefined || array.lastIndexOf !== array_proto.lastIndexOf) {
		return array.lastIndexOf(value);
	}

	for (let i = array.length - 1; i >= 0; i--) {
		if (i in array && old_get_property(array, i) === value) {
			return i;
		}
	}

	return -1;
}

/**
 * @template T
 * @param {Array<T>} array
 * @param {(value: T, index: number, array: Array<T>) => boolean} callback
 * @returns {boolean}
 */
export function array_every(array, callback) {
  // @ts-expect-error
  var tracked_properties = array[TRACKED_OBJECT];
  if (tracked_properties === undefined || array.every !== array_proto.every) {
    return array.every(callback);
  }

  for (let i = 0; i < array.length; i++) {
    if (i in array && !callback(old_get_property(array, i), i, array)) {
      return false;
    }
  }

  return true;
}

/**
 * @template T
 * @param {Array<T>} array
 * @param {(value: T, index: number, array: Array<T>) => boolean} callback
 * @returns {boolean}
 */
export function array_some(array, callback) {
  // @ts-expect-error
  var tracked_properties = array[TRACKED_OBJECT];
  if (tracked_properties === undefined || array.some !== array_proto.some) {
    return array.some(callback);
  }

  for (let i = 0; i < array.length; i++) {
    if (i in array && callback(old_get_property(array, i), i, array)) {
      return true;
    }
  }

  return false;
}

/**
 * @template T
 * @param {Array<T>} array
 * @returns {string}
 */
export function array_toString(array) {
  // @ts-expect-error
  var tracked_properties = array[TRACKED_OBJECT];
  if (tracked_properties === undefined || array.toString !== array_proto.toString) {
    return array.toString();
  }

  let result = '';
  for (let i = 0; i < array.length; i++) {
    if (i > 0) {
      result += ',';
    }
    if (i in array) {
      result += String(old_get_property(array, i));
    }
  }

  return result;
}

/**
 * @template T
 * @param {Array<T>} array
 * @param {((a: T, b: T) => number) | undefined} compare_fn
 * @returns {Array<T>}
 */
export function array_toSorted(array, compare_fn) {
  // @ts-expect-error
  var tracked_properties = array[TRACKED_OBJECT];
  if (tracked_properties === undefined || array.toSorted !== array_proto.toSorted) {
    return array.toSorted(compare_fn);
  }

  const result = [];
  for (let i = 0; i < array.length; i++) {
    if (i in array) {
      result.push(old_get_property(array, i));
    }
  }

  return result.sort(compare_fn);
}

/**
 * @template T
 * @param {Array<T>} array
 * @param {number} start
 * @param {number} delete_count
 * @param {...T} items
 * @returns {Array<T>}
 */
export function array_toSpliced(array, start, delete_count, ...items) {
  // @ts-expect-error
  var tracked_properties = array[TRACKED_OBJECT];
  if (tracked_properties === undefined || array.toSpliced !== array_proto.toSpliced) {
    return array.toSpliced(start, delete_count, ...items);
  }

  const result = [];
  for (let i = 0; i < array.length; i++) {
    if (i in array) {
      result.push(old_get_property(array, i));
    }
  }

  result.splice(start, delete_count, ...items);

  return result;
}

/**
 * @template T
 * @param {Array<T>} array
 * @returns {IterableIterator<T>}
 */
export function array_values(array) {
  // @ts-expect-error
  var tracked_properties = array[TRACKED_OBJECT];
  if (tracked_properties === undefined || array.values !== array_proto.values) {
    return array.values();
  }

  const result = [];
  for (let i = 0; i < array.length; i++) {
    if (i in array) {
      result.push(old_get_property(array, i));
    }
  }

  return result[Symbol.iterator]();
}

/**
 * @template T
 * @param {Array<T>} array
 * @returns {IterableIterator<[number, T]>}
 */
export function array_entries(array) {
	// @ts-expect-error
	var tracked_properties = array[TRACKED_OBJECT];
	if (tracked_properties === undefined || array.entries !== array_proto.entries) {
		return array.entries();
	}

	/** @type {Array<[number, T]>} */
	const result = [];
	for (let i = 0; i < array.length; i++) {
		if (i in array) {
			result.push([i, old_get_property(array, i)]);
		}
	}

	return result[Symbol.iterator]();
}
