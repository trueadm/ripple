export var ROOT_BLOCK = 1 << 1;
export var RENDER_BLOCK = 1 << 2;
export var EFFECT_BLOCK = 1 << 3;
export var BRANCH_BLOCK = 1 << 4;
export var FOR_BLOCK = 1 << 5;
export var TRY_BLOCK = 1 << 6;
export var IF_BLOCK = 1 << 7;
export var ASYNC_BLOCK = 1 << 8;
export var COMPAT_BLOCK = 1 << 9;
export var CONTAINS_UPDATE = 1 << 10;
export var CONTAINS_TEARDOWN = 1 << 11;
export var BLOCK_HAS_RUN = 1 << 12;
export var TRACKED = 1 << 13;
export var COMPUTED = 1 << 14;
export var DEFERRED = 1 << 15;
export var PAUSED = 1 << 16;
export var DESTROYED = 1 << 17;

export var LOGIC_BLOCK = FOR_BLOCK | IF_BLOCK | TRY_BLOCK;

export var UNINITIALIZED = Symbol();
export var TRACKED_OBJECT = Symbol();
export var SPREAD_OBJECT = Symbol();
export var COMPUTED_PROPERTY = Symbol();
export var USE_PROP = '@use';
export var ARRAY_SET_INDEX_AT = Symbol();
