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

export type Tracked<V> = { '#v': V };

export type Props<K extends PropertyKey = any, V = unknown> = Record<K, V>;
export type PropsWithExtras<T extends object> = Props & T & Record<string, unknown>;
export type PropsWithChildren<T extends object = {}> =
  Expand<Omit<Props, 'children'> & { children: Component } & T>;

type UnwrapTracked<T> = [T] extends [Tracked<infer V>] ? T : Tracked<T>;

// force ts to evaluate and expand a type fully
type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;

type PickKeys<T, K extends readonly (keyof T)[]> =
  { [I in keyof K]: UnwrapTracked<T[K[I] & keyof T]> };

type RestKeys<T, K extends readonly (keyof T)[]> = Expand<Omit<T, K[number]>>;

type SplitResult<T extends Props, K extends readonly (keyof T)[]> =
  [...PickKeys<T, K>, UnwrapTracked<RestKeys<T, K>>];

type TrackOptions = { split?: readonly (string | number | symbol)[] };

export declare function track<V>(value?: V | (() => V)): Tracked<V>;

export declare function track<V extends Props, const K extends readonly (keyof V)[]>(
  value: V,
  options: TrackOptions
): SplitResult<V, K>;

export function on<Type extends keyof WindowEventMap>(
	window: Window,
	type: Type,
	handler: (this: Window, event: WindowEventMap[Type]) => any,
	options?: AddEventListenerOptions | undefined
): () => void;

export function on<Type extends keyof DocumentEventMap>(
	document: Document,
	type: Type,
	handler: (this: Document, event: DocumentEventMap[Type]) => any,
	options?: AddEventListenerOptions | undefined
): () => void;

export function on<Element extends HTMLElement, Type extends keyof HTMLElementEventMap>(
	element: Element,
	type: Type,
	handler: (this: Element, event: HTMLElementEventMap[Type]) => any,
	options?: AddEventListenerOptions | undefined
): () => void;

export function on<Element extends MediaQueryList, Type extends keyof MediaQueryListEventMap>(
	element: Element,
	type: Type,
	handler: (this: Element, event: MediaQueryListEventMap[Type]) => any,
	options?: AddEventListenerOptions | undefined
): () => void;

export function on(
	element: EventTarget,
	type: string,
	handler: EventListener,
	options?: AddEventListenerOptions | undefined
): () => void;
