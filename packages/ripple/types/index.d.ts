export type Component<T = Record<string, any>> = (props: T) => void;

export declare function mount(
	component: () => void,
	options: { target: HTMLElement; props?: Record<string, any> },
): () => void;

export declare function untrack<T>(fn: () => T): T;

export declare function flushSync<T>(fn: () => T): T;

export declare function effect(fn: (() => void) | (() => () => void)): void;

export interface TrackedArrayConstructor {
  new <T>(...elements: T[]): TrackedArray<T>;   // must be used with `new`
  from<T>(arrayLike: ArrayLike<T>): TrackedArray<T>;
  of<T>(...items: T[]): TrackedArray<T>;
  fromAsync<T>(iterable: AsyncIterable<T>): Promise<TrackedArray<T>>;
}

export interface TrackedArray<T> extends Array<T> {}

export declare const TrackedArray: TrackedArrayConstructor;

export type Context<T> = {
	get(): T;
	set(value: T): void;
};

export declare function createContext<T>(initialValue: T): Context<T>;

export class TrackedSet<T> extends Set<T> {
	isDisjointFrom(other: TrackedSet<T> | Set<T>): boolean;
	isSubsetOf(other: TrackedSet<T> | Set<T>): boolean;
	isSupersetOf(other: TrackedSet<T> | Set<T>): boolean;
	difference(other: TrackedSet<T> | Set<T>): TrackedSet<T>;
	intersection(other: TrackedSet<T> | Set<T>): TrackedSet<T>;
	symmetricDifference(other: TrackedSet<T> | Set<T>): TrackedSet<T>;
	union(other: TrackedSet<T> | Set<T>): TrackedSet<T>;
	toJSON(): T[];
}

export class TrackedMap<K, V> extends Map<K, V> {
	toJSON(): [K, V][];
}

// Compiler-injected runtime symbols (for Ripple component development)
declare global {
	/**
	 * Runtime block context injected by the Ripple compiler.
	 * This is automatically available in component scopes and passed to runtime functions.
	 */
	var __block: any;

	/**
	 * Ripple runtime namespace - injected by the compiler
	 * These functions are available in compiled Ripple components for TypeScript analysis
	 */
	var $: {
		tracked<T>(value: T, block?: any): T;
		computed<T>(fn: () => T, block?: any): T;
		scope(): any;
		get_tracked(node: any): any;
		get_derived(node: any): any;
		set(node: any, value: any, block?: any): any;
		// Add other runtime functions as needed for TypeScript analysis
	};
}

export declare function createRefKey(): symbol;

type Tracked<V> = { '#v': V };

export declare function track<V>(value?: V | (() => V)): Tracked<V>;
