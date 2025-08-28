export type Fragment<T extends any[] = []> = (...args: T) => void;

export declare function mount(
	component: () => void,
	options: { target: HTMLElement; props?: Record<string, any> }
): () => void;

export declare function untrack<T>(fn: () => T): T;