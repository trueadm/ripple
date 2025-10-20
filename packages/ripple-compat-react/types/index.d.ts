export type Tsx = {
	jsx: typeof import('react/jsx-runtime').jsx;
	jsxs: typeof import('react/jsx-runtime').jsxs;
	Fragment: typeof import('react').Fragment;
};

export declare function createReactCompat(): {
	createComponent(node: HTMLElement, children_fn: (tsx: Tsx) => any): void;
	createRoot(): () => void | (() => void);
};
