/**
 * Types for Hidden Imports in TSX Generated Code
 *
 * Adds uniquely named exports to account for hidden imports
 * in the tsx generated code for language server / IDE support.
 * This is necessary because we need to keep hidden imports named differently
 * for full TS support including adding missing imports in source and
 * property reporting missing imports.
 *
 * The types are obfuscated to avoid name collisions and provide
 * sufficiently different names so that TS cannot attempt to infer that
 * the user made a mistake when the user is missing an import.
 *
 * e.g.
 * // import { TrackedMap } from 'ripple'; -- assume TrackedMap import is missing
 * const map = new TrackedMap();
 *
 * If a type in the hidden import contains 'TrackedMap', e.g. '__TrackedMap',
 * TS would suggest to the user that they meant to use '__TrackedMap' instead of 'TrackedMap'.
 *
 * Add additional types as needed if they are used in hidden imports.
 *
 * This file is used by the package.json in exports
 * The exports path is used by the TS compiler to resolve types.
 *
 * The intellisense is intercepted by hover language plugin
 * to replace the obfuscated names with the actual types.
 *
 * Do not rename or move without updating those paths.
 */

import {
	TrackedMap as _$_Map__Tracked,
	TrackedSet as _$_Set__Tracked,
	TrackedArray as _$_Array__Tracked,
	TrackedObject as _$_Object__Tracked,
	TrackedURL as _$_URL__Tracked,
	TrackedURLSearchParams as _$_URLSearchParams__Tracked,
	TrackedDate as _$_Date__Tracked,
	createRefKey as _$_RefKey__create,
} from 'ripple';

export {
	_$_Map__Tracked,
	_$_Set__Tracked,
	_$_Array__Tracked,
	_$_Object__Tracked,
	_$_URL__Tracked,
	_$_URLSearchParams__Tracked,
	_$_Date__Tracked,
	_$_RefKey__create,
};
