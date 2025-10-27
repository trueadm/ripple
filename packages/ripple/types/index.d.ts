export type Component<T = Record<string, any>> = (props: T) => void;

export type CompatApi = {
	createRoot: () => void;
	createComponent: (node: any, children_fn: () => any) => void;
	jsx: (type: any, props: any) => any;
};

export type CompatOptions = {
	[key: string]: CompatApi;
};

export declare function mount(
	component: () => void,
	options: { target: HTMLElement; props?: Record<string, any>; compat?: CompatOptions },
): () => void;

export declare function tick(): Promise<void>;

export declare function untrack<T>(fn: () => T): T;

export declare function flushSync<T>(fn?: () => T): T;

export declare function effect(fn: (() => void) | (() => () => void)): void;

export interface TrackedArrayConstructor {
	new <T>(...elements: T[]): TrackedArray<T>; // must be used with `new`
	from<T>(arrayLike: ArrayLike<T>): TrackedArray<T>;
	of<T>(...items: T[]): TrackedArray<T>;
	fromAsync<T>(iterable: AsyncIterable<T>): Promise<TrackedArray<T>>;
}

export interface TrackedArray<T> extends Array<T> {}

export declare const TrackedArray: TrackedArrayConstructor;

export declare class Context<T> {
	constructor(initial_value: T);
	get(): T;
	set(value: T): void;
	#private;
}

export declare class TrackedSet<T> extends Set<T> {
	isDisjointFrom<U>(other: ReadonlySetLike<U> | TrackedSet<U>): boolean;
	isSubsetOf<U>(other: ReadonlySetLike<U> | TrackedSet<U>): boolean;
	isSupersetOf<U>(other: ReadonlySetLike<U> | TrackedSet<U>): boolean;
	difference<U>(other: ReadonlySetLike<U> | TrackedSet<U>): TrackedSet<T>;
	intersection<U>(other: ReadonlySetLike<U> | TrackedSet<U>): TrackedSet<T & U>;
	symmetricDifference<U>(other: ReadonlySetLike<U> | TrackedSet<U>): TrackedSet<T | U>;
	union<U>(other: ReadonlySetLike<U> | TrackedSet<U>): TrackedSet<T | U>;
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
		set(node: any, value: any): any;
		// Add other runtime functions as needed for TypeScript analysis
	};
}

export declare function createRefKey(): symbol;

// Base Tracked interface - all tracked values have a '#v' property containing the actual value
export interface Tracked<V> {
	'#v': V;
}

// Augment Tracked to be callable when V is a Component
// This allows <@Something /> to work in JSX when Something is Tracked<Component>
export interface Tracked<V> {
	(props: V extends Component<infer P> ? P : never): V extends Component ? void : never;
}

// Helper type to infer component type from a function that returns a component
// If T is a function returning a Component, extract the Component type itself, not the return type (void)
export type InferComponent<T> = T extends () => infer R ? (R extends Component<any> ? R : T) : T;

export type Props<K extends PropertyKey = any, V = unknown> = Record<K, V>;
export type PropsWithExtras<T extends object> = Props & T & Record<string, unknown>;
export type PropsWithChildren<T extends object = {}> = Expand<
	Omit<Props, 'children'> & { children: Component } & T
>;

type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;

type PickKeys<T, K extends readonly (keyof T)[]> = { [I in keyof K]: Tracked<T[K[I] & keyof T]> };

type RestKeys<T, K extends readonly (keyof T)[]> = Expand<Omit<T, K[number]>>;

type SplitResult<T extends Props, K extends readonly (keyof T)[]> = [
	...PickKeys<T, K>,
	Tracked<RestKeys<T, K>>,
];

export declare function get<V>(tracked: Tracked<V>): V;

export declare function set<V>(tracked: Tracked<V>, value: V): void;

// Overload for function values - infers the return type of the function
export declare function track<V>(
	value: () => V,
	get?: (v: InferComponent<V>) => InferComponent<V>,
	set?: (next: InferComponent<V>, prev: InferComponent<V>) => InferComponent<V>,
): Tracked<InferComponent<V>>;
// Overload for non-function values
export declare function track<V>(
	value?: V,
	get?: (v: V) => V,
	set?: (next: V, prev: V) => V,
): Tracked<V>;

export declare function trackSplit<V extends Props, const K extends readonly (keyof V)[]>(
	value: V,
	splitKeys: K,
): SplitResult<V, K>;

