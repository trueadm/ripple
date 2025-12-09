import type { Context } from './context.js';

export type Component = {
	c: null | Map<Context<any>, any>;
	p: null | Component;
};

export type Dependency = {
	c: number;
	t: Tracked | Derived;
	n: null | Dependency;
};

export type Derived = {
	a: { get?: Function; set?: Function };
	c: number;
	co: null | Component;
	d: null | Dependency;
	f: number;
	fn: Function;
	v: any;
};

export type Tracked = {
	a: { get?: Function; set?: Function };
	c: number;
	f: number;
	v: any;
};
