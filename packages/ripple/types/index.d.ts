export type Component<T = Record<string, any>> = (props: T) => void;

export declare function mount(
	component: () => void,
	options: { target: HTMLElement; props?: Record<string, any> },
): () => void;

export declare function untrack<T>(fn: () => T): T;

export declare function flushSync<T>(fn: () => T): T;

export declare function effect(fn: (() => void) | (() => () => void)): void;

export declare class RippleArray<T> extends Array<T> {
	static from<T>(arrayLike: ArrayLike<T>): RippleArray<T>;
	static from<T, U>(
		arrayLike: ArrayLike<T>,
		mapFn: (v: T, k: number) => U,
		thisArg?: any
	): RippleArray<U>;
	static from<T>(iterable: Iterable<T>): RippleArray<T>;
	static from<T, U>(
		iterable: Iterable<T>,
		mapFn: (v: T, k: number) => U,
		thisArg?: any
	): RippleArray<U>;

	static of<T>(...items: T[]): RippleArray<T>;

	$length: number;

	toJSON(): T[];
}

export type Context<T> = {
	get(): T;
	set(value: T): void;
};

export declare function createContext<T>(initialValue: T): Context<T>;

export class RippleSet<T> extends Set<T> {
  readonly $size: number;
  isDisjointFrom(other: RippleSet<T> | Set<T>): boolean;
  isSubsetOf(other: RippleSet<T> | Set<T>): boolean;
  isSupersetOf(other: RippleSet<T> | Set<T>): boolean;
  difference(other: RippleSet<T> | Set<T>): RippleSet<T>;
  intersection(other: RippleSet<T> | Set<T>): RippleSet<T>;
  symmetricDifference(other: RippleSet<T> | Set<T>): RippleSet<T>;
  union(other: RippleSet<T> | Set<T>): RippleSet<T>;
  toJSON(): T[];
}

export class RippleMap<K, V> extends Map<K, V> {
    get $size(): number;
    toJSON(): [K, V][];
}
