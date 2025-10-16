import type { Context } from './context.js';

export type Component = {
	c: null | Map<Context<any>, any>;
	e: null | Array<{
		b: Block;
		fn: Function;
		r: null | Block | Derived;
	}>;
	p: null | Component;
	m: boolean;
};

export type Dependency = {
	c: number;
	t: Tracked | Derived;
	n: null | Dependency;
};

export type Tracked<V = any> = {
	DO_NOT_ACCESS_THIS_OBJECT_DIRECTLY?: true;
	a: { get?: Function, set?: Function };
	b: Block;
	c: number;
	f: number;
	__v: V;
};

export type Derived = {
	DO_NOT_ACCESS_THIS_OBJECT_DIRECTLY?: true;
	a: { get?: Function, set?: Function };
	b: Block;
	blocks: null | Block[];
	c: number;
	co: null | Component;
	d: null;
	f: number;
	fn: Function;
	__v: any;
};

export type Block = {
	co: null | Component;
	d: null | Dependency;
	first: null | Block;
	f: number;
	fn: any;
	last: null | Block;
	next: null | Block;
	p: null | Block;
	prev: null | Block;
	s: any;
	// teardown function
	t: (() => {}) | null;
};

export type CompatApi = {
	createRoot: () => void;
	createComponent: (node: any, children_fn: () => any) => void;
	jsx: (type: any, props: any) => any;
}

export type CompatOptions = {
	[key: string]: CompatApi;
}