export function on<Type extends keyof WindowEventMap>(
	window: Window,
	type: Type,
	handler: (this: Window, event: WindowEventMap[Type]) => any,
	options?: AddEventListenerOptions | undefined,
): () => void;

export function on<Type extends keyof DocumentEventMap>(
	document: Document,
	type: Type,
	handler: (this: Document, event: DocumentEventMap[Type]) => any,
	options?: AddEventListenerOptions | undefined,
): () => void;

export function on<Element extends HTMLElement, Type extends keyof HTMLElementEventMap>(
	element: Element,
	type: Type,
	handler: (this: Element, event: HTMLElementEventMap[Type]) => any,
	options?: AddEventListenerOptions | undefined,
): () => void;

export function on<Element extends MediaQueryList, Type extends keyof MediaQueryListEventMap>(
	element: Element,
	type: Type,
	handler: (this: Element, event: MediaQueryListEventMap[Type]) => any,
	options?: AddEventListenerOptions | undefined,
): () => void;

export function on(
	element: EventTarget,
	type: string,
	handler: EventListener,
	options?: AddEventListenerOptions | undefined,
): () => void;

export type TrackedObjectShallow<T> = {
	[K in keyof T]: T[K] | Tracked<T[K]>;
};

export type TrackedObjectDeep<T> = T extends
	| string
	| number
	| boolean
	| null
	| undefined
	| symbol
	| bigint
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
							?
									| Map<TrackedObjectDeep<K>, TrackedObjectDeep<V>>
									| Tracked<Map<TrackedObjectDeep<K>, TrackedObjectDeep<V>>>
							: T extends object
								? { [K in keyof T]: TrackedObjectDeep<T[K]> | Tracked<TrackedObjectDeep<T[K]>> }
								: T | Tracked<T>;

export type TrackedObject<T extends object> = T & {};

export interface TrackedObjectConstructor {
	new <T extends object>(obj: T): TrackedObject<T>;
}

export declare const TrackedObject: TrackedObjectConstructor;

export class TrackedDate extends Date {
	constructor(...params: any[]);
	#private;
}

declare const REPLACE: unique symbol;

export class TrackedURLSearchParams extends URLSearchParams {
	[REPLACE](params: URLSearchParams): void;
	#private;
}

export class TrackedURL extends URL {
	get searchParams(): TrackedURLSearchParams;
	#private;
}

export function createSubscriber(start: () => void | (() => void)): () => void;

interface ReactiveValue<V> extends Tracked<V> {
	new (fn: () => Tracked<V>, start: () => void | (() => void)): Tracked<V>;
	/** @private */
	_brand: void;
}

export interface MediaQuery extends Tracked<boolean> {
	new (query: string, fallback?: boolean | undefined): Tracked<boolean>;
	/** @private */
	_brand: void;
}

export declare const MediaQuery: {
	new (query: string, fallback?: boolean | undefined): Tracked<boolean>;
};

export function Portal<V = HTMLElement>({
	target,
	children: Component,
}: {
	target: V;
	children?: Component;
}): void;

/**
 * @param {Tracked<V>} tracked
 * @returns {(node: HTMLInputElement | HTMLSelectElement) => void}
 */
export declare function bindValue<V>(
	tracked: Tracked<V>,
): (node: HTMLInputElement | HTMLSelectElement) => void;

/**
 * @param {Tracked<V>} tracked
 * @returns {(node: HTMLInputElement) => void}
 */
export declare function bindChecked<V>(tracked: Tracked<V>): (node: HTMLInputElement) => void;

export declare function bindClientWidth<V>(tracked: Tracked<V>): (node: HTMLElement) => void;

export declare function bindClientHeight<V>(tracked: Tracked<V>): (node: HTMLElement) => void;

export declare function bindContentRect<V>(tracked: Tracked<V>): (node: HTMLElement) => void;

export declare function bindContentBoxSize<V>(tracked: Tracked<V>): (node: HTMLElement) => void;

export declare function bindBorderBoxSize<V>(tracked: Tracked<V>): (node: HTMLElement) => void;

export declare function bindDevicePixelContentBoxSize<V>(
	tracked: Tracked<V>,
): (node: HTMLElement) => void;

export declare function bindInnerHTML<V>(tracked: Tracked<V>): (node: HTMLElement) => void;

export declare function bindInnerText<V>(tracked: Tracked<V>): (node: HTMLElement) => void;

export declare function bindTextContent<V>(tracked: Tracked<V>): (node: HTMLElement) => void;

export declare function bindNode<V>(tracked: Tracked<V>): (node: HTMLElement) => void;
