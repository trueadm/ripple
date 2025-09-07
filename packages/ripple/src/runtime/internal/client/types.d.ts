import type { Context } from './context.js';

export type Component = {
	c: null | Map<Context<any>, any>;
	e: null | Array<{
		b: Block;
		fn: Function;
		r: null | Block | Computed;
	}>;
	p: null | Component;
	m: boolean;
};

export type Dependency = {
	c: number;
	t: Tracked | Computed;
	n: null | Dependency;
};

export type Tracked = {
	b: Block;
	c: number;
	f: number;
	v: any;
};

export type Computed = {
		b: Block,
		blocks: null | Block[],
		c: number,
		d: null,
		f: number,
		fn: Function,
		v: any,
};

export type Block = {
	c: null | Component;
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
