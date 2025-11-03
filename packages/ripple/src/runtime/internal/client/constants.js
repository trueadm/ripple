export var ROOT_BLOCK = 1 << 1;
export var RENDER_BLOCK = 1 << 2;
export var EFFECT_BLOCK = 1 << 3;
export var BRANCH_BLOCK = 1 << 4;
export var FOR_BLOCK = 1 << 5;
export var TRY_BLOCK = 1 << 6;
export var IF_BLOCK = 1 << 7;
export var SWITCH_BLOCK = 1 << 8;
export var COMPOSITE_BLOCK = 1 << 9;
export var ASYNC_BLOCK = 1 << 10;
export var HEAD_BLOCK = 1 << 11;
export var CONTAINS_UPDATE = 1 << 12;
export var CONTAINS_TEARDOWN = 1 << 13;
export var BLOCK_HAS_RUN = 1 << 14;
export var TRACKED = 1 << 15;
export var DERIVED = 1 << 16;
export var DEFERRED = 1 << 17;
export var PAUSED = 1 << 18;
export var DESTROYED = 1 << 19;

export var CONTROL_FLOW_BLOCK = FOR_BLOCK | IF_BLOCK | SWITCH_BLOCK | TRY_BLOCK | COMPOSITE_BLOCK;

export var UNINITIALIZED = Symbol();
/** @type {unique symbol} */
export const TRACKED_ARRAY = Symbol();
/** @type {unique symbol} */
export const TRACKED_OBJECT = Symbol();
export var COMPUTED_PROPERTY = Symbol();
export var REF_PROP = 'ref';
/** @type {unique symbol} */
export const ARRAY_SET_INDEX_AT = Symbol();
export const MAX_ARRAY_LENGTH = 2 ** 32 - 1;
export const DEFAULT_NAMESPACE = 'html';
export const NAMESPACE_URI = {
	html: 'http://www.w3.org/1999/xhtml',
	svg: 'http://www.w3.org/2000/svg',
	mathml: 'http://www.w3.org/1998/Math/MathML',
};
