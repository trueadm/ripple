import type { Context } from './context.js';

export type Component = {
  c: null | Map<Context<any>, any>;
  p: null | Component;
};


export type Derived = {
  a: { get?: Function, set?: Function };
  co: null | Component;
  f: number;
  fn: Function;
  v: any;
};

export type Tracked = {
  a: { get?: Function, set?: Function };
  f: number;
  v: any;
};