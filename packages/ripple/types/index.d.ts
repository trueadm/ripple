export type Component<T = Record<string, any>> = (props: T) => void;

export declare function mount(
	component: () => void,
	options: { target: HTMLElement; props?: Record<string, any> },
): () => void;

export declare function tick(): Promise<void>;

export declare function untrack<T>(fn: () => T): T;

export declare function flushSync<T>(fn: () => T): T;

export declare function effect(fn: (() => void) | (() => () => void)): void;

export interface TrackedArrayConstructor {
	new <T>(...elements: T[]): TrackedArray<T>;   // must be used with `new`
	from<T>(arrayLike: ArrayLike<T>): TrackedArray<T>;
	of<T>(...items: T[]): TrackedArray<T>;
	fromAsync<T>(iterable: AsyncIterable<T>): Promise<TrackedArray<T>>;
}

export interface TrackedArray<T> extends Array<T> { }

export declare const TrackedArray: TrackedArrayConstructor;

export type Context<T> = {
	get(): T;
	set(value: T): void;
};

export declare function createContext<T>(initialValue: T): Context<T>;

export declare class TrackedSet<T> extends Set<T> {
	isDisjointFrom(other: TrackedSet<T> | Set<T>): boolean;
	isSubsetOf(other: TrackedSet<T> | Set<T>): boolean;
	isSupersetOf(other: TrackedSet<T> | Set<T>): boolean;
	difference(other: TrackedSet<T> | Set<T>): TrackedSet<T>;
	intersection(other: TrackedSet<T> | Set<T>): TrackedSet<T>;
	symmetricDifference(other: TrackedSet<T> | Set<T>): TrackedSet<T>;
	union(other: TrackedSet<T> | Set<T>): TrackedSet<T>;
	toJSON(): T[];
	#private;
}

export declare class TrackedMap<K, V> extends Map<K, V> {
	toJSON(): [K, V][];
	#private;
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
	var _$_: {
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

type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;

type PickKeys<T, K extends readonly (keyof T)[]> =
	{ [I in keyof K]: Tracked<T[K[I] & keyof T]> };

type RestKeys<T, K extends readonly (keyof T)[]> = Expand<Omit<T, K[number]>>;

type SplitResult<T extends Props, K extends readonly (keyof T)[]> =
	[...PickKeys<T, K>, Tracked<RestKeys<T, K>>];

export declare function track<V>(value?: V | (() => V), get?: (v: V) => V, set?: (next: V, prev: V) => V): Tracked<V>;

export declare function trackSplit<V extends Props, const K extends readonly (keyof V)[]>(
	value: V,
	splitKeys: K,
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

export type TrackedObjectShallow<T> = {
	[K in keyof T]: T[K] | Tracked<T[K]>;
};

export type TrackedObjectDeep<T> =
	T extends string | number | boolean | null | undefined | symbol | bigint
	? T | Tracked<T>
	: T extends TrackedArray<infer U>
	? TrackedArray<U> | Tracked<TrackedArray<U>>
	: T extends TrackedSet<infer U>
	? TrackedSet<U> | Tracked<TrackedSet<U>>
	: T extends TrackedMap<infer K, infer V>
	? TrackedMap<K, V> | Tracked<TrackedMap<K, V>>
	: T extends Array<infer U>
	? Array<TrackedObjectDeep<U>> | Tracked<Array<TrackedObjectDeep<U>>>
	: T extends Set<infer U>
	? Set<TrackedObjectDeep<U>> | Tracked<Set<TrackedObjectDeep<U>>>
	: T extends Map<infer K, infer V>
	? Map<TrackedObjectDeep<K>, TrackedObjectDeep<V>> |
	Tracked<Map<TrackedObjectDeep<K>, TrackedObjectDeep<V>>>
	: T extends object
	? { [K in keyof T]: TrackedObjectDeep<T[K]> | Tracked<TrackedObjectDeep<T[K]>> }
	: T | Tracked<T>;

export type TrackedObject<T extends object> = T & {};

export interface TrackedObjectConstructor {
	new <T extends object>(obj: T): TrackedObject<T>;
}

export declare const TrackedObject: TrackedObjectConstructor;

export class SvelteDate extends Date {
	constructor(...params: any[]);
	#private;
}

export function Portal<V = HTMLElement>({ target }: { target: V }): void;
