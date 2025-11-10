import type { Component } from 'ripple';

export type Tsx = {
	jsx: typeof import('react/jsx-runtime').jsx;
	jsxs: typeof import('react/jsx-runtime').jsxs;
	Fragment: typeof import('react').Fragment;
};

export declare function createReactCompat(): {
	createComponent(node: HTMLElement, children_fn: (tsx: Tsx) => any): void;
	createRoot(): () => void | (() => void);
};

export declare function Ripple<P>(component: Component<P>, props?: P): React.JSX.Element;

export declare function RippleRoot(props: { children: React.ReactNode }): React.JSX.Element;
