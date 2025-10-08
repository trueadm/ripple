import type { Tracked } from "ripple";

/**
 * @param {Tracked<V>} tracked
 * @returns {(node: HTMLInputElement) => void}
 */
export declare function value<V>(tracked: Tracked<V>): (node: HTMLInputElement) => void;

/**
 * @param {Tracked<V>} tracked
 * @returns {(node: HTMLInputElement) => void}
 */
export declare function checked<V>(tracked: Tracked<V>): (node: HTMLInputElement) => void;