export type Component = {
	c: null | Map<any, any>;
	e: null | Array<{
		b: Block;
		fn: Function;
		r: null | Block;
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
	last: null;
	next: null;
	p: null | Block;
	prev: null;
	s: any;
	t: Tracked | null;
};

export type Context<T> = {
	v: T;
};

export type Ref<T> = {
	$current: T;
};	
