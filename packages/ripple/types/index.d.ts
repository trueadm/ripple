export type Component<T = Record<string, any>> = (props: T) => void;

export declare function mount(
	component: () => void,
	options: { target: HTMLElement; props?: Record<string, any> },
): () => void;

export declare function untrack<T>(fn: () => T): T;

export declare function flushSync<T>(fn: () => T): T;

export declare function effect(fn: (() => void) | (() => () => void)): void;

export interface Ref<T> {
	$current: T;
}

export declare function ref<T>(value: T): Ref<T>;

export interface RippleArray<T> extends Array<T> {
  $length: number;
  toJSON(): T[];
}

export declare function array<T>(...elements: T[]): RippleArray<T>;

export type Context<T> = {
	v: T;
};

export declare function createContext<T>(initialValue: T): Context<T>;

export declare function setContext<T>(context: Context<T>, value: T): void;

export declare function getContext<T>(context: Context<T>): T;