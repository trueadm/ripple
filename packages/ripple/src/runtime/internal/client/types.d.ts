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

export type Tracked = {
	b: Block;
	c: number;
	f: number;
	v: any;
};

export type Derived = {
	b: Block;
	blocks: null | Block[];
	c: number;
	co: null | Component;
	d: null;
	f: number;
	fn: Function;
	v: any;
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
