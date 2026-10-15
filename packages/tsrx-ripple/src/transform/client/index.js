// @ts-check

/**
@import * as AST from 'estree';
@import * as ESTreeJSX from 'estree-jsx';
@import { RawSourceMap } from 'source-map';
@import {
	AnalysisResult,
	TransformClientContext,
	VisitorClientContext,
	TransformClientState,
	ScopeInterface,
	Visitor,
	Visitors,
	Binding,
}	from '../../../types/index';
@import { CompileError } from '../../../types/index';
@import { RequiredPresent } from '@tsrx/core/types/helpers';
 */

/**
@typedef {Map<number, {offset: number, delta: number}>} PostProcessingChanges;
@typedef {number[]} LineOffsets;
@typedef {NonNullable<TransformClientState['update']>[number] & {
	unguarded?: boolean;
}} UpdateEntry an update whose operation is emitted without the `__prev`
	compare, and updates its own slot (an element spread)
*/

import { walk } from 'zimmerframe';

/**
 * A `for_keyed` flag of the Ripple runtime (`packages/ripple/src/constants.js`),
 * next to the target-neutral flags from `@tsrx/core`: the loop item is read
 * only by the render block its item block carries.
 */
const LOCAL_ITEMS = 1 << 7;
/** `if_static` flags (`packages/ripple/src/constants.js`). */
const IF_ROOT_CONTROLLED = 1;
const IF_TRACKED = 1 << 1;
import { captured_locals, register_hoisted, rewrite } from './hoist.js';
import { has_text_type_fact } from '../../text-type-facts.js';
import { HTML_ELEMENT_SETTERS, HTML_TAG_SETTERS } from '../../dom-setters.js';
import path from 'node:path';
import { print } from 'esrap';
import tsx from 'esrap/languages/tsx';
import {
	builders,
	clone_ast_node,
	extractIdentifiers,
	IS_CONTROLLED,
	IS_INDEXED,
	ROOT_CONTROLLED,
	TEMPLATE_FRAGMENT,
	TEMPLATE_SVG_NAMESPACE,
	TEMPLATE_MATHML_NAMESPACE,
	DEFAULT_NAMESPACE,
	sanitizeTemplateString,
	SERVER_IDENTIFIER,
	obfuscateIdentifier,
	object,
	renderCssResult,
	buildStyleClassMap,
	createStyleClassMapFromStylesheet,
	getStyleElementStylesheet,
	getOriginalEventName,
	has_location,
	isCaptureEvent,
	isEventAttribute,
	isNonDelegated,
	isSvgTagName,
	isMathmlTagName,
	isEmptyJsxFragment as is_empty_jsx_fragment,
	isInsideComponent as is_inside_component,
	normalizeEventName,
	shouldPreserveComment,
	formatComment,
	setLocation,
	createElementRefTargetTypeForName as create_element_ref_target_type_for_name,
	wrapEdgeWhitespace as wrap_edge_whitespace,
	isTemplateValuePosition,
	withDeferredImports,
} from '@tsrx/core';
const b = builders;
import {
	build_assignment,
	visit_assignment_expression,
	escape_html,
	is_boolean_attribute,
	is_dom_property,
	is_declared_function_within_component,
	is_inside_call_expression,
	is_global_coercion_call,
	unwrap_single_return_iife,
	is_value_static,
	is_void_element,
	is_element_dom_element,
	is_ripple_track_call,
	normalize_children,
	build_getter,
	determine_namespace_for_children,
	index_to_key,
	is_children_template_expression,
	is_inside_left_side_assignment,
	strong_hash,
	flatten_switch_consequent,
	scope_switch_case_body,
	get_ripple_namespace_call_name,
	get_ripple_namespace_static_call_name,
	is_ripple_import,
	is_context_method_call,
	is_boxed,
	sole_template_if,
	is_template_if,
	is_ripple_portal,
	ripple_import_requires_block,
	strip_class_typescript_syntax,
	strip_typescript_expression_wrappers,
	visit_children_without,
	adopt_raw_template_jsx,
	create_native_tsrx_render_function,
	get_native_tsrx_function_body,
	is_native_tsrx_function_node,
	is_static_native_tsrx_function_call,
	is_native_tsrx_template_node,
	is_code_block_function_body,
	is_tsrx_component_function,
	is_style_element,
	pattern_reads,
	dynamic_element_import_local,
	lower_dynamic_element,
	strip_tsrx_style_elements,
	wrap_code_block_in_iife,
	visit_directive_wrapping_values,
	get_code_block_render,
	get_code_block_template_child,
	lower_code_block_children,
	is_text_primitive_expression,
	collect_head_elements,
	is_flattenable_template_fragment,
	get_scope_class_chain,
	build_scope_class_expression,
	is_server_module_declaration,
} from '../../utils.js';
import {
	get_attribute_name,
	get_attribute_name_node,
	get_attribute_value,
	get_element_attributes,
	get_element_id,
	get_element_identifier,
	get_style_css,
	get_template_expression,
	get_template_text_value,
	is_dynamic_element,
	is_empty_expression_container,
	is_expression_attribute,
	is_self_closing,
	is_template_element,
	is_template_directive,
	is_template_expression,
	is_template_fragment,
	is_template_text,
	is_template_text_or_expression,
} from '../../template-ast.js';
import is_reference from 'is-reference';

/**
 * The class-map object of an assigned block (`const theme = <style>…</style>`):
 * `$class` first — the applied themes' classes, then the block's own hash —
 * followed by one entry per standalone class selector. The sheet itself was
 * prepared by the style pre-pass at its declaration position.
 * @param {AST.JSXStyleElement} node
 * @param {TransformClientContext} context
 * @returns {AST.ObjectExpression}
 */
function build_style_class_map_expression(node, context) {
	const stylesheet = getStyleElementStylesheet(node);
	const applied = node.metadata.tsrx_style_class_parts ?? [];
	const class_map = stylesheet
		? createStyleClassMapFromStylesheet(stylesheet, { applied })
		: buildStyleClassMap(new Map(), null, { applied });
	if (context.state.to_ts) {
		add_type_only_style_anchor(node, context);
	}
	return class_map;
}

/**
 * The synthesized `$class` read of a type-only `apply` target borrows the
 * target's position for verification only, so a TypeScript error on it (the
 * target is not a style object) lands on the authored identifier, while
 * hover and navigation on that identifier stay the target's own.
 * @param {AST.Node} target
 * @returns {AST.Identifier}
 */
function type_only_class_read(target) {
	const id = b.id('$class', has_location(target) ? target : undefined);
	if (has_location(target)) {
		id.metadata = {
			...id.metadata,
			verify_only: true,
			source_length: target.end - target.start,
		};
	}
	return id;
}

/**
 * The attributes of a type-only `<style>` stand-in: `apply` becomes a
 * `data-tsrx-apply` attribute reading `$class` of each target, so TypeScript
 * checks that every target is a style object. Other attributes carry no
 * type information and are dropped.
 * @param {AST.JSXStyleElement} node
 * @returns {ESTreeJSX.JSXAttribute[]}
 */
function type_only_style_attributes(node) {
	/** @type {ESTreeJSX.JSXAttribute[]} */
	const attributes = [];
	for (const attr of get_element_attributes(node)) {
		if (attr.type !== 'JSXAttribute' || get_attribute_name(attr) !== 'apply') continue;
		const value = attr.value;
		if (
			value?.type !== 'JSXExpressionContainer' ||
			value.expression.type === 'JSXEmptyExpression'
		) {
			continue;
		}
		/** @param {AST.Expression} target */
		const read = (target) => b.member(clone_ast_node(target), type_only_class_read(target));
		const expression = value.expression;
		const reads =
			expression.type === 'ArrayExpression'
				? b.array(
						expression.elements.map((element) =>
							element && element.type !== 'SpreadElement' ? read(element) : element,
						),
					)
				: read(expression);
		attributes.push(
			b.jsx_attribute(b.jsx_id('data-tsrx-apply'), b.jsx_expression_container(reads)),
		);
	}
	return attributes;
}

/**
 * The hoisted stand-in of an assigned block, so the `<style>` tag keeps a
 * mapping. It carries no `apply` reads: hoisting them above the declarations
 * they name would be a use before declaration, and the class-map object
 * already reads an imported target's `$class` (a same-module target is
 * resolved by the analyzer).
 * @param {AST.JSXStyleElement} node
 * @param {TransformClientContext} context
 * @returns {void}
 */
function add_type_only_style_anchor(node, context) {
	const style_anchor = b.jsx_element(clone_ast_node(node, true), [], []);
	disable_style_anchor_verification(style_anchor);

	const anchor_id = b.id(context.state.scope.generate('style_anchor'));
	context.state.hoisted.push(b.const(anchor_id, style_anchor), b.stmt(b.id(anchor_id.name)));
	register_hoisted(context.state.hoisted, anchor_id.name);
}

/**
 * @param {AST.TSRXJSXElement} element
 */
function disable_style_anchor_verification(element) {
	if (element.openingElement?.name) {
		element.openingElement.name.metadata = {
			...(element.openingElement.name.metadata || {}),
			disable_verification: true,
		};
	}
	if (element.closingElement?.name) {
		element.closingElement.name.metadata = {
			...(element.closingElement.name.metadata || {}),
			disable_verification: true,
		};
	}
}

/**
 * Copy-on-write: nodes on the changed spine are rebuilt (their scope mapping is
 * mirrored onto the copies); untouched subtrees are shared with the input.
 * @param {AST.Node[]} body
 * @param {AST.Statement[]} setup
 * @param {Map<AST.Node | AST.Node[], ScopeInterface>} [scopes]
 * @returns {AST.Node[]}
 */
function insert_style_ref_setup_statements(body, setup, scopes) {
	if (setup.length === 0) {
		return body;
	}

	let inserted = false;

	/**
	 * @template {AST.Node | AST.Node[]} T
	 * @param {T} original
	 * @param {T} copy
	 * @returns {T}
	 */
	const mirror_scope = (original, copy) => {
		const scope = scopes?.get(original);
		if (scope) scopes?.set(copy, scope);
		return copy;
	};

	/** @param {AST.Node[]} nodes */
	const insert_in_list = (nodes) => {
		const index = nodes.findIndex((node) => node.metadata?.returned_tsrx_child);
		if (index !== -1) {
			inserted = true;
			return mirror_scope(nodes, [
				...nodes.slice(0, index),
				...setup.map((statement) => clone_ast_node(statement, false)),
				...nodes.slice(index),
			]);
		}

		/** @type {AST.Node[] | null} */
		let out = null;
		for (let i = 0; i < nodes.length; i++) {
			const next = insert_in_statement(nodes[i]);
			if (next !== nodes[i]) {
				out ??= nodes.slice();
				out[i] = next;
			}
		}
		return out === null ? nodes : mirror_scope(nodes, out);
	};

	/** @param {AST.Node} node */
	const insert_in_statement = (node) => {
		if (node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') {
			return node;
		}
		if (node.type === 'BlockStatement') {
			const list = node.body || [];
			const node_body = /** @type {AST.Statement[]} */ (insert_in_list(list));
			return node_body === list ? node : mirror_scope(node, { ...node, body: node_body });
		}
		if (node.type === 'IfStatement') {
			/** @type {{ consequent?: AST.Statement; alternate?: AST.Statement } | null} */
			let updates = null;
			const consequent = /** @type {AST.Statement} */ (insert_in_statement(node.consequent));
			if (consequent !== node.consequent) (updates ??= {}).consequent = consequent;
			if (node.alternate) {
				const alternate = /** @type {AST.Statement} */ (insert_in_statement(node.alternate));
				if (alternate !== node.alternate) (updates ??= {}).alternate = alternate;
			}
			return updates === null ? node : mirror_scope(node, { ...node, ...updates });
		}
		if (node.type === 'SwitchStatement') {
			const node_cases = node.cases || [];
			/** @type {AST.SwitchCase[] | null} */
			let cases = null;
			for (let i = 0; i < node_cases.length; i++) {
				const switch_case = node_cases[i];
				const list = switch_case.consequent || [];
				const consequent = /** @type {AST.Statement[]} */ (insert_in_list(list));
				if (consequent !== list) {
					cases ??= node_cases.slice();
					cases[i] = mirror_scope(switch_case, { ...switch_case, consequent });
				}
			}
			return cases === null ? node : mirror_scope(node, { ...node, cases });
		}
		if (node.type === 'TryStatement') {
			/** @type {{ block?: AST.BlockStatement; handler?: AST.CatchClause; finalizer?: AST.BlockStatement } | null} */
			let updates = null;
			const block = /** @type {AST.BlockStatement} */ (insert_in_statement(node.block));
			if (block !== node.block) (updates ??= {}).block = block;
			if (node.handler?.body) {
				const handler_body = /** @type {AST.BlockStatement} */ (
					insert_in_statement(node.handler.body)
				);
				if (handler_body !== node.handler.body) {
					(updates ??= {}).handler = mirror_scope(node.handler, {
						...node.handler,
						body: handler_body,
					});
				}
			}
			if (node.finalizer) {
				const finalizer = /** @type {AST.BlockStatement} */ (insert_in_statement(node.finalizer));
				if (finalizer !== node.finalizer) (updates ??= {}).finalizer = finalizer;
			}
			return updates === null ? node : mirror_scope(node, { ...node, ...updates });
		}
		return node;
	};

	const result = insert_in_list(body);
	if (inserted) {
		return result;
	}
	return [...setup, ...body];
}

/**
 * @param {AST.TSRXImportDeclaration} node
 * @returns {string | null}
 */
function get_submodule_import_source_name(node) {
	const source = node.source;
	return source.type === 'Identifier' ? source.name : null;
}

/**
 * @param {AST.ImportSpecifier} specifier
 * @returns {string | null}
 */
function get_imported_name(specifier) {
	const imported = specifier.imported;
	if (imported.type === 'Identifier') {
		return imported.name;
	}
	if (imported.type === 'Literal' && typeof imported.value === 'string') {
		return imported.value;
	}
	return null;
}

/**
 * @param {string} filename
 * @param {string} imported_name
 * @returns {AST.FunctionExpression}
 */
function create_server_rpc_stub(filename, imported_name) {
	const func_hash = strong_hash(filename + '#' + imported_name);
	return b.function(
		null,
		[b.rest(b.id('args'))],
		b.block([b.return(b.call('_$_.rpc', b.literal(func_hash), b.id('args')))]),
	);
}

/**
 * @param {AST.TSRXImportDeclaration} node
 * @param {TransformClientState} state
 * @returns {AST.Statement[]}
 */
function transform_server_module_import(node, state) {
	/** @type {AST.Statement[]} */
	const declarations = [];
	const source_name = get_submodule_import_source_name(node);
	for (const specifier of node.specifiers) {
		if (specifier.type !== 'ImportSpecifier') {
			continue;
		}
		const imported_name = get_imported_name(specifier);
		if (imported_name === null) {
			continue;
		}
		const local_name = specifier.local.name;
		const server_identifier = b.id(
			SERVER_IDENTIFIER,
			/** @type {AST.NodeWithLocation} */ (node.source),
		);
		if (source_name !== null) {
			server_identifier.metadata.source_name = source_name;
		}
		const imported_identifier = b.id(
			imported_name,
			/** @type {AST.NodeWithLocation} */ (specifier.imported),
		);
		const local_identifier = b.id(
			local_name,
			/** @type {AST.NodeWithLocation} */ (specifier.local),
		);
		const init = state.to_ts
			? b.member(server_identifier, imported_identifier)
			: create_server_rpc_stub(state.filename, imported_name);
		declarations.push(b.const(local_identifier, init));
	}
	return declarations;
}

/**
 * @param {AST.Statement | AST.Statement[] | AST.Directive | AST.ModuleDeclaration} statement
 * @param {Array<AST.Statement | AST.Directive | AST.ModuleDeclaration>} statements
 */
function push_statement(statement, statements) {
	if (Array.isArray(statement)) {
		for (const item of statement) {
			statements.push(item);
		}
	} else {
		statements.push(statement);
	}
}

/**
 *
 * @param {AST.FunctionDeclaration | AST.FunctionExpression | AST.ArrowFunctionExpression} node
 * @param {TransformClientContext} context
 */
function visit_function(node, context) {
	// Function overload signatures don't have a body - they're TypeScript-only
	// Remove them when compiling to JavaScript
	if (!context.state.to_ts && !node.body) {
		return b.empty;
	}

	if (is_tsrx_component_function(node)) {
		return transform_native_tsrx_function(node, context);
	}

	const state = context.state;
	const metadata = /** @type {AST.FunctionExpression['metadata']} */ (node.metadata);

	if (context.state.to_ts) {
		return context.next(SetStateForOutsideComponent(state));
	}

	// Strip parameter type annotations via copies (the source params are never
	// mutated)
	const transformed_params = node.params.map((param) => {
		/** @type {AST.Pattern} */
		let param_out =
			param.typeAnnotation || /** @type {any} */ (param).optional
				? /** @type {AST.Pattern} */ (
						/** @type {unknown} */ ({ ...param, typeAnnotation: undefined, optional: false })
					)
				: param;
		// Handle AssignmentPattern (parameters with default values)
		if (
			param_out.type === 'AssignmentPattern' &&
			(param_out.left?.typeAnnotation || /** @type {any} */ (param_out.left)?.optional)
		) {
			param_out = /** @type {AST.AssignmentPattern} */ (
				/** @type {unknown} */ ({
					...param_out,
					left: { ...param_out.left, typeAnnotation: undefined, optional: false },
				})
			);
		}
		return param_out;
	});

	let body = /** @type {AST.BlockStatement | AST.Expression} */ (
		context.visit(
			node.body,
			SetStateForOutsideComponent(state, {
				// we are new context so tracking no longer applies
				metadata: { ...state.metadata, tracking: false },
				component: undefined,
				flush_node: null,
				template: null,
				jsx_to_tsrx_element: true,
			}),
		)
	);

	if (
		metadata?.tracked === true &&
		!is_inside_component(context, true) &&
		body.type === 'BlockStatement' &&
		references_block(body)
	) {
		body = { ...body, body: [b.var('__block', b.call('_$_.scope')), ...body.body] };
	}

	const boxes = box_param_statements(node);
	if (boxes.length > 0) {
		body =
			body.type === 'BlockStatement'
				? { ...body, body: [...boxes, ...body.body] }
				: b.block([...boxes, b.return(body)]);
	}

	return {
		...node,
		params: transformed_params.map((param) => context.visit(param, state)),
		body,
		returnType: undefined,
		typeParameters: undefined,
	};
}

/** AST keys that hold no child values, or hold references back up the tree. */
const NON_CHILD_KEYS = new Set([
	'metadata',
	'loc',
	'start',
	'end',
	'range',
	'leadingComments',
	'trailingComments',
	'typeAnnotation',
	'typeParameters',
	'typeArguments',
	'returnType',
]);

/**
 * Whether a compiled function body reads the `__block` binding a scope
 * declaration would introduce. A body that never does (it creates no tracked
 * value and wraps no call in `with_scope`) gets no `_$_.scope()` call: a
 * bundler drops the unused binding but has to keep the call.
 * @param {AST.Node} node
 * @returns {boolean}
 */
function references_block(node) {
	if (node.type === 'Identifier') {
		return node.name === '__block';
	}
	for (const key in node) {
		if (NON_CHILD_KEYS.has(key)) continue;
		const value = /** @type {any} */ (node)[key];
		if (Array.isArray(value)) {
			for (const item of value) {
				if (is_ast_node(item) && references_block(item)) return true;
			}
		} else if (is_ast_node(value) && references_block(value)) {
			return true;
		}
	}
	return false;
}

/**
 * @param {unknown} value
 * @returns {value is AST.Node}
 */
function is_ast_node(value) {
	return (
		value !== null &&
		typeof value === 'object' &&
		typeof (/** @type {any} */ (value).type) === 'string'
	);
}

/**
 * @param {AST.Node | null | undefined} node
 * @param {boolean} [allow_direct_template]
 * @returns {ESTreeJSX.JSXElement | ESTreeJSX.JSXFragment | null}
 */
function get_native_tsrx_return_template_node(node, allow_direct_template = false) {
	if (!node) return null;
	if (allow_direct_template && is_native_tsrx_template_node(node)) {
		return /** @type {ESTreeJSX.JSXElement | ESTreeJSX.JSXFragment} */ (
			/** @type {unknown} */ (node)
		);
	}
	if (node.type === 'ReturnStatement' && is_native_tsrx_template_node(node.argument)) {
		return /** @type {ESTreeJSX.JSXElement | ESTreeJSX.JSXFragment} */ (
			/** @type {unknown} */ (node.argument)
		);
	}
	if (node.type === 'JSXCodeBlock') {
		const render = get_code_block_render(node);
		if (is_native_tsrx_template_node(render)) {
			return /** @type {ESTreeJSX.JSXElement | ESTreeJSX.JSXFragment} */ (
				/** @type {unknown} */ (render)
			);
		}
	}
	if (
		node.type === 'FunctionDeclaration' ||
		node.type === 'FunctionExpression' ||
		node.type === 'ArrowFunctionExpression' ||
		node.type === 'ClassDeclaration' ||
		node.type === 'ClassExpression'
	) {
		return null;
	}
	if (node.type === 'BlockStatement') {
		for (const statement of node.body) {
			const match = get_native_tsrx_return_template_node(statement);
			if (match) return match;
		}
	}
	if (node.type === 'IfStatement') {
		return (
			get_native_tsrx_return_template_node(node.consequent) ||
			get_native_tsrx_return_template_node(node.alternate)
		);
	}
	return null;
}

/**
 * Whether an object pattern has a top-level rest element.
 * @param {AST.Pattern} pattern
 * @returns {boolean}
 */
function has_rest_property(pattern) {
	return (
		pattern.type === 'ObjectPattern' &&
		pattern.properties.some((property) => property.type === 'RestElement')
	);
}

/**
 * A boxed `let` (see `box_declarator` in the analyzer): the variable holds a
 * `{ v }` box so module-level code the transform hoists can capture it and
 * still read and write its current value; every access goes through `.v`.
 * @param {AST.VariableDeclarator} declarator the visited declarator
 * @returns {AST.VariableDeclarator}
 */
function box_declarator(declarator) {
	return {
		...declarator,
		init: b.object([b.prop('init', b.id('v'), declarator.init ?? b.void0)]),
	};
}

/**
 * Boxes the written names of a `let` pattern: each is renamed inside the
 * pattern and declared as its box right after it, so `let { a: [first] } = x`
 * with `first` boxed becomes `let { a: [first_1] } = x, first = { v: first_1 }`.
 * JavaScript keeps doing the destructuring, defaults and rest included.
 * @param {AST.VariableDeclarator} declarator the visited declarator
 * @param {string[]} names
 * @param {TransformClientContext} context
 * @returns {AST.VariableDeclarator[]}
 */
function box_pattern_names(declarator, names, context) {
	/** @type {Map<string, AST.Identifier>} */
	const renamed = new Map();
	for (const name of names) {
		renamed.set(name, b.id(context.state.scope.generate(name)));
	}
	/**
	 * @template {AST.Node} T
	 * @param {T} node
	 * @returns {T}
	 */
	const rename = (node) => {
		switch (node.type) {
			case 'Identifier': {
				const fresh = renamed.get(node.name);
				return fresh === undefined ? node : /** @type {T} */ (/** @type {AST.Node} */ (fresh));
			}
			case 'AssignmentPattern':
				return { ...node, left: rename(node.left) };
			case 'RestElement':
				return { ...node, argument: rename(node.argument) };
			case 'ObjectPattern':
				return {
					...node,
					properties: node.properties.map((property) =>
						property.type === 'RestElement'
							? rename(property)
							: { ...property, value: rename(property.value), shorthand: false },
					),
				};
			case 'ArrayPattern':
				return {
					...node,
					elements: node.elements.map((element) => (element === null ? null : rename(element))),
				};
			default:
				return node;
		}
	};
	/** @type {AST.VariableDeclarator[]} */
	const declarators = [{ ...declarator, id: rename(declarator.id) }];
	for (const [name, fresh] of renamed) {
		declarators.push(b.declarator(b.id(name), b.object([b.prop('init', b.id('v'), fresh)])));
	}
	return declarators;
}

/**
 * The statements that rebox the boxed function declarations of a statement
 * list, first thing in it (`f = { v: f }`): the declarations are hoisted, so
 * the box holds the function before any statement can read the name.
 * @param {AST.Node[]} statements the source statements
 * @returns {AST.Statement[]}
 */
function box_declaration_statements(statements) {
	/** @type {AST.Statement[]} */
	const boxes = [];
	for (const statement of statements) {
		if (
			statement.type === 'FunctionDeclaration' &&
			statement.id &&
			/** @type {any} */ (statement.metadata)?.boxed_declaration
		) {
			const name = statement.id.name;
			boxes.push(
				b.stmt(b.assignment('=', b.id(name), b.object([b.prop('init', b.id('v'), b.id(name))]))),
			);
		}
	}
	return boxes;
}

/**
 * The statements that turn a function's or catch clause's boxed parameters
 * into their boxes, first thing in the body: `mode = { v: mode }`.
 * @param {AST.Function | AST.CatchClause} node
 * @returns {AST.Statement[]}
 */
function box_param_statements(node) {
	/** @type {string[] | undefined} */
	const boxed = /** @type {any} */ (node.metadata)?.boxed_params;
	if (!boxed) return [];
	return boxed.map((name) =>
		b.stmt(b.assignment('=', b.id(name), b.object([b.prop('init', b.id('v'), b.id(name))]))),
	);
}

/**
 * Whether a compiled render body reads `this` or `arguments` of the function
 * that contains it (through arrows only; a nested `function` has its own).
 * @param {AST.Node} node
 * @returns {boolean}
 */
function references_function_scope(node) {
	let found = false;
	walk(node, null, {
		_(node, { next }) {
			if (found) return;
			if (
				node.type === 'ThisExpression' ||
				(node.type === 'Identifier' && node.name === 'arguments')
			) {
				found = true;
				return;
			}
			if (node.type === 'FunctionExpression' || node.type === 'FunctionDeclaration') {
				return;
			}
			next();
		},
	});
	return found;
}

/**
 * @param {AST.FunctionDeclaration | AST.FunctionExpression | AST.ArrowFunctionExpression} node
 * @param {TransformClientContext} context
 * @returns {AST.Function | AST.Expression | AST.EmptyStatement}
 */
function transform_native_tsrx_function(node, context) {
	node.metadata.native_tsrx_function = true;
	const metadata = {};
	const is_tsrx_element = context.state.is_tsrx_element;

	if (context.state.to_ts) {
		const body =
			node.body?.type === 'BlockStatement'
				? /** @type {AST.BlockStatement} */ (
						context.visit(node.body, { ...context.state, component: node, metadata })
					)
				: /** @type {AST.Expression} */ (
						context.visit(node.body, { ...context.state, component: node, metadata })
					);
		const params = node.params.map(
			(param) =>
				/** @type {AST.Pattern} */ (
					context.visit(param, { ...context.state, component: node, metadata })
				),
		);
		if (node.type === 'ArrowFunctionExpression') {
			return { ...node, params, body };
		}
		return { ...node, params, body: /** @type {AST.BlockStatement} */ (body) };
	}

	/** @type {AST.Pattern} */
	let props = b.id('__props');

	if (node.params.length > 0) {
		let props_param = node.params[0];

		if (props_param.type === 'Identifier') {
			props = props_param.typeAnnotation
				? /** @type {AST.Pattern} */ ({ ...props_param, typeAnnotation: undefined })
				: props_param;
		} else if (props_param.type === 'ObjectPattern' || props_param.type === 'ArrayPattern') {
			props = /** @type {AST.Pattern} */ (
				props_param.typeAnnotation ? { ...props_param, typeAnnotation: undefined } : props_param
			);
		} else {
			props = props_param;
		}
	}

	const render_scope_node = get_native_tsrx_return_template_node(
		node.body,
		node.type === 'ArrowFunctionExpression' && node.body?.type !== 'BlockStatement',
	);
	const component_scope =
		(render_scope_node && context.state.scopes.get(render_scope_node)) ||
		context.state.scopes.get(node) ||
		context.state.scope;
	const node_id = node.type !== 'ArrowFunctionExpression' ? (node.id ?? null) : null;
	const is_synthetic_children = node.metadata?.synthetic_children === true;
	const raw_render_body = get_native_tsrx_function_body(node, context.state.scopes);
	// `<style ref>` class maps of the scopes inside this function (see
	// `style-scopes.js`) are assigned before the template renders.
	const style_ref_setup = node.metadata.tsrx_style_ref_statements ?? [];
	const render_body = strip_tsrx_style_elements(
		insert_style_ref_setup_statements(raw_render_body, style_ref_setup, context.state.scopes),
		context.state.scopes,
	);
	const transformed_body = transform_body(render_body, {
		...context,
		state: {
			...context.state,
			flush_node: null,
			// A synthetic children render arrow is itself a tsrx_element render
			// context, so it inherits the enclosing component. When the enclosing
			// function is a `function C() { return <jsx> }` component (transformed
			// via the generic function path, which never sets `component`), there is
			// no component to inherit. Fall back to this arrow as the component
			// boundary so directive-branch elements in statement position are not
			// misread as out-of-component template statements and double-wrapped.
			component: is_synthetic_children ? (context.state.component ?? node) : node,
			metadata,
			scope: component_scope,
			is_tsrx_element: false,
			regular_js: false,
		},
	});

	const value_params = [...node.params];
	if (value_params.length > 0) {
		value_params[0] = props;
	}
	const params = is_tsrx_element ? [b.id('__anchor'), b.id('__block')] : value_params;
	const render_block = b.block([...box_param_statements(node), ...transformed_body]);
	/** @type {AST.BlockStatement} */
	let component_body;
	if (is_tsrx_element) {
		component_body = render_block;
	} else if (
		node.type === 'FunctionDeclaration' &&
		node_id &&
		!node.async &&
		!node.generator &&
		!is_synthetic_children &&
		node.params.length <= 1 &&
		context.path.every(
			(ancestor) =>
				ancestor.type === 'Program' ||
				ancestor.type === 'ExportNamedDeclaration' ||
				ancestor.type === 'ExportDefaultDeclaration',
		) &&
		!references_function_scope(render_block)
	) {
		// A module-level component: its render body sees only its props and
		// module bindings, so it is a module-level function that receives the
		// props from the element instead of a closure created per instantiation.
		// A destructuring parameter destructures in the render function's own
		// signature; the component then takes the props object under `__props`.
		const render_id = b.id(context.state.scope.generate(node_id.name + '_render'));
		register_hoisted(context.state.hoisted, render_id.name);
		/** @type {AST.Pattern[]} */
		const render_params = [b.id('__anchor'), b.id('__block')];
		const component_props = props.type === 'Identifier' ? props : b.id('__props');
		if (node.params.length === 1) {
			render_params.push(props);
			params[0] = component_props;
		}
		context.state.hoisted.push(
			b.function_declaration(render_id, render_params, render_block),
			// `render_component` calls the render function directly through this
			// symbol-keyed reference (both declarations are hoisted, so the
			// assignment may precede them in the module body).
			b.stmt(
				b.assignment('=', b.member(node_id, b.member(b.id('_$_'), b.id('$r')), true), render_id),
			),
		);
		component_body = b.block([
			b.return(
				b.call(
					'_$_.tsrx_element',
					render_id,
					...(node.params.length === 1 ? [component_props] : []),
				),
			),
		]);
	} else {
		component_body = b.block([
			b.return(
				b.call('_$_.tsrx_element', b.arrow([b.id('__anchor'), b.id('__block')], render_block)),
			),
		]);
	}
	const func =
		node.type === 'FunctionDeclaration' && node_id
			? b.function(node_id, params, component_body)
			: node.type === 'ArrowFunctionExpression'
				? b.arrow(params, component_body)
				: b.function(node_id, params, component_body);

	func.metadata.native_tsrx_function = true;

	return func;
}

/**
 * @param {ESTreeJSX.JSXElement} node
 * @param {number} index
 * @param {TransformClientContext} context
 */
function visit_head_element(node, index, context) {
	const { state, visit } = context;

	/** @type {TransformClientState['init']} */
	const init = [];
	/** @type {TransformClientState['update']} */
	const update = [];
	/** @type {TransformClientState['final']} */
	const final = [];
	/** @type {TransformClientState['template']} */
	const template = [];

	transform_children(
		/** @type {AST.Node[]} */ (node.children),
		/** @type {VisitorClientContext} */ ({
			visit,
			state: { ...state, init, update, final, template, inside_head: true },
			root: true,
		}),
	);

	if (init.length > 0 || update.length > 0 || final.length > 0) {
		// Generate a hash for this head element based on filename and index
		// Use both filename and index to ensure uniqueness across multiple head blocks
		const hash_source = `${state.filename}:head:${index}:${node.start ?? 0}`;
		const hash_value = strong_hash(hash_source);

		context.state.init?.push(
			b.stmt(
				b.call(
					'_$_.head',
					b.literal(hash_value),
					b.arrow(
						[b.id('__anchor')],
						b.block([
							...init,
							.../** @type {AST.Statement[]} */ (update.map((u) => u.operation())),
							...final,
						]),
					),
				),
			),
		);
	}
}

/**
 * Emits a render block. Its function lives at module level when the body's
 * captured locals can travel on the block state (`{ _name: name }`, read as
 * `__prev._name`), so instantiating the component allocates the state object
 * only, not a closure and its context.
 * @param {NonNullable<TransformClientState['init']>} init
 * @param {AST.Statement[]} body
 * @param {AST.Property[]} initial the state object's properties
 * @param {TransformClientState} state
 */
function emit_render_block(init, body, initial, state) {
	const fn = b.arrow([b.id('__prev')], b.block(body));
	const captures = state.to_ts
		? null
		: (captured_locals([fn], state.scope, state.hoisted)?.captures ?? null);

	if (captures === null) {
		init.push(
			b.stmt(
				b.call(
					'_$_.render',
					initial.length === 0 ? b.thunk(b.block(body)) : fn,
					...(initial.length === 0 ? [] : [b.object(initial)]),
				),
			),
		);
		return;
	}

	const hoisted = state.hoisted;
	const id = b.id(state.scope.generate('render'));
	// Captured locals ride on the state under positional keys (`_a`, `_b`,
	// …): the `_` keeps them apart from the value keys, and the key of each
	// name is remembered on its property for the item-slot rename.
	const captured = new Map(captures.map((name, index) => [name, '_' + capture_key(index)]));
	const hoisted_fn = rewrite(
		fn,
		(name) => {
			const key = captured.get(name);
			return key === undefined ? null : b.member(b.id('__prev'), b.id(key));
		},
		new Set(),
	);
	hoisted.push(
		b.function_declaration(
			id,
			hoisted_fn.params,
			/** @type {AST.BlockStatement} */ (hoisted_fn.body),
		),
	);
	register_hoisted(hoisted, id.name);
	const properties = [
		...initial,
		...captures.map((name) => {
			const property = b.prop('init', b.id(/** @type {string} */ (captured.get(name))), b.id(name));
			/** @type {any} */ (property).metadata = { capture: name };
			return property;
		}),
	];
	init.push(
		b.stmt(b.call('_$_.render', id, ...(properties.length === 0 ? [] : [b.object(properties)]))),
	);
}

/**
 * @param {NonNullable<TransformClientState['init']>} init
 * @param {NonNullable<TransformClientState['update']>} update
 * @param {TransformClientState} state
 */
function apply_updates(init, update, state) {
	// A compared update keeps its last value in the block state even when it
	// is alone, so setters never cache on the DOM node.
	if (update.length === 1 && !update[0].needsPrevTracking && !update[0].initial) {
		emit_render_block(
			init,
			update.map((u) => u.operation()),
			[],
			state,
		);
	} else {
		/** @type {AST.Property[]} */
		const initial = [];
		/** @type {AST.Statement[]} */
		const render_statements = [];
		let index = 0;

		/**
			@type {
				Map<
					AST.Identifier | AST.Expression,
					RequiredPresent<
						NonNullable<TransformClientState['update']>[number],
						'initial' | 'identity' | 'expression'
					>[]
				>
			}
		 */
		const grouped_updates = new Map();

		for (const u of update) {
			if (u.initial) {
				const id = /** @type {AST.Identifier | AST.Expression} */ (
					u.identity.type === 'Identifier'
						? /** @type {Binding} */ (state.scope.get(u.identity.name)).node
						: u.identity
				);
				let updates = grouped_updates.get(id);

				if (updates === undefined) {
					updates = [];
					grouped_updates.set(id, updates);
				}
				updates.push(u);
			}
		}

		for (const [, updates] of grouped_updates) {
			if (updates.length === 1) {
				const u = updates[0];
				const key = index_to_key(index);
				initial.push(b.prop('init', b.id(key), u.initial));
				if ('unguarded' in u && u.unguarded === true) {
					// The operation compares for itself and keeps the slot.
					render_statements.push(u.operation(u.expression, b.member(b.id('__prev'), b.id(key))));
					index++;
					continue;
				}
				render_statements.push(
					b.var('__' + key, u.expression),
					b.if(
						b.binary('!==', b.member(b.id('__prev'), b.id(key)), b.id('__' + key)),
						b.block(
							u.needsPrevTracking
								? [
										u.operation(b.id('__' + key), b.member(b.id('__prev'), b.id(key))),
										b.stmt(
											b.assignment('=', b.member(b.id('__prev'), b.id(key)), b.id('__' + key)),
										),
									]
								: [
										u.operation(
											b.assignment('=', b.member(b.id('__prev'), b.id(key)), b.id('__' + key)),
										),
									],
						),
					),
				);
				index++;
			} else {
				const key = index_to_key(index);
				/** @type {Array<AST.Statement>} */
				const if_body = [];
				initial.push(b.prop('init', b.id(key), updates[0].initial));
				render_statements.push(
					b.var('__' + key, updates[0].expression),
					b.if(
						b.binary('!==', b.member(b.id('__prev'), b.id(key)), b.id('__' + key)),
						b.block(if_body),
					),
				);
				for (const u of updates) {
					if_body.push(
						u.needsPrevTracking
							? u.operation(b.id('__' + key), b.member(b.id('__prev'), b.id(key)))
							: u.operation(b.id('__' + key)),
					);
					index++;
				}
				// Update prev after all operations
				if_body.push(
					b.stmt(b.assignment('=', b.member(b.id('__prev'), b.id(key)), b.id('__' + key))),
				);
			}
		}

		for (const u of update) {
			if (!u.initial && !u.needsPrevTracking) {
				render_statements.push(u.operation());
			}
		}

		hoist_repeated_tracked_reads(render_statements, state);

		emit_render_block(init, render_statements, initial, state);
	}
}

/**
 * Whether a compiled condition reads a tracked value through `_$_.get`.
 * @param {AST.Node} node
 * @returns {boolean}
 */
function reads_tracked_item(node) {
	let found = false;
	walk(node, null, {
		CallExpression(call, { next }) {
			if (get_tracked_read_name(call) !== null) {
				found = true;
				return;
			}
			next();
		},
	});
	return found;
}

/**
 * @param {AST.Node} node
 * @returns {string | null} the identifier read by a `_$_.get(identifier)` call
 */
function get_tracked_read_name(node) {
	if (node.type !== 'CallExpression' || node.arguments.length !== 1) {
		return null;
	}
	const callee = node.callee;
	// The builder emits `_$_.get` either as a dotted identifier or a member.
	const is_get =
		(callee.type === 'Identifier' && callee.name === '_$_.get') ||
		(callee.type === 'MemberExpression' &&
			callee.object.type === 'Identifier' &&
			callee.object.name === '_$_' &&
			callee.property.type === 'Identifier' &&
			callee.property.name === 'get');
	const argument = node.arguments[0];
	return is_get && argument.type === 'Identifier' ? argument.name : null;
}

/**
 * A grouped render reads the same tracked identifier (typically a `@for`
 * item) once per update it appears in. Where the render body reads it
 * unconditionally anyway, read it once up front and reuse the value. Reads
 * inside nested functions keep their own subscription and are left alone; an
 * identifier read only on a conditional path (a ternary branch, the right
 * side of `&&` / `||`) is not hoisted, since the read may be guarded — for
 * example against a pending `trackAsync` value.
 * @param {AST.Statement[]} statements
 * @param {TransformClientState} state
 */
function hoist_repeated_tracked_reads(statements, state) {
	/** @type {Map<string, { unconditional: number; total: number }>} */
	const counts = new Map();

	/**
	 * The key of a read the render body may hoist: a `_$_.get(x)` call, or the
	 * `.value` of a parameter (a tracked or derived prop) or of a const made
	 * by a call (`track(…)`), unwrapped as often as the template reads it.
	 * The key of a `.value` read carries a suffix no identifier has.
	 * @param {AST.Node} node
	 * @returns {string | null}
	 */
	const read_key = (node) => {
		const name = get_tracked_read_name(node);
		if (name !== null) return name;
		if (
			node.type === 'MemberExpression' &&
			!node.computed &&
			!node.optional &&
			node.object.type === 'Identifier' &&
			node.property.type === 'Identifier' &&
			node.property.name === 'value'
		) {
			const binding = state.scope.get(node.object.name);
			if (
				binding !== null &&
				(binding.declaration_kind === 'param' ||
					(binding.declaration_kind === 'const' && binding.initial?.type === 'CallExpression'))
			) {
				return node.object.name + '.value';
			}
		}
		return null;
	};

	/** @type {Visitors<AST.Node, { conditional: boolean }>} */
	const counting_visitors = {
		_(node, { state, next }) {
			const name = read_key(node);
			if (name !== null) {
				let count = counts.get(name);
				if (count === undefined) {
					count = { unconditional: 0, total: 0 };
					counts.set(name, count);
				}
				count.total += 1;
				if (!state.conditional) count.unconditional += 1;
				return;
			}
			next();
		},
		ConditionalExpression(node, { state, visit }) {
			visit(node.test, state);
			visit(node.consequent, { conditional: true });
			visit(node.alternate, { conditional: true });
		},
		LogicalExpression(node, { state, visit }) {
			visit(node.left, state);
			visit(node.right, { conditional: true });
		},
		IfStatement(node, { state, visit }) {
			visit(node.test, state);
			visit(node.consequent, { conditional: true });
			if (node.alternate) visit(node.alternate, { conditional: true });
		},
		// A written `.value` is not a read; the render body never writes one,
		// but the rule is kept explicit.
		AssignmentExpression(node, { state, visit }) {
			visit(node.right, state);
		},
		UpdateExpression() {},
		ArrowFunctionExpression() {},
		FunctionExpression() {},
		FunctionDeclaration() {},
	};

	for (const statement of statements) {
		walk(statement, { conditional: false }, counting_visitors);
	}

	/** @type {Map<string, AST.Identifier>} */
	const hoisted = new Map();
	for (const [name, count] of counts) {
		if (count.total > 1 && count.unconditional > 0) {
			hoisted.set(name, b.id(state.scope.generate('__' + name.replace('.', '_'))));
		}
	}
	if (hoisted.size === 0) {
		return;
	}

	/** @type {Visitors<AST.Node, null>} */
	const replacing_visitors = {
		_(node, { next }) {
			const name = read_key(node);
			if (name !== null) {
				const id = hoisted.get(name);
				return id === undefined ? node : id;
			}
			return next();
		},
		AssignmentExpression(node, { next }) {
			// The left side stays as written.
			const right = /** @type {AST.Expression} */ (
				walk(/** @type {AST.Node} */ (node.right), null, replacing_visitors)
			);
			return right === node.right ? node : { ...node, right };
		},
		UpdateExpression(node) {
			return node;
		},
		ArrowFunctionExpression(node) {
			return node;
		},
		FunctionExpression(node) {
			return node;
		},
		FunctionDeclaration(node) {
			return node;
		},
	};

	for (let i = 0; i < statements.length; i++) {
		statements[i] = /** @type {AST.Statement} */ (walk(statements[i], null, replacing_visitors));
	}

	const declarations = [];
	for (const [name, id] of hoisted) {
		declarations.push(
			b.var(
				id,
				name.endsWith('.value')
					? b.member(b.id(name.slice(0, -'.value'.length)), 'value')
					: b.call('_$_.get', b.id(name)),
			),
		);
	}
	statements.unshift(...declarations);
}

/**
 * @param {ESTreeJSX.JSXElement} node
 * @param {TransformClientContext} context
 */
function visit_title_element(node, context) {
	const normalized = normalize_children(/** @type {AST.Node[]} */ (node.children), context);
	const content = /** @type {ESTreeJSX.JSXText | ESTreeJSX.JSXExpressionContainer} */ (
		normalized[0]
	);

	const metadata = { tracking: false };
	const result = /** @type {AST.Expression} */ (
		context.visit(get_template_expression(content, !!context.state.to_ts), {
			...context.state,
			metadata,
		})
	);

	if (metadata.tracking) {
		context.state.init?.push(
			b.stmt(
				b.call(
					'_$_.render',
					b.thunk(b.block([b.stmt(b.assignment('=', b.id('_$_.document.title'), result))])),
				),
			),
		);
	} else {
		context.state.init?.push(b.stmt(b.assignment('=', b.id('_$_.document.title'), result)));
	}
}

/**
 * @param {string} name
 * @param {TransformClientContext} context
 * @param {boolean} [is_obfuscated]
 * @returns {string}
 */
function set_hidden_import_from_ripple(name, context, is_obfuscated = false) {
	if (!is_obfuscated) {
		name = obfuscateIdentifier(name);
	}
	if (!context.state.imports.has(`import { ${name} } from 'ripple/compiler/internal/import'`)) {
		context.state.imports.add(`import { ${name} } from 'ripple/compiler/internal/import'`);
	}

	return name;
}

/**
 * @param {ESTreeJSX.JSXExpressionContainer | AST.Expression} source_argument
 * @param {VisitorClientContext} context
 * @returns {AST.CallExpression}
 */
function create_ref_value_call(source_argument, context) {
	const { state, visit } = context;
	const metadata = { tracking: false };
	const source =
		source_argument.type === 'JSXExpressionContainer'
			? source_argument.expression
			: source_argument;
	let argument;
	let add_setter = true;

	if (source.type === 'ArrayExpression') {
		argument = b.array(
			source.elements.map((/** @type {AST.Expression | AST.SpreadElement | null} */ element) => {
				if (element === null) {
					return null;
				}
				if (element.type === 'SpreadElement') {
					return b.spread(
						/** @type {AST.Expression} */ (
							visit(element.argument, { ...state, flush_node: null, metadata })
						),
					);
				}
				return create_ref_value_call(element, context);
			}),
		);
		add_setter = false;
	} else {
		argument = /** @type {AST.Expression} */ (
			visit(source, { ...state, flush_node: null, metadata })
		);
	}

	/** @type {AST.Expression[]} */
	const args = [b.thunk(argument)];
	if (add_setter) {
		add_ref_setter_arg(args, source, argument);
	}

	const call = b.call(
		state.to_ts ? set_hidden_import_from_ripple('createRefProp', context) : '_$_.create_ref_prop',
		...args,
	);
	if (state.to_ts && state.ref_target_type) {
		call.typeArguments = b.ts_type_parameter_instantiation([state.ref_target_type]);
	}
	return call;
}

/**
 * @param {AST.TSRXJSXElement} node
 * @param {TransformClientState} state
 * @returns {AST.TypeNode | null}
 */
function create_element_ref_target_type(node, state) {
	if (!is_element_dom_element(node)) {
		return null;
	}
	const element_name = /** @type {AST.Identifier} */ (get_element_id(node)).name;
	const namespace =
		element_name === 'svg' ? 'svg' : element_name === 'math' ? 'mathml' : state.namespace;
	return create_element_ref_target_type_for_name(element_name, namespace);
}

/**
 * @param {ESTreeJSX.JSXExpressionContainer | AST.Expression} source_argument
 * @returns {AST.Expression}
 */
function get_ref_source_argument(source_argument) {
	return source_argument.type === 'JSXExpressionContainer'
		? /** @type {AST.Expression} */ (source_argument.expression)
		: source_argument;
}

/**
 * @param {AST.Expression[]} args
 * @param {ESTreeJSX.JSXExpressionContainer | AST.Expression} source_argument
 * @param {AST.Expression} argument
 * @returns {void}
 */
function add_ref_setter_arg(args, source_argument, argument) {
	const source =
		source_argument.type === 'JSXExpressionContainer'
			? source_argument.expression
			: source_argument;
	const arg_type = source?.type;

	if (arg_type === 'Identifier' || arg_type === 'MemberExpression') {
		args.push(
			b.arrow(
				[b.id('v')],
				b.assignment('=', /** @type {AST.Pattern} */ (clone_ast_node(argument, false)), b.id('v')),
			),
		);
	}
}

/**
 * @param {AST.NodeWithLocation} loc_info
 * @param {number} [start_offset]
 * @param {number} [length]
 * @returns {AST.NodeWithLocation}
 */
function slice_loc_info(loc_info, start_offset = 0, length) {
	if (length === undefined) {
		length = loc_info.end - loc_info.start - start_offset;
	}
	return {
		start: loc_info.start + start_offset,
		end: loc_info.start + start_offset + length,
		loc: {
			start: {
				line: loc_info.loc.start.line,
				column: loc_info.loc.start.column + start_offset,
			},
			end: {
				line: loc_info.loc.start.line,
				column: loc_info.loc.start.column + start_offset + length,
			},
		},
	};
}

/**
 * @param {string | undefined} name
 * @returns {boolean}
 */
function ripple_namespace_requires_block(name) {
	return name !== undefined && ripple_import_requires_block(name);
}

/**
 * @param {AST.TSRXJSXElement} node
 * @param {TransformClientContext | VisitorClientContext} context
 * @returns {boolean}
 */
function is_ripple_fragment_element(node, context) {
	const id = get_element_id(node);
	if (id.type === 'Identifier') {
		return id.name === 'Fragment' && is_ripple_import(id, context);
	}

	return (
		id.type === 'MemberExpression' &&
		id.property.type === 'Identifier' &&
		id.property.name === 'Fragment' &&
		is_ripple_import(id, context)
	);
}

/**
 * @param {ESTreeJSX.JSXElement | AST.TSRXJSXElement} node
 * @returns {ESTreeJSX.JSXAttribute | null}
 */
function get_inner_html_attribute(node) {
	for (const attr of get_element_attributes(node)) {
		if (attr.type === 'JSXAttribute' && get_attribute_name(attr) === 'innerHTML') {
			return attr;
		}
	}

	return null;
}

/**
 * @param {ESTreeJSX.JSXAttribute} attr
 * @param {VisitorClientContext} context
 * @returns {AST.Expression}
 */
function get_attribute_value_expression(attr, context) {
	const value = get_attribute_value(attr);
	if (value === null) {
		return b.literal('');
	}

	return /** @type {AST.Expression} */ (
		context.visit(value, {
			...context.state,
			flush_node: null,
			metadata: { tracking: false },
		})
	);
}

/**
 * @param {AST.Expression} expression
 * @param {AST.Identifier} id
 * @returns {AST.Expression}
 */
function normalize_inner_html_expression(expression, id) {
	return b.logical('??', expression, b.member(id, 'innerHTML'));
}

/**
 * @param {ESTreeJSX.JSXElement | AST.TSRXJSXElement} node
 * @param {VisitorClientContext} context
 * @returns {void}
 */
function visit_ripple_fragment_element(node, context) {
	const { state, visit } = context;
	const inner_html = get_inner_html_attribute(node);

	if (inner_html !== null) {
		state.template?.push('<!>');
		const id = state.flush_node?.(false);
		const expression = get_attribute_value_expression(inner_html, context);

		state.update?.push({
			operation: () =>
				b.stmt(
					b.call(
						'_$_.html',
						id,
						b.thunk(expression),
						state.namespace === 'svg' && b.true,
						state.namespace === 'mathml' && b.true,
					),
				),
		});
		return;
	}

	transform_children(
		/** @type {AST.Node[]} */ (node.children),
		/** @type {VisitorClientContext} */ ({
			visit,
			state,
			root: false,
		}),
	);
}

/**
 * @param {TransformClientContext} context
 * @param {Partial<TransformClientState>} [more_state]
 * @return TransformClientContext
 */
function SetContextForOutsideComponent(context, more_state = {}) {
	return /** @type {TransformClientContext} */ ({
		...context,
		state: SetStateForOutsideComponent(context.state, more_state),
	});
}

/**
 * @param {TransformClientState} state
 * @param {Partial<TransformClientState>} [more_state]
 * @return TransformClientState
 */
function SetStateForOutsideComponent(state, more_state = {}) {
	return /** @type {TransformClientState} */ ({
		...state,
		...more_state,
		init: null,
		update: null,
		final: null,
	});
}

/**
 * Whether anything reads a `@for` directive's `index` binding. An index nothing
 * reads needs no tracked value per item.
 * @param {AST.ForOfStatement | AST.JSXForOfExpression} node
 * @param {TransformClientContext} context
 * @returns {boolean}
 */
function is_index_read(node, context) {
	const index = /** @type {AST.Identifier} */ (node.index);
	const scope = /** @type {ScopeInterface | undefined} */ (context.state.scopes.get(node));
	const binding = scope?.get(index.name);

	if (!binding) {
		return true;
	}

	// The declaration itself is collected as a reference; only other sites count.
	return binding.references.some(
		(reference) => reference.node.start !== index.start || reference.node.end !== index.end,
	);
}

/**
 * @param {AST.TSRXJSXElement | AST.TSRXJSXFragment} node
 * @param {TransformClientContext} context
 * @returns {AST.CallExpression}
 */
function build_jsx_to_tsrx_element(node, context) {
	const { state, visit, path } = context;
	const result = adopt_raw_template_jsx(/** @type {AST.Node} */ (node));
	const converted = Array.isArray(result) ? result : [result];
	/** @type {AST.Node[]} */
	const children = converted.filter((child) => child != null && child.type !== 'EmptyStatement');

	const children_component = create_native_tsrx_render_function(
		[],
		children,
		/** @type {AST.Node} */ (node),
	);

	return b.call(
		'_$_.tsrx_element',
		/** @type {AST.Expression} */ (
			visit(children_component, {
				...state,
				flush_node: null,
				regular_js: false,
				namespace: state.namespace,
				is_tsrx_element: true,
				jsx_to_tsrx_element: true,
			})
		),
	);
}

/**
 * How hoisted control-flow functions receive the locals they capture through
 * the runtime's single context argument: one local as itself, several as one
 * object literal built at the call (`{ a: depth, b: path }`, the values at that
 * moment). Each hoisted signature takes apart only the locals its function
 * reads, under the names it was written with, so a branch may declare a local
 * named like one its condition or a sibling branch reads.
 * @param {string[]} captures
 * @returns {{ args: AST.Expression[]; params: (reads: Set<string>) => AST.Pattern[] }}
 */
function capture_context(captures) {
	if (captures.length <= 1) {
		return {
			args: captures.map((name) => b.id(name)),
			params: (reads) => captures.filter((name) => reads.has(name)).map((name) => b.id(name)),
		};
	}
	// The keys are positional (`a`, `b`, …): the object is built at the call
	// and taken apart in the signatures, so the names it carries are never
	// read, and short keys keep both sites small.
	return {
		args: [
			b.object(captures.map((name, index) => b.prop('init', b.id(capture_key(index)), b.id(name)))),
		],
		params: (reads) => {
			const pattern = captures.flatMap((name, index) =>
				reads.has(name) ? [b.assignment_prop(b.id(capture_key(index)), b.id(name))] : [],
			);
			return pattern.length === 0 ? [] : [b.object_pattern(pattern)];
		},
	};
}

/**
 * The key of the `index`th captured local: `a`…`z`, then `aa`, `ab`, ….
 * @param {number} index
 * @returns {string}
 */
function capture_key(index) {
	let key = '';
	do {
		key = String.fromCharCode(97 + (index % 26)) + key;
		index = Math.floor(index / 26) - 1;
	} while (index >= 0);
	return key;
}

/**
 * Shared by the plain statement and the `@`-directive forms.
 * @type {Visitor<AST.SwitchStatement | AST.JSXSwitchExpression, TransformClientState, AST.Node>}
 */
const visit_switch_statement = (node, context) => {
	if (context.state.regular_js) {
		return context.next();
	}

	if (!is_inside_component(context)) {
		if (context.state.to_ts) {
			return transform_ts_child(node, SetContextForOutsideComponent(context));
		}

		return context.next();
	}

	const root_controlled = node.metadata?.root_controlled === true;
	if (!root_controlled) {
		context.state.template?.push('<!>');
	}

	const id = root_controlled ? b.id('__anchor') : context.state.flush_node?.();
	/** @type {{ id: AST.Identifier; body: AST.BlockStatement }[]} */
	const branches = [];
	/** @type {AST.SwitchCase[]} */
	const cases = [];

	// A `@switch` is an `@if` chain with a different selector: the callback
	// runs the JS `switch` and returns the case function to render (a `@case`
	// never falls through; an empty one renders nothing), so it shares the if
	// runtime, which probes it once and renders a static case with no block.
	let id_gen = 0;
	for (const switch_case of node.cases) {
		const consequent = switch_case.consequent;
		/** @type {AST.Statement[]} */
		const case_body = [];

		if (consequent.length !== 0) {
			const flattened_consequent = flatten_switch_consequent(consequent);
			const consequent_scope = context.state.scopes.get(switch_case) || context.state.scope;
			const block = b.block(
				transform_body(flattened_consequent, {
					...context,
					state: { ...context.state, scope: consequent_scope, flush_node: null },
				}),
			);
			const is_default = switch_case.test == null;
			const case_id = context.state.scope.generate(
				'switch_case_' + (is_default ? 'default' : id_gen),
			);
			branches.push({ id: b.id(case_id), body: block });
			case_body.push(b.return(b.id(case_id)));
			id_gen++;
		} else {
			case_body.push(b.return());
		}

		cases.push(
			b.switch_case(
				switch_case.test ? /** @type {AST.Expression} */ (context.visit(switch_case.test)) : null,
				case_body,
			),
		);
	}

	const callback = b.block([
		b.switch(
			/** @type {AST.Expression} */ (
				context.visit(node.discriminant, {
					...context.state,
					metadata: { ...context.state.metadata },
				})
			),
			cases,
		),
	]);

	// Same hoisting as `@if`: module-level selector and cases, their captured
	// locals passed through the runtime.
	const hoisted = context.state.hoisted;
	const captured = captured_locals(
		[b.arrow([], callback), ...branches.map((branch) => b.arrow([b.id('__anchor')], branch.body))],
		context.state.scope,
		hoisted,
		branches.map((branch) => branch.id.name),
	);

	if (captured !== null) {
		const { params: context_params, args: context_args } = capture_context(captured.captures);
		const switch_id = b.id(context.state.scope.generate('switch'));
		branches.forEach((branch, index) => {
			hoisted.push(
				b.function_declaration(
					branch.id,
					[b.id('__anchor'), ...context_params(captured.reads[index + 1])],
					branch.body,
				),
			);
			register_hoisted(hoisted, branch.id.name);
		});
		hoisted.push(b.function_declaration(switch_id, context_params(captured.reads[0]), callback));
		register_hoisted(hoisted, switch_id.name);
		context.state.init?.push(
			b.stmt(
				b.call(
					'_$_.switch',
					id,
					switch_id,
					...(context_args.length > 0
						? [b.literal(root_controlled), ...context_args]
						: root_controlled
							? [b.true]
							: []),
				),
			),
		);
		return;
	}

	/** @type {AST.Statement[]} */
	const statements = [];
	for (const branch of branches) {
		statements.push(b.var(branch.id, b.arrow([b.id('__anchor')], branch.body)));
	}
	statements.push(
		b.stmt(b.call('_$_.switch', id, b.arrow([], callback), root_controlled ? b.true : undefined)),
	);

	context.state.init?.push(b.block(statements));
};

/**
 * Shared by the plain statement and the `@`-directive forms.
 * @type {Visitor<AST.IfStatement | AST.JSXIfExpression, TransformClientState, AST.Node>}
 */
const visit_if_statement = (node, context) => {
	if (context.state.regular_js || node.metadata?.regular_js) {
		return context.next({ ...context.state, regular_js: true });
	}

	if (context.state.to_ts) {
		return transform_ts_child(node, context);
	}

	if (!is_inside_component(context)) {
		return context.next();
	}

	if (
		(node.metadata?.script_only || node.metadata?.has_continue) &&
		!node.metadata?.has_template &&
		!node.alternate
	) {
		const consequent_scope =
			/** @type {ScopeInterface} */ (context.state.scopes.get(node.consequent)) ||
			context.state.scope;
		const consequent_body =
			node.consequent.type === 'BlockStatement' ? node.consequent.body : [node.consequent];
		const continue_index = find_top_level_continue_index(consequent_body);
		const consequent_statements =
			continue_index === -1
				? transform_body(consequent_body, {
						...context,
						state: { ...context.state, flush_node: null, scope: consequent_scope },
					})
				: transform_continue_consequent_body(consequent_body, {
						...context,
						state: { ...context.state, flush_node: null, scope: consequent_scope },
					});
		const consequent = b.block(consequent_statements);

		context.state.init?.push(
			b.if(
				/** @type {AST.Expression} */ (
					context.visit(node.test, {
						...context.state,
						metadata: { ...context.state.metadata },
					})
				),
				consequent,
			),
		);
		return;
	}

	const root_controlled = node.metadata?.root_controlled === true;
	// A trailing if appends into the parent (`append_after`) and one before a
	// static element sibling inserts before that element (`append_before`,
	// both see transform_children): neither needs a placeholder.
	if (
		!root_controlled &&
		node.metadata?.append_after === undefined &&
		node.metadata?.append_before !== true
	) {
		context.state.template?.push('<!>');
	}

	const id = root_controlled ? b.id('__anchor') : context.state.flush_node?.();
	/** @type {AST.Statement[]} */
	const statements = [];
	/** @type {{ id: AST.Identifier; body: AST.BlockStatement }[]} */
	const branches = [];

	/**
	 * Renders a branch body as a function and returns the statement that
	 * selects it: the condition callback returns the branch function, which
	 * identifies the branch to the runtime.
	 * @param {AST.Statement} branch
	 * @param {ScopeInterface} scope
	 * @param {string} name
	 * @returns {AST.Statement}
	 */
	const render_branch = (branch, scope, name) => {
		const body = branch.type === 'BlockStatement' ? branch.body : [branch];
		const block = b.block(
			transform_body(body, {
				...context,
				state: { ...context.state, flush_node: null, scope },
			}),
		);
		const branch_id = context.state.scope.generate(name);
		branches.push({ id: b.id(branch_id), body: block });
		return b.return(b.id(branch_id));
	};

	// Set by a condition of the chain that reads tracked state.
	const chain_metadata = { ...context.state.metadata, tracking: false };

	/**
	 * Lowers a template `@if` into the JS `if` the condition callback runs. An
	 * `@else if`, and a branch whose only statement is another `@if`, fold into
	 * the same block: their conditions are evaluated by this callback and their
	 * branches become branches of this block.
	 * @param {AST.IfStatement | AST.JSXIfExpression} if_node
	 * @param {ScopeInterface} scope
	 * @returns {AST.IfStatement}
	 */
	const lower_chain = (if_node, scope) => {
		const consequent = /** @type {AST.Statement} */ (if_node.consequent);
		const consequent_scope =
			/** @type {ScopeInterface} */ (context.state.scopes.get(consequent)) || scope;
		const nested_consequent = sole_template_if(consequent);
		const consequent_statement = nested_consequent
			? b.block([lower_chain(nested_consequent, consequent_scope)])
			: render_branch(consequent, consequent_scope, 'consequent');

		/** @type {AST.Statement | undefined} */
		let alternate_statement;
		if (if_node.alternate) {
			const alternate = /** @type {AST.Statement} */ (if_node.alternate);
			const alternate_scope =
				/** @type {ScopeInterface} */ (context.state.scopes.get(alternate)) || scope;
			const nested_alternate = is_template_if(alternate) ? alternate : sole_template_if(alternate);
			alternate_statement = nested_alternate
				? lower_chain(nested_alternate, alternate_scope)
				: render_branch(alternate, alternate_scope, 'alternate');
		}

		// The condition is a render expression of its own: inside a `@for`, an
		// `outer === item` comparison lowers to a selector lookup like one in
		// an attribute would (see `visit_selector_comparison`).
		return b.if(
			/** @type {AST.Expression} */ (
				context.visit(if_node.test, {
					...context.state,
					scope,
					metadata: chain_metadata,
					selector_root: if_node.test,
				})
			),
			consequent_statement,
			alternate_statement,
		);
	};

	const callback = b.block([lower_chain(node, context.state.scope)]);

	// The condition and its branches live at module level; the locals they
	// capture travel through the runtime's one context slot, bare when there is
	// one and as an object literal destructured in the hoisted signatures when
	// there are more (see `capture_context`), so no closures are created per
	// instantiation of the enclosing component.
	const hoisted = context.state.hoisted;
	const captured = captured_locals(
		[b.arrow([], callback), ...branches.map((branch) => b.arrow([b.id('__anchor')], branch.body))],
		context.state.scope,
		hoisted,
		branches.map((branch) => branch.id.name),
	);

	if (captured !== null) {
		const { params: context_params, args: context_args } = capture_context(captured.captures);
		const if_id = b.id(context.state.scope.generate('if'));
		branches.forEach((branch, index) => {
			hoisted.push(
				b.function_declaration(
					branch.id,
					[b.id('__anchor'), ...context_params(captured.reads[index + 1])],
					branch.body,
				),
			);
			register_hoisted(hoisted, branch.id.name);
		});
		hoisted.push(b.function_declaration(if_id, context_params(captured.reads[0]), callback));
		register_hoisted(hoisted, if_id.name);
		const context_arguments =
			context_args.length > 0
				? [b.literal(root_controlled), ...context_args]
				: root_controlled
					? [b.true]
					: [];

		// A condition that reads tracked state is evaluated by the render
		// function of the enclosing content (a list item's, an element's): the
		// if keeps a block for its branch, but not one that runs the condition,
		// so an item with an `@if` on its fields costs one block, one
		// dependency and one flush entry less. A static condition keeps the
		// probe: it renders without any block.
		if (
			chain_metadata.tracking === true &&
			context.state.update !== null &&
			!context.state.inside_head
		) {
			const state_id = b.id(context.state.scope.generate('ifs'));
			// A read of a `@for` item is a tracked read for certain; a prop may
			// hold a plain value, so the runtime probes such a condition once.
			const if_flags =
				(root_controlled ? IF_ROOT_CONTROLLED : 0) |
				(reads_tracked_item(callback) ? IF_TRACKED : 0);
			context.state.init?.push(
				b.var(
					state_id,
					b.call(
						'_$_.if_static',
						id,
						if_id,
						...(context_args.length > 0 || if_flags !== 0 ? [b.literal(if_flags)] : []),
						...context_args,
					),
				),
			);
			context.state.update.push({
				operation: (key) =>
					b.stmt(b.call('_$_.if_update', state_id, /** @type {AST.Expression} */ (key))),
				expression: b.call(if_id, ...context_args),
				identity: node.test,
				initial: b.member(b.id('_$_'), b.id('UNINITIALIZED')),
			});
			return;
		}

		context.state.init?.push(b.stmt(b.call('_$_.if', id, if_id, ...context_arguments)));
		return;
	}

	for (const branch of branches) {
		statements.push(b.var(branch.id, b.arrow([b.id('__anchor')], branch.body)));
	}
	statements.push(
		b.stmt(b.call('_$_.if', id, b.arrow([], callback), root_controlled ? b.true : undefined)),
	);

	context.state.init?.push(b.block(statements));
};

/**
 * Shared by the plain statement and the `@`-directive forms.
 * @type {Visitor<AST.TryStatement | AST.JSXTryExpression, TransformClientState, AST.Node>}
 */
const visit_try_statement = (node, context) => {
	if (context.state.regular_js) {
		return context.next();
	}

	if (!is_inside_component(context)) {
		if (context.state.to_ts) {
			return transform_ts_child(node, SetContextForOutsideComponent(context));
		}

		return context.next();
	}

	if (context.state.to_ts) {
		return transform_ts_child(node, context);
	}
	const root_controlled = node.metadata?.root_controlled === true;
	if (!root_controlled) {
		context.state.template?.push('<!>');
	}

	const id = root_controlled ? b.id('__anchor') : context.state.flush_node?.();
	const handler = /** @type {AST.CatchClause | null} */ (node.handler);
	const pending = /** @type {AST.BlockStatement | null} */ (node.pending);
	let body = transform_body(node.block.body, {
		...context,
		state: {
			...context.state,
			scope: /** @type {ScopeInterface} */ (context.state.scopes.get(node.block)),
		},
	});

	// Strip catch-param type annotations on copies embedded in the output; the
	// source handler params are never mutated.
	const handler_param = handler?.param
		? /** @type {AST.Pattern} */ ({ ...handler.param, typeAnnotation: undefined })
		: null;
	const handler_reset_param = handler?.resetParam
		? /** @type {AST.Pattern} */ ({ ...handler.resetParam, typeAnnotation: undefined })
		: null;

	const catch_arg =
		handler === null
			? b.literal(null)
			: b.arrow(
					[
						b.id('__anchor'),
						...(handler_param && handler_reset_param
							? [handler_param, handler_reset_param]
							: handler_param
								? [handler_param]
								: []),
					],
					b.block([
						...box_param_statements(handler),
						...transform_body(handler.body.body, {
							...context,
							state: {
								...context.state,
								scope: /** @type {ScopeInterface} */ (context.state.scopes.get(handler.body)),
							},
						}),
					]),
				);

	const pending_arg =
		pending === null
			? null
			: b.arrow(
					[b.id('__anchor')],
					b.block(
						transform_body(pending.body, {
							...context,
							state: {
								...context.state,
								scope: /** @type {ScopeInterface} */ (context.state.scopes.get(pending)),
							},
						}),
					),
				);

	const try_args = [id, b.arrow([b.id('__anchor')], b.block(body)), catch_arg];
	if (root_controlled) {
		// Keep pending_fn positioned (null when absent) so root_controlled lands
		// in the 5th slot.
		try_args.push(pending_arg ?? b.literal(null), b.true);
	} else if (pending_arg !== null) {
		try_args.push(pending_arg);
	}

	context.state.init?.push(b.stmt(b.call('_$_.try', ...try_args)));
};

/**
 * Shared by the plain statement and the `@`-directive forms.
 * @type {Visitor<AST.ForOfStatement | AST.JSXForOfExpression, TransformClientState, AST.Node>}
 */
const visit_for_of_statement = (node, context) => {
	if (context.state.regular_js) {
		return context.next();
	}

	if (!is_inside_component(context)) {
		return context.next();
	}
	const is_controlled = node.metadata?.is_controlled;
	const root_controlled = node.metadata?.root_controlled === true;
	const index = node.index;
	const key = node.key;
	let flags = is_controlled ? IS_CONTROLLED : 0;

	if (root_controlled) {
		flags |= ROOT_CONTROLLED;
	}

	if (index != null && is_index_read(node, context)) {
		flags |= IS_INDEXED;
	}

	if (node.metadata?.script_only && !node.metadata?.has_template) {
		const pattern =
			node.metadata?.tsrx_for_pattern_id ??
			/** @type {AST.VariableDeclaration} */ (node.left).declarations[0].id;
		const body_scope = /** @type {ScopeInterface} */ (context.state.scopes.get(node.body));
		const body = transform_body(/** @type {AST.BlockStatement} */ (node.body).body, {
			...context,
			state: {
				...context.state,
				scope: body_scope,
				namespace: context.state.namespace,
				flush_node: null,
			},
		});
		const fields = node.metadata?.tsrx_for_pattern_fields;
		if (fields) {
			// A plain loop: the item is destructured once per iteration into the
			// object of names the body reads (`_$_.get` passes a plain object through).
			body.unshift(
				b.stmt(
					b.assignment(
						'=',
						/** @type {AST.Identifier} */ (pattern),
						b.call(pattern_fields_arrow(node, fields), /** @type {AST.Identifier} */ (pattern)),
					),
				),
			);
		}

		if (index) {
			body.push(b.stmt(b.update('++', index)));
			context.state.init?.push(b.var(index, b.literal(0)));
		}

		const left = /** @type {AST.VariableDeclaration} */ (
			context.visit(/** @type {AST.Node} */ (node.left))
		);
		context.state.init?.push(
			b.for_of(
				// A keyed loop iterates the generated pattern id (see the
				// analyzer's tsrx_for_pattern_id), not the source destructuring.
				node.metadata?.tsrx_for_pattern_id
					? {
							...left,
							// Reassigned to the destructured names when the pattern has a rest or default.
							kind: fields ? 'let' : left.kind,
							declarations: [{ ...left.declarations[0], id: node.metadata.tsrx_for_pattern_id }],
						}
					: left,
				/** @type {AST.Expression} */ (context.visit(/** @type {AST.Node} */ (node.right))),
				b.block(body),
			),
		);
		return;
	}

	// A controlled list appends into its parent, a root-controlled one renders
	// before the component's anchor, and a trailing one appends into the parent
	// (`append_after`, see transform_children): none needs a placeholder.
	if (
		!is_controlled &&
		!root_controlled &&
		node.metadata?.append_after === undefined &&
		node.metadata?.append_before !== true
	) {
		context.state.template?.push('<!>');
	}

	const id = root_controlled ? b.id('__anchor') : context.state.flush_node?.(false, is_controlled);
	const pattern =
		node.metadata?.tsrx_for_pattern_id ??
		/** @type {AST.VariableDeclaration} */ (node.left).declarations[0].id;
	const body_scope = /** @type {ScopeInterface} */ (context.state.scopes.get(node.body));
	const body_nodes = /** @type {AST.BlockStatement} */ (node.body).body;
	const selector_for = create_selector_for_state(node, body_scope, context.state);
	/** @type {AST.Statement[]} */
	const body = transform_body(body_nodes, {
		...context,
		state: {
			...context.state,
			scope: body_scope,
			namespace: context.state.namespace,
			flush_node: null,
			selector_for,
		},
	});
	const fields = node.metadata?.tsrx_for_pattern_fields;

	// An item body whose updates all live in one render block carries that
	// block on the item block itself: the `_$_.render(fn, state)` call becomes
	// `_$_.item(state)`, and `fn` travels once with the list (see the
	// runtime's `item`). Only a hoisted function can: it must be shared.
	/** @type {AST.Identifier | null} */
	let update_fn = null;
	if (!context.state.to_ts) {
		const render_calls = find_render_calls(body);
		if (render_calls.length === 1) {
			const { statements, index } = render_calls[0];
			const call = /** @type {AST.CallExpression} */ (
				/** @type {AST.ExpressionStatement} */ (statements[index]).expression
			);
			if (call.arguments.length === 2 && call.arguments[0].type === 'Identifier') {
				update_fn = call.arguments[0];
				statements[index] = b.stmt(
					b.call('_$_.item', /** @type {AST.Expression} */ (call.arguments[1])),
				);
			}
		}
	}

	// A keyed item that only its update function reads (the pattern appears
	// nowhere in the body but in that function's state) is held as it is,
	// not in a tracked: the update function reads the item off its state, and
	// a replaced item re-runs the item block directly (see `LOCAL_ITEMS`).
	if (
		update_fn !== null &&
		key != null &&
		!index &&
		!fields &&
		pattern.type === 'Identifier' &&
		!reads_outside_item_state(body, pattern.name)
	) {
		flags |= LOCAL_ITEMS;
		const local = /** @type {AST.Identifier} */ (update_fn);
		const declaration = context.state.hoisted.find(
			(statement) => statement.type === 'FunctionDeclaration' && statement.id?.name === local.name,
		);
		if (declaration !== undefined) {
			const slot = rename_item_slot(find_render_calls(body)[0], pattern.name);
			if (slot !== null) {
				read_item_from_state(/** @type {AST.FunctionDeclaration} */ (declaration), slot);
			}
		}
	}

	// Selectors are created once per loop, ahead of the loop itself.
	for (const { id: selector_id, source } of selector_for.selectors) {
		context.state.init?.push(b.const(selector_id, b.call('_$_.selector', b.thunk(source))));
	}

	const empty_scope = node.empty
		? context.state.scopes.get(node.empty) || context.state.scope
		: null;
	const empty_renderer = node.empty
		? b.arrow(
				[b.id('__anchor')],
				b.block(
					transform_body(/** @type {AST.BlockStatement} */ (node.empty).body, {
						...context,
						state: {
							...context.state,
							scope: /** @type {ScopeInterface} */ (empty_scope),
							namespace: context.state.namespace,
							flush_node: null,
						},
					}),
				),
			)
		: undefined;

	// The runtime passes a keyed item's key behind the index; the body
	// receives it when a lowered comparison reads it (see `selector_for.key`).
	const render_params = index ? [b.id('__anchor'), pattern, index] : [b.id('__anchor'), pattern];
	if (selector_for.key_id !== null) {
		if (!index) render_params.push(b.id(body_scope.generate('index')));
		render_params.push(selector_for.key_id);
	}
	const for_args = [
		id,
		b.thunk(/** @type {AST.Expression} */ (context.visit(/** @type {AST.Node} */ (node.right)))),
		b.arrow(render_params, b.block(body)),
		b.literal(flags),
	];
	if (key != null) {
		if (is_identity_key(node, key, body_scope)) {
			// `key item` keys by the item itself: the runtime keys by identity
			// with no key callback, so nothing runs per item on a diff.
			if (empty_renderer) {
				for_args.push(b.void0);
			}
		} else {
			let key_expression = /** @type {AST.Expression} */ (context.visit(key));
			if (!fields) {
				// The key receives the item as the collection holds it, not the
				// item's tracked, so it reads the item directly.
				key_expression = /** @type {AST.Expression} */ (
					walk(/** @type {AST.Node} */ (key_expression), null, {
						CallExpression(call, { next }) {
							if (
								call.callee.type === 'Identifier' &&
								call.callee.name === '_$_.get' &&
								call.arguments.length === 1 &&
								call.arguments[0].type === 'Identifier' &&
								call.arguments[0].name === /** @type {AST.Identifier} */ (pattern).name
							) {
								return call.arguments[0];
							}
							next();
						},
					})
				);
			}
			if (fields) {
				// The key receives the item as the collection holds it, before the
				// runtime destructures it. A name with a member chain reads that
				// chain off the item; a name behind a rest or default destructures
				// the item inline.
				const chains = new Map(
					pattern_reads(/** @type {AST.VariableDeclaration} */ (node.left).declarations[0].id).map(
						(read) => [read.node.name, read.chain],
					),
				);
				const item = () => /** @type {AST.Identifier} */ (pattern);
				key_expression = /** @type {AST.Expression} */ (
					walk(/** @type {AST.Node} */ (key_expression), null, {
						MemberExpression(member, { next }) {
							const object = member.object;
							if (
								object.type === 'CallExpression' &&
								object.callee.type === 'Identifier' &&
								object.callee.name === '_$_.get' &&
								object.arguments[0]?.type === 'Identifier' &&
								object.arguments[0].name === /** @type {AST.Identifier} */ (pattern).name &&
								!member.computed &&
								member.property.type === 'Identifier' &&
								chains.has(member.property.name)
							) {
								const chain = chains.get(member.property.name);
								return chain
									? chain(item())
									: b.member(b.call(pattern_fields_arrow(node, fields), item()), member.property);
							}
							next();
						},
					})
				);
			}
			for_args.push(b.arrow(index ? [pattern, index] : [pattern], key_expression));
		}
	}
	if (empty_renderer) {
		for_args.push(empty_renderer);
	}
	if (fields) {
		// The runtime destructures each item once per change with the authored
		// pattern; the item's tracked then holds the object of names.
		if (!empty_renderer) {
			for_args.push(b.void0);
		}
		for_args.push(pattern_fields_arrow(node, fields));
	}
	if (update_fn !== null) {
		// After the key, empty renderer and item destructuring of a keyed list,
		// or the empty renderer of a plain one.
		const position = key != null ? 7 : 5;
		while (for_args.length < position) {
			for_args.push(b.void0);
		}
		for_args.push(update_fn);
	}

	context.state.init?.push(
		b.stmt(
			b.call(
				key != null ? '_$_.for_keyed' : '_$_.for',
				.../** @type {AST.Expression[]} */ (for_args),
			),
		),
	);
};

/**
 * Whether a compiled item body reads the loop item anywhere but as the value
 * it hands to its update function's state (`_$_.item({ _item: item })`).
 * @param {AST.Statement[]} body
 * @param {string} name
 * @returns {boolean}
 */
function reads_outside_item_state(body, name) {
	let found = false;
	walk(/** @type {AST.Node} */ (b.block(body)), null, {
		CallExpression(node, { next }) {
			if (node.callee.type === 'Identifier' && node.callee.name === '_$_.item') {
				return;
			}
			next();
		},
		Identifier(node) {
			if (node.name === name) {
				found = true;
			}
		},
	});
	return found;
}

/**
 * The slot of a local item on its update function's state. The runtime
 * writes a replaced item there (see `LOCAL_ITEMS`), so the name is fixed; it
 * cannot collide with a value key (letters) or a captured local (`_name`).
 */
const ITEM_SLOT = '$item';

/**
 * Whether a node is the member expression `__prev.<key>`.
 * @param {AST.Node} node
 * @param {string} key
 */
function is_item_read(node, key) {
	return (
		node.type === 'MemberExpression' &&
		node.object.type === 'Identifier' &&
		node.object.name === '__prev' &&
		node.property.type === 'Identifier' &&
		node.property.name === key
	);
}

/**
 * Rewrites an update function's reads of a local item (see `LOCAL_ITEMS`),
 * `_$_.get(__prev.<key>)` or `__prev.<key>`, to `__prev.$item`: the state
 * holds the item itself, in the slot the runtime refreshes.
 * @param {AST.FunctionDeclaration} declaration
 * @param {string} key the state key the item was captured under
 */
function read_item_from_state(declaration, key) {
	const slot = () => b.member(b.id('__prev'), b.id(ITEM_SLOT));
	declaration.body = /** @type {AST.BlockStatement} */ (
		walk(/** @type {AST.Node} */ (declaration.body), null, {
			CallExpression(node, { next }) {
				if (
					node.callee.type === 'Identifier' &&
					node.callee.name === '_$_.get' &&
					node.arguments.length === 1 &&
					is_item_read(node.arguments[0], key)
				) {
					return slot();
				}
				next();
			},
			MemberExpression(node, { next }) {
				if (is_item_read(node, key)) {
					return slot();
				}
				next();
			},
		})
	);
}

/**
 * Renames the property holding the captured item of an item body's
 * `_$_.item({ … })` state to the local item slot (see `read_item_from_state`).
 * @param {{ statements: AST.Statement[]; index: number }} call
 * @param {string} name the item's name
 * @returns {string | null} the key the item was captured under, if any
 */
function rename_item_slot(call, name) {
	const state = /** @type {AST.ObjectExpression} */ (
		/** @type {AST.CallExpression} */ (
			/** @type {AST.ExpressionStatement} */ (call.statements[call.index]).expression
		).arguments[0]
	);
	for (const property of state.properties) {
		if (
			property.type === 'Property' &&
			property.key.type === 'Identifier' &&
			/** @type {any} */ (property).metadata?.capture === name
		) {
			const key = property.key.name;
			property.key = b.id(ITEM_SLOT);
			property.shorthand = false;
			return key;
		}
	}
	return null;
}

/**
 * The `_$_.render(…)` statements of a compiled item body: at its top level or
 * in a nested block, never inside a function of its own.
 * @param {AST.Statement[]} statements
 * @param {{ statements: AST.Statement[]; index: number }[]} [found]
 * @returns {{ statements: AST.Statement[]; index: number }[]}
 */
function find_render_calls(statements, found = []) {
	for (let index = 0; index < statements.length; index++) {
		const statement = statements[index];
		if (statement.type === 'BlockStatement') {
			find_render_calls(statement.body, found);
		} else if (
			statement.type === 'ExpressionStatement' &&
			statement.expression.type === 'CallExpression' &&
			statement.expression.callee.type === 'Identifier' &&
			(statement.expression.callee.name === '_$_.render' ||
				statement.expression.callee.name === '_$_.item')
		) {
			found.push({ statements, index });
		}
	}
	return found;
}

/**
 * The function that destructures a keyed loop item with the authored pattern
 * into an object of the pattern's names: `({ id, ...rest }) => ({ id, rest })`.
 * Rest, default, computed-key, and iterable semantics are JavaScript's own,
 * and each runs once per call.
 * @param {AST.ForOfStatement | AST.JSXForOfExpression} node
 * @param {string[]} names
 * @returns {AST.ArrowFunctionExpression}
 */
function pattern_fields_arrow(node, names) {
	const source = /** @type {AST.VariableDeclaration} */ (node.left).declarations[0].id;
	const param = /** @type {AST.Pattern} */ (
		/** @type {unknown} */ ({ ...clone_ast_node(source), typeAnnotation: undefined })
	);
	return b.arrow(
		[param],
		b.object(names.map((name) => b.prop('init', b.id(name), b.id(name), false, true))),
	);
}

/**
 * Whether a keyed loop's key is the loop item itself (`key item` over a plain
 * `const item of …` pattern, with `item` resolving to the loop binding).
 * @param {AST.ForOfStatement | AST.JSXForOfExpression} node
 * @param {AST.Expression} key
 * @param {ScopeInterface} body_scope
 * @returns {boolean}
 */
function is_identity_key(node, key, body_scope) {
	if (key.type !== 'Identifier' || node.left.type !== 'VariableDeclaration') {
		return false;
	}
	const id = node.left.declarations[0]?.id;
	return (
		id !== undefined &&
		id.type === 'Identifier' &&
		id.name === key.name &&
		body_scope.get(key.name)?.node === id
	);
}

/** @import { SelectorForState } from '../../../types/transform-state' */

/**
 * The per-loop bookkeeping for selector lowering: the loop item's bindings
 * and the scope the loop is declared in, plus the selectors its body needs.
 * @param {AST.ForOfStatement | AST.JSXForOfExpression} node
 * @param {ScopeInterface} body_scope
 * @param {TransformClientState} state
 * @returns {SelectorForState}
 */
function create_selector_for_state(node, body_scope, state) {
	/** @type {Set<Binding>} */
	const pattern_bindings = new Set();
	const left = node.left;

	if (left.type === 'VariableDeclaration') {
		for (const declarator of left.declarations) {
			for (const id of extractIdentifiers(declarator.id)) {
				const binding = body_scope.get(id.name);
				if (binding !== null) {
					pattern_bindings.add(binding);
				}
			}
		}
	}

	// A key read off the item as authored (`key t.id`, `key t`): the body may
	// read it as the block's key. Behind a rest or default the key reads the
	// item before the runtime destructures it, unlike the body.
	const key =
		node.key != null && !node.metadata?.tsrx_for_pattern_fields
			? /** @type {AST.Expression} */ (node.key)
			: null;

	return {
		pattern_bindings,
		outer_scope: state.scope,
		selectors: [],
		key,
		body_scope,
		key_id: null,
	};
}

/**
 * Whether two pure operands (see `collect_pure_operand_references`) spell the
 * same read: the same names, members and literals.
 * @param {AST.Node} a
 * @param {AST.Node} b
 * @returns {boolean}
 */
function same_operand(a, b) {
	a = unwrap_operand(a);
	b = unwrap_operand(b);
	if (a.type !== b.type) {
		return false;
	}
	switch (a.type) {
		case 'Identifier':
			return a.name === /** @type {AST.Identifier} */ (b).name;
		case 'Literal':
			return a.value === /** @type {AST.Literal} */ (b).value;
		case 'MemberExpression': {
			const other = /** @type {AST.MemberExpression} */ (b);
			return (
				a.computed === other.computed &&
				a.optional === other.optional &&
				same_operand(a.object, other.object) &&
				same_operand(a.property, other.property)
			);
		}
		default:
			return false;
	}
}

/**
 * @param {AST.Node} node
 * @returns {AST.Node}
 */
function unwrap_operand(node) {
	while (
		node.type === 'ChainExpression' ||
		node.type === 'ParenthesizedExpression' ||
		node.type === 'TSNonNullExpression' ||
		node.type === 'TSInstantiationExpression' ||
		node.type === 'TSAsExpression' ||
		node.type === 'TSTypeAssertion' ||
		node.type === 'TSSatisfiesExpression'
	) {
		node = node.expression;
	}
	return node;
}

/**
 * Whether an operand of a comparison is side-effect free and cheap enough to
 * re-evaluate: identifiers, literals, member chains, and pure operators.
 * Collects the identifiers it references.
 * @param {AST.Node} node
 * @param {AST.Identifier[]} references
 * @returns {boolean}
 */
function collect_pure_operand_references(node, references) {
	switch (node.type) {
		case 'Identifier':
			references.push(node);
			return true;
		case 'Literal':
			return true;
		case 'TemplateLiteral':
			return node.expressions.every((expression) =>
				collect_pure_operand_references(expression, references),
			);
		case 'MemberExpression':
			return (
				collect_pure_operand_references(node.object, references) &&
				(!node.computed || collect_pure_operand_references(node.property, references))
			);
		case 'ChainExpression':
		case 'ParenthesizedExpression':
		case 'TSNonNullExpression':
		case 'TSInstantiationExpression':
		case 'TSAsExpression':
		case 'TSTypeAssertion':
		case 'TSSatisfiesExpression':
			return collect_pure_operand_references(node.expression, references);
		case 'UnaryExpression':
			return (
				node.operator !== 'delete' && collect_pure_operand_references(node.argument, references)
			);
		case 'BinaryExpression':
		case 'LogicalExpression':
			return (
				collect_pure_operand_references(node.left, references) &&
				collect_pure_operand_references(node.right, references)
			);
		case 'ConditionalExpression':
			return (
				collect_pure_operand_references(node.test, references) &&
				collect_pure_operand_references(node.consequent, references) &&
				collect_pure_operand_references(node.alternate, references)
			);
		default:
			return false;
	}
}

/**
 * @param {ScopeInterface | null} owner
 * @param {ScopeInterface} scope
 * @returns {boolean}
 */
function is_scope_or_ancestor(owner, scope) {
	/** @type {ScopeInterface | null} */
	let current = scope;
	while (current !== null) {
		if (current === owner) {
			return true;
		}
		current = current.parent;
	}
	return false;
}

/**
 * Lower `outer === item` (or `!==`) inside a `@for` render expression to a
 * selector lookup, so a change of the outer value only re-renders the items
 * for its previous and next key. One side must read outer reactive state that
 * is visible where the loop is declared; the other must involve the loop item.
 * @param {AST.BinaryExpression} node
 * @param {TransformClientContext} context
 * @returns {AST.Expression | null}
 */
function visit_selector_comparison(node, context) {
	const state = context.state;
	const selector_for = state.selector_for;
	const root = state.selector_root;

	if (
		selector_for === undefined ||
		root === undefined ||
		state.to_ts ||
		(node.operator !== '===' && node.operator !== '!==')
	) {
		return null;
	}

	// Only comparisons evaluated directly by the render expression qualify;
	// a callback inside it may run outside the render block.
	if (node !== root) {
		const path = context.path;
		let found = false;
		for (let i = path.length - 1; i >= 0; i -= 1) {
			const ancestor = path[i];
			if (ancestor === root) {
				found = true;
				break;
			}
			if (
				ancestor.type === 'ArrowFunctionExpression' ||
				ancestor.type === 'FunctionExpression' ||
				ancestor.type === 'FunctionDeclaration'
			) {
				return null;
			}
		}
		if (!found) {
			return null;
		}
	}

	const left = /** @type {AST.Expression} */ (node.left);
	const right = node.right;
	/** @type {AST.Identifier[]} */
	const left_references = [];
	/** @type {AST.Identifier[]} */
	const right_references = [];
	if (
		!collect_pure_operand_references(left, left_references) ||
		!collect_pure_operand_references(right, right_references)
	) {
		return null;
	}

	/**
	 * @param {AST.Identifier[]} references
	 * @returns {'item' | 'outer' | 'local'}
	 */
	const classify = (references) => {
		let uses_item = false;
		for (const reference of references) {
			const binding = state.scope.get(reference.name);
			if (binding === null) {
				continue;
			}
			if (selector_for.pattern_bindings.has(binding)) {
				uses_item = true;
				continue;
			}
			if (!is_scope_or_ancestor(state.scope.owner(reference.name), selector_for.outer_scope)) {
				return 'local';
			}
		}
		return uses_item ? 'item' : 'outer';
	};

	const left_kind = classify(left_references);
	const right_kind = classify(right_references);
	/** @type {AST.Expression} */
	let outer;
	/** @type {AST.Expression} */
	let item;
	if (left_kind === 'outer' && right_kind === 'item') {
		outer = left;
		item = right;
	} else if (left_kind === 'item' && right_kind === 'outer') {
		outer = right;
		item = left;
	} else {
		return null;
	}

	const outer_metadata = { tracking: false };
	const item_metadata = { tracking: false };
	const outer_expression = /** @type {AST.Expression} */ (
		context.visit(outer, { ...state, metadata: outer_metadata })
	);
	if (!outer_metadata.tracking) {
		// A static outer value needs no selector; keep the plain comparison.
		const item_expression = /** @type {AST.Expression} */ (
			context.visit(item, { ...state, metadata: item_metadata })
		);
		if (state.metadata?.tracking === false && item_metadata.tracking) {
			state.metadata.tracking = true;
		}
		return outer === left
			? b.binary(node.operator, outer_expression, item_expression)
			: b.binary(node.operator, item_expression, outer_expression);
	}

	// The item's key is fixed for its block's life, so a comparison against
	// the key expression reads the key the runtime passed (`__key`) instead
	// of the item's tracked: the block then depends on the selector alone.
	const item_references = outer === left ? right_references : left_references;
	const reads_key =
		selector_for.key !== null &&
		same_operand(item, selector_for.key) &&
		item_references.every((reference) => {
			const binding = state.scope.get(reference.name);
			return binding !== null && selector_for.pattern_bindings.has(binding);
		});
	const item_expression = reads_key
		? (selector_for.key_id ??= b.id(selector_for.body_scope.generate('key')))
		: /** @type {AST.Expression} */ (context.visit(item, { ...state, metadata: item_metadata }));

	// The enclosing render expression tracks what the outer side tracked (and
	// the item side, when it is read rather than the key).
	if (state.metadata?.tracking === false) {
		state.metadata.tracking = true;
	}

	// One selector per outer read: every comparison against the same outer
	// value in the loop shares it. Same spelling, same binding, as an outer
	// read resolves to a binding owned above the loop (see `classify`).
	let selector_id = selector_for.selectors.find((entry) => same_operand(entry.outer, outer))?.id;
	if (selector_id === undefined) {
		selector_id = b.id(selector_for.outer_scope.generate('selector'));
		selector_for.selectors.push({ id: selector_id, source: outer_expression, outer });
	}

	const match = b.call('_$_.selector_match', selector_id, item_expression);
	return node.operator === '===' ? match : b.unary('!', match);
}

/**
 * A DOM traversal read, inline so each template position has its own
 * property-read site (one inline cache per site instead of one shared,
 * megamorphic site inside a helper). While hydrating the read is replaced by
 * the hydration cursor, exactly as the `child` / `sibling` helpers do; a
 * client-only build (`hydration: false`) emits the bare read.
 * @param {'child' | 'sibling'} operation
 * @param {AST.Expression} node
 * @param {boolean | undefined} is_text
 * @param {boolean} hydration
 * @returns {AST.Expression}
 */
function inline_traversal(operation, node, is_text, hydration) {
	const read = b.member(node, b.id(operation === 'child' ? 'firstChild' : 'nextSibling'));
	if (!hydration) {
		return read;
	}
	return b.conditional(
		b.member(b.id('_$_'), b.id('hydrating')),
		b.call(operation === 'child' ? '_$_.hydrate_child' : '_$_.hydrate_sibling', is_text && b.true),
		read,
	);
}

/** @type {Visitors<AST.Node, TransformClientState>} */
const visitors = {
	_(node, { next, state, path }) {
		if (!node.metadata) {
			node.metadata = { path: [...path] };
		} else {
			node.metadata.path = [...path];
		}

		const scope = state.scopes.get(node);

		if (scope && scope !== state.scope) {
			return next({ ...state, scope });
		} else {
			return next();
		}
	},

	Identifier(node, context) {
		const parent = /** @type {AST.Node} */ (context.path.at(-1));

		if (is_reference(node, parent)) {
			if (context.state.to_ts) {
				const binding = context.state.scope.get(node.name);
				if (node.tracked) {
					const member = b.member(
						node,
						b.literal('#v'),
						true,
						!is_inside_left_side_assignment(node),
						/** @type {AST.NodeWithLocation} */ (node),
					);
					member.tracked = true;
					return member;
				}
			} else {
				const binding = context.state.scope.get(node.name);
				const is_right_side_of_assignment =
					parent.type === 'AssignmentExpression' && parent.right === node;
				if (
					(context.state.metadata?.tracking === false ||
						(parent.type !== 'AssignmentExpression' && parent.type !== 'UpdateExpression') ||
						is_right_side_of_assignment) &&
					(node.tracked ||
						binding?.kind === 'prop' ||
						binding?.kind === 'index' ||
						binding?.kind === 'prop_fallback' ||
						binding?.kind === 'for_pattern') &&
					binding?.node !== node
				) {
					if (context.state.metadata?.tracking === false) {
						context.state.metadata.tracking = true;
					}
				}
				return build_getter(node, context);
			}
		}
	},

	ImportDeclaration(node, context) {
		const { state } = context;

		if (get_submodule_import_source_name(node) === 'server') {
			return transform_server_module_import(node, state);
		}

		if (!state.to_ts && node.importKind === 'type') {
			return b.empty;
		}

		if (state.to_ts && state.ancestor_server_block) {
			/** @type {AST.VariableDeclaration[]} */
			const locals = state.server_block_locals;
			// Rebuild the specifiers with obfuscated locals on copies — the source
			// import declaration is never mutated.
			const specifiers = node.specifiers.map((spec) => {
				const original_name = spec.local.name;
				const name = obfuscateIdentifier(original_name);
				const local =
					spec.type !== 'ImportSpecifier' ||
					(spec.imported && /** @type {AST.Identifier} */ (spec.imported).name !== spec.local.name)
						? { ...spec.local, name }
						: b.id(name);
				local.metadata = { ...local.metadata, source_name: original_name };
				locals.push(b.const(original_name, b.id(name)));
				return { ...spec, local };
			});
			state.imports.add(/** @type {AST.ImportDeclaration} */ ({ ...node, specifiers }));
			return b.empty;
		}

		return /** @type {AST.ImportDeclaration} */ ({
			...node,
			specifiers: node.specifiers
				.filter(
					(spec) => state.to_ts || /** @type {AST.ImportSpecifier} */ (spec).importKind !== 'type',
				)
				.map((spec) => context.visit(spec)),
		});
	},

	TSNonNullExpression(node, context) {
		if (context.state.to_ts) {
			return context.next();
		}
		return context.visit(/** @type {AST.Expression} */ (node.expression));
	},

	CallExpression(node, context) {
		const callee = node.callee;
		const parent = context.path.at(-1);

		if (context.state.metadata?.tracking === false) {
			context.state.metadata.tracking = true;
		}

		// A generated inline-component IIFE for a `@{ … }` block: after the
		// block's statements lower into the component callback, the wrapper
		// scope holds a lone `return _$_.tsrx_element(…)` — collapse it to the
		// component value. Constructing the value reads no scope, so no
		// `with_scope` is needed either.
		if (!context.state.to_ts && node.metadata?.tsrx_code_block_component) {
			return unwrap_single_return_iife(/** @type {AST.Expression} */ (context.next()));
		}

		// Handle direct calls to ripple-imported functions: effect(), untrack(), RippleArray(), etc.
		if (!context.state.to_ts && callee.type === 'Identifier' && is_ripple_import(callee, context)) {
			const ripple_runtime_method = get_ripple_namespace_call_name(callee.name);
			if (ripple_runtime_method !== null) {
				const requires_block = ripple_namespace_requires_block(callee.name);
				return {
					...node,
					callee: b.member(b.id('_$_'), b.id(ripple_runtime_method)),
					arguments: /** @type {(AST.Expression | AST.SpreadElement)[]} */ ([
						...(requires_block ? [b.id('__block')] : []),
						...node.arguments.map((arg) => context.visit(arg)),
					]),
					typeArguments: undefined,
				};
			}
		}

		const matched_track_call = !context.state.to_ts ? is_ripple_track_call(callee, context) : null;
		if (matched_track_call) {
			const track_method_name =
				matched_track_call === 'trackAsync'
					? 'track_async'
					: matched_track_call === 'trackReadOnly'
						? 'track_read_only'
						: 'track';
			/** @type {(AST.Expression | AST.SpreadElement)[]} */
			const call_args = [];
			const source_args = node.arguments.length === 0 ? [b.void0] : node.arguments;

			for (let i = 0; i < source_args.length; i++) {
				const arg = source_args[i];
				call_args.push(/** @type {(AST.Expression | AST.SpreadElement)} */ (context.visit(arg)));
				if (i === 0) {
					call_args.push(b.id('__block'));
					// A read-only view is not a serialized value: no hash.
					if (matched_track_call === 'trackReadOnly') {
						continue;
					}
					// The hash pairs a client tracked with its serialized server
					// dependency during hydration; a client-only build has no use for it.
					if (context.state.hydration) {
						call_args.push(b.literal(node.metadata.hash));
					}
				}
			}

			return /** @type {AST.CallExpression} */ ({
				...node,
				callee: b.member(b.id('_$_'), b.id(track_method_name)),
				arguments: call_args,
				typeArguments: undefined,
			});
		}

		// Handle member calls on ripple imports, like RippleArray.from()
		if (
			callee.type === 'MemberExpression' &&
			callee.object.type === 'Identifier' &&
			callee.property.type === 'Identifier' &&
			is_ripple_import(callee, context)
		) {
			const object = callee.object;
			const property = callee.property;
			const method_name = get_ripple_namespace_static_call_name(object.name, property.name);

			if (!context.state.to_ts && method_name !== null) {
				const requires_block = ripple_namespace_requires_block(object.name);
				return b.call(
					b.member(b.id('_$_'), b.id(method_name)),
					.../** @type {(AST.Expression | AST.SpreadElement)[]} */ ([
						...(requires_block ? [b.id('__block')] : []),
						...node.arguments.map((arg) => context.visit(arg)),
					]),
				);
			}
		}

		if (
			!is_inside_component(context, true) ||
			context.state.to_ts ||
			(parent?.type === 'MemberExpression' && parent.property === node) ||
			is_inside_call_expression(context) ||
			!context.path.some((node) => is_native_tsrx_function_node(node)) ||
			is_declared_function_within_component(callee, context) ||
			is_global_coercion_call(callee, context) ||
			is_context_method_call(callee, context)
		) {
			if (context.state.to_ts) {
				return context.next();
			}
			// Like `context.next()`, but on a copy without the TypeScript-only type
			// arguments so they are neither visited nor emitted.
			return visit_children_without(node, context, ['typeArguments']);
		}

		// Handle array methods that access the array
		if (callee.type === 'MemberExpression') {
			const property = callee.property;

			if (callee.computed) {
				return b.call(
					'_$_.with_scope',
					b.id('__block'),
					b.thunk(
						b.call(
							'_$_.call_property',
							/** @type {AST.Expression} */ (context.visit(callee.object)),
							/** @type {AST.Expression} */ (context.visit(property)),
							callee.optional ? b.true : undefined,
							/** @type {AST.SimpleCallExpression} */ (node).optional ? b.true : undefined,
							.../** @type {AST.Expression[]} */ (node.arguments.map((arg) => context.visit(arg))),
						),
					),
				);
			}
		}

		const visited_call = {
			...node,
			callee: /** @type {AST.Expression} */ (context.visit(callee)),
			arguments: /** @type {(AST.Expression | AST.SpreadElement)[]} */ (
				node.arguments.map((arg) => context.visit(arg))
			),
			typeArguments: undefined,
		};

		// A generated code-block scope IIFE is already a zero-argument
		// closure — use its arrow as the with_scope callback directly instead
		// of thunking the call (`() => (() => { … })()`).
		if (
			node.metadata?.tsrx_code_block_scope &&
			visited_call.callee.type === 'ArrowFunctionExpression'
		) {
			return b.call('_$_.with_scope', b.id('__block'), visited_call.callee);
		}

		return b.call('_$_.with_scope', b.id('__block'), b.thunk(visited_call));
	},

	TSTypeAliasDeclaration(_, context) {
		if (!context.state.to_ts) {
			return b.empty;
		}
		return context.next();
	},

	TSInterfaceDeclaration(_, context) {
		if (!context.state.to_ts) {
			return b.empty;
		}
		return context.next();
	},

	TSMappedType(_, context) {
		if (!context.state.to_ts) {
			return b.empty;
		}
		return context.next();
	},

	NewExpression(node, context) {
		const callee = node.callee;

		if (context.state.metadata?.tracking === false) {
			context.state.metadata.tracking = true;
		}

		// Transform `new RippleArray(...)`, `new RippleMap(...)`, etc. imported from 'ripple'
		if (!context.state.to_ts && callee.type === 'Identifier' && is_ripple_import(callee, context)) {
			const ripple_runtime_method = get_ripple_namespace_call_name(callee.name);
			if (ripple_runtime_method !== null) {
				const requires_block = ripple_namespace_requires_block(callee.name);
				return b.call(
					'_$_.' + ripple_runtime_method,
					...(requires_block ? [b.id('__block')] : []),
					.../** @type {(AST.Expression | AST.SpreadElement)[]} */ (
						node.arguments.map((arg) => context.visit(arg))
					),
				);
			}
		}

		if (
			context.state.to_ts ||
			!is_inside_component(context, true) ||
			is_inside_call_expression(context) ||
			is_value_static(node)
		) {
			if (!context.state.to_ts) {
				// Like `context.next()`, but on a copy without the TypeScript-only
				// type arguments so they are neither visited nor emitted.
				return visit_children_without(node, context, ['typeArguments']);
			}

			return context.next();
		}

		/** @type {AST.NewExpression} */
		const new_node = {
			...node,
			callee: /** @type {AST.Expression} */ (context.visit(callee)),
			arguments: /** @type {(AST.Expression | AST.SpreadElement)[]} */ (
				node.arguments.map((arg) => context.visit(arg))
			),
		};
		if (!context.state.to_ts) {
			delete new_node.typeArguments;
		}

		return b.call('_$_.with_scope', b.id('__block'), b.thunk(new_node));
	},

	MemberExpression(node, context) {
		if (context.state.metadata?.tracking === false) {
			context.state.metadata.tracking = true;
		}

		if (node.object.type === 'MemberExpression' && node.object.optional) {
			const metadata = { tracking: false };

			const object = context.visit(node.object, { ...context.state, metadata });

			if (metadata.tracking) {
				if (/** @type {boolean | undefined} */ (context.state.metadata?.tracking) === false) {
					context.state.metadata.tracking = true;
				}

				return {
					...node,
					optional: true,
					object: /** @type {AST.Expression} */ (object),
					property: /** @type {AST.Expression} */ (context.visit(node.property)),
				};
			}
		} else {
			return context.next();
		}
	},

	PropertyDefinition(node, context) {
		if (!context.state.to_ts) {
			// Like `context.next()`, but on a copy without the TypeScript-only type
			// annotation so it is neither visited nor emitted.
			return visit_children_without(node, context, ['typeAnnotation']);
		}
		return context.next();
	},

	ClassDeclaration(node, context) {
		if (!context.state.to_ts) {
			return strip_class_typescript_syntax(node, context);
		}
		return context.next();
	},

	ClassExpression(node, context) {
		if (!context.state.to_ts) {
			return strip_class_typescript_syntax(node, context);
		}
		return context.next();
	},

	ParenthesizedExpression(node, context) {
		// Only volar/to_ts parses preserve source parens (build compiles fold
		// them). A lowered fragment/element is self-delimiting — parens around
		// it are redundant in the type view and the JS targets never print
		// them, so drop the wrapper and keep the lowered child.
		if (context.state.to_ts) {
			const expression = /** @type {AST.Expression} */ (context.visit(node.expression));
			if (expression.type === 'JSXFragment' || expression.type === 'JSXElement') {
				return expression;
			}
			if (expression !== node.expression) {
				return { ...node, expression };
			}
		}
		return context.next();
	},

	VariableDeclaration(node, context) {
		// Rewrite declarator ids on copies (strip type annotations) — the source
		// declarators are never mutated.
		const declarations = node.declarations.map((declarator) => {
			/** @type {AST.VariableDeclarator['id']} */
			let id = declarator.id;

			if (!context.state.to_ts && id.typeAnnotation) {
				id = { ...id, typeAnnotation: undefined };
			}

			if (id === declarator.id) {
				return declarator;
			}
			const copy = { ...declarator, id };
			const scope = context.state.scopes.get(declarator);
			if (scope) context.state.scopes.set(copy, scope);
			return copy;
		});

		return {
			...node,
			declarations: declarations.flatMap((declarator) => {
				const visited = /** @type {AST.VariableDeclarator} */ (context.visit(declarator));
				// `boxed` / `boxed_names` are set by the analyzer's `box_declarator`.
				const metadata = /** @type {any} */ (declarator.metadata);
				if (context.state.to_ts || !metadata) {
					return [visited];
				}
				if (metadata.boxed) {
					return [box_declarator(visited)];
				}
				if (metadata.boxed_names) {
					return box_pattern_names(visited, metadata.boxed_names, context);
				}
				return [visited];
			}),
		};
	},

	VariableDeclarator(node, context) {
		return context.next();
	},

	CatchClause(node, context) {
		const visited = /** @type {AST.CatchClause} */ (context.next() ?? node);
		if (context.state.to_ts) {
			return visited;
		}
		const boxes = box_param_statements(node);
		if (boxes.length === 0) {
			return visited;
		}
		return { ...visited, body: { ...visited.body, body: [...boxes, ...visited.body.body] } };
	},

	FunctionDeclaration(node, context) {
		return /** @type AST.FunctionDeclaration | AST.EmptyStatement */ (
			visit_function(node, context)
		);
	},

	ArrowFunctionExpression(node, context) {
		return /** @type AST.ArrowFunctionExpression | AST.EmptyStatement */ (
			visit_function(node, context)
		);
	},

	FunctionExpression(node, context) {
		return /** @type AST.FunctionExpression | AST.EmptyStatement */ (visit_function(node, context));
	},

	JSXText(node, context) {
		if (context.state.to_ts) {
			return context.next();
		}
		return b.literal(node.value + '');
	},

	JSXIdentifier(node, context) {
		if (context.state.to_ts) {
			return context.next();
		}
		return b.id(node.name);
	},

	JSXExpressionContainer(node, context) {
		if (context.state.to_ts) {
			return context.next();
		}
		return context.visit(node.expression);
	},

	JSXEmptyExpression(node, context) {
		// JSX comments like {/* ... */} are represented as JSXEmptyExpression
		// In TypeScript mode, preserve them as-is for prettier
		// In JavaScript mode, they're removed (which is correct since they're comments)
		if (context.state.to_ts) {
			return context.next();
		}
		// In JS mode, return empty - comments are stripped
		return b.empty;
	},

	JSXCodeBlock(node, context) {
		// A `@{ … }` block that sits in a value position (assigned to a variable,
		// returned, …) is wrapped in an immediately-invoked arrow so it flows
		// through the function-body path (`transform_native_tsrx_function`) rather
		// than reaching the printer as a raw `JSXCodeBlock` — a code-only block
		// would otherwise print as an invalid `{ … }` "expression". Applies to
		// runtime and `to_ts` output alike. The function-body guard keeps
		// `transform_native_tsrx_function`'s own visit of the body (in `to_ts`)
		// from re-wrapping it endlessly.
		if (
			!is_code_block_function_body(node, context.path.at(-1)) &&
			is_native_tsrx_value_position(context.path, node)
		) {
			return context.visit(wrap_code_block_in_iife(node), context.state);
		}
		// A code-only `@{ … }` block (no render output) is just a lexical block of
		// setup statements. Component blocks (with a render template) are handled by
		// `transform_native_tsrx_function`, and `to_ts` mode keeps the node for the
		// TSX printer. Everywhere else, lower it to a plain BlockStatement so the
		// JS printer (which has no JSXCodeBlock visitor) can emit it.
		if (context.state.to_ts) {
			/** @type {AST.Statement[]} */
			const body = [];
			for (const statement of node.body) {
				push_statement(
					/** @type {AST.Statement | AST.Statement[]} */ (context.visit(statement, context.state)),
					body,
				);
			}
			const render = get_code_block_render(node, context.state.scopes);
			return {
				...node,
				body,
				render: render
					? transform_tsrx_ts_render_node(
							/** @type {AST.Node} */ (render),
							/** @type {VisitorClientContext} */ (context),
						)
					: null,
			};
		}
		if (get_code_block_render(node, context.state.scopes) != null) {
			return context.next();
		}
		const body = node.body.map(
			(statement) => /** @type {AST.Statement} */ (context.visit(statement, context.state)),
		);
		return b.block(body);
	},

	JSXFragment(node, context) {
		const { state, visit } = context;

		// A raw (non-template) fragment — an attribute value or other JSX that
		// never entered the template traversal.
		if (!is_template_fragment(node)) {
			if (state.to_ts) {
				return context.next();
			}
			if (state.jsx_to_tsrx_element || is_native_tsrx_value_position(context.path, node)) {
				return build_jsx_to_tsrx_element(/** @type {AST.TSRXJSXFragment} */ (node), context);
			}
			return context.next();
		}

		// to_ts mode: produce a JSX fragment from native TSRX children.
		if (state.to_ts) {
			const expression = build_tsrx_to_ts_expression(node, context);
			// Keep an AUTHORED `<> … </>` verbatim in EVERY position — a value slot
			// (`const v = <>{1}</>`), render output (`return <>{x}</>`, `() => <>{x}</>`),
			// or a JSX-child `{ … }` container (`<div>{<>{x}</>}</div>`) — matching the JS
			// targets; collapsing it to a bare child risks the wrong output (a fragment is
			// always truthy, and the type changes). A fragment COMBINED into a surrounding
			// expression is likewise kept, including the compiler-generated wrapper around a
			// directive used as a `||`/`&&` operand (`@if (…) { … } || 'x'` → `<>{…}</> || 'x'`):
			// the wrapper is a truthy value so the fallback stays dead, exactly as the JS
			// targets / runtime treat it (the type view must agree). A directive as the SOLE
			// value of a slot (`const v = @if (…)`) still collapses — `is_combined_expression_position`
			// excludes those slots — and a nested authored fragment collapses outer→inner via
			// `wrap_to_ts_value_in_fragment`'s short-circuit.
			const value =
				is_authored_native_fragment(node) || is_combined_expression_position(context.path, node)
					? wrap_to_ts_value_in_fragment(expression, node)
					: expression;
			return is_ts_statement_slot(context.path, node)
				? b.stmt(/** @type {AST.Expression} */ (value))
				: value;
		}

		const children_filtered = lower_code_block_children(
			/** @type {AST.Node[]} */ (node.children),
			state.scopes,
		).filter((child) => {
			return child != null && child.type !== 'EmptyStatement';
		});

		const children_component = create_native_tsrx_render_function([], children_filtered, node);

		const element = b.call(
			'_$_.tsrx_element',
			/** @type {AST.Expression} */ (
				visit(children_component, {
					...state,
					regular_js: false,
					namespace: state.namespace,
					is_tsrx_element: true,
					jsx_to_tsrx_element: true,
				})
			),
		);

		// Template body context: push to template and schedule init
		if (state.flush_node) {
			state.template?.push('<!>');

			const id = state.flush_node(false);

			const call = b.call('_$_.expression', id, b.thunk(element));
			state.init?.push(
				state.namespace !== DEFAULT_NAMESPACE
					? b.stmt(b.call('_$_.with_ns', b.literal(state.namespace), b.thunk(call)))
					: b.stmt(call),
			);
			return;
		}

		// Expression context: return the tsrx_element directly as an expression value
		return element;
	},

	JSXStyleElement(node, context) {
		const { state } = context;

		if (
			state.regular_js ||
			is_native_tsrx_value_position(context.path, node) ||
			is_regular_js_statement_position(context.path)
		) {
			const expression = build_style_class_map_expression(node, context);
			if (is_regular_js_statement_position(context.path)) {
				return b.stmt(expression);
			}
			return expression;
		}

		if (state.to_ts) {
			const fragment = /** @type {ESTreeJSX.JSXFragment} */ (
				/** @type {unknown} */ ({
					type: 'JSXFragment',
					children: [node],
					openingFragment: { type: 'JSXOpeningFragment', metadata: { path: [] } },
					closingFragment: { type: 'JSXClosingFragment', metadata: { path: [] } },
					metadata: { path: [], tsrx_render_fragment: true },
				})
			);
			return build_tsrx_to_ts_expression(fragment, context);
		}

		if (state.inside_head) {
			state.template?.push(`<style>${sanitizeTemplateString(get_style_css(node))}</style>`);
			return;
		}

		// Component styles render nothing at runtime — their CSS is extracted at
		// analysis time and injected separately.
	},

	JSXElement(node, context) {
		const { state, visit } = context;

		// A raw (non-template) element — an attribute value or other JSX that
		// never entered the template traversal.
		if (!is_template_element(node)) {
			if (state.to_ts) {
				return context.next();
			}
			if (state.jsx_to_tsrx_element || is_native_tsrx_value_position(context.path, node)) {
				return build_jsx_to_tsrx_element(/** @type {AST.TSRXJSXElement} */ (node), context);
			}
			return context.next();
		}

		// Read before `node` is replaced by its lowered form, which the parent doesn't hold.
		const in_ts_statement_slot = state.to_ts && is_ts_statement_slot(context.path, node);

		// The TS view needs the `<TsrxDynamic is={expr}>` component shape for type
		// checking; production codegen keeps `node.id` as the dynamic expression
		// and renders it directly via `_$_.composite` in the component branch.
		if (state.to_ts) {
			const lowered = lower_dynamic_element(node, undefined, state.scopes);
			if (lowered) {
				state.imports.add(`import { Dynamic as ${dynamic_element_import_local} } from 'ripple'`);
				node = lowered;
			}
		}

		const element_id = get_element_id(node);
		const element_attributes = get_element_attributes(node);

		if (state.to_ts) {
			const fragment = /** @type {ESTreeJSX.JSXFragment} */ (
				/** @type {unknown} */ ({
					type: 'JSXFragment',
					children: [node],
					openingFragment: { type: 'JSXOpeningFragment', metadata: { path: [] } },
					closingFragment: { type: 'JSXClosingFragment', metadata: { path: [] } },
					metadata: { path: [], tsrx_render_fragment: true },
				})
			);
			const expression = build_tsrx_to_ts_expression(fragment, context);
			return in_ts_statement_slot ? b.stmt(/** @type {AST.Expression} */ (expression)) : expression;
		}

		if (
			state.regular_js ||
			(!state.inside_head &&
				!state.template_child &&
				!node.metadata?.returned_tsrx_child &&
				(is_native_tsrx_value_position(context.path, node) ||
					(context.state.component === undefined &&
						is_native_tsrx_statement_position(context.path))))
		) {
			const expression = build_native_tsrx_value_expression([node], node, context);
			if (is_regular_js_statement_position(context.path)) {
				return b.stmt(expression);
			}
			return expression;
		}

		if (is_ripple_fragment_element(node, context)) {
			visit_ripple_fragment_element(node, context);
			return;
		}

		if (context.state.inside_head) {
			// Inline scripts (`<script>…raw JS/TS…</script>`) are raw-text elements: the
			// body is captured verbatim on `node.content` (see the parser's
			// `#parseScriptElement`) and injected as the script's text content. Scripts
			// with no inline body (e.g. `<script src={...} />`) carry their behavior in
			// attributes, so they fall through to generic element handling instead.
			const script_content = /** @type {AST.TSRXJSXElement} */ (node).content;
			if (
				element_id.type === 'Identifier' &&
				element_id.name === 'script' &&
				typeof script_content === 'string' &&
				script_content.length > 0
			) {
				const id = state.flush_node?.();
				state.template?.push('<!>');
				context.state.init?.push(b.stmt(b.call('_$_.script', id, b.literal(script_content))));
				return;
			}
		}

		const is_dom_element = is_element_dom_element(node);
		const is_spreading = element_attributes.some((attr) => attr.type === 'JSXSpreadAttribute');
		/** @type {(AST.Property | AST.SpreadElement)[] | null} */
		const spread_attributes = is_spreading ? [] : null;
		// A dynamic tag is only known at runtime: composite() renders the
		// children in the namespace the tag resolves to, so they carry none.
		const child_namespace = is_dom_element
			? determine_namespace_for_children(
					/** @type {AST.Identifier} */ (element_id).name,
					state.namespace,
				)
			: is_dynamic_element(node)
				? DEFAULT_NAMESPACE
				: state.namespace;

		/**
		 * @param {string} name
		 *  @param {string | number | bigint | boolean | RegExp | null | undefined} value
		 */
		const handle_static_attr = (name, value) => {
			const attr_value = b.literal(` ${name}${static_attribute_value(name, value)}`);

			if (is_spreading) {
				// For spread attributes, store just the actual value, not the full attribute string
				const actual_value =
					is_boolean_attribute(name) && value === true
						? b.literal(true)
						: b.literal(value === true ? '' : value);
				spread_attributes?.push(b.prop('init', b.literal(name), actual_value));
			} else {
				state.template?.push(attr_value);
			}
		};

		if (is_dom_element) {
			/** @type {ESTreeJSX.JSXAttribute | null} */
			let class_attribute = null;
			/** @type {ESTreeJSX.JSXAttribute | null} */
			let style_attribute = null;
			/** @type {TransformClientState['update']} */
			const local_updates = [];
			const element_name = /** @type {AST.Identifier} */ (element_id).name;
			const is_void = is_void_element(element_name);
			// The scope hashes and applied theme classes the style pre-pass
			// stamped on this element: a literal, or a runtime concatenation
			// when an imported theme's `$class` is part of it.
			const scope_class = build_scope_class_expression(get_scope_class_chain(node));
			const inner_html_attribute = get_inner_html_attribute(node);

			state.template?.push(`<${element_name}`);

			for (const attr of element_attributes) {
				if (attr.type === 'JSXAttribute') {
					const attr_value = get_attribute_value(attr);
					{
						const name = get_attribute_name(attr);

						if (name === 'innerHTML') {
							const metadata = { tracking: false };
							const expression =
								attr_value === null
									? b.literal('')
									: /** @type {AST.Expression} */ (visit(attr_value, { ...state, metadata }));

							if (is_spreading) {
								spread_attributes?.push(b.prop('init', b.literal('innerHTML'), expression));
								continue;
							}

							const id = state.flush_node?.();
							if (metadata.tracking) {
								local_updates.push({
									operation: (key) =>
										b.stmt(
											b.assignment(
												'=',
												b.member(/** @type {AST.Identifier} */ (id), 'innerHTML'),
												normalize_inner_html_expression(
													/** @type {AST.Expression} */ (key),
													/** @type {AST.Identifier} */ (id),
												),
											),
										),
									expression,
									identity: attr_value ?? b.literal(''),
									initial: b.member(/** @type {AST.Identifier} */ (id), 'innerHTML'),
								});
							} else {
								state.init?.push(
									b.stmt(
										b.assignment(
											'=',
											b.member(/** @type {AST.Identifier} */ (id), 'innerHTML'),
											normalize_inner_html_expression(
												expression,
												/** @type {AST.Identifier} */ (id),
											),
										),
									),
								);
							}
							continue;
						}

						if (attr_value === null) {
							// omit a valueless event attr (analyze errored); `hidden` etc. still emit
							if (!isEventAttribute(name)) {
								handle_static_attr(name, true);
							}
							continue;
						}

						if (name === 'ref') {
							const id = state.flush_node?.();
							const metadata = { tracking: false };
							const source = get_ref_source_argument(attr_value);
							const ref_value =
								source.type === 'ArrayExpression'
									? create_ref_value_call(attr_value, context)
									: /** @type {AST.Expression} */ (visit(attr_value, { ...state, metadata }));
							const ref_args = [/** @type {AST.Expression} */ (id), b.thunk(ref_value)];
							if (source.type !== 'ArrayExpression') {
								add_ref_setter_arg(ref_args, attr_value, ref_value);
							}
							state.init?.push(b.stmt(b.call('_$_.ref', ...ref_args)));
							continue;
						}

						if (
							attr_value.type === 'Literal' &&
							name !== 'class' &&
							name !== 'style' &&
							!(name === 'value' && element_name === 'option')
						) {
							handle_static_attr(name, attr_value.value);
							continue;
						}

						if (name === 'value') {
							const id = state.flush_node?.();
							const metadata = { tracking: false };
							const expression = /** @type {AST.Expression} */ (
								visit(attr_value, { ...state, metadata })
							);

							if (metadata.tracking) {
								local_updates.push({
									operation: (key) => b.stmt(b.call('_$_.set_value', id, key)),
									expression,
									identity: attr_value,
									initial: b.void0,
								});
							} else {
								state.init?.push(b.stmt(b.call('_$_.set_value', id, expression)));
							}

							continue;
						}

						if (name === 'class') {
							class_attribute = attr;

							continue;
						}

						if (name === 'style') {
							style_attribute = attr;

							continue;
						}

						if (name === 'checked') {
							const id = state.flush_node?.();
							const metadata = { tracking: false };
							const expression = /** @type {AST.Expression} */ (
								visit(attr_value, { ...state, metadata })
							);

							if (metadata.tracking) {
								local_updates.push({
									operation: (key) => b.stmt(b.call('_$_.set_checked', id, key)),
									expression,
									identity: attr_value,
									initial: b.void0,
								});
							} else {
								state.init?.push(b.stmt(b.call('_$_.set_checked', id, expression)));
							}
							continue;
						}

						if (name === 'selected') {
							const id = state.flush_node?.();
							const metadata = { tracking: false };
							const expression = /** @type {AST.Expression} */ (
								visit(attr_value, { ...state, metadata })
							);

							if (metadata.tracking) {
								local_updates.push({
									operation: (key) => b.stmt(b.call('_$_.set_selected', id, key)),
									expression,
									identity: attr_value,
									initial: b.void0,
								});
							} else {
								state.init?.push(b.stmt(b.call('_$_.set_selected', id, expression)));
							}
							continue;
						}

						if (isEventAttribute(name)) {
							const metadata = { tracking: false };
							let handler = /** @type {AST.Expression} */ (
								visit(attr_value, { ...state, metadata })
							);
							const id = state.flush_node?.();

							if (attr.metadata?.delegated) {
								const event_name = normalizeEventName(name);

								if (!state.events.has(event_name)) {
									state.events.add(event_name);
								}

								state.init?.push(
									b.stmt(
										b.assignment(
											'=',
											b.member(/** @type {AST.Identifier} */ (id), '__' + event_name),
											handler,
										),
									),
								);
							} else {
								const event_name = getOriginalEventName(name);
								// Check if handler is reactive (contains tracking)
								if (metadata.tracking) {
									// Use reactive_event with a thunk to re-evaluate when dependencies change
									state.init?.push(
										b.stmt(b.call('_$_.render_event', b.literal(event_name), id, b.thunk(handler))),
									);
								} else if (
									(isCaptureEvent(event_name) || isNonDelegated(normalizeEventName(name))) &&
									(handler.type === 'ArrowFunctionExpression' ||
										handler.type === 'FunctionExpression' ||
										(attr_value.type === 'Identifier' &&
											is_declared_function_within_component(attr_value, context)))
								) {
									// A plain function for an event its name keeps off delegation:
									// the DOM name and phase are resolved here, so the runtime
									// attaches the listener without its name tables or options.
									state.init?.push(
										b.stmt(
											b.call(
												'_$_.listen',
												b.literal(normalizeEventName(name)),
												id,
												handler,
												isCaptureEvent(event_name) ? b.true : undefined,
											),
										),
									);
								} else {
									state.init?.push(b.stmt(b.call('_$_.event', b.literal(event_name), id, handler)));
								}
							}

							continue;
						}
						const metadata = { tracking: false };
						const expression = /** @type {AST.Expression} */ (
							visit(attr_value, { ...state, metadata })
						);
						// All other attributes
						if (metadata.tracking) {
							const attribute = name;
							const id = state.flush_node?.();

							if (is_dom_property(attribute)) {
								local_updates.push({
									operation: () =>
										b.stmt(
											b.assignment(
												'=',
												b.member(/** @type {AST.Identifier} */ (id), attribute),
												expression,
											),
										),
								});
							} else {
								const kind = attribute_kind(element_name, attribute, state);
								// A value proved to be a string is never removed and never
								// a property: the DOM call goes straight to the element. So
								// is a primitive on a name that is not a property.
								const direct = is_direct_attribute_value(attribute, attr_value, state, kind);
								local_updates.push({
									operation: (key) =>
										b.stmt(
											direct
												? b.call(
														b.member(/** @type {AST.Identifier} */ (id), 'setAttribute'),
														b.literal(attribute),
														/** @type {AST.Expression} */ (key),
													)
												: b.call(attribute_helper(kind), id, b.literal(attribute), key),
										),
									expression,
									identity: attr_value,
									initial: b.void0,
								});
							}
						} else {
							const id = state.flush_node?.();

							if (is_dom_property(name)) {
								state.init?.push(
									b.stmt(
										b.assignment(
											'=',
											b.member(/** @type {AST.Identifier} */ (id), name),
											expression,
										),
									),
								);
							} else {
								const kind = attribute_kind(element_name, name, state);
								if (is_direct_attribute_value(name, attr_value, state, kind)) {
									state.init?.push(
										b.stmt(
											b.call(
												b.member(/** @type {AST.Identifier} */ (id), 'setAttribute'),
												b.literal(name),
												expression,
											),
										),
									);
								} else {
									state.init?.push(
										b.stmt(b.call(attribute_helper(kind), id, b.literal(name), expression)),
									);
								}
							}
						}
					}
				} else if (attr.type === 'JSXSpreadAttribute') {
					spread_attributes?.push(
						b.spread(/** @type {AST.Expression} */ (visit(attr.argument, state))),
					);
				}
			}

			// Where no namespace is known, the element may still be rendered into
			// an `<svg>` at runtime, so only a tag that is not an SVG or MathML
			// element name takes the `className` fast path.
			const is_html_class =
				context.state.namespace === 'html' &&
				!isSvgTagName(element_name) &&
				!isMathmlTagName(element_name);

			if (class_attribute !== null) {
				const attr_value = /** @type {AST.Expression} */ (get_attribute_value(class_attribute));
				if (attr_value.type === 'Literal') {
					if (is_spreading && scope_class !== null) {
						// The spread may carry a `class` of its own that replaces this
						// one, so the scope classes ride separately as `#class`, which
						// the runtime adds after every other attribute.
						handle_static_attr('class', attr_value.value);
						if (scope_class.type === 'Literal') {
							handle_static_attr('#class', /** @type {string} */ (scope_class.value));
						} else {
							spread_attributes?.push(b.prop('init', b.literal('#class'), scope_class));
						}
					} else if (scope_class === null || scope_class.type === 'Literal') {
						handle_static_attr(
							'class',
							scope_class === null
								? attr_value.value
								: `${attr_value.value} ${/** @type {string} */ (scope_class.value)}`,
						);
					} else {
						// An applied theme is read at runtime, so the class is set
						// when the element renders.
						const id = state.flush_node?.();
						state.init?.push(
							b.stmt(
								b.call(
									'_$_.set_class',
									id,
									b.literal(attr_value.value),
									...set_class_args(scope_class, is_html_class),
								),
							),
						);
					}
				} else {
					const id = state.flush_node?.();
					const metadata = { tracking: false };
					const expression = /** @type {AST.Expression} */ (
						visit(attr_value, { ...state, metadata, selector_root: attr_value })
					);
					// A class the compiler can prove to be a string writes through the
					// string-only helper; any other shape needs the clsx-style joiner,
					// which then ships only with a bundle that has such a class.
					const set_class_fn = is_string_expression(attr_value, state)
						? '_$_.set_class'
						: '_$_.set_class_value';

					if (metadata.tracking) {
						local_updates.push({
							operation: (key) =>
								b.stmt(
									b.call(set_class_fn, id, key, ...set_class_args(scope_class, is_html_class)),
								),
							expression,
							identity: attr_value,
							initial: b.member(b.id('_$_'), b.id('UNINITIALIZED')),
						});
					} else {
						state.init?.push(
							b.stmt(
								b.call(set_class_fn, id, expression, ...set_class_args(scope_class, is_html_class)),
							),
						);
					}
				}
			} else if (scope_class !== null) {
				if (scope_class.type === 'Literal') {
					handle_static_attr(
						is_spreading ? '#class' : 'class',
						/** @type {string} */ (scope_class.value),
					);
				} else if (is_spreading) {
					spread_attributes?.push(b.prop('init', b.literal('#class'), scope_class));
				} else {
					const id = state.flush_node?.();
					state.init?.push(
						b.stmt(
							b.call(
								'_$_.set_class',
								id,
								b.literal(null),
								...set_class_args(scope_class, is_html_class),
							),
						),
					);
				}
			}

			if (style_attribute !== null) {
				const attr_value = /** @type {AST.Expression} */ (get_attribute_value(style_attribute));
				if (attr_value.type === 'Literal') {
					handle_static_attr('style', attr_value.value);
				} else {
					const id = state.flush_node?.();
					const metadata = { tracking: false };
					const expression = /** @type {AST.Expression} */ (
						visit(attr_value, { ...state, metadata, selector_root: attr_value })
					);

					if (metadata.tracking) {
						if (attr_value.type === 'TemplateLiteral') {
							// Doesn't need prev tracking
							local_updates.push({
								operation: () => b.stmt(b.call('_$_.set_style', id, expression, b.void0)),
							});
						} else {
							// Object or unknown - needs prev tracking
							local_updates.push({
								operation: (new_value, prev_value) =>
									b.stmt(b.call('_$_.set_style', id, new_value, prev_value)),
								identity: attr_value,
								expression,
								initial: b.void0,
								needsPrevTracking: true,
							});
						}
					} else {
						state.init?.push(b.stmt(b.call('_$_.set_style', id, expression, b.void0)));
					}
				}
			}

			state.template?.push('>');

			if (spread_attributes !== null && spread_attributes.length > 0) {
				// The spread is applied from the element's render function, with
				// the state `_$_.spread` returns kept in a slot of the render
				// state: the runtime compares the object with the one it applied
				// last, so a sole spread passes its expression as it is (an
				// unchanged row object is skipped without a copy or a diff).
				const id = state.flush_node?.();
				const sole =
					spread_attributes.length === 1 && spread_attributes[0].type === 'SpreadElement'
						? spread_attributes[0].argument
						: null;
				/** @type {UpdateEntry} */
				const spread_update = {
					operation: (next, prev) =>
						b.stmt(
							b.assignment(
								'=',
								/** @type {AST.MemberExpression} */ (prev),
								b.call('_$_.spread', id, /** @type {AST.Expression} */ (next), prev),
							),
						),
					expression: sole ?? b.object(spread_attributes),
					// Unique to this element: never grouped with another update.
					identity: node,
					initial: b.void0,
					unguarded: true,
				};
				local_updates.push(spread_update);
			}

			/** @type {TransformClientState['init']} */
			const init = [];
			/** @type {TransformClientState['update']} */
			const update = [];

			if (!is_void) {
				const element_name = /** @type {AST.Identifier} */ (element_id).name;
				const render_children = /** @type {AST.Node[]} */ (
					inner_html_attribute === null
						? lower_code_block_children(node.children, state.scopes)
						: []
				);
				// Special handling for <template> elements
				const leaf_text = { value: false };
				if (element_name === 'template' && render_children.length > 0) {
					transform_template_element(node, state, visit, child_namespace);
				} else {
					transform_children(
						render_children,
						/** @type {VisitorClientContext} */ ({
							visit,
							state: {
								...state,
								init,
								update,
								namespace: child_namespace,
								skip_children_traversal: true,
								leaf_text,
							},
							root: false,
						}),
					);
				}
				state.template?.push(`</${element_name}>`);

				// We need to check if any child nodes are dynamic to determine
				// if we need to pop the hydration stack to the parent node.
				// Template elements never need pop() since we don't traverse into
				// them, and a lone text child is hydrated without moving the cursor.
				const needs_pop =
					element_name !== 'template' &&
					!leaf_text.value &&
					render_children.some(
						(child) =>
							is_template_directive(child) ||
							child.type === 'IfStatement' ||
							child.type === 'TryStatement' ||
							child.type === 'ForOfStatement' ||
							child.type === 'SwitchStatement' ||
							is_template_fragment(child) ||
							(is_template_element(child) &&
								(get_element_id(child).type !== 'Identifier' || !is_element_dom_element(child))) ||
							// A JSXText child is always a literal; only a `{ … }` container
							// (including a merged text run) can hold a dynamic expression.
							(child.type === 'JSXExpressionContainer' && child.expression.type !== 'Literal'),
					);

				if (needs_pop) {
					const id = state.flush_node?.();

					// The cursor restore only matters while hydrating.
					if (state.hydration) {
						init.push(b.stmt(b.logical('&&', b.id('_$_.hydrating'), b.call('_$_.pop', id))));
					}
				}
			}

			update.push(...local_updates);

			if (update.length > 0) {
				if (state.scope.declarations.size > 0) {
					apply_updates(init, update, state);
				} else {
					state.update?.push(...update);
				}
			}

			if (init.length > 0) {
				if (/** @type {AST.Identifier} */ (element_id).name === 'foreignObject') {
					// The children are HTML whatever namespace the element renders
					// in, and that namespace may only be known at runtime (children
					// rendered into a component's `<svg>`): reset it around their
					// setup, so the blocks created here record HTML, and restore it
					// for the siblings that follow.
					const ns_id = b.id(state.scope.generate('ns'));
					init.unshift(b.var(ns_id, b.call('_$_.set_ns', b.literal(DEFAULT_NAMESPACE))));
					init.push(b.stmt(b.call('_$_.set_ns', ns_id)));
				}
				state.init?.push(b.block(init));
			}
		} else {
			const root_controlled = node.metadata?.root_controlled === true;
			// `append_into` is a `{ parent }` sentinel set by transform_children when
			// every sibling is a static component: render directly into the parent,
			// no `<!>` placeholder and no child()/sibling() navigation.
			const append_into = node.metadata?.append_into ?? null;
			const id = root_controlled
				? b.id('__anchor')
				: append_into
					? append_into
					: state.flush_node?.();

			if (
				!root_controlled &&
				!append_into &&
				node.metadata?.append_after === undefined &&
				node.metadata?.append_before !== true
			) {
				state.template?.push('<!>');
			}

			// Only a dynamic `<{tag}>` element carries scope classes here; a
			// component's host elements belong to its own scopes.
			const scope_class = build_scope_class_expression(get_scope_class_chain(node));

			const is_spreading = element_attributes.some((attr) => attr.type === 'JSXSpreadAttribute');

			// `<Portal target={...}>…</Portal>` imported from 'ripple' lowers to the
			// `portal()` runtime fast path: a target thunk and a fixed children
			// render function, with no props object, component context, or
			// element wrapper per portal. Anything else (spreads, refs, a
			// `children` prop) keeps the generic component call.
			if (
				!is_spreading &&
				element_attributes.length === 1 &&
				element_attributes[0].type === 'JSXAttribute' &&
				get_attribute_name(element_attributes[0]) === 'target' &&
				get_attribute_value(element_attributes[0]) !== null &&
				is_ripple_portal(element_id, context)
			) {
				const target_value = /** @type {AST.Expression} */ (
					get_attribute_value(element_attributes[0])
				);
				const target = /** @type {AST.Expression} */ (
					visit(target_value, { ...state, flush_node: null, metadata: { tracking: false } })
				);

				const portal_children = lower_code_block_children(
					/** @type {AST.Node[]} */ (node.children),
					state.scopes,
				);
				for (const child of portal_children) {
					if (is_native_tsrx_function_node(child)) {
						state.init?.push(/** @type {AST.Statement} */ (visit(child, state)));
					}
				}
				const portal_children_filtered = portal_children.filter(
					(child) => child.type !== 'EmptyStatement' && !is_native_tsrx_function_node(child),
				);
				const portal_scope = state.scopes.get(node) || state.scope;
				const render_children = /** @type {AST.Expression} */ (
					visit(create_native_tsrx_render_function([], portal_children_filtered, node), {
						...state,
						regular_js: false,
						scope: /** @type {ScopeInterface} */ (portal_scope),
						namespace: child_namespace,
						is_tsrx_element: true,
					})
				);

				const portal_call = b.call('_$_.portal', id, b.thunk(target), render_children);
				state.init?.push(
					state.namespace !== DEFAULT_NAMESPACE
						? b.stmt(b.call('_$_.with_ns', b.literal(state.namespace), b.thunk(portal_call)))
						: b.stmt(portal_call),
				);
				return;
			}

			/** @type {(AST.Property | AST.SpreadElement)[]} */
			const props = [];
			/** @type {AST.Property | null} */
			let children_prop = null;

			for (const attr of element_attributes) {
				if (attr.type === 'JSXAttribute') {
					{
						const attr_name = get_attribute_name(attr);
						const attr_value = get_attribute_value(attr);
						const metadata = { tracking: false };
						if (attr_name === 'ref' && attr_value !== null) {
							props.push(b.prop('init', b.key('ref'), create_ref_value_call(attr_value, context)));
							continue;
						}

						let property =
							attr_value === null
								? b.literal(true)
								: /** @type {AST.Expression} */ (
										visit(attr_value, { ...state, flush_node: null, metadata })
									);
						if (attr_name === 'class' && scope_class !== null) {
							property =
								property.type === 'Literal' && scope_class.type === 'Literal'
									? b.literal(`${property.value} ${/** @type {string} */ (scope_class.value)}`)
									: b.array([property, scope_class]);
						}

						if (attr_name === 'children') {
							children_prop = b.prop(
								'init',
								b.id('children'),
								b.call('_$_.normalize_children', property),
							);
							props.push(children_prop);
							continue;
						}

						props.push(b.prop('init', b.key(attr_name), property));
					}
				} else if (attr.type === 'JSXSpreadAttribute') {
					props.push(
						b.spread(
							/** @type {AST.Expression} */
							(
								visit(attr.argument, {
									...state,
									flush_node: null,
									metadata: { ...state.metadata },
								})
							),
						),
					);
				} else {
					throw new Error('Unexpected attribute type encountered during client transformation');
				}
			}

			if (scope_class !== null) {
				const hasClassAttr = element_attributes.some(
					(attr) => attr.type === 'JSXAttribute' && get_attribute_name(attr) === 'class',
				);
				if (!hasClassAttr) {
					props.push(b.prop('init', b.key(is_spreading ? '#class' : 'class'), scope_class));
				}
			}

			const element_children = lower_code_block_children(
				/** @type {AST.Node[]} */ (node.children),
				state.scopes,
			);
			for (const child of element_children) {
				if (is_native_tsrx_function_node(child)) {
					state.init?.push(/** @type {AST.Statement} */ (visit(child, state)));
				}
			}

			const children_filtered = element_children.filter(
				(child) => child.type !== 'EmptyStatement' && !is_native_tsrx_function_node(child),
			);

			if (children_filtered.length > 0) {
				const component_scope = state.scopes.get(node) || state.scope;
				const children_component = create_native_tsrx_render_function([], children_filtered, node);

				const children = b.call(
					'_$_.tsrx_element',
					/** @type {AST.Expression} */ (
						visit(children_component, {
							...state,
							regular_js: false,
							scope: /** @type {ScopeInterface} */ (component_scope),
							namespace: child_namespace,
							is_tsrx_element: true,
						})
					),
				);

				// Template children take precedence over explicit children prop
				if (children_prop) {
					const idx = props.indexOf(children_prop);
					if (idx !== -1) props.splice(idx, 1);
				}
				children_prop = b.prop('init', b.id('children'), children);
				props.push(children_prop);
			}

			const metadata = { tracking: false };
			// We visit, but only to gather metadata
			b.call(/** @type {AST.Expression} */ (visit(element_id, { ...state, metadata })));

			// We're calling a component from within svg/mathml context
			const is_with_ns = state.namespace !== DEFAULT_NAMESPACE;

			const object_props = b.object(props);
			// Dynamic tags (`<{expr}>`) always render through composite: the runtime
			// resolves the expression value (component function, tag string, or
			// null) and re-renders when a tracked expression changes. Inside an
			// `<svg>` or `<math>` template the namespace travels as an argument.
			if (metadata.tracking || is_dynamic_element(node)) {
				// A sole spread is passed as it is: the runtime diffs the object
				// against the one it applied last, and skips an identical one.
				const sole_spread =
					props.length === 1 && props[0].type === 'SpreadElement' ? props[0].argument : null;
				const namespace_args = is_with_ns ? [b.literal(state.namespace)] : [];

				// Without children, and anchored inside a template (not a root
				// the block would have to own), the element is driven by the
				// enclosing render function: no block, no closures, and a run
				// whose tag is unchanged only diffs the attributes.
				if (
					children_filtered.length === 0 &&
					children_prop === null &&
					!root_controlled &&
					!append_into &&
					state.update !== null &&
					!state.inside_head
				) {
					/** @type {UpdateEntry} */
					const dynamic_update = {
						operation: (next, prev) =>
							b.stmt(
								b.assignment(
									'=',
									/** @type {AST.MemberExpression} */ (prev),
									b.call(
										'_$_.dynamic',
										/** @type {AST.Expression} */ (prev),
										id,
										/** @type {AST.Expression} */ (visit(element_id, state)),
										/** @type {AST.Expression} */ (next),
										...namespace_args,
									),
								),
							),
						expression: sole_spread ?? object_props,
						identity: node,
						// The slot starts with the tag and props thunks a component
						// target is handed over with; a build that can hydrate lets a
						// composite block claim the server element while hydrating (see
						// `dynamic_init`).
						initial: b.call(
							'_$_.dynamic_init',
							id,
							b.thunk(/** @type {AST.Expression} */ (visit(element_id, state))),
							b.thunk(sole_spread ?? object_props),
							...namespace_args,
						),
						unguarded: true,
					};
					state.update.push(dynamic_update);
				} else {
					state.init?.push(
						b.stmt(
							b.call(
								'_$_.composite',
								b.thunk(/** @type {AST.Expression} */ (visit(element_id, state))),
								id,
								b.thunk(sole_spread ?? object_props),
								...namespace_args,
							),
						),
					);
				}
			} else {
				state.init?.push(
					b.stmt(
						is_with_ns
							? b.call(
									'_$_.render_component_ns',
									b.literal(state.namespace),
									/** @type {AST.Expression} */ (visit(element_id, state)),
									id,
									object_props,
								)
							: b.call(
									'_$_.render_component',
									/** @type {AST.Expression} */ (visit(element_id, state)),
									id,
									object_props,
								),
					),
				);
			}
		}
	},

	AssignmentExpression(node, context) {
		if (context.state.to_ts) {
			return context.next();
		}

		const left = node.left;

		// A binding with an assignment transform (a boxed `let`) writes through it.
		// Must come before the left.tracked check to use the binding's transform
		if (left.type === 'Identifier') {
			const binding = context.state.scope?.get(left.name);
			if (binding?.transform?.assign && binding.node !== left) {
				let value = /** @type {AST.Expression} */ (context.visit(node.right));

				// For compound operators (+=, -=, *=, /=), expand to read + operation
				if (node.operator !== '=') {
					const operator = node.operator.slice(0, -1); // '+=' -> '+'
					const current = binding.transform.read(left);
					value = b.binary(/** @type {AST.BinaryOperator} */ (operator), current, value);
				}

				return binding.transform.assign(left, value);
			}
		}

		const transformed = visit_assignment_expression(node, context, build_assignment);
		if (transformed !== null) {
			return transformed;
		}

		return {
			...node,
			left: /** @type {AST.Pattern} */ (strip_typescript_expression_wrappers(node.left, context)),
			right: /** @type {AST.Expression} */ (context.visit(node.right)),
		};
	},

	UpdateExpression(node, context) {
		if (context.state.to_ts) {
			return context.next();
		}
		const argument = node.argument;

		// A binding with an update transform (a boxed `let`) updates through it
		if (argument.type === 'Identifier') {
			const binding = context.state.scope?.get(argument.name);
			if (binding?.transform?.update && binding.node !== argument) {
				return binding.transform.update(node);
			}
		}

		const left = object(/** @type {AST.MemberExpression | AST.Identifier} */ (argument));
		const binding = left && context.state.scope.get(left.name);
		const transformers = left && binding?.transform;

		if (left === argument) {
			const update_fn = transformers?.update;
			if (update_fn) {
				return update_fn(node);
			}
		}

		context.next();
	},

	ForOfStatement: visit_for_of_statement,
	// `@for` covers for-of / for-in / for(;;): non-for-of forms have no
	// dedicated visitor and keep the default traversal, as before.
	JSXForExpression(node, context) {
		return visit_directive_wrapping_values(node, context, (node, context) => {
			if (node.statementType === 'ForOfStatement') {
				return visit_for_of_statement(node, context);
			}
			return context.next();
		});
	},

	SwitchStatement: visit_switch_statement,
	JSXSwitchExpression(node, context) {
		return visit_directive_wrapping_values(node, context, visit_switch_statement);
	},

	IfStatement: visit_if_statement,
	JSXIfExpression(node, context) {
		return visit_directive_wrapping_values(node, context, visit_if_statement);
	},

	ReturnStatement(node, context) {
		if (
			context.state.jsx_to_tsrx_element &&
			node.argument &&
			is_native_tsrx_template_node(node.argument)
		) {
			return b.return(
				/** @type {AST.Expression} */ (
					context.visit(
						node.argument,
						SetStateForOutsideComponent(context.state, {
							component: undefined,
							flush_node: null,
							template: null,
							jsx_to_tsrx_element: true,
						}),
					)
				),
				/** @type {AST.NodeWithLocation} */ (node),
			);
		}
		if (context.state.to_ts) {
			return b.return(
				node.argument
					? /** @type {AST.Expression} */ (context.visit(node.argument, context.state))
					: undefined,
				/** @type {AST.NodeWithLocation} */ (node),
			);
		}
		return context.next();
	},

	TSSatisfiesExpression(node, context) {
		if (!context.state.to_ts) {
			return context.visit(/** @type {AST.Expression} */ (node.expression));
		}
		return context.next();
	},

	TSAsExpression(node, context) {
		if (!context.state.to_ts) {
			return context.visit(/** @type {AST.Expression} */ (node.expression));
		}
		return context.next();
	},

	TSInstantiationExpression(node, context) {
		if (!context.state.to_ts) {
			// In JavaScript, just return the expression wrapped in parentheses
			return b.sequence([
				/** @type {AST.Expression} */ (
					context.visit(/** @type {AST.Expression} */ (node.expression))
				),
			]);
		}
		return context.next();
	},

	ExportNamedDeclaration(node, context) {
		if (!context.state.to_ts && node.exportKind === 'type') {
			return b.empty;
		}

		// Remove TSDeclareFunction nodes (function overload signatures) in JavaScript mode
		if (
			!context.state.to_ts &&
			/** @type {AST.TSRXDeclaration} */ (node.declaration)?.type === 'TSDeclareFunction'
		) {
			return b.empty;
		}

		if (context.state.to_ts && context.state.ancestor_server_block) {
			// All validation errors will be handled in the analysis phase
			// So we can safely print these
			if (node.declaration) {
				return context.visit(node.declaration);
			} else if (node.specifiers) {
				for (const specifier of node.specifiers) {
					context.visit(specifier);
				}
				return;
			}
		}

		return context.next();
	},

	TSDeclareFunction(node, context) {
		// TSDeclareFunction nodes are TypeScript overload signatures - remove in JavaScript mode
		if (!context.state.to_ts) {
			return b.empty;
		}

		// In TypeScript mode, keep as TSDeclareFunction - esrap will print it with 'declare'
		// We'll remove the 'declare' keyword in post-processing
		return context.next();
	},

	TryStatement: visit_try_statement,
	JSXTryExpression(node, context) {
		return visit_directive_wrapping_values(node, context, visit_try_statement);
	},

	BinaryExpression(node, context) {
		const selector = visit_selector_comparison(node, context);
		if (selector !== null) {
			return selector;
		}
		return b.binary(
			node.operator,
			/** @type {AST.Expression} */ (context.visit(node.left)),
			/** @type {AST.Expression} */ (context.visit(node.right)),
		);
	},

	TemplateLiteral(node, context) {
		const parent = context.path.at(-1);

		if (
			!context.state.to_ts &&
			node.expressions.length === 0 &&
			parent?.type !== 'TaggedTemplateExpression'
		) {
			const literal = b.literal(
				node.quasis[0].value.cooked,
				undefined,
				/** @type {AST.NodeWithLocation} */ (node),
			);
			literal.metadata.source_name = '`' + node.quasis[0].value.raw + '`';
			return literal;
		}

		const expressions = /** @type {AST.Expression[]} */ (
			node.expressions.map((expr) => context.visit(expr))
		);
		return b.template(node.quasis, expressions, /** @type {AST.NodeWithLocation} */ (node));
	},

	BlockStatement(node, context) {
		/** @type {AST.Statement[]} */
		const statements = context.state.to_ts ? [] : box_declaration_statements(node.body);

		for (const statement of node.body) {
			push_statement(
				/** @type {AST.Statement | AST.Statement[]} */ (context.visit(statement)),
				statements,
			);
		}

		return b.block(statements);
	},

	TSModuleBlock(node, context) {
		/** @type {AST.Statement[]} */
		const statements = [];
		for (const statement of node.body) {
			push_statement(
				/** @type {AST.Statement | AST.Statement[]} */ (context.visit(statement)),
				statements,
			);
		}
		return { ...node, body: statements };
	},

	TSModuleDeclaration(node, context) {
		if (!context.state.to_ts && node.declare) {
			return b.empty;
		}
		if (!is_server_module_declaration(node, context.path.at(-1))) {
			return context.next();
		}

		if (context.state.to_ts) {
			// Convert imports inside `module server` to local variables.
			// ImportDeclaration() visitor will add imports to the top of the module
			/** @type {AST.VariableDeclaration[]} */
			const server_block_locals = [];

			const block = /** @type {AST.TSModuleBlock} */ (
				context.visit(node.body, {
					...context.state,
					ancestor_server_block: node,
					server_block_locals,
				})
			);

			/** @type {AST.Property[]} */
			const properties = [];
			for (const name of node.metadata.exports ?? []) {
				const id = b.id(name);
				properties.push(b.prop('init', id, id, false, true));
			}

			// The block's own imports were hoisted to module scope by the
			// ImportDeclaration visitor, so only statements are left behind.
			const block_statements = /** @type {AST.Statement[]} */ (block.body);
			const value = b.call(
				b.thunk(
					b.block([...server_block_locals, ...block_statements, b.return(b.object(properties))]),
				),
			);
			value.loc = node.loc;

			const server_identifier = b.id(
				SERVER_IDENTIFIER,
				/** @type {AST.NodeWithLocation} */ (node.id),
			);
			server_identifier.metadata.source_name = 'server';

			const server_const = b.const(server_identifier, value);
			server_const.loc = node.loc;

			return server_const;
		}

		return b.empty;
	},

	Program(node, context) {
		/** @type {Array<AST.Statement | AST.Directive | AST.ModuleDeclaration>} */
		const statements = [];

		for (const statement of node.body) {
			push_statement(
				/** @type {AST.Statement | AST.Statement[] | AST.Directive | AST.ModuleDeclaration} */ (
					context.visit(statement)
				),
				statements,
			);
		}

		return { ...node, body: statements };
	},
};

/**
 * The `=value` part of a static attribute in a template string, in its
 * shortest form the HTML parser reads back the same way: nothing for an empty
 * value (`hidden`, `class`), the bare value when it holds none of the
 * characters an unquoted value cannot (`type=text`), quotes otherwise.
 * @param {string} name
 * @param {string | number | bigint | boolean | RegExp | null | undefined} value
 * @returns {string}
 */
function static_attribute_value(name, value) {
	if (value === true && is_boolean_attribute(name)) {
		return '';
	}
	const text = value === true ? '' : escape_html(String(value), true);
	if (text === '') {
		return '';
	}
	return /[\s"'=<>`]/.test(text) ? `="${text}"` : `=${text}`;
}

/**
 * Elements whose end tag the parser needs even at the end of the input: their
 * content is raw text or escapable raw text, and an implied end is a parse
 * error the browsers recover from differently.
 */
const REQUIRED_END_TAGS = new Set([
	'script',
	'style',
	'textarea',
	'title',
	'xmp',
	'iframe',
	'noembed',
	'noframes',
	'noscript',
	'plaintext',
]);

/**
 * Drops the end tags that close a template: the parser implies them when the
 * input ends, so `<tr><td></td></tr>` and `<tr><td>` build the same tree. Only
 * the run of end tags at the very end goes, and it stops at an element whose
 * end tag matters (see `REQUIRED_END_TAGS`).
 * @param {Array<string | AST.Expression>} items
 * @returns {Array<string | AST.Expression>}
 */
function strip_trailing_end_tags(items) {
	const stripped = items.slice();
	while (stripped.length > 0) {
		const last = stripped[stripped.length - 1];
		if (typeof last !== 'string') break;
		const match = /<\/([a-zA-Z][\w-]*)>$/.exec(last);
		if (match === null || REQUIRED_END_TAGS.has(match[1].toLowerCase())) break;
		const rest = last.slice(0, -match[0].length);
		if (rest === '') {
			stripped.pop();
		} else {
			stripped[stripped.length - 1] = rest;
		}
	}
	return stripped;
}

/**
 * Elements the HTML parser does not create as written, so a template holding
 * one is parsed: raw-text and escapable-raw-text content, `noscript` (raw
 * text while scripting is on), a dropped leading newline (`pre`, `listing`,
 * `textarea`), template contents, document structure, foreign roots, and
 * `image` (parsed as `img`).
 */
const PARSED_TAGS = new Set([
	'script',
	'style',
	'title',
	'textarea',
	'xmp',
	'iframe',
	'noembed',
	'noframes',
	'plaintext',
	'noscript',
	'pre',
	'listing',
	'template',
	'html',
	'head',
	'body',
	'frameset',
	'frame',
	'svg',
	'math',
	'image',
]);

/**
 * Elements whose children the parser rearranges: the table model (an
 * implied `tbody`, text foster-parented out unless it is all whitespace,
 * which is inserted as written), `select` and its options (children are
 * filtered, options close each other), and ruby annotations (implied end
 * tags). Built only as a leaf, with text the parser keeps in place.
 */
const LEAF_ONLY_TAGS = new Set([
	'table',
	'caption',
	'colgroup',
	'col',
	'thead',
	'tbody',
	'tfoot',
	'tr',
	'td',
	'th',
	'select',
	'option',
	'optgroup',
	'rb',
	'rt',
	'rtc',
	'rp',
]);

/** Text the parser foster-parents out of these unless it is whitespace. */
const TABLE_MODEL_TAGS = new Set(['table', 'thead', 'tbody', 'tfoot', 'tr', 'colgroup']);

/**
 * Table parts the parser ignores outside a table (`<div><td>x</td></div>`
 * parses to `<div>x</div>`): built only as a template's root, where the
 * template insertion mode creates them as written.
 */
const TABLE_PART_TAGS = new Set([
	'caption',
	'colgroup',
	'col',
	'thead',
	'tbody',
	'tfoot',
	'tr',
	'td',
	'th',
]);

/**
 * Start tags that close an open ancestor the parser has in scope, at any
 * depth, so the tree written is not the tree the parser builds: a `p` is
 * closed by every block-level start tag of the "in body" insertion mode,
 * list items and descriptions by their own kind. Most of these nestings
 * (and those of `a`, `button`, `form` and headings) are compile errors
 * before a template is built; the table is the parser's, not the
 * validator's, so it stays complete.
 * @type {Map<string, Set<string>>}
 */
const CLOSED_BY_DESCENDANT = new Map([
	[
		'p',
		new Set([
			'address',
			'article',
			'aside',
			'blockquote',
			'center',
			'dd',
			'details',
			'dialog',
			'dir',
			'div',
			'dl',
			'dt',
			'fieldset',
			'figcaption',
			'figure',
			'footer',
			'form',
			'h1',
			'h2',
			'h3',
			'h4',
			'h5',
			'h6',
			'header',
			'hgroup',
			'hr',
			'li',
			'listing',
			'main',
			'menu',
			'nav',
			'ol',
			'p',
			'plaintext',
			'pre',
			'search',
			'section',
			'summary',
			'table',
			'ul',
			'xmp',
		]),
	],
	['li', new Set(['li'])],
	['dt', new Set(['dt', 'dd'])],
	['dd', new Set(['dt', 'dd'])],
	['nobr', new Set(['nobr'])],
]);

/**
 * Elements that may fetch a resource from an attribute as soon as it is set,
 * even while detached: a template holding one builds its master in the inert
 * template document, as a parse would (`template_el` in the client runtime).
 */
const RESOURCE_TAGS = new Set([
	'img',
	'picture',
	'source',
	'track',
	'video',
	'audio',
	'iframe',
	'embed',
	'object',
	'input',
	'link',
	'base',
	'frame',
]);

/** Past this many nodes a parse is the cheaper way to build a template. */
const DOM_BUILT_MAX_NODES = 8;

const START_TAG = /<([a-z][a-z0-9]*)((?: [a-z][a-z0-9-]*(?:=(?:[^\s"'<>=`&]+|"[^"<]*"))?)*)>/y;
const END_TAG = /<\/([a-z][a-z0-9]*)>/y;
const TEXT = /[^<]+/y;
const STATIC_ATTRIBUTE = / ([a-z][a-z0-9-]*)(?:=("[^"]*"|[^\s"]+))?/g;
const STATIC_ENTITY = /&(amp|lt|quot);/g;

/**
 * Decodes the character references `escape_html` produces.
 * @param {string} text
 * @returns {string}
 */
function decode_static_html(text) {
	return text.replace(STATIC_ENTITY, (_, name) =>
		name === 'amp' ? '&' : name === 'lt' ? '<' : '"',
	);
}

/**
 * @typedef {{ tag: string, attributes: string[], children: string | DomBuiltChild[] }} DomBuiltElement
 * @typedef {DomBuiltElement | string | null} DomBuiltChild
 * @typedef {{ root: DomBuiltElement, inert: boolean }} DomBuiltTemplate
 */

/**
 * A static HTML template of one element with static attributes and at most
 * a few nested elements, text nodes and placeholder comments, as a tree, or
 * `null`: such a template is built with DOM calls instead of parsed (see
 * `template_el` in the client runtime). Every node must come out exactly as
 * the parser would create it, so the tree is refused when a tag is parsed
 * specially (`PARSED_TAGS`, `LEAF_ONLY_TAGS`, `TABLE_PART_TAGS`), a start tag would close an open ancestor
 * (`CLOSED_BY_DESCENDANT`), or the content holds a character the parser
 * rewrites. Attribute names stay lowercase ASCII and namespace-free so
 * `setAttribute` matches the parser, and the parser keeps the first of two
 * same-named attributes; `is` would need `createElement` to know about it;
 * a custom element (a hyphenated tag) is only upgraded when the template is
 * parsed in the inert document.
 * @param {(string | AST.Expression)[]} items
 * @returns {DomBuiltTemplate | null}
 */
function dom_built_template(items) {
	let content = '';
	for (const item of items) {
		if (typeof item === 'string') {
			content += item;
		} else if (item.type === 'Literal' && typeof item.value === 'string') {
			content += item.value;
		} else if (item.type === 'TemplateLiteral' && item.expressions.length === 0) {
			content += item.quasis[0].value.cooked;
		} else {
			return null;
		}
	}
	// A carriage return is normalized and a NUL replaced before the tree is built.
	if (/[\r\0]/.test(content)) return null;

	let pos = 0;
	let nodes = 0;
	let inert = false;
	/** @type {string[]} */
	const open = [];

	/** @returns {DomBuiltElement | null} */
	const parse_element = () => {
		START_TAG.lastIndex = pos;
		const match = START_TAG.exec(content);
		if (match === null) return null;
		const tag = match[1];
		if (PARSED_TAGS.has(tag) || ++nodes > DOM_BUILT_MAX_NODES) return null;
		if (open.length > 0 && TABLE_PART_TAGS.has(tag)) return null;
		if (RESOURCE_TAGS.has(tag)) inert = true;
		for (const ancestor of open) {
			if (CLOSED_BY_DESCENDANT.get(ancestor)?.has(tag)) return null;
		}
		/** @type {string[]} */
		const attributes = [];
		/** @type {Set<string>} */
		const names = new Set();
		for (const attribute of match[2].matchAll(STATIC_ATTRIBUTE)) {
			const name = attribute[1];
			if (name === 'is' || names.has(name)) return null;
			names.add(name);
			const value = attribute[2] ?? '';
			attributes.push(name, decode_static_html(value.startsWith('"') ? value.slice(1, -1) : value));
		}
		pos = START_TAG.lastIndex;
		if (is_void_element(tag)) {
			return { tag, attributes, children: '' };
		}
		open.push(tag);
		/** @type {DomBuiltChild[]} */
		const children = [];
		while (pos < content.length) {
			if (content.startsWith('</', pos)) {
				END_TAG.lastIndex = pos;
				const end = END_TAG.exec(content);
				if (end === null || end[1] !== tag) return null;
				pos = END_TAG.lastIndex;
				break;
			}
			if (content.startsWith('<!>', pos)) {
				if (++nodes > DOM_BUILT_MAX_NODES) return null;
				children.push(null);
				pos += 3;
			} else if (content.charCodeAt(pos) === 60 /* < */) {
				const child = parse_element();
				if (child === null) return null;
				children.push(child);
			} else {
				TEXT.lastIndex = pos;
				const text = /** @type {RegExpExecArray} */ (TEXT.exec(content));
				if (++nodes > DOM_BUILT_MAX_NODES) return null;
				children.push(decode_static_html(text[0]));
				pos = TEXT.lastIndex;
			}
		}
		open.pop();
		// One text child is written through `textContent`.
		const text = children.length === 1 && typeof children[0] === 'string' ? children[0] : null;
		if (LEAF_ONLY_TAGS.has(tag)) {
			if (children.length > 0 && text === null) return null;
			if (TABLE_MODEL_TAGS.has(tag) && text !== null && text.trim() !== '') return null;
		}
		return { tag, attributes, children: text ?? children };
	};

	const root = parse_element();
	return root !== null && pos === content.length ? { root, inert } : null;
}

/**
 * The `tag, attributes, children` arguments of a DOM-built element, trailing
 * absences left out unless `inert` follows them.
 * @param {DomBuiltElement} element
 * @param {boolean} [inert]
 * @returns {AST.Expression[]}
 */
function dom_built_arguments(element, inert = false) {
	const { tag, attributes, children } = element;
	/** @type {AST.Expression[]} */
	const args = [b.literal(tag)];
	const has_children = typeof children === 'string' ? children !== '' : children.length > 0;
	if (attributes.length > 0 || has_children || inert) {
		args.push(
			attributes.length > 0
				? b.array(attributes.map((value) => b.literal(value)))
				: b.literal(null),
		);
	}
	if (has_children || inert) {
		args.push(
			typeof children === 'string'
				? b.literal(children)
				: b.array(
						children.map((child) =>
							child === null
								? b.literal(null)
								: typeof child === 'string'
									? b.literal(child)
									: b.array(dom_built_arguments(child)),
						),
					),
		);
	}
	if (inert) {
		args.push(b.literal(1));
	}
	return args;
}

/**
 * How a non-event attribute of an element is written: `'property'` for a
 * settable property of the element per Web IDL (`dom-setters.js`), so a
 * non-string value is assigned; `'attribute'` for any other name of an HTML
 * element, written with `setAttribute` alone; `null` when only the runtime
 * can tell (a custom element, a tag that is also an SVG or MathML element,
 * namespaced content), which keeps `set_attribute` and its setter walk. An
 * unlisted HTML tag is an `HTMLUnknownElement`, with `HTMLElement`'s setters.
 * @param {string} element_name
 * @param {string} name
 * @param {TransformClientState} state
 * @returns {'property' | 'attribute' | null}
 */
function attribute_kind(element_name, name, state) {
	if (
		state.namespace !== 'html' ||
		element_name.includes('-') ||
		isSvgTagName(element_name) ||
		isMathmlTagName(element_name)
	) {
		return null;
	}
	return HTML_ELEMENT_SETTERS.has(name) || HTML_TAG_SETTERS[element_name]?.includes(name)
		? 'property'
		: 'attribute';
}

/**
 * The runtime helper that writes an attribute of the given kind (see
 * {@link attribute_kind}).
 * @param {'property' | 'attribute' | null} kind
 * @returns {string}
 */
function attribute_helper(kind) {
	return kind === 'property'
		? '_$_.set_property_value'
		: kind === 'attribute'
			? '_$_.set_attribute_value'
			: '_$_.set_attribute';
}

/**
 * Whether an attribute value can be written with `setAttribute` alone: a
 * string (never removed, never a property), or on a name that is not a
 * property (`kind`, or a `data-` or `aria-` name of any element), a value
 * the checker proved to be a primitive (a string, number or bigint, never
 * `null` or `undefined`).
 * @param {string} name
 * @param {AST.Node} node
 * @param {TransformClientState} state
 * @param {'property' | 'attribute' | null} kind
 * @returns {boolean}
 */
function is_direct_attribute_value(name, node, state, kind) {
	if (is_string_expression(node, state)) return true;
	if (kind !== 'attribute' && !(name.startsWith('data-') || name.startsWith('aria-'))) return false;
	while (
		node.type === 'JSXExpressionContainer' ||
		node.type === 'TSAsExpression' ||
		node.type === 'TSNonNullExpression' ||
		node.type === 'TSSatisfiesExpression' ||
		node.type === 'TSTypeAssertion'
	) {
		node = /** @type {any} */ (node).expression;
	}
	return has_text_type_fact(/** @type {AST.Expression} */ (node), state.scope, false);
}

/**
 * Whether an expression always evaluates to a string: a string literal or
 * template, a `+` with a string operand, a conditional with string branches,
 * a `String()` coercion, or a text-typed expression the checker proved.
 * @param {AST.Node} node
 * @param {TransformClientState} state
 * @returns {boolean}
 */
function is_string_expression(node, state) {
	switch (node.type) {
		case 'JSXExpressionContainer':
			return is_string_expression(/** @type {any} */ (node).expression, state);
		case 'Literal':
			return typeof node.value === 'string';
		case 'TemplateLiteral':
			return true;
		case 'BinaryExpression':
			return (
				node.operator === '+' &&
				(is_string_expression(node.left, state) || is_string_expression(node.right, state))
			);
		case 'ConditionalExpression':
			return (
				is_string_expression(node.consequent, state) && is_string_expression(node.alternate, state)
			);
		case 'TSAsExpression':
		case 'TSNonNullExpression':
		case 'TSSatisfiesExpression':
		case 'TSTypeAssertion':
			return is_string_expression(/** @type {any} */ (node).expression, state);
		case 'CallExpression':
			return (
				node.callee.type === 'Identifier' &&
				node.callee.name === 'String' &&
				state.scope.get('String') === null
			);
		default:
			return has_text_type_fact(/** @type {AST.Expression} */ (node), state.scope, true);
	}
}

/**
 * The trailing arguments of a `set_class` call, without the runtime's
 * defaults: no scope hash and an HTML element pass nothing.
 * @param {AST.Expression | null} scope_class
 * @param {boolean} is_html_class
 * @returns {AST.Expression[]}
 */
function set_class_args(scope_class, is_html_class) {
	if (is_html_class) {
		return scope_class === null ? [] : [scope_class];
	}
	return [scope_class ?? b.void0, b.literal(false)];
}

/**
 * @param {Array<string | AST.Expression>} items
 */
function join_template(items) {
	let quasi = b.quasi('');
	const template = b.template([quasi], []);

	/**
	 * @param {AST.Expression} expression
	 */
	function push(expression) {
		if (expression.type === 'TemplateLiteral') {
			for (let i = 0; i < expression.expressions.length; i += 1) {
				const q = expression.quasis[i];
				const e = expression.expressions[i];

				quasi.value.cooked += /** @type {string} */ (q.value.cooked);
				push(e);
			}

			const last = expression.quasis.at(-1);
			quasi.value.cooked += /** @type {string} */ (last?.value.cooked);
		} else if (expression.type === 'Literal') {
			/** @type {string} */ (quasi.value.cooked) += expression.value;
		} else {
			template.expressions.push(expression);
			template.quasis.push((quasi = b.quasi('')));
		}
	}

	for (const item of items) {
		if (typeof item === 'string') {
			quasi.value.cooked += item;
		} else {
			push(item);
		}
	}

	for (const quasi of template.quasis) {
		quasi.value.raw = sanitizeTemplateString(/** @type {string} */ (quasi.value.cooked));
	}

	quasi.tail = true;

	return template;
}

/**
 * @typedef {AST.Statement | ESTreeJSX.JSXElement | AST.TSRXJSXFragment} TsrxTsStatement
 * @typedef {AST.Expression | ESTreeJSX.JSXElement | AST.TSRXJSXFragment} TsrxTsExpression
 * @typedef {ESTreeJSX.JSXText | ESTreeJSX.JSXExpressionContainer | ESTreeJSX.JSXElement | AST.TSRXJSXElement | AST.TSRXJSXFragment} TsrxTsxChild
 * @typedef {TsrxTsExpression | ESTreeJSX.JSXText | ESTreeJSX.JSXExpressionContainer} TsrxTsViewNode
 */

/**
 * @param {TsrxTsStatement} statement
 * @returns {TsrxTsExpression | null}
 */
function statement_to_tsrx_ts_expression(statement) {
	if (statement.type === 'ExpressionStatement') {
		return /** @type {AST.ExpressionStatement} */ (statement).expression;
	}
	const node = /** @type {AST.Node} */ (statement);
	if (node.type === 'JSXElement' || node.type === 'JSXFragment') {
		return /** @type {ESTreeJSX.JSXElement | ESTreeJSX.JSXFragment} */ (node);
	}
	return null;
}

/**
 * @param {TsrxTsxChild[]} children
 * @param {boolean} in_jsx_child
 * @param {AST.NodeWithLocation} loc_node
 * @returns {TsrxTsViewNode}
 */
function build_tsrx_ts_return_expression(children, in_jsx_child, loc_node) {
	if (children.length === 0) {
		// An empty fragment is a real value: keep it as `<></>` even in expression
		// position. Lowering it to `null` (e.g. `let b = <></>`) drops the author's
		// fragment; `<></>` is a valid value and matches the JSX targets' TS view.
		return setLocation(b.jsx_fragment([]), loc_node);
	}
	if (children.length === 1) {
		const only = children[0];
		if (only.type === 'JSXText') {
			// Stay faithful to the source: keep a single text child as `<>text</>`
			// rather than promoting it to a `{'text'}` string literal. Promotion mangles
			// characters like `@` (a valid text char) into `{'@'}` and loses fidelity.
			return setLocation(b.jsx_fragment([only]), /** @type {AST.NodeWithLocation} */ (only));
		}
		if (only.type === 'JSXExpressionContainer' && !in_jsx_child) {
			return only.expression;
		}
		if (is_empty_jsx_fragment(only)) {
			// `<><></></>` — keep the outer fragment instead of collapsing to the bare
			// inner `<></>`, matching the JSX targets and preserving author intent.
			return setLocation(b.jsx_fragment([only]), loc_node);
		}
		return /** @type {TsrxTsViewNode} */ (only);
	}
	return b.jsx_fragment(children);
}

/**
 * @param {AST.Node[]} children
 * @param {VisitorClientContext} context
 * @returns {TsrxTsStatement[]}
 */
function transform_tsrx_ts_children(children, context) {
	const { state } = context;
	/** @type {TsrxTsStatement[]} */
	const init = [];
	const ts_state = { ...state, init };

	for (const child of lower_code_block_children(children, state.scopes)) {
		if (child == null || child.type === 'EmptyStatement') continue;
		// Spread `context` (not just `visit`/`state`) so flags like `value_position`
		// reach nested fragment/element children — see transform_tsrx_tsx_child.
		transform_ts_child(
			/** @type {AST.Node} */ (child),
			/** @type {TransformClientContext} */ ({ ...context, state: ts_state }),
		);
	}

	return init.filter((statement) => statement.type !== 'EmptyStatement');
}

/**
 * Builds a TSX expression for Volar/TypeScript output. Pure template children can
 * remain inline JSX; fragments with setup statements need an IIFE so declarations
 * stay in statement position.
 *
 * @param {ESTreeJSX.JSXFragment | AST.TSRXJSXFragment} node
 * @param {VisitorClientContext} context
 * @param {boolean} [in_jsx_child]
 * @returns {TsrxTsViewNode}
 */
function build_tsrx_to_ts_expression(node, context, in_jsx_child = false) {
	// A compiler-generated wrapper (utils.js `wrap_directive_in_jsx_fragment`) around
	// a single VALUE-position directive lowers to a TYPED VALUE (ternary / `.map` /
	// returning IIFE), not the void render IIFE `transform_tsrx_tsx_children` would
	// emit. Render position never sets `tsrx_generated_wrapper`, so it is unaffected;
	// authored `<> … </>` (no wrapper flag) keeps flowing through the normal path.
	if (node.metadata?.tsrx_generated_wrapper === true) {
		const only = /** @type {AST.Node | undefined} */ (
			(node.children || []).find((child) => child && child.type !== 'EmptyStatement')
		);
		if (only && is_template_directive(only)) {
			const value = build_tsrx_ts_directive_value(only, context);
			return in_jsx_child ? b.jsx_expression_container(value) : value;
		}
	}
	const children = transform_tsrx_tsx_children(/** @type {AST.Node[]} */ (node.children), context);
	return build_tsrx_ts_return_expression(
		children,
		in_jsx_child,
		/** @type {AST.NodeWithLocation} */ (/** @type {unknown} */ (node)),
	);
}

/**
 * @param {ESTreeJSX.JSXExpressionContainer | ESTreeJSX.JSXText} node
 * @returns {AST.NodeWithLocation | undefined}
 */
function get_tsrx_expression_container_location(node) {
	if (has_location(node)) return node;

	const expression = /** @type {AST.Expression & Partial<AST.NodeWithLocation>} */ (
		/** @type {ESTreeJSX.JSXExpressionContainer} */ (node).expression
	);
	if (!expression.loc || node.start == null || node.end == null) {
		return undefined;
	}

	return /** @type {AST.NodeWithLocation} */ ({
		start: node.start,
		end: node.end,
		loc: {
			start: {
				line: expression.loc.start.line,
				column: Math.max(0, expression.loc.start.column - 1),
			},
			end: {
				line: expression.loc.end.line,
				column: expression.loc.end.column + 1,
			},
		},
	});
}

/**
 * @param {AST.Node[]} children
 * @param {VisitorClientContext} context
 * @returns {TsrxTsxChild[]}
 */
function transform_tsrx_tsx_children(children, context) {
	/** @type {TsrxTsxChild[]} */
	const transformed_children = [];
	/** @type {AST.Node[]} */
	let pending_statement_children = [];

	const flush_pending_statement_children = () => {
		if (pending_statement_children.length === 0) return;

		const statements = transform_body(pending_statement_children, context);
		if (statements.length > 0) {
			transformed_children.push(b.jsx_expression_container(b.call(b.thunk(b.block(statements)))));
		}
		pending_statement_children = [];
	};

	for (const child of lower_code_block_children(children, context.state.scopes)) {
		const transformed = transform_tsrx_tsx_child(child, context);
		if (transformed === undefined) {
			pending_statement_children.push(child);
			continue;
		}

		flush_pending_statement_children();
		if (transformed !== null) {
			transformed_children.push(transformed);
		}
	}

	flush_pending_statement_children();
	return /** @type {TsrxTsxChild[]} */ (wrap_edge_whitespace(transformed_children));
}

/**
 * @param {AST.Node} node
 * @param {VisitorClientContext} context
 * @returns {TsrxTsxChild | null | undefined}
 */
function transform_tsrx_tsx_child(node, context) {
	if (node == null || node.type === 'EmptyStatement') {
		return null;
	}

	if (node.type === 'JSXText') {
		const value = get_template_text_value(node, true);
		return setLocation(b.jsx_text(value, value), /** @type {AST.NodeWithLocation} */ (node));
	}

	if (node.type === 'JSXExpressionContainer') {
		// A `{/* comment */}` container renders nothing.
		if (is_empty_expression_container(node)) {
			return null;
		}
		// An EMPTY fragment that is the container's expression (`<b>{<></>}</b>`) must
		// stay `<></>`: the `{}` already supplies the wrapper, so the default
		// `in_jsx_child = false` lowering to a bare `null` drops the source fragment.
		// Build it as a JSX child instead. Non-empty fragments keep their existing
		// lowering (e.g. `{<>{a}</>}` still unwraps to `{a}`). This matches the JSX
		// targets and how the same fragment survives in an attribute value.
		const expr = node.expression;
		// Both fragment shapes carry AST.Node children (the strict estree-jsx
		// children are a subset).
		const fragment_children =
			expr.type === 'JSXFragment' && is_template_fragment(expr)
				? /** @type {AST.Node[]} */ (expr.children || [])
				: null;
		const is_empty_fragment =
			fragment_children !== null &&
			!fragment_children.some(
				(child) =>
					child &&
					child.type !== 'EmptyStatement' &&
					(child.type !== 'JSXText' || get_template_text_value(child, true) !== ''),
			);
		const expression = is_empty_fragment
			? build_tsrx_to_ts_expression(/** @type {ESTreeJSX.JSXFragment} */ (expr), context, true)
			: /** @type {AST.Expression} */ (context.visit(node.expression, context.state));
		return b.jsx_expression_container(
			/** @type {AST.Expression} */ (expression),
			get_tsrx_expression_container_location(node),
		);
	}

	if (is_template_element(node) || node.type === 'JSXStyleElement') {
		const expression = transform_ts_child(node, {
			...context,
			state: { ...context.state, init: null },
		});
		return expression
			? /** @type {TsrxTsxChild} */ (/** @type {unknown} */ (expression))
			: undefined;
	}

	if (is_template_fragment(node)) {
		// `in_jsx_child` mode already returns a valid JSX child (a fragment, or a
		// `{expr}` container kept for type visibility), so use it as-is. Only a bare
		// expression (which can happen in other positions) needs wrapping.
		const expression = build_tsrx_to_ts_expression(
			/** @type {ESTreeJSX.JSXFragment} */ (node),
			context,
			true,
		);
		if (
			expression.type === 'JSXElement' ||
			expression.type === 'JSXFragment' ||
			expression.type === 'JSXExpressionContainer' ||
			expression.type === 'JSXText'
		) {
			return expression;
		}
		return b.jsx_expression_container(expression);
	}

	// A directive nested as a child of VALUE content (inside an authored fragment that
	// is itself a directive's branch/case value) is value content too — lower it to
	// its value (`{cond ? <a/> : <b/>}`), like the JS targets. In render position (a
	// direct child of the component's rendered output) `@if`/`@for`/`@try` still render
	// as statements, so that is gated on `value_position`.
	//
	// A `@switch` is the exception: `@case` always renders and cannot `break`/fall through,
	// so lowering it to a render statement leaves cases without a `return`, which TS reports
	// as "Fallthrough case in switch" (7029). Its value form already returns from every case
	// (with a trailing `return null`), so lower a `@switch` child to its value in render
	// position too — it renders the matched case's output all the same.
	if (
		is_template_directive(node) &&
		(context.value_position || node.type === 'JSXSwitchExpression')
	) {
		return b.jsx_expression_container(build_tsrx_ts_directive_value(node, context));
	}

	return undefined;
}

/**
 * @param {TsrxTsStatement[]} statements
 * @returns {AST.Statement[]}
 */
function transform_tsrx_ts_statements_to_render_body(statements) {
	/** @type {AST.Statement[]} */
	const body = [];

	for (const statement of statements) {
		const child = statement_to_tsrx_ts_expression(statement);
		body.push(
			child
				? b.return(/** @type {AST.Expression} */ (child))
				: /** @type {AST.Statement} */ (statement),
		);
	}

	return body;
}

/**
 * @param {AST.Node[]} children
 * @param {VisitorClientContext} context
 * @returns {AST.Statement[]}
 */
function transform_tsrx_ts_render_children(children, context) {
	/** @type {AST.Statement[]} */
	const body = [];

	for (const child of lower_code_block_children(children, context.state.scopes)) {
		if (child == null || child.type === 'EmptyStatement') continue;

		if (is_template_or_control_flow(child)) {
			if (
				is_template_directive(child) ||
				child.type === 'IfStatement' ||
				child.type === 'ForOfStatement' ||
				child.type === 'SwitchStatement' ||
				child.type === 'TryStatement'
			) {
				body.push(transform_tsrx_ts_render_control_flow_statement(child, context));
			} else {
				body.push(
					...transform_tsrx_ts_statements_to_render_body(
						transform_tsrx_ts_children([child], context),
					),
				);
			}
		} else {
			body.push(
				.../** @type {AST.Statement[]} */ (
					transform_tsrx_ts_children([/** @type {AST.Node} */ (child)], context)
				),
			);
		}
	}

	return body;
}

/**
 * @param {AST.Node} node
 * @param {VisitorClientContext} context
 * @returns {AST.Statement}
 */
function transform_tsrx_ts_render_node(node, context) {
	const body = transform_tsrx_ts_render_children([node], context);
	return body.length === 1 ? body[0] : b.block(body);
}

/**
 * Whether a generated statement is guaranteed to return or throw, so control cannot
 * reach past it. Used to decide whether a `@switch` case needs a synthetic trailing
 * `return` in the type-only view (a `@case` always renders and cannot fall through,
 * so the generated case must definitely return — otherwise TS reports 7029).
 * @param {AST.Statement | null | undefined} statement
 * @returns {boolean}
 */
function statement_definitely_returns(statement) {
	if (!statement) {
		return false;
	}
	if (statement.type === 'ReturnStatement' || statement.type === 'ThrowStatement') {
		return true;
	}
	if (statement.type === 'BlockStatement') {
		return statement_definitely_returns(statement.body[statement.body.length - 1]);
	}
	if (statement.type === 'IfStatement') {
		return (
			statement.alternate != null &&
			statement_definitely_returns(/** @type {AST.Statement} */ (statement.consequent)) &&
			statement_definitely_returns(/** @type {AST.Statement} */ (statement.alternate))
		);
	}
	return false;
}

/**
 * @param {AST.JSXIfExpression | AST.JSXForExpression | AST.JSXSwitchExpression | AST.JSXTryExpression | AST.IfStatement | AST.ForOfStatement | AST.SwitchStatement | AST.TryStatement} node
 * @param {VisitorClientContext} context
 * @returns {AST.Statement}
 */
function transform_tsrx_ts_render_control_flow_statement(node, context) {
	if (node.type === 'JSXIfExpression' || node.type === 'IfStatement') {
		const consequent_scope =
			/** @type {ScopeInterface} */ (context.state.scopes.get(node.consequent)) ||
			context.state.scope;
		const consequent_body =
			node.consequent.type === 'BlockStatement' ? node.consequent.body : [node.consequent];
		const consequent = b.block(
			transform_tsrx_ts_render_children(consequent_body, {
				...context,
				state: { ...context.state, scope: consequent_scope },
			}),
			/** @type {AST.NodeWithLocation} */ (node.consequent),
		);

		let alternate = null;
		if (node.alternate !== null) {
			const alternate_node = /** @type {AST.Statement} */ (node.alternate);
			const alternate_scope = context.state.scopes.get(alternate_node) || context.state.scope;
			alternate =
				alternate_node.type === 'IfStatement'
					? transform_tsrx_ts_render_control_flow_statement(alternate_node, {
							...context,
							state: { ...context.state, scope: alternate_scope },
						})
					: b.block(
							transform_tsrx_ts_render_children(
								alternate_node.type === 'BlockStatement' ? alternate_node.body : [alternate_node],
								{
									...context,
									state: { ...context.state, scope: alternate_scope },
								},
							),
							/** @type {AST.NodeWithLocation} */ (alternate_node),
						);
		}

		return b.if(
			/** @type {AST.Expression} */ (context.visit(node.test, context.state)),
			consequent,
			alternate,
			/** @type {AST.NodeWithLocation} */ (node),
		);
	}

	if (
		node.type === 'ForOfStatement' ||
		(node.type === 'JSXForExpression' && node.statementType === 'ForOfStatement')
	) {
		const body_scope = /** @type {ScopeInterface} */ (context.state.scopes.get(node.body));
		const block_body = transform_tsrx_ts_render_children(
			/** @type {AST.BlockStatement} */ (node.body).body,
			{
				...context,
				state: { ...context.state, scope: body_scope },
			},
		);
		if (node.key) {
			block_body.unshift(b.stmt(/** @type {AST.Expression} */ (context.visit(node.key))));
		}
		if (node.index) {
			block_body.unshift(
				b.let(/** @type {AST.Identifier} */ (context.visit(node.index)), b.literal(0)),
			);
		}
		const empty =
			node.empty != null
				? b.block(
						transform_tsrx_ts_render_children(node.empty.body, {
							...context,
							state: {
								...context.state,
								scope: context.state.scopes.get(node.empty) || context.state.scope,
							},
						}),
						/** @type {AST.NodeWithLocation} */ (node.empty),
					)
				: null;

		const result = b.for_of(
			/** @type {AST.Pattern} */ (context.visit(/** @type {AST.Node} */ (node.left))),
			/** @type {AST.Expression} */ (context.visit(/** @type {AST.Node} */ (node.right))),
			b.block(block_body),
			node.await,
			/** @type {AST.NodeWithLocation} */ (node),
		);
		result.empty = empty;
		return result;
	}

	if (node.type === 'SwitchStatement' || node.type === 'JSXSwitchExpression') {
		const cases = node.cases.map((switch_case) => {
			const consequent_scope = context.state.scopes.get(switch_case) || context.state.scope;
			const body = transform_tsrx_ts_render_children(
				flatten_switch_consequent(switch_case.consequent),
				{
					...context,
					state: { ...context.state, scope: consequent_scope },
				},
			);

			// A `@case` always renders and cannot `break`/fall through, so the generated case
			// must definitely return. When its render is conditional (e.g. an `@if` with no
			// else) or the case is empty, control can reach the end and TS reports
			// "Fallthrough case in switch" (7029). Append a trailing `return <></>` (render
			// nothing) — but only when the body doesn't already definitely return, so we never
			// emit unreachable code.
			if (!statement_definitely_returns(body[body.length - 1])) {
				body.push(b.return(b.jsx_fragment([])));
			}

			return b.switch_case(
				switch_case.test ? /** @type {AST.Expression} */ (context.visit(switch_case.test)) : null,
				scope_switch_case_body(body),
			);
		});

		return b.switch(
			/** @type {AST.Expression} */ (context.visit(node.discriminant)),
			cases,
			/** @type {AST.NodeWithLocation} */ (node),
		);
	}

	const try_node = /** @type {AST.TryStatement | AST.JSXTryExpression} */ (node);
	const try_scope = /** @type {ScopeInterface} */ (context.state.scopes.get(try_node.block));
	const try_body = b.block(
		transform_tsrx_ts_render_children(try_node.block.body, {
			...context,
			state: { ...context.state, scope: try_scope },
		}),
		/** @type {AST.NodeWithLocation} */ (try_node.block),
	);

	let catch_handler = null;
	if (try_node.handler) {
		const catch_scope = /** @type {ScopeInterface} */ (
			context.state.scopes.get(try_node.handler.body)
		);
		catch_handler = b.catch_clause(
			try_node.handler.param || null,
			try_node.handler.resetParam || null,
			b.block(
				transform_tsrx_ts_render_children(try_node.handler.body.body, {
					...context,
					state: { ...context.state, scope: catch_scope },
				}),
				/** @type {AST.NodeWithLocation} */ (try_node.handler.body),
			),
			/** @type {AST.NodeWithLocation} */ (try_node.handler),
		);
	}

	const pending = try_node.pending
		? b.block(
				transform_tsrx_ts_render_children(try_node.pending.body, {
					...context,
					state: {
						...context.state,
						scope: /** @type {ScopeInterface} */ (context.state.scopes.get(try_node.pending)),
					},
				}),
				/** @type {AST.NodeWithLocation} */ (try_node.pending),
			)
		: null;
	const finalizer = try_node.finalizer
		? b.block(
				transform_body(try_node.finalizer.body, {
					...context,
					state: {
						...context.state,
						scope: /** @type {ScopeInterface} */ (context.state.scopes.get(try_node.finalizer)),
					},
				}),
				/** @type {AST.NodeWithLocation} */ (try_node.finalizer),
			)
		: null;

	return b.try(try_body, catch_handler, finalizer, pending);
}

/**
 * Lower a VALUE-position control-flow directive (`const v = @if (…) { … }`) to a
 * typed TS value for the to_ts view — a ternary (`@if`), an array `.map` (`@for`),
 * or a returning IIFE (`@switch`/`@try`) — matching the JS targets' types. Unlike
 * the render path (`transform_tsrx_ts_render_control_flow_statement`), each branch
 * LEAF is returned, so the value is not a void IIFE. Render position never reaches
 * here — only the generated value-wrapper fragment does (see
 * `build_tsrx_to_ts_expression`).
 * @param {AST.JSXTemplateDirective | AST.IfStatement} node — a directive, or a
 * plain `IfStatement` link of an `@else if` chain (the recursion below)
 * @param {VisitorClientContext} context
 * @returns {AST.Expression}
 */
function build_tsrx_ts_directive_value(node, context) {
	const scoped = (/** @type {AST.Node | AST.Node[]} */ scope_node) => ({
		...context,
		// Everything lowered as a directive's branch/case value is value content, so a
		// directive nested in a fragment here lowers to a value (see transform_tsrx_tsx_child).
		value_position: true,
		state: {
			...context.state,
			scope:
				/** @type {ScopeInterface} */ (context.state.scopes.get(scope_node)) || context.state.scope,
		},
	});
	// Combine a render expression into a JSX child so multiple siblings can be
	// merged into one fragment.
	const to_fragment_child = (/** @type {TsrxTsViewNode} */ expr) =>
		expr?.type === 'JSXElement' ||
		expr?.type === 'JSXFragment' ||
		expr?.type === 'JSXText' ||
		expr?.type === 'JSXExpressionContainer'
			? expr
			: b.jsx_expression_container(/** @type {AST.Expression} */ (expr));

	// Lower a branch body to statements ending in a SINGLE `return` of the combined
	// render value. All sibling templates — plain elements/expressions AND nested
	// `@if`/`@for`/`@switch`/`@try` directives (each lowered to its own VALUE) — are
	// merged into one `return <> … </>` (not several returns where only the first is
	// reachable, nor a bare nested `if` dropped from the value). Setup statements are
	// kept before the return so they share the IIFE scope.
	const branch_returning_body = (
		/** @type {AST.Node[]} */ body,
		/** @type {AST.Node | AST.Node[]} */ scope_node,
		/** @type {AST.Node | AST.Node[] | null} */ loc_node = scope_node,
	) => {
		const ctx = scoped(scope_node);
		/** @type {AST.Statement[]} */
		const setup = [];
		/** @type {any[]} */
		const renders = [];
		for (const stmt of lower_code_block_children(body, context.state.scopes)) {
			if (stmt == null || stmt.type === 'EmptyStatement') continue;
			if (is_template_directive(stmt)) {
				// A nested directive is render content here — lower it to its own value.
				renders.push(to_fragment_child(build_tsrx_ts_directive_value(stmt, scoped(stmt))));
				continue;
			}
			// A render node lowers to a render expression (collected into the fragment);
			// anything else (a `const`, a side effect) stays setup before the return.
			for (const lowered of transform_tsrx_ts_children([stmt], ctx)) {
				const expr = statement_to_tsrx_ts_expression(lowered);
				if (expr) renders.push(to_fragment_child(expr));
				else setup.push(/** @type {AST.Statement} */ (lowered));
			}
		}
		const value = build_tsrx_ts_return_expression(
			renders,
			false,
			/** @type {AST.NodeWithLocation} */ (loc_node),
		);
		return [...setup, b.return(/** @type {AST.Expression} */ (value))];
	};

	// A branch as a VALUE (a ternary arm): the bare value when there is no setup, an
	// IIFE that returns it otherwise.
	const branch_value = (/** @type {AST.Node[]} */ body, /** @type {AST.Node} */ scope_node) => {
		const stmts = branch_returning_body(body, scope_node);
		if (stmts.length === 1 && stmts[0].type === 'ReturnStatement' && stmts[0].argument) {
			return /** @type {AST.Expression} */ (stmts[0].argument);
		}
		return b.call(b.thunk(b.block(stmts)));
	};

	// An `@else if` chain link recurses here as a plain `IfStatement` — it
	// lowers exactly like the rooting `@if`, to the ternary's next arm.
	if (node.type === 'JSXIfExpression' || node.type === 'IfStatement') {
		const cons_body =
			node.consequent.type === 'BlockStatement' ? node.consequent.body : [node.consequent];
		const consequent = branch_value(cons_body, node.consequent);
		let alternate = /** @type {AST.Expression} */ (b.literal(null));
		if (node.alternate) {
			const alt = node.alternate;
			alternate =
				alt.type === 'IfStatement'
					? build_tsrx_ts_directive_value(alt, scoped(alt))
					: branch_value(alt.type === 'BlockStatement' ? alt.body : [alt], alt);
		}
		return b.conditional(
			/** @type {AST.Expression} */ (context.visit(node.test, context.state)),
			consequent,
			alternate,
		);
	}

	if (
		node.type === 'JSXForExpression' &&
		(node.statementType === 'ForOfStatement' || node.statementType === 'ForInStatement')
	) {
		// `@for await` iterates an AsyncIterable, which `Array.from` does NOT accept.
		// Accumulate with a real `for await` loop instead (the runtime renders via
		// `_$_.for`; this is the to_ts type view only). Await the async IIFE so the
		// binding types as the item array, not a `Promise` — the enclosing component is
		// async, since `for await` requires it.
		if (node.statementType === 'ForOfStatement' && node.await) {
			const items_id = b.id('$$items');
			/** @type {AST.Statement[]} */
			const loop_body = [];
			// `; index i` has no map-callback equivalent here; declare it as a typed
			// `number` (its runtime value is irrelevant to the type view), like the
			// render path. `; key expr` stays so it type-checks.
			if (node.index) {
				loop_body.push(
					b.let(/** @type {AST.Identifier} */ (context.visit(node.index)), b.literal(0)),
				);
			}
			if (node.key) {
				loop_body.push(b.stmt(/** @type {AST.Expression} */ (context.visit(node.key))));
			}
			loop_body.push(
				b.stmt(
					b.call(
						b.member(items_id, b.id('push')),
						b.call(b.thunk(b.block(branch_returning_body(node.body.body, node.body)))),
					),
				),
			);
			const for_await = b.for_of(
				/** @type {AST.Pattern} */ (context.visit(node.left)),
				/** @type {AST.Expression} */ (context.visit(node.right)),
				b.block(loop_body),
				true,
				/** @type {AST.NodeWithLocation} */ (node),
			);
			const result =
				node.empty != null
					? b.conditional(
							b.binary('===', b.member(items_id, b.id('length')), b.literal(0)),
							branch_value(node.empty.body, node.empty),
							items_id,
						)
					: items_id;
			const iife = b.arrow(
				[],
				b.block([b.const(items_id, b.array([])), for_await, b.return(result)]),
				true,
			);
			// The custom esrap AwaitExpression printer reads `node.loc`, so stamp it.
			return setLocation(b.await(b.call(iife)), /** @type {AST.NodeWithLocation} */ (node));
		}
		const body = branch_returning_body(
			/** @type {AST.BlockStatement} */ (node.body).body,
			node.body,
		);
		// A keyed `@for (…; key expr)` evaluates `expr` per item — keep it so the key
		// type-checks (it references the loop variable), matching the render path.
		if (node.key) {
			body.unshift(b.stmt(/** @type {AST.Expression} */ (context.visit(node.key))));
		}
		// `node.left` is a `const x` VariableDeclaration; the `.map` callback needs the
		// bare pattern (`x`), not the declaration statement. `; index i` becomes the
		// callback's second parameter (`(x, i)`), not a dropped reference.
		const left = node.left;
		const param = left.type === 'VariableDeclaration' ? left.declarations[0].id : left;
		const params = [/** @type {AST.Pattern} */ (context.visit(param))];
		if (node.index) {
			params.push(/** @type {AST.Pattern} */ (context.visit(node.index)));
		}
		// `@for` iterates ANY iterable, but many (Set, Map, generators) have no `.length`
		// or `.map`, so lowering those directly typed the binding as an error and never
		// surfaced the `@empty` branch. `Array.from(iterable)` yields a real array — the
		// Ripple `to_ts` analog of the JS targets' `map_iterable` helper.
		const items = () =>
			b.call(
				b.member(b.id('Array'), b.id('from')),
				/** @type {AST.Expression} */ (context.visit(node.right)),
			);
		const map_arrow = b.arrow(params, b.block(body));
		if (node.empty != null) {
			// Bind `Array.from(iterable)` ONCE: a one-shot iterable (a generator) would be
			// exhausted by a second `Array.from`, so the `.length` test and the `.map` must
			// read the same materialized array.
			const items_id = b.id('$$items');
			return b.call(
				b.thunk(
					b.block([
						b.const(items_id, items()),
						b.return(
							b.conditional(
								b.binary('===', b.member(items_id, b.id('length')), b.literal(0)),
								branch_value(node.empty.body, node.empty),
								b.call(b.member(items_id, b.id('map')), map_arrow),
							),
						),
					]),
				),
			);
		}
		return b.call(b.member(items(), b.id('map')), map_arrow);
	}

	if (node.type === 'JSXSwitchExpression') {
		const cases = node.cases.map((sc) =>
			b.switch_case(
				sc.test ? /** @type {AST.Expression} */ (context.visit(sc.test)) : null,
				// The arm's scope lives on its `SwitchCase`. An arm has no block node, so
				// its value keeps no location of its own.
				scope_switch_case_body(
					branch_returning_body(flatten_switch_consequent(sc.consequent), sc, null),
				),
			),
		);
		const switch_stmt = b.switch(
			/** @type {AST.Expression} */ (context.visit(node.discriminant)),
			cases,
			/** @type {AST.NodeWithLocation} */ (node),
		);
		return b.call(b.thunk(b.block([switch_stmt, b.return(b.literal(null))])));
	}

	if (node.type === 'JSXTryExpression') {
		// TryStatement: try/catch/pending leaves return; a `finally` must not.
		const try_body = b.block(
			branch_returning_body(node.block.body, node.block),
			/** @type {AST.NodeWithLocation} */ (node.block),
		);
		let catch_handler = null;
		if (node.handler) {
			catch_handler = b.catch_clause(
				node.handler.param || null,
				node.handler.resetParam || null,
				b.block(
					branch_returning_body(node.handler.body.body, node.handler.body),
					/** @type {AST.NodeWithLocation} */ (node.handler.body),
				),
				/** @type {AST.NodeWithLocation} */ (node.handler),
			);
		}
		const pending = node.pending
			? b.block(
					branch_returning_body(node.pending.body, node.pending),
					/** @type {AST.NodeWithLocation} */ (node.pending),
				)
			: null;
		const finalizer = node.finalizer
			? b.block(
					transform_body(node.finalizer.body, scoped(node.finalizer)),
					/** @type {AST.NodeWithLocation} */ (node.finalizer),
				)
			: null;
		return b.call(b.thunk(b.block([b.try(try_body, catch_handler, finalizer, pending)])));
	}

	// Only `@for (;;)` remains — it renders repeatedly with no item binding, so
	// it has no value form (previously this fell into the `@try` lowering and
	// crashed on the missing `block`).
	throw new Error('A `@for (;;)` directive cannot be used as a value.');
}

/**
 * @param {AST.Node} node
 * @param {TransformClientContext} context
 */
function transform_ts_child(node, context) {
	const { state, visit } = context;

	if (is_template_text_or_expression(node)) {
		if (is_empty_expression_container(node)) {
			return;
		}
		state.init?.push(
			b.stmt(
				/** @type {AST.Expression} */ (visit(get_template_expression(node, true), { ...state })),
			),
		);
	} else if (node.type === 'JSXStyleElement') {
		// to_ts: emit an empty `<style>` element for type-only mappings. The CSS
		// children are TSRX stylesheet AST, never printed as TSX children; only
		// `apply` carries type information (see type_only_style_attributes).
		const jsxElement = b.jsx_element(node, type_only_style_attributes(node), []);
		disable_style_anchor_verification(jsxElement);
		if (!state.init) {
			return jsxElement;
		}
		if (node.unclosed) {
			state.init?.push(/** @type {AST.Statement} */ (/** @type {unknown} */ (jsxElement)));
		} else {
			state.init?.push(b.stmt(jsxElement));
		}
	} else if (is_template_element(node)) {
		// is_template_element stays a boolean predicate — narrow the element once.
		let element = /** @type {AST.TSRXJSXElement} */ (node);
		const lowered = lower_dynamic_element(element, undefined, state.scopes);
		if (lowered) {
			state.imports.add(`import { Dynamic as ${dynamic_element_import_local} } from 'ripple'`);
			element = lowered;
		}

		/** @type {TsrxTsxChild[]} */
		const children = [];
		let has_children_props = false;
		const is_dom_element = is_element_dom_element(element);
		const element_name = get_element_identifier(element)?.name ?? null;
		const child_namespace =
			is_dom_element && element_name !== null
				? determine_namespace_for_children(element_name, state.namespace)
				: is_dynamic_element(element)
					? DEFAULT_NAMESPACE
					: state.namespace;

		const attributes = get_element_attributes(element).map((attr) => {
			if (attr.type === 'JSXAttribute') {
				const name = visit(get_attribute_name_node(attr), state);
				const attr_value = /** @type { AST.Expression & AST.NodeWithLocation | null} */ (
					get_attribute_value(attr)
				);
				/** @type {string} */
				let prop_name;
				/** @type {AST.Identifier} */
				let name_node;
				if (name.type === 'Identifier') {
					name_node = name;
					prop_name = name.name;
				} else {
					name_node = get_attribute_name_node(attr);
					prop_name = get_attribute_name(attr) || 'unknown';
				}
				const ref_target_type =
					prop_name === 'ref' ? create_element_ref_target_type(element, state) : null;
				const value =
					attr_value === null
						? // <div attr>, not adding `name` for loc because `jsx_name` below
							// will take care of the mapping JSXAttribute's JSXIdentifier
							b.literal(true)
						: // reset init, update, final to avoid adding attr value to the component body
							visit(
								attr_value,
								SetStateForOutsideComponent(
									state,
									ref_target_type ? { ref_target_type } : undefined,
								),
							);

				const jsx_name = b.jsx_id(prop_name, /** @type {AST.NodeWithLocation} */ (name_node));
				if (prop_name === 'children') {
					has_children_props = true;
				}

				const jsx_attr = b.jsx_attribute(
					jsx_name,
					// match the source code usage of expressions for literals
					// for proper source mapping to avoid turning strings into expressions
					attr_value?.type === 'Literal' && !is_expression_attribute(attr)
						? /** @type {AST.Literal} */ (value)
						: b.jsx_expression_container(
								/** @type {AST.Expression} */ (value),
								attr_value === null
									? /** @type {AST.NodeWithLocation} */ (value)
									: // account location for opening and closing braces around the expression
										/** @type {AST.NodeWithLocation} */ ({
											start: attr_value.start - 1,
											end: attr_value.end + 1,
											loc: {
												start: {
													line: attr_value.loc.start.line,
													column: attr_value.loc.start.column - 1,
												},
												end: {
													line: attr_value.loc.end.line,
													column: attr_value.loc.end.column + 1,
												},
											},
										}),
							),
					attr.shorthand ?? false,
					/** @type {AST.NodeWithLocation} */ (attr),
				);
				return jsx_attr;
			} else if (attr.type === 'JSXSpreadAttribute') {
				const argument = visit(attr.argument, state);
				return b.jsx_spread_attribute(
					/** @type {AST.Expression} */ (argument),
					/** @type {AST.NodeWithLocation} */ (attr),
				);
			} else {
				// Should not happen
				throw new Error(`Unexpected attribute type: ${/** @type {AST.Node} */ (attr).type}`);
			}
		});

		if (
			!is_self_closing(element) &&
			!element.unclosed &&
			!has_children_props &&
			element.children.length > 0
		) {
			const component_scope = /** @type {ScopeInterface} */ (context.state.scopes.get(element));
			const child_context = {
				...context,
				state: {
					...state,
					scope: component_scope,
					inside_head: element_name === 'head' ? true : state.inside_head,
					namespace: child_namespace,
					skip_children_traversal: is_dom_element,
				},
			};
			const thunk =
				element_name === 'style' || is_dom_element
					? null
					: b.thunk(b.block(transform_body(element.children, child_context)));

			if (element_name === 'style') {
				// CSS children are TSRX stylesheet AST, not TSX children. Keep the
				// empty style anchor for type-only mappings, but never print the CSS AST.
			} else if (is_dom_element) {
				children.push(
					...transform_tsrx_tsx_children(
						/** @type {AST.Node[]} */ (element.children),
						/** @type {VisitorClientContext} */ (child_context),
					),
				);
			} else if (thunk !== null) {
				attributes.push(b.jsx_attribute(b.jsx_id('children'), b.jsx_expression_container(thunk)));
			}
		}

		let element_source = element;

		if (get_element_id(element).type === 'MemberExpression') {
			const member = /** @type {AST.MemberExpression} */ (
				visit(get_element_id(element), { ...state })
			);

			// Plant the visited member tag on local copies for the printer — the
			// source element is never mutated.
			const opening = /** @type {ESTreeJSX.TSRXJSXOpeningElement} */ ({
				...element.openingElement,
				name: member,
			});
			const closing = element.closingElement
				? /** @type {ESTreeJSX.TSRXJSXClosingElement} */ ({
						...element.closingElement,
						name: setLocation(
							{ ...member },
							/** @type {AST.NodeWithLocation} */ (element.closingElement.name),
							true,
						),
					})
				: null;
			element_source = { ...element, openingElement: opening, closingElement: closing };
		}

		const jsxElement = b.jsx_element(element_source, attributes, children);
		if (element_name === 'style') {
			disable_style_anchor_verification(jsxElement);
		}

		if (!state.init) {
			return jsxElement;
		}

		// For unclosed elements, push the JSXElement directly without wrapping in ExpressionStatement
		// This keeps it in the AST for mappings but avoids adding a semicolon
		if (element.unclosed) {
			state.init?.push(/** @type {AST.Statement} */ (/** @type {unknown} */ (jsxElement)));
		} else {
			state.init?.push(b.stmt(jsxElement));
		}
	} else if (node.type === 'IfStatement' || node.type === 'JSXIfExpression') {
		const consequent_scope =
			/** @type {ScopeInterface} */ (context.state.scopes.get(node.consequent)) ||
			context.state.scope;
		const consequent_body =
			node.consequent.type === 'BlockStatement' ? node.consequent.body : [node.consequent];
		const consequent = b.block(
			transform_body(consequent_body, {
				...context,
				state: { ...context.state, scope: consequent_scope },
			}),
			/** @type {AST.NodeWithLocation} */ (node.consequent),
		);

		let alternate;

		if (node.alternate !== null) {
			const alternate_node = /** @type {AST.Statement} */ (node.alternate);
			const alternate_scope = context.state.scopes.get(alternate_node) || context.state.scope;
			const alternate_body =
				alternate_node.type === 'IfStatement'
					? [alternate_node]
					: alternate_node.type === 'BlockStatement'
						? alternate_node.body
						: [alternate_node];
			alternate = b.block(
				transform_body(alternate_body, {
					...context,
					state: { ...context.state, scope: alternate_scope },
				}),
				/** @type {AST.NodeWithLocation} */ (alternate_node),
			);
		}

		const result = b.if(
			/** @type {AST.Expression} */ (visit(node.test)),
			consequent,
			alternate,
			/** @type {AST.NodeWithLocation} */ (node),
		);
		if (!state.init) {
			return result;
		}
		state.init.push(result);
	} else if (node.type === 'SwitchStatement' || node.type === 'JSXSwitchExpression') {
		const cases = [];

		for (const switch_case of node.cases) {
			const consequent_scope = context.state.scopes.get(switch_case) || context.state.scope;
			const consequent_body = transform_body(flatten_switch_consequent(switch_case.consequent), {
				...context,
				state: { ...context.state, scope: consequent_scope },
			});

			cases.push(
				b.switch_case(
					switch_case.test ? /** @type {AST.Expression} */ (context.visit(switch_case.test)) : null,
					switch_case.consequent.length && switch_case.consequent[0].type === 'BlockStatement'
						? [
								b.block(
									consequent_body,
									/** @type {AST.NodeWithLocation} */ (switch_case.consequent[0]),
								),
							]
						: node.type === 'JSXSwitchExpression'
							? scope_switch_case_body(consequent_body)
							: consequent_body,
				),
			);
		}

		const result = b.switch(
			/** @type {AST.Expression} */ (context.visit(node.discriminant)),
			cases,
			/** @type {AST.NodeWithLocation} */ (node),
		);

		if (!state.init) {
			return result;
		}
		state.init.push(result);
	} else if (
		node.type === 'ForOfStatement' ||
		(node.type === 'JSXForExpression' && node.statementType === 'ForOfStatement')
	) {
		const body_scope = /** @type {ScopeInterface} */ (context.state.scopes.get(node.body));
		const block_body = transform_body(/** @type {AST.BlockStatement} */ (node.body).body, {
			...context,
			state: { ...context.state, scope: body_scope },
		});
		if (node.key) {
			block_body.unshift(b.stmt(/** @type {AST.Expression} */ (visit(node.key))));
		}
		if (node.index) {
			block_body.unshift(b.let(/** @type {AST.Identifier} */ (visit(node.index)), b.literal(0)));
		}
		const body = b.block(block_body);
		const empty =
			node.empty != null
				? b.block(
						transform_body(node.empty.body, {
							...context,
							state: {
								...context.state,
								scope: context.state.scopes.get(node.empty) || context.state.scope,
							},
						}),
						/** @type {AST.NodeWithLocation} */ (node.empty),
					)
				: null;

		const result = b.for_of(
			/** @type {AST.Pattern} */ (visit(node.left)),
			/** @type {AST.Expression} */ (visit(node.right)),
			body,
			node.await,
			/** @type {AST.NodeWithLocation} */ (node),
		);
		result.empty = empty;

		if (!state.init) {
			return result;
		}
		state.init.push(result);
	} else if (node.type === 'TryStatement' || node.type === 'JSXTryExpression') {
		const try_scope = /** @type {ScopeInterface} */ (context.state.scopes.get(node.block));
		const try_body = b.block(
			transform_body(node.block.body, {
				...context,
				state: { ...context.state, scope: try_scope },
			}),
			/** @type {AST.NodeWithLocation} */ (node.block),
		);

		let catch_handler = null;
		if (node.handler) {
			const catch_scope = /** @type {ScopeInterface} */ (
				context.state.scopes.get(node.handler.body)
			);
			const catch_body = b.block(
				transform_body(node.handler.body.body, {
					...context,
					state: { ...context.state, scope: catch_scope },
				}),
				/** @type {AST.NodeWithLocation} */ (node.handler),
			);
			catch_handler = b.catch_clause(
				node.handler.param || null,
				node.handler.resetParam || null,
				catch_body,
				/** @type {AST.NodeWithLocation} */ (node.handler),
			);
		}

		let pending_block = null;
		if (node.pending) {
			const pending_scope = /** @type {ScopeInterface} */ (context.state.scopes.get(node.pending));
			pending_block = b.block(
				transform_body(node.pending.body, {
					...context,
					state: { ...context.state, scope: pending_scope },
				}),
				/** @type {AST.NodeWithLocation} */ (node.pending),
			);
		}

		let finally_block = null;
		if (node.finalizer) {
			const finally_scope = /** @type {ScopeInterface} */ (
				context.state.scopes.get(node.finalizer)
			);
			finally_block = b.block(
				transform_body(node.finalizer.body, {
					...context,
					state: { ...context.state, scope: finally_scope },
				}),
				/** @type {AST.NodeWithLocation} */ (node.finalizer),
			);
		}
		const result = b.try(try_body, catch_handler, finally_block, pending_block);
		if (!state.init) {
			return result;
		}
		state.init.push(result);
	} else if (is_native_tsrx_function_node(node)) {
		const component = visit(node, state);

		state.init?.push(/** @type {AST.Statement} */ (component));
	} else if (node.type === 'BreakStatement') {
		const result = b.break;

		if (!state.init) {
			return result;
		}
		state.init.push(/** @type {AST.Statement} */ (result));
	} else if (node.type === 'ContinueStatement') {
		const result = b.continue;

		if (!state.init) {
			return result;
		}
		state.init.push(/** @type {AST.Statement} */ (result));
	} else if (is_template_fragment(node)) {
		// is_template_fragment stays a boolean predicate — narrow once.
		const fragment = /** @type {AST.TSRXJSXFragment} */ (node);
		let result = build_tsrx_to_ts_expression(fragment, context);
		// Keep an AUTHORED `<> … </>` here too (a render-output / control-flow branch
		// body, e.g. the `<>{[1,2,3]}</>` branch of an `@if`), so it is not unwrapped to
		// a bare `[1,2,3]`. The fragment's contents (including any `<style>`) are already
		// lowered by `build_tsrx_to_ts_expression`; this only re-adds the `<> … </>`.
		if (is_authored_native_fragment(fragment)) {
			result = wrap_to_ts_value_in_fragment(result, fragment);
		}
		if (!state.init) {
			return result;
		}
		state.init.push(b.stmt(/** @type {AST.Expression} */ (result)));
	} else if (node.type === 'ReturnStatement') {
		const result = b.return(
			node.argument ? /** @type {AST.Expression} */ (visit(node.argument, state)) : undefined,
			/** @type {AST.NodeWithLocation} */ (node),
		);
		if (!state.init) {
			return result;
		}
		state.init.push(result);
	} else {
		const result = visit(node, state);
		if (!state.init) {
			return result;
		}
		if (result && /** @type {AST.Node} */ (result).type !== 'EmptyStatement') {
			push_statement(
				/** @type {AST.Statement | AST.Statement[] | AST.Directive | AST.ModuleDeclaration} */ (
					result
				),
				state.init,
			);
		}
	}
}

/**
 * Checks if a node is template or control-flow content
 * @param {AST.Node} node
 * @returns {boolean}
 */
function is_template_or_control_flow(node) {
	if (node.metadata?.regular_js) {
		return false;
	}

	return (
		is_template_element(node) ||
		node.type === 'JSXStyleElement' ||
		node.type === 'JSXExpressionContainer' ||
		node.type === 'JSXText' ||
		is_template_fragment(node) ||
		is_template_directive(node) ||
		node.type === 'IfStatement' ||
		node.type === 'ForOfStatement' ||
		node.type === 'TryStatement' ||
		node.type === 'SwitchStatement'
	);
}

/**
 * @param {AST.Node} node
 * @returns {boolean}
 */
function is_dead_native_tsrx_expression_statement(node) {
	return (
		is_native_tsrx_template_node(node) ||
		(node.type === 'ExpressionStatement' && is_native_tsrx_template_node(node.expression))
	);
}

/**
 * @param {AST.Node[]} path
 * @returns {boolean}
 */
function is_regular_js_statement_position(path) {
	const parent = path.at(-1);
	return (
		parent?.type === 'BlockStatement' || parent?.type === 'Program' || parent?.type === 'SwitchCase'
	);
}

/**
 * Whether `node` takes the place of a statement: in a statement list, or as the body of an
 * `if`, `else` or loop. The TS view prints a template there as an `ExpressionStatement`, so
 * it keeps its `;` (#1517).
 * @param {AST.Node[]} path
 * @param {AST.Node} node
 * @returns {boolean}
 */
function is_ts_statement_slot(path, node) {
	const parent = /** @type {any} */ (path.at(-1));
	switch (parent?.type) {
		case 'BlockStatement':
		case 'Program':
			return true;
		case 'SwitchCase':
			return parent.consequent.includes(node);
		case 'IfStatement':
			return parent.consequent === node || parent.alternate === node;
		case 'ForStatement':
		case 'ForInStatement':
		case 'ForOfStatement':
		case 'WhileStatement':
		case 'DoWhileStatement':
		case 'LabeledStatement':
			return parent.body === node;
		default:
			return false;
	}
}

/**
 * @param {AST.Node[]} path
 * @returns {boolean}
 */
function is_native_tsrx_statement_position(path) {
	const parent = path.at(-1);
	return (
		parent?.type === 'BlockStatement' ||
		parent?.type === 'Program' ||
		parent?.type === 'SwitchCase' ||
		parent?.type === 'IfStatement' ||
		parent?.type === 'ForStatement' ||
		parent?.type === 'ForInStatement' ||
		parent?.type === 'ForOfStatement' ||
		parent?.type === 'WhileStatement' ||
		parent?.type === 'DoWhileStatement' ||
		parent?.type === 'TryStatement' ||
		parent?.type === 'SwitchStatement' ||
		parent?.type === 'LabeledStatement' ||
		is_template_directive(parent)
	);
}

/**
 * Whether `node` is one of `parent`'s rendered template children, looking
 * through fragments that `normalize_child` flattens — their children render
 * inline in the parent, so they are the parent's children for classification.
 * @param {AST.Node | undefined} parent
 * @param {AST.Node} node
 * @returns {boolean}
 */
function is_rendered_template_child(parent, node) {
	const children = /** @type {ESTreeJSX.JSXElement | undefined} */ (parent)?.children;
	if (!children) return false;
	for (const child of children) {
		if (child === node) return true;
		if (
			is_flattenable_template_fragment(/** @type {AST.Node} */ (child), false) &&
			is_rendered_template_child(/** @type {AST.Node} */ (child), node)
		) {
			return true;
		}
		// A `@{ … }` child renders through its lowered template child (see
		// lower_code_block_children), which stands in the parent's children
		// list in its place.
		const item = /** @type {AST.Node} */ (child);
		if (item.type === 'JSXCodeBlock') {
			const lowered = item.metadata?.tsrx_template_child?.child ?? item.render ?? null;
			if (lowered === node) return true;
			if (
				is_flattenable_template_fragment(/** @type {AST.Node} */ (lowered), false) &&
				is_rendered_template_child(/** @type {AST.Node} */ (lowered), node)
			) {
				return true;
			}
		}
	}
	return false;
}

/**
 * @param {AST.Node[]} path
 * @param {AST.Node} [node] The node being classified. Expression-container and
 *   attribute values are visited with the container unwrapped (see
 *   `get_attribute_value` / `get_template_expression`), so their path parent is
 *   the host template element itself — indistinguishable from a rendered child
 *   by parent type alone. A rendered child sits in the parent's `children`; a
 *   value does not, so `<div>{<h1 />}</div>` and `prop={<h1 />}` classify as
 *   values while `<div><h1 /></div>` stays a template child.
 * @returns {boolean}
 */
function is_native_tsrx_value_position(path, node) {
	const parent = path.at(-1);
	if (node && (is_template_element(parent) || is_template_fragment(parent))) {
		return !is_rendered_template_child(parent, node);
	}
	return !(
		is_native_tsrx_statement_position(path) ||
		is_template_element(parent) ||
		is_template_fragment(parent)
	);
}

/**
 * A `<> … </>` combined INTO a surrounding expression (an operator operand, a
 * conditional branch, an array element, …) rather than being the sole value of a
 * render-output slot. There the to_ts collapse of a single-child fragment to its
 * bare value flips meaning — a fragment is always truthy, but `<>{0}</>` collapses
 * to a falsy `0`, so `<>{0}</> || 'x'` would render `'x'` instead of `0`. Keep the
 * fragment in these positions.
 * @param {AST.Node[]} path
 * @param {AST.Node} node
 * @returns {boolean}
 */
/**
 * An AUTHORED `<> … </>` fragment (not a compiler-generated wrapper around a
 * directive, nor a code-block-chain wrapper). These are kept verbatim in the
 * to_ts output instead of being unwrapped to their single child.
 * @param {AST.Node | null | undefined} node
 * @returns {boolean}
 */
function is_authored_native_fragment(node) {
	return (
		node?.type === 'JSXFragment' &&
		node.metadata?.native_tsrx === true &&
		node.metadata?.tsrx_generated_wrapper !== true &&
		node.metadata?.tsrx_code_block_chain !== true
	);
}

/**
 * @param {AST.Node[]} path
 * @param {AST.Node} node
 * @returns {boolean}
 */
function is_combined_expression_position(path, node) {
	let depth = path.length - 1;
	let parent = path[depth];
	let slot_node = node;
	// Walk up through transparent stand-ins, in whatever order they nest:
	//  - preserved source parentheses (volar/to_ts parses only) — the wrapped
	//    expression stands in the paren's slot (`(@if (…) { … }) || x` judges
	//    against the `||`, not the paren);
	//  - a generated value wrapper, visited FROM its directive's visitor, so
	//    the directive sits atop the path and stands in the wrapper's slot.
	while (parent) {
		if (parent.type === 'ParenthesizedExpression') {
			slot_node = parent;
			parent = path[--depth];
			continue;
		}
		if (
			parent.metadata?.tsrx_value_wrapper === slot_node ||
			parent.metadata?.tsrx_value_wrapper === node
		) {
			slot_node = parent;
			parent = path[--depth];
			continue;
		}
		break;
	}
	if (!parent || !isTemplateValuePosition(parent, slot_node)) return false;
	switch (parent.type) {
		// Sole-value render-output slots: the collapse is invisible, keep it.
		case 'VariableDeclarator':
			return parent.init !== slot_node;
		case 'AssignmentExpression':
			return parent.right !== slot_node;
		case 'CallExpression':
		case 'NewExpression':
			return !parent.arguments.some((argument) => argument === slot_node);
		default:
			return true;
	}
}

/**
 * Re-wrap a lowered to_ts value in a `<> … </>` fragment so a fragment combined
 * into an expression keeps its fragment identity (see
 * `is_combined_expression_position`). A value that is already a fragment is left
 * as-is; a JSX element/text/container nests directly; any other expression goes in
 * a `{ … }` container.
 * @param {TsrxTsViewNode} expression
 * @param {AST.Node} source
 * @returns {TsrxTsViewNode}
 */
function wrap_to_ts_value_in_fragment(expression, source) {
	if (expression?.type === 'JSXFragment') return expression;
	const child =
		expression?.type === 'JSXElement' ||
		expression?.type === 'JSXText' ||
		expression?.type === 'JSXExpressionContainer'
			? expression
			: b.jsx_expression_container(/** @type {AST.Expression} */ (expression));
	return setLocation(b.jsx_fragment([child]), /** @type {AST.NodeWithLocation} */ (source));
}

/**
 * @param {AST.Node[]} children
 * @param {AST.Node} source_node
 * @param {TransformClientContext} context
 * @returns {AST.CallExpression}
 */
function build_native_tsrx_value_expression(children, source_node, context) {
	const { state, visit } = context;
	const children_filtered = children
		.filter((child) => {
			return child != null && child.type !== 'EmptyStatement';
		})
		.map((child) => {
			if (!child.metadata?.regular_js) return child;
			const metadata = { ...child.metadata };
			delete metadata.regular_js;
			return { ...child, metadata };
		});

	const children_component = create_native_tsrx_render_function([], children_filtered, source_node);

	return b.call(
		'_$_.tsrx_element',
		/** @type {AST.Expression} */ (
			visit(children_component, {
				...state,
				flush_node: null,
				template: null,
				regular_js: false,
				namespace: state.namespace,
				is_tsrx_element: true,
				jsx_to_tsrx_element: true,
			})
		),
	);
}

/**
 * Check if an Element has any dynamic content that would trigger flush_node().
 * An Element has dynamic content if it has:
 * - Dynamic attributes (tracked expressions in attribute values)
 * - Control flow children (IfStatement, ForOfStatement, etc.)
 * - Dynamic text children (non-Literal Text nodes)
 * - Non-DOM element children (components)
 * - Dynamic descendants (recursive)
 * @param {ESTreeJSX.JSXElement} element
 * @returns {boolean}
 */
function element_has_dynamic_content(element) {
	// Check for dynamic attributes
	for (const attr of get_element_attributes(element)) {
		if (attr.type === 'JSXAttribute') {
			const attr_value = get_attribute_value(attr);
			// Dynamic value expression (not null, not Literal)
			if (attr_value !== null && attr_value.type !== 'Literal') {
				return true;
			}
		} else if (attr.type === 'JSXSpreadAttribute') {
			return true;
		}
	}

	// Check children for dynamic content
	for (const child of lower_code_block_children(/** @type {AST.Node[]} */ (element.children))) {
		if (
			is_template_directive(child) ||
			child.type === 'IfStatement' ||
			child.type === 'TryStatement' ||
			child.type === 'ForOfStatement' ||
			child.type === 'SwitchStatement' ||
			is_template_fragment(child)
		) {
			return true;
		}
		if (child.type === 'JSXExpressionContainer' && child.expression.type !== 'Literal') {
			return true;
		}
		// Non-DOM element (component)
		if (
			is_template_element(child) &&
			(get_element_id(child).type !== 'Identifier' || !is_element_dom_element(child))
		) {
			return true;
		}
		// Recursively check DOM element children
		if (
			is_template_element(child) &&
			get_element_id(child).type === 'Identifier' &&
			is_element_dom_element(child)
		) {
			if (element_has_dynamic_content(/** @type {ESTreeJSX.JSXElement} */ (child))) {
				return true;
			}
		}
	}

	return false;
}

/**
 * Transform a template element's children into innerHTML assignment.
 * Template elements don't render children in the normal DOM tree - their content
 * goes into template.content (a DocumentFragment). We handle them like textarea
 * elements where children become innerHTML content.
 *
 * @param {ESTreeJSX.JSXElement | AST.TSRXJSXElement} node - The template element node
 * @param {TransformClientState} state - The transform state
 * @param {(node: AST.Node, state?: TransformClientState) => AST.Node} visit - The visitor function
 * @param {'html' | 'svg' | 'mathml'} child_namespace - The namespace for child elements
 */
function transform_template_element(node, state, visit, child_namespace) {
	const child_state = /** @type {TransformClientState} */ ({
		...state,
		template: [],
		init: [],
		update: [],
		namespace: child_namespace,
		skip_children_traversal: true,
	});

	transform_children(
		/** @type {AST.Node[]} */ (node.children),
		/** @type {VisitorClientContext} */ ({
			visit,
			state: child_state,
			root: false,
		}),
	);

	const template_array = /** @type {NonNullable<TransformClientState['template']>} */ (
		child_state.template
	);

	if (template_array.length > 0) {
		const content_html = join_template(template_array);
		const id = state.flush_node?.();
		state.init?.push(
			b.stmt(
				b.assignment('=', b.member(/** @type {AST.Identifier} */ (id), 'innerHTML'), content_html),
			),
		);
	}
}

/**
 *
 * @param {AST.Node[]} children
 * @param {VisitorClientContext} context
 */
function transform_children(children, context) {
	const { visit, state, root } = context;
	if (state.to_ts) {
		children = children.map((child) => {
			const lowered = is_template_element(child)
				? lower_dynamic_element(/** @type {AST.TSRXJSXElement} */ (child), undefined, state.scopes)
				: null;
			if (lowered) {
				state.imports.add(`import { Dynamic as ${dynamic_element_import_local} } from 'ripple'`);
			}
			return lowered ?? child;
		});
	}
	const normalized = normalize_children(children, {
		...context,
		state: { ...state, keep_component_style: state.to_ts ? true : state.keep_component_style },
	});

	const head_elements = collect_head_elements(children, !!state.to_ts);

	const is_fragment =
		normalized.some(
			(node) =>
				is_template_directive(node) ||
				node.type === 'IfStatement' ||
				node.type === 'TryStatement' ||
				node.type === 'ForOfStatement' ||
				node.type === 'SwitchStatement' ||
				is_template_fragment(node) ||
				(is_template_element(node) &&
					(get_element_id(node).type !== 'Identifier' || !is_element_dom_element(node))),
		) ||
		(normalized.filter(
			(node) =>
				node.type !== 'VariableDeclaration' &&
				node.type !== 'BlockStatement' &&
				node.type !== 'EmptyStatement',
		).length === 1 &&
			normalized.some(
				(node) =>
					is_template_expression(node) &&
					is_children_template_expression(
						/** @type {ESTreeJSX.JSXExpressionContainer} */ (node).expression,
						state.scope,
					),
			)) ||
		// At root level, non-literal expressions need a fragment template so the
		// anchor has a parent node. Without a parent, expression()'s .before() call
		// is a no-op when the value is a TSRXElement.
		(root &&
			normalized.some(
				(node) =>
					is_template_expression(node) &&
					/** @type {ESTreeJSX.JSXExpressionContainer} */ (node).expression.type !== 'Literal',
			)) ||
		// Setup statements produce no DOM; only rendered siblings need a fragment.
		normalized.filter(
			(node) => is_template_element(node) || is_template_text(node) || is_template_expression(node),
		).length > 1;
	// A fragment template root (a component or control-flow body, not an
	// element's children): its hydration cursor must end on its last top-level
	// node, since no enclosing element's traversal restores the cursor for it.
	// `skip_children_traversal` is not the discriminator here: it leaks from an
	// enclosing element into the control-flow bodies nested in it.
	const is_fragment_root = is_fragment && root;
	/** @type {AST.Identifier | null} */
	let initial = null;
	/** @type {(() => AST.Identifier) | null} */
	let prev = null;
	let template_id = null;

	// A component whose entire renderable body is a single control-flow block can
	// render that block directly before the parent-provided __anchor, skipping the
	// synthesized `<!>` wrapper fragment and its extra append/clone. The control-
	// flow runtimes render before their given anchor, and during hydration consume
	// the SSR boundary marker via append(), so __anchor replaces the wrapper.
	const root_output = root ? normalized.filter(is_template_or_control_flow) : [];
	const single_output = root_output.length === 1 ? root_output[0] : null;
	const root_controlled =
		single_output !== null &&
		(is_template_directive(single_output) ||
			single_output.type === 'IfStatement' ||
			single_output.type === 'SwitchStatement' ||
			single_output.type === 'ForOfStatement' ||
			single_output.type === 'TryStatement' ||
			// A single static component child (`render_component`, not a dynamic/
			// composite tag, DOM element, or ripple `Fragment`) renders before
			// __anchor too.
			(is_template_element(single_output) &&
				!is_dynamic_element(single_output) &&
				get_element_identifier(single_output) !== null &&
				!get_element_identifier(single_output)?.tracked &&
				get_element_identifier(single_output)?.name !== 'children' &&
				!is_element_dom_element(single_output) &&
				!is_ripple_fragment_element(single_output, context)));
	if (root_controlled) {
		/** @type {AST.Node} */ (single_output).metadata = {
			.../** @type {AST.Node} */ (single_output).metadata,
			root_controlled: true,
		};
	}

	// All-component children can append directly into the parent element instead of
	// each rendering before a synthesized `<!>` placeholder. We pass a `{ parent }`
	// sentinel as the anchor; append() detects it (no nodeType) and appendChild()s
	// the component's root, dropping the placeholder comment nodes from the template.
	/** @param {AST.Node} n */
	const is_static_component_child = (n) => {
		if (!is_template_element(n) || is_dynamic_element(n)) return false;
		const id = get_element_identifier(n);
		return (
			id !== null &&
			!id.tracked &&
			id.name !== 'children' &&
			!is_element_dom_element(n) &&
			!is_ripple_fragment_element(n, context)
		);
	};
	/**
	 * A static DOM element in the template: the anchor a preceding component
	 * or control-flow sibling can insert before (see `append_before`).
	 * @param {AST.Node} n
	 */
	const is_static_dom_element_child = (n) =>
		is_template_element(n) &&
		!is_dynamic_element(n) &&
		is_element_dom_element(n) &&
		get_element_id(n).type === 'Identifier';
	/**
	 * A template `@if`: one that renders (a plain `if` around setup code
	 * lowers to JavaScript and holds no template position).
	 * @param {AST.Node} n
	 */
	const is_template_if_child = (n) =>
		(n.type === 'IfStatement' || n.type === 'JSXIfExpression') &&
		!n.metadata?.regular_js &&
		!(
			(n.metadata?.script_only || n.metadata?.has_continue) &&
			!n.metadata?.has_template &&
			!(/** @type {AST.IfStatement} */ (n).alternate)
		);
	/**
	 * A template `@for` (see `is_template_if_child`).
	 * @param {AST.Node} n
	 */
	const is_template_for_child = (n) =>
		(n.type === 'ForOfStatement' ||
			(n.type === 'JSXForExpression' && n.statementType === 'ForOfStatement')) &&
		!n.metadata?.regular_js &&
		!(n.metadata?.script_only && !n.metadata?.has_template);
	const all_component_append =
		!root &&
		!root_controlled &&
		state.flush_node != null &&
		normalized.length > 0 &&
		normalized.every(is_static_component_child);
	if (all_component_append) {
		const parent_id = /** @type {AST.Expression} */ (state.flush_node?.());
		const append_anchor_id = b.id(state.scope.generate('append_anchor'));
		state.init?.push(b.var(append_anchor_id, b.call('_$_.append_into', parent_id)));
		for (const child of normalized) {
			child.metadata = { ...child.metadata, append_into: append_anchor_id };
		}
	} else if (!root && !root_controlled && state.flush_node != null) {
		// A trailing run of static components and template `@if`s, with a
		// template `@for` allowed last of all, behind template siblings appends
		// into the parent as well: no `<!>` placeholder per node, and an
		// appendChild instead of an insert. An if materializes an anchor of its
		// own once a branch swap needs a position (see the runtime's
		// `materialize_anchor`); a list keeps inserting at the parent's end, so
		// nothing may follow it. Hydration keeps the sibling cursor, so the
		// earlier siblings are still navigated (see flush_node).
		let trailing_start = normalized.length;
		if (trailing_start > 0 && is_template_for_child(normalized[trailing_start - 1])) {
			trailing_start -= 1;
		}
		while (
			trailing_start > 0 &&
			(is_static_component_child(normalized[trailing_start - 1]) ||
				is_template_if_child(normalized[trailing_start - 1]))
		) {
			trailing_start -= 1;
		}
		if (
			trailing_start > 0 &&
			trailing_start < normalized.length &&
			is_template_or_control_flow(normalized[trailing_start - 1])
		) {
			const parent_id = /** @type {AST.Expression} */ (state.flush_node());
			for (let i = trailing_start; i < normalized.length; i++) {
				normalized[i].metadata = { ...normalized[i].metadata, append_after: parent_id };
			}
			// The if that closes the run is the parent's tail: nothing the
			// framework renders follows it, so it never needs an anchor.
			const last = normalized[normalized.length - 1];
			if (is_template_if_child(last)) {
				last.metadata = { ...last.metadata, append_tail: true };
			}
		}
	}

	if (!root && !root_controlled && state.flush_node != null) {
		// A static component, template `@if`, or template `@for` followed by a
		// static DOM element sibling inserts before that element instead of
		// before a `<!>` placeholder of its own (`append_before`): the element
		// is part of the template and never moves, so it anchors the node for
		// the node's whole life, and the template holds no comment for it. In
		// the client the node's variable is that element, so each rendered
		// node after it up to and including the element reuses the variable
		// (`alias_prev`) instead of stepping to a sibling. Hydration keeps the
		// sibling cursor: the placeholder never existed in the server output.
		let anchor_ahead = false;
		// The rendered node after the current one: setup statements between
		// children render nothing and are skipped.
		/** @type {AST.Node | null} */
		let following = null;
		for (let i = normalized.length - 1; i >= 0; i--) {
			const child = normalized[i];
			if (!is_template_or_control_flow(child)) {
				continue;
			}
			if (is_static_dom_element_child(child)) {
				anchor_ahead = true;
			} else if (
				anchor_ahead &&
				following !== null &&
				child.metadata?.append_into === undefined &&
				child.metadata?.append_after === undefined &&
				(is_static_component_child(child) ||
					is_template_if_child(child) ||
					is_template_for_child(child))
			) {
				child.metadata = { ...child.metadata, append_before: true };
				following.metadata = { ...following.metadata, alias_prev: true };
			} else {
				anchor_ahead = false;
			}
			following = child;
		}
	}

	/** @param {AST.Node} node */
	const get_id = (node) => {
		return b.id(
			is_template_element(node) && is_element_dom_element(node)
				? state.scope.generate(/** @type {AST.Identifier} */ (get_element_id(node)).name)
				: node.type === 'JSXStyleElement'
					? state.scope.generate('style')
					: is_template_text(node)
						? state.scope.generate('text')
						: is_template_expression(node)
							? state.scope.generate('expression')
							: state.scope.generate('node'),
			/** @type {AST.NodeWithLocation} */ (
				is_template_element(node) ? /** @type {AST.TSRXJSXElement} */ (node).openingElement : node
			),
		);
	};

	/** @param {AST.Node} node */
	const create_initial = (node) => {
		const id = is_fragment
			? b.id(
					state.scope.generate('fragment'),
					/** @type {AST.NodeWithLocation} */ (
						is_template_element(node)
							? /** @type {AST.TSRXJSXElement} */ (node).openingElement
							: node
					),
				)
			: get_id(node);
		initial = id;
		template_id = state.scope.generate('root');
		state.init?.push(b.var(id, b.call(template_id)));
	};

	let fragment_hop_count = 0;

	// Hydration cursor lag for a fragment root: how many top-level template
	// nodes back from the last emitted one the cursor sits, plus one. A child
	// that was navigated to (`cached`) leaves the cursor on its own last DOM
	// node, so the count restarts at 1; an untouched child leaves the cursor
	// where it was, so the count grows. The fragment closes with
	// `next(skipped - 1)` to bring the cursor onto its last node.
	let skipped = 0;

	for (let node_idx = 0; node_idx < normalized.length; node_idx++) {
		const node = normalized[node_idx];

		if (node.metadata?.regular_js && !state.to_ts) {
			if (is_dead_native_tsrx_expression_statement(node)) {
				continue;
			}
			const regular_node = /** @type {AST.Node} */ (
				visit(node, {
					...state,
					flush_node: null,
					template: null,
					regular_js: true,
				})
			);
			if (regular_node && regular_node.type !== 'EmptyStatement') {
				const statement =
					regular_node.type.endsWith('Statement') || regular_node.type.endsWith('Declaration')
						? /** @type {AST.Statement} */ (regular_node)
						: b.stmt(/** @type {AST.Expression} */ (regular_node));
				state.init?.push(statement);
			}
			continue;
		}

		if (is_fragment && is_template_or_control_flow(node)) {
			fragment_hop_count += 1;
		}

		if (
			node.type === 'VariableDeclaration' ||
			node.type === 'BlockStatement' ||
			node.type === 'ExpressionStatement' ||
			node.type === 'ThrowStatement' ||
			node.type === 'FunctionDeclaration' ||
			node.type === 'DebuggerStatement' ||
			node.type === 'ClassDeclaration' ||
			node.type === 'TSTypeAliasDeclaration' ||
			node.type === 'TSInterfaceDeclaration' ||
			node.type === 'ReturnStatement' ||
			is_native_tsrx_function_node(node)
		) {
			state.init?.push(/** @type {AST.Statement} */ (visit(node, state)));
		} else if (state.to_ts) {
			transform_ts_child(node, /** @type {VisitorClientContext} */ ({ visit, state }));
		} else {
			/** @type {{ tracking: boolean } | undefined} */
			let metadata;
			/** @type {AST.Expression | undefined} */
			let expression = undefined;
			let is_create_text_only = false;
			if (is_template_text_or_expression(node)) {
				metadata = { tracking: false };
				expression = /** @type {AST.Expression} */ (
					visit(get_template_expression(node, false), {
						...state,
						flush_node: null,
						metadata,
						selector_root: get_template_expression(node, false),
					})
				);
				is_create_text_only = normalized.length === 1 && expression.type === 'Literal';
			}

			if (initial === null && root && !is_create_text_only && !root_controlled) {
				create_initial(node);
			}

			const current_prev = prev;
			/** @type {AST.Identifier | null} */
			let cached = null;
			/**
			 * @param {boolean} [is_text]
			 * @param {boolean} [is_controlled]
			 * */
			const flush_node = (is_text, is_controlled) => {
				if (cached && !is_controlled) {
					return cached;
				} else if (current_prev !== null) {
					const id = get_id(node);
					const append_after = node.metadata?.append_after;
					if (node.metadata?.alias_prev === true) {
						// The previous sibling inserts before this node's element
						// (`append_before`), so in the client its variable already
						// is that element; only hydration steps to the sibling.
						state.init?.push(
							b.var(
								id,
								state.hydration
									? b.conditional(
											b.member(b.id('_$_'), b.id('hydrating')),
											b.call('_$_.hydrate_sibling', is_text && b.true),
											current_prev(),
										)
									: current_prev(),
							),
						);
					} else if (append_after !== undefined) {
						// The earlier siblings are navigated for the hydration cursor;
						// the client appends into the parent instead of inserting
						// before a placeholder, and a client-only build never reads
						// them.
						if (state.hydration) current_prev();
						const append_into =
							node.metadata?.append_tail === true
								? b.call('_$_.append_into', append_after, b.true)
								: b.call('_$_.append_into', append_after);
						state.init?.push(
							b.var(
								id,
								state.hydration
									? b.conditional(
											b.member(b.id('_$_'), b.id('hydrating')),
											b.call('_$_.hydrate_sibling'),
											append_into,
										)
									: append_into,
							),
						);
					} else {
						state.init?.push(
							b.var(id, inline_traversal('sibling', current_prev(), is_text, state.hydration)),
						);
					}
					cached = id;
					return id;
				} else if (initial !== null) {
					if (is_fragment) {
						const id = get_id(node);
						state.init?.push(b.var(id, b.call('_$_.first_child_frag', initial, is_text && b.true)));
						cached = id;
						return id;
					}
					return initial;
				} else if (state.flush_node !== null) {
					if (is_controlled) {
						return state.flush_node?.(is_text);
					}

					const id = get_id(node);
					const parent = /** @type {AST.Expression} */ (state.flush_node?.());
					const leaf_text = state.leaf_text;
					if (is_text === true && normalized.length === 1 && leaf_text !== undefined) {
						// The element's only child is a text node: the template holds
						// no placeholder, the text is written through the element
						// itself (`set_text_content`), and the hydration cursor never
						// leaves the element, so it needs no pop().
						leaf_text.value = true;
						cached = /** @type {AST.Identifier} */ (parent);
						return cached;
					}
					state.init?.push(b.var(id, inline_traversal('child', parent, is_text, state.hydration)));
					cached = id;
					return id;
				} else {
					return get_id(node);
				}
			};

			prev = flush_node;

			const is_controlled = normalized.length === 1 && !root;
			/**
			 * Whether `flush_node(true)` adopted the enclosing element for this
			 * text, the element's only child (see `leaf_text`).
			 */
			const is_leaf_text = () =>
				normalized.length === 1 && state.leaf_text !== undefined && state.leaf_text.value === true;
			/**
			 * @param {AST.Expression} identity
			 * @param {AST.Expression} expr
			 */
			const render_text_expression = (identity, expr) => {
				if (metadata?.tracking) {
					const id = flush_node(true);
					if (is_leaf_text()) {
						state.update?.push({
							// The previous value says whether the element holds a text
							// node yet, so the write needs no DOM read.
							operation: (key, prev) =>
								b.stmt(
									b.call('_$_.set_text_content', id, key, /** @type {AST.Expression} */ (prev)),
								),
							expression: expr,
							identity,
							initial: b.literal(''),
							needsPrevTracking: true,
						});
					} else {
						state.template?.push(' ');
						state.update?.push({
							operation: (key) => b.stmt(b.call('_$_.set_text', id, key)),
							expression: expr,
							identity,
							initial: b.literal(' '),
						});
					}
				} else if (normalized.length === 1) {
					if (expr.type === 'Literal') {
						if (
							/** @type {NonNullable<TransformClientState['template']>} */ (state.template).length >
							0
						) {
							state.template?.push(escape_html(expr.value));
						} else {
							const id = flush_node(true);
							state.init?.push(b.var(/** @type {AST.Identifier} */ (id), b.call('_$_.text', expr)));
							state.final?.push(b.stmt(b.call('_$_.append', b.id('__anchor'), id)));
						}
					} else {
						const id = flush_node(true);
						if (is_leaf_text()) {
							// A one-off text: written through the element, which the
							// template leaves empty.
							state.init?.push(
								b.stmt(
									b.assignment(
										'=',
										b.member(/** @type {AST.Identifier} */ (id), b.id('textContent')),
										expr,
									),
								),
							);
						} else {
							state.template?.push(' ');
							// avoid set_text overhead for single text nodes
							state.init?.push(
								b.stmt(
									b.assignment(
										'=',
										b.member(/** @type {AST.Identifier} */ (id), b.id('nodeValue')),
										expr,
									),
								),
							);
						}
					}
				} else {
					if (expr.type === 'Literal') {
						state.template?.push(escape_html(expr.value));
					} else {
						state.template?.push(' ');
						const id = flush_node(true);
						state.update?.push({
							operation: (key) => b.stmt(b.call('_$_.set_text', id, key)),
							expression: expr,
							identity,
							initial: b.literal(' '),
						});
					}
				}
			};

			if (is_template_element(node)) {
				visit(node, {
					...state,
					flush_node: /** @type {TransformClientState['flush_node']} */ (flush_node),
					namespace: state.namespace,
				});

				// Processing an element's children via child()/sibling() navigation
				// leaves hydrate_node deep inside the element. It must be back on the
				// element before a sibling's traversal, and at the end of a fragment
				// root, where no enclosing element's append() restores it and the
				// fragment's closing next() walks from wherever the cursor sits.
				//
				// Only a navigated element (`cached`) can have been descended into.
				// The Element visitor already adds pop() for non-literal text,
				// control flow, and component (non-DOM element) children; DOM element
				// children navigate without one, so add it here.
				const element_children = /** @type {AST.TSRXJSXElement} */ (node).children;
				if (cached !== null && is_element_dom_element(node) && element_children.length > 0) {
					const has_dom_element_children = element_children.some(
						(child) =>
							is_template_element(child) &&
							get_element_identifier(child) !== null &&
							is_element_dom_element(child),
					);

					const element_visitor_adds_pop = element_children.some(
						(child) =>
							is_template_directive(child) ||
							child.type === 'IfStatement' ||
							child.type === 'TryStatement' ||
							child.type === 'ForOfStatement' ||
							child.type === 'SwitchStatement' ||
							is_template_fragment(child) ||
							(is_template_element(child) &&
								(get_element_id(child).type !== 'Identifier' || !is_element_dom_element(child))) ||
							(child.type === 'JSXExpressionContainer' && child.expression.type !== 'Literal'),
					);

					const has_following_renderable_sibling = normalized
						.slice(node_idx + 1)
						.some(
							(sibling) =>
								sibling.type !== 'VariableDeclaration' && sibling.type !== 'EmptyStatement',
						);

					if (
						has_dom_element_children &&
						!element_visitor_adds_pop &&
						(has_following_renderable_sibling || is_fragment_root)
					) {
						state.init?.push(
							...(state.hydration
								? [b.stmt(b.logical('&&', b.id('_$_.hydrating'), b.call('_$_.pop', cached)))]
								: []),
						);
					}
				}
			} else if (node.type === 'JSXStyleElement') {
				// A `<style>` in `<head>` renders as a static template element; the
				// visitor pushes its markup (or nothing outside head).
				visit(node, {
					...state,
					flush_node: /** @type {TransformClientState['flush_node']} */ (flush_node),
					namespace: state.namespace,
				});
			} else if (is_template_fragment(node)) {
				visit(node, {
					...state,
					flush_node: /** @type {TransformClientState['flush_node']} */ (flush_node),
					namespace: state.namespace,
				});
			} else if (is_template_expression(node)) {
				// is_template_expression stays a boolean (its negative would lie
				// about merged-text containers), so narrow the container once here.
				const container = /** @type {ESTreeJSX.JSXExpressionContainer} */ (node);
				const container_expression = /** @type {AST.Expression} */ (container.expression);
				const expr = /** @type {AST.Expression} */ (expression);
				const is_static_native_tsrx_call = is_static_native_tsrx_function_call(
					container_expression,
					/** @type {VisitorClientContext} */ ({ ...context, state }),
				);

				if (expr.type === 'Literal') {
					if (normalized.length === 1) {
						if (
							/** @type {NonNullable<TransformClientState['template']>} */ (state.template).length >
							0
						) {
							state.template?.push(escape_html(expr.value));
						} else {
							const id = flush_node(true);
							state.init?.push(b.var(/** @type {AST.Identifier} */ (id), b.call('_$_.text', expr)));
							state.final?.push(b.stmt(b.call('_$_.append', b.id('__anchor'), id)));
						}
					} else {
						state.template?.push(escape_html(expr.value));
					}
				} else if (is_static_native_tsrx_call) {
					state.template?.push('<!>');
					const id = flush_node(false);
					const call = b.call('_$_.render_tsrx_element', expr, id, b.id('__block'));
					state.init?.push(
						state.namespace !== DEFAULT_NAMESPACE
							? b.stmt(b.call('_$_.with_ns', b.literal(state.namespace), b.thunk(call)))
							: b.stmt(call),
					);
				} else if (
					!is_children_template_expression(container_expression, state.scope) &&
					is_text_primitive_expression(container_expression, state)
				) {
					render_text_expression(container_expression, expr);
				} else if (
					normalized.length === 1 &&
					!is_children_template_expression(container_expression, state.scope)
				) {
					state.template?.push(' ');
					const id = flush_node(false);
					const call = b.call('_$_.expression', id, b.thunk(expr));
					state.init?.push(
						state.namespace !== DEFAULT_NAMESPACE
							? b.stmt(b.call('_$_.with_ns', b.literal(state.namespace), b.thunk(call)))
							: b.stmt(call),
					);
				} else {
					state.template?.push('<!>');
					const id = flush_node(false);
					const call = b.call('_$_.expression', id, b.thunk(expr));
					state.init?.push(
						state.namespace !== DEFAULT_NAMESPACE
							? b.stmt(b.call('_$_.with_ns', b.literal(state.namespace), b.thunk(call)))
							: b.stmt(call),
					);
				}
			} else if (is_template_text(node)) {
				render_text_expression(
					get_template_expression(
						/** @type {ESTreeJSX.JSXText | ESTreeJSX.JSXExpressionContainer} */ (node),
						false,
					),
					/** @type {AST.Expression} */ (expression),
				);
			} else if (
				node.type === 'ForOfStatement' ||
				(node.type === 'JSXForExpression' && node.statementType === 'ForOfStatement')
			) {
				node.metadata = { ...node.metadata, is_controlled };
				visit(node, {
					...state,
					flush_node: /** @type {TransformClientState['flush_node']} */ (flush_node),
					namespace: state.namespace,
				});
			} else if (node.type === 'IfStatement' || node.type === 'JSXIfExpression') {
				node.metadata = { ...node.metadata, is_controlled };
				visit(node, {
					...state,
					flush_node: /** @type {TransformClientState['flush_node']} */ (flush_node),
					namespace: state.namespace,
				});
			} else if (node.type === 'TryStatement' || node.type === 'JSXTryExpression') {
				node.metadata = { ...node.metadata, is_controlled };
				visit(node, {
					...state,
					flush_node: /** @type {TransformClientState['flush_node']} */ (flush_node),
					namespace: state.namespace,
				});
			} else if (node.type === 'SwitchStatement' || node.type === 'JSXSwitchExpression') {
				node.metadata = { ...node.metadata, is_controlled };
				visit(node, {
					...state,
					flush_node: /** @type {TransformClientState['flush_node']} */ (flush_node),
					namespace: state.namespace,
				});
			} else if (node.type === 'BreakStatement') {
				// do nothing
			} else if (node.type === 'ContinueStatement') {
				state.template?.push('<!>');
			} else {
				debugger;
			}

			if (node.type !== 'BreakStatement' && node.type !== 'ContinueStatement') {
				skipped = cached !== null ? 1 : skipped + 1;
			}
		}
	}

	for (let i = 0; i < head_elements.length; i++) {
		const head_element = head_elements[i];
		if (state.to_ts) {
			transform_ts_child(head_element, /** @type {VisitorClientContext} */ ({ visit, state }));
		} else {
			visit_head_element(head_element, i, context);
		}
	}

	if (context.state.inside_head) {
		const title_element = /** @type {ESTreeJSX.JSXElement} */ (
			children.find(
				(node) => is_template_element(node) && get_element_identifier(node)?.name === 'title',
			)
		);

		if (title_element) {
			visit_title_element(title_element, context);
		}
	}

	if (is_fragment_root && skipped > 1 && state.hydration) {
		skipped--;
		state.init?.push(b.stmt(b.call('_$_.next', skipped !== 1 && b.literal(skipped))));
	}

	const template_namespace = state.namespace || 'html';

	if (root && initial !== null && template_id !== null) {
		let flags = is_fragment ? TEMPLATE_FRAGMENT : 0;
		if (template_namespace === 'svg') {
			flags |= TEMPLATE_SVG_NAMESPACE;
		} else if (template_namespace === 'mathml') {
			flags |= TEMPLATE_MATHML_NAMESPACE;
		}
		state.final?.push(b.stmt(b.call('_$_.append', b.id('__anchor'), initial)));
		const template_array = /** @type {NonNullable<TransformClientState['template']>} */ (
			state.template
		);
		const template_items =
			template_namespace === 'html' ? strip_trailing_end_tags(template_array) : template_array;
		const built = flags === 0 ? dom_built_template(template_items) : null;
		/** @type {AST.CallExpression} */
		let template_call;
		if (built !== null) {
			// A few static elements are built with DOM calls; a parse would
			// cost more than the elements.
			template_call = b.call('_$_.template_el', ...dom_built_arguments(built.root, built.inert));
		} else {
			/** @type {AST.Expression[]} */
			const template_args = [join_template(template_items)];
			// The runtime defaults the flags to 0.
			if (flags !== 0) {
				template_args.push(b.literal(flags));
			}

			// For fragments, add the pre-calculated hop count as a third argument.
			// This count reflects emitted top-level positions.
			if (is_fragment) {
				const node_count = fragment_hop_count || 1;
				template_args.push(b.literal(node_count));
			}

			// A template in the SVG or MathML namespace parses through the
			// namespace-aware entry, which an HTML-only bundle never loads.
			template_call = b.call(
				template_namespace === 'html' ? '_$_.template' : '_$_.template_ns',
				...template_args,
			);
		}
		state.hoisted.push(b.var(template_id, template_call));
		register_hoisted(state.hoisted, template_id);
	}
}

/**
 * @param {AST.Node[]} body
 * @returns {number}
 */
function find_top_level_continue_index(body) {
	return body.findIndex((node) => node.type === 'ContinueStatement');
}

/**
 * Emit the DOM placeholder used for a skipped for-of iteration. This is kept
 * separate from generic `transform_body` so a component-loop `continue`
 * never lowers to a JavaScript `continue` inside the for runtime callback.
 *
 * @param {TransformClientState} state
 * @param {AST.Node} source_node
 * @returns {AST.Statement[]}
 */
function create_continue_skip_statements(state, source_node) {
	const template_id = state.scope.generate('root');
	const node_id = b.id(
		state.scope.generate('node'),
		/** @type {AST.NodeWithLocation} */ (source_node),
	);

	state.hoisted.push(b.var(template_id, b.call('_$_.template', join_template(['<!>']))));
	register_hoisted(state.hoisted, template_id);

	return [
		b.var(node_id, b.call(template_id)),
		b.stmt(b.call('_$_.append', b.id('__anchor'), node_id)),
	];
}

/**
 * @param {AST.Node[]} consequent_body
 * @param {TransformClientContext} context
 * @returns {AST.Statement[]}
 */
function transform_continue_consequent_body(consequent_body, context) {
	const continue_index = find_top_level_continue_index(consequent_body);
	if (continue_index === -1) {
		return transform_body(consequent_body, context);
	}

	const continue_node = consequent_body[continue_index];
	return [
		...transform_body(consequent_body.slice(0, continue_index), context),
		...create_continue_skip_statements(context.state, continue_node),
		b.return(null),
	];
}

/**
 * @param {AST.Node[]} body
 * @param {TransformClientContext} context
 * @returns {AST.Statement[]}
 */
function transform_body(body, { visit, state }) {
	/** @type {TransformClientState} */
	const body_state = {
		...state,
		template: [],
		init: [],
		update: [],
		final: [],
		metadata: state.metadata,
		namespace: state.namespace || 'html', // Preserve namespace context
		inside_head: state.inside_head || false,
	};

	transform_children(
		body,
		/** @type {VisitorClientContext} */ ({ visit, state: body_state, root: true }),
	);

	if (/** @type {NonNullable<TransformClientState['update']>} */ (body_state.update).length > 0) {
		if (!state.to_ts) {
			apply_updates(
				/** @type {NonNullable<TransformClientState['init']>} */ (body_state.init),
				/** @type {NonNullable<TransformClientState['update']>} */ (body_state.update),
				state,
			);
		}

		// NOTE: transform_children in `to_ts` mode does NOT add to body_state.update
		// So, we skip adding any actions with body_state.update
	}

	const init = [
		...(state.to_ts ? [] : box_declaration_statements(body)),
		.../** @type {AST.Statement[]} */ (body_state.init),
		.../** @type {NonNullable<TransformClientState['final']>} */ (body_state.final),
	];
	return init;
}

/**
 * Create a TSX language handler with enhanced TypeScript support
 * @param {AST.CommentWithLocation[]} [comments] - Comments to pass to esrap's built-in comment handling
 * @returns {Visitors<AST.Node, TransformClientState>} TSX language handler with TypeScript return type support
 */
function create_tsx_with_typescript_support(comments) {
	const preserved_comments = comments?.filter(shouldPreserveComment) ?? [];
	// Don't pass comments to esrap - we handle them manually via flush_comments_before
	// because esrap's built-in comment handling requires all intermediate nodes to have loc
	// boundaryTokens: this language only prints the to_ts (volar) view — maps
	// are consumed positionally by the language tooling, never shipped.
	const base_tsx = /** @type {Visitors<AST.Node, TransformClientState>} */ (
		withDeferredImports(tsx({ boundaryTokens: true }))
	);

	// Track which comments have been written (by index)
	let comment_index = 0;
	// Track the previous node's line to see if need to
	// insert a new line before the comment
	let prev_line = -1;

	/**
	 * Flush all preserved comments that appear before the given position
	 * @param {TransformClientContext} context
	 * @param {{ line: number, column: number }} position
	 */
	const flush_comments_before = (context, position) => {
		while (comment_index < preserved_comments.length) {
			const comment = preserved_comments[comment_index];
			if (!comment.loc) {
				comment_index++;
				continue;
			}
			// Check if comment is before the current position
			if (
				comment.loc.start.line < position.line ||
				(comment.loc.start.line === position.line && comment.loc.start.column < position.column)
			) {
				if (prev_line > 0 && comment.loc.start.line > prev_line) {
					context.newline();
				}
				// Write the comment
				context.location(comment.loc.start.line, comment.loc.start.column);
				context.write(formatComment(comment));
				context.location(comment.loc.end.line, comment.loc.end.column);
				context.newline();
				comment_index++;
			} else {
				// Comment is at or after position, stop
				break;
			}
		}
		prev_line = position.line;
	};

	/**
	 * Shared handler for function-like nodes to support component->function mapping
	 * Creates source maps for 'function' keyword by passing node to context.write()
	 * @param {AST.Function} node
	 * @param {TransformClientContext} context
	 */
	const handle_function = (node, context) => {
		// esrap ≥2.3.0 prints function-like nodes fully (mapped async/function
		// keywords, generator star, id, typeParameters, params, returnType,
		// body); keep only the node-boundary markers so segments.js can resolve
		// the whole span (see ReturnStatement).
		const loc = node.loc;
		if (loc) context.location(loc.start.line, loc.start.column);
		/** @type {(node: any, context: any) => void} */ (base_tsx[node.type])(node, context);
		if (loc) context.location(loc.end.line, loc.end.column);
	};

	return /** @type {Visitors<AST.Node, TransformClientState>} */ ({
		...base_tsx,
		_(node, context, visit) {
			if (node.loc) {
				flush_comments_before(context, node.loc.start);
			}

			visit(node);
		},
		TSExpressionWithTypeArguments(node, context) {
			context.visit(node.expression);
			if (node.typeParameters) {
				context.visit(node.typeParameters);
			}
		},
		TSModuleDeclaration(node, context) {
			if (node.kind !== 'global') {
				base_tsx.TSModuleDeclaration?.(node, context);
				return;
			}
			if (node.declare) context.write('declare ');
			context.visit(node.id);
			if (node.body) context.visit(node.body);
		},
		TSImportEqualsDeclaration(node, context) {
			// acorn-typescript marks `export import A = B` with `isExport` instead of
			// wrapping it in an ExportNamedDeclaration, and esrap ignores the flag.
			// Mark both ends, as for an ExportNamedDeclaration, so the whole exported
			// statement maps back to its source.
			if (!node.isExport) {
				base_tsx.TSImportEqualsDeclaration?.(node, context);
				return;
			}
			const loc = /** @type {AST.SourceLocation} */ (node.loc);
			context.location(loc.start.line, loc.start.column);
			context.write('export ');
			base_tsx.TSImportEqualsDeclaration?.(node, context);
			context.location(loc.end.line, loc.end.column);
		},
		AssignmentPattern(node, context) {
			// We need to make sure that the whole AssignmentPattern has a start and end mapping
			// Acorn only maps pieces but not the whole thing
			// So we need to cover the start and end source positions manually
			const loc = /** @type {AST.SourceLocation} */ (node.loc);
			// node.left already covers the start
			base_tsx.AssignmentPattern?.(node, context);
			// cover the end
			context.location(loc.end.line, loc.end.column);
		},
		ExpressionStatement(node, context) {
			if (!node.loc) {
				base_tsx.ExpressionStatement?.(node, context);
				return;
			}
			const loc = /** @type {AST.SourceLocation} */ (node.loc);
			context.location(loc.start.line, loc.start.column);
			base_tsx.ExpressionStatement?.(node, context);
			context.location(loc.end.line, loc.end.column);
		},
		JSXCodeBlock(node, context) {
			context.write('{');
			for (const statement of node.body) {
				context.newline();
				context.visit(statement);
			}
			if (node.render) {
				context.newline();
				context.visit(node.render);
			}
			context.newline();
			context.write('}');
		},
		UpdateExpression(node, context) {
			if (!node.loc) {
				base_tsx.UpdateExpression?.(node, context);
				return;
			}
			const loc = /** @type {AST.SourceLocation} */ (node.loc);
			context.location(loc.start.line, loc.start.column);
			base_tsx.UpdateExpression?.(node, context);
			context.location(loc.end.line, loc.end.column);
		},
		UnaryExpression(node, context) {
			if (!node.loc) {
				base_tsx.UnaryExpression?.(node, context);
				return;
			}
			const loc = /** @type {AST.SourceLocation} */ (node.loc);
			context.location(loc.start.line, loc.start.column);
			base_tsx.UnaryExpression?.(node, context);
			context.location(loc.end.line, loc.end.column);
		},
		YieldExpression(node, context) {
			if (!node.loc) {
				base_tsx.YieldExpression?.(node, context);
				return;
			}
			const loc = /** @type {AST.SourceLocation} */ (node.loc);
			context.location(loc.start.line, loc.start.column);
			base_tsx.YieldExpression?.(node, context);
			context.location(loc.end.line, loc.end.column);
		},
		CallExpression(node, context) {
			if (!node.loc) {
				base_tsx.CallExpression?.(node, context);
				return;
			}
			const loc = /** @type {AST.SourceLocation} */ (node.loc);
			context.location(loc.start.line, loc.start.column);
			base_tsx.CallExpression?.(node, context);
			context.location(loc.end.line, loc.end.column);
		},
		Literal(node, context) {
			if (!node.loc || node.raw === undefined) {
				base_tsx.Literal?.(node, context);
				return;
			}
			const loc = /** @type {AST.SourceLocation} */ (node.loc);
			context.location(loc.start.line, loc.start.column);
			context.write(node.raw);
			context.location(loc.end.line, loc.end.column);
		},
		MemberExpression(node, context) {
			if (!node.loc) {
				base_tsx.MemberExpression?.(node, context);
				return;
			}
			const loc = /** @type {AST.SourceLocation} */ (node.loc);
			context.location(loc.start.line, loc.start.column);
			base_tsx.MemberExpression?.(node, context);
			context.location(loc.end.line, loc.end.column);
		},
		ObjectExpression(node, context) {
			if (node.loc) {
				context.location(node.loc.start.line, node.loc.start.column);
			}

			if (node.metadata?.printInline) {
				// Check if this object should be printed inline (e.g., ref attribute spread)
				context.write('{ ');
				for (let i = 0; i < node.properties.length; i++) {
					if (i > 0) context.write(', ');
					context.visit(node.properties[i]);
				}
				context.write(' }');
			} else {
				base_tsx.ObjectExpression?.(node, context);
			}

			if (node.loc) {
				context.location(node.loc.end.line, node.loc.end.column);
			}
		},
		NewExpression(node, context) {
			const loc = /** @type {AST.SourceLocation} */ (node.loc) ?? null;

			if (loc && !node?.metadata?.skipNewMapping) {
				context.location(loc.start.line, loc.start.column);
			}
			context.write('new ');

			if (loc && node?.metadata?.skipNewMapping) {
				context.location(loc.start.line, loc.start.column);
			}

			context.visit(node.callee);
			if (node.typeArguments) {
				context.visit(node.typeArguments);
			}
			context.write('(');
			for (let i = 0; i < node.arguments.length; i++) {
				if (i > 0) context.write(', ');
				context.visit(node.arguments[i]);
			}
			context.write(')');
			if (loc) {
				context.location(loc.end.line, loc.end.column);
			}
		},
		TemplateLiteral(node, context) {
			if (!node.loc) {
				base_tsx.TemplateLiteral?.(node, context);
				return;
			}

			const loc = /** @type {AST.SourceLocation} */ (node.loc);
			context.location(loc.start.line, loc.start.column);
			base_tsx.TemplateLiteral?.(node, context);
			context.location(loc.end.line, loc.end.column);
		},
		SwitchStatement(node, context) {
			const loc = /** @type {AST.SourceLocation} */ (node.loc);
			// the start needs to be covered as we don't cover it in visitors
			context.location(loc.start.line, loc.start.column);
			base_tsx.SwitchStatement?.(node, context);
			// cover the end
			context.location(loc.end.line, loc.end.column);
		},
		ForOfStatement(node, context) {
			const loc = /** @type {AST.SourceLocation} */ (node.loc);
			// the start needs to be covered as we don't cover it in visitors
			context.location(loc.start.line, loc.start.column);
			base_tsx.ForOfStatement?.(node, context);
			if (node.empty) {
				context.newline();
				context.write('(() => ');
				context.visit(node.empty);
				context.write(')();');
			}
			// cover the end
			context.location(loc.end.line, loc.end.column);
		},
		ForStatement(node, context) {
			const loc = /** @type {AST.SourceLocation} */ (node.loc);
			// the start needs to be covered as we don't cover it in visitors
			context.location(loc.start.line, loc.start.column);
			base_tsx.ForStatement?.(node, context);
			// cover the end
			context.location(loc.end.line, loc.end.column);
		},
		ForInStatement(node, context) {
			const loc = /** @type {AST.SourceLocation} */ (node.loc);
			// the start needs to be covered as we don't cover it in visitors
			context.location(loc.start.line, loc.start.column);
			base_tsx.ForInStatement?.(node, context);
			// cover the end
			context.location(loc.end.line, loc.end.column);
		},
		ReturnStatement(node, context) {
			if (!node.loc) {
				base_tsx.ReturnStatement?.(node, context);
				return;
			}

			const { start, end } = node.loc;

			context.location(start.line, start.column);
			base_tsx.ReturnStatement?.(node, context);
			context.location(end.line, end.column);
		},
		AwaitExpression(node, context) {
			// esrap ≥2.3.0 maps the await keyword; keep only boundary markers.
			const loc = /** @type {AST.SourceLocation} */ (node.loc);
			if (loc) context.location(loc.start.line, loc.start.column);
			/** @type {(node: any, context: any) => void} */ (base_tsx.AwaitExpression)(node, context);
			if (loc) context.location(loc.end.line, loc.end.column);
		},
		Property(node, context) {
			let start_pos = node.loc?.start;
			if (node.loc) {
				start_pos = /** @type {AST.Position} */ ({
					line: node.loc.start.line,
					column: node.loc.start.column,
				});
			}

			const is_method = node.method || node.kind === 'get' || node.kind === 'set';

			// Handle getters/setters
			if (node.kind === 'get') {
				context.write('get ');
				if (start_pos) {
					start_pos.column += 'get '.length;
				}
			} else if (node.kind === 'set') {
				if (start_pos) {
					start_pos.column += 'set '.length;
				}
				context.write('set ');
			}

			// Write async keyword (before *)
			if (is_method && /** @type {AST.FunctionExpression} */ (node.value).async) {
				// If not a method, async should be a part of the value e.g. { prop: async function }
				if (start_pos) {
					context.location(start_pos.line, start_pos.column);
				}
				context.write('async ');
				if (start_pos) {
					context.location(start_pos.line, start_pos.column + 'async '.length);
					start_pos.column += 'async '.length;
				}
			}

			// Write * for generator methods
			if (/** @type {AST.FunctionExpression} */ (node.value).generator) {
				context.write('*');
			}

			// Write the key
			if (node.computed) {
				if (node.key.loc) {
					context.location(node.key.loc.start.line, node.key.loc.start.column - 1);
				}
				context.write('[');
				context.visit(node.key);
				context.write(']');
				if (node.key.loc) {
					context.location(node.key.loc.end.line, node.key.loc.end.column + 1);
				}
			} else {
				if (node.shorthand) {
					// Shorthand object properties require an Identifier value. When the
					// transformed value is a tracked MemberExpression (for example
					// @value), emit longhand to keep valid output.
					if (
						node.value.type === 'MemberExpression' &&
						/** @type {AST.MemberExpression & { tracked?: boolean }} */ (node.value).tracked
					) {
						context.visit(node.key);
						context.write(': ');
						context.visit(node.value);
						return;
					}
					// only visit value since key and value are the same
					// or the value will contain the key like in AssignmentPattern: { foo = 1 }
					context.visit(node.value);
					return;
				}

				context.visit(node.key);
			}

			// Method shorthand: { foo() {} } or getters/setters - print params and body directly
			if (is_method) {
				const fn = /** @type {AST.FunctionExpression} */ (node.value);

				fn.metadata.is_method = true;

				// Type parameters: { foo<T>() {} }
				if (fn.typeParameters) {
					context.visit(fn.typeParameters);
				}

				context.write('(');
				for (let i = 0; i < fn.params.length; i++) {
					if (i > 0) context.write(', ');
					context.visit(fn.params[i]);
				}
				context.write(')');

				if (fn.returnType) {
					context.visit(fn.returnType);
				}

				context.write(' ');
				context.visit(fn.body);
				return;
			}

			// Regular property: { key: value }
			context.write(': ');
			context.visit(node.value);
		},
		JSXOpeningElement(node, context) {
			// Set location for '<'
			if (node.loc) {
				context.location(node.loc.start.line, node.loc.start.column);
			}
			context.write('<');

			context.visit(node.name);

			if (node.typeArguments) {
				context.visit(node.typeArguments);
			}

			for (const attr of node.attributes || []) {
				context.write(' ');
				context.visit(attr);
			}

			if (node.selfClosing) {
				context.write(' />');
			} else {
				// Set the source location for the '>'
				// node.loc.end points AFTER the '>', so subtract 1 to get the position OF the '>'
				if (node.loc) {
					context.location(node.loc.end.line, node.loc.end.column - 1);
				}
				context.write('>');
			}

			if (node.loc) {
				context.location(node.loc.end.line, node.loc.end.column);
			}
		},
		JSXClosingElement(node, context) {
			const loc = /** @type {AST.SourceLocation} */ (node.loc);
			context.location(loc.start.line, loc.start.column);
			base_tsx.JSXClosingElement?.(node, context);
			context.location(loc.end.line, loc.end.column);
		},
		JSXIdentifier(node, context) {
			if (!node.loc) {
				base_tsx.JSXIdentifier?.(node, context);
				return;
			}
			const loc = /** @type {AST.SourceLocation} */ (node.loc);
			context.location(loc.start.line, loc.start.column);
			context.write(node.name);
			context.location(loc.end.line, loc.end.column);
		},
		Identifier(node, context) {
			context.write(node.name, node);
			if (node.optional) {
				context.write('?');
			}
			if (node.typeAnnotation) {
				context.visit(node.typeAnnotation);
			}
		},
		JSXExpressionContainer(node, context) {
			const loc = /** @type {AST.SourceLocation} */ (node.loc);
			if (!loc) {
				base_tsx.JSXExpressionContainer?.(node, context);
				return;
			}
			context.location(loc.start.line, loc.start.column);
			base_tsx.JSXExpressionContainer?.(node, context);
			context.location(loc.end.line, loc.end.column);
		},
		MethodDefinition(node, context) {
			node.value.metadata.is_method = true;
			/** @type {AST.Position | undefined} */
			let start_pos;
			if (node.loc) {
				start_pos = /** @type {AST.Position} */ ({
					line: node.loc.start.line,
					column: node.loc.start.column,
				});
			}

			// Write modifiers (static, async, etc.)
			if (node.static) {
				context.write('static ');
				if (start_pos) {
					start_pos.column += 'static '.length;
				}
			}

			if (node.kind === 'get') {
				context.write('get ');
				if (start_pos) {
					start_pos.column += 'get '.length;
				}
			} else if (node.kind === 'set') {
				if (start_pos) {
					start_pos.column += 'set '.length;
				}
				context.write('set ');
			} else if (node.kind === 'constructor') {
				// skip as it's covered by the key
			}

			// Write async keyword (before *)
			if (/** @type {AST.FunctionExpression} */ (node.value).async) {
				if (start_pos) {
					context.location(start_pos.line, start_pos.column);
				}
				context.write('async ');
				if (start_pos) {
					context.location(start_pos.line, start_pos.column + 'async '.length);
					start_pos.column += 'async '.length;
				}
			}

			// Write * for generator methods
			if (node.value.generator) {
				context.write('*');
			}

			// Write the method key
			if (node.computed) {
				if (node.key.loc) {
					context.location(node.key.loc.start.line, node.key.loc.start.column - 1);
				}
				context.write('[');
				context.visit(node.key);
				context.write(']');
				if (node.key.loc) {
					context.location(node.key.loc.end.line, node.key.loc.end.column + 1);
				}
			} else {
				context.visit(node.key);
			}

			// Visit typeParameters
			// TypeParameters can be on either the MethodDefinition or its value (FunctionExpression)
			if (node.typeParameters) {
				context.visit(node.typeParameters);
			} else if (node.value?.typeParameters) {
				context.visit(node.value.typeParameters);
			}

			// Write parameters - set location for opening '('
			if (node.value?.loc) {
				context.location(node.value.loc.start.line, node.value.loc.start.column);
			}
			context.write('(');
			if (node.value?.params) {
				for (let i = 0; i < node.value.params.length; i++) {
					if (i > 0) context.write(', ');
					context.visit(node.value.params[i]);
				}
			}
			context.write(')');

			// Write return type if present
			if (node.value?.returnType) {
				context.visit(node.value.returnType);
			}

			// Write method body
			if (node.value?.body) {
				context.write(' ');
				context.visit(node.value.body);
			}
		},
		ParenthesizedExpression(node, context) {
			if (!node.loc) {
				base_tsx.ParenthesizedExpression?.(node, context);
				return;
			}
			const loc = /** @type {AST.SourceLocation} */ (node.loc);
			context.location(loc.start.line, loc.start.column);
			base_tsx.ParenthesizedExpression?.(node, context);
			context.location(loc.end.line, loc.end.column);
		},
		TSAsExpression(node, context) {
			if (!node.loc) {
				base_tsx.TSAsExpression?.(node, context);
				return;
			}
			const loc = /** @type {AST.SourceLocation} */ (node.loc);
			context.location(loc.start.line, loc.start.column);
			base_tsx.TSAsExpression?.(node, context);
			context.location(loc.end.line, loc.end.column);
		},
		TSObjectKeyword(node, context) {
			if (node.loc) {
				context.location(node.loc.start.line, node.loc.start.column);
			}
			context.write('object');
			if (node.loc) {
				context.location(node.loc.end.line, node.loc.end.column);
			}
		},
		TSTypeParameterDeclaration(node, context) {
			if (node.loc) {
				context.location(node.loc.start.line, node.loc.start.column);
			}
			context.write('<');
			for (let i = 0; i < node.params.length; i++) {
				if (i > 0) {
					context.write(', ');
				}
				context.visit(node.params[i]);
			}
			if (node.params.length === 1 && node.extra?.trailingComma !== undefined) {
				context.write(',');
			}
			context.write('>');
			if (node.loc) {
				context.location(node.loc.end.line, node.loc.end.column);
			}
		},
		TSTypeParameterInstantiation(node, context) {
			if (node.loc) {
				context.location(node.loc.start.line, node.loc.start.column);
			}
			base_tsx.TSTypeParameterInstantiation?.(node, context);
			if (node.loc) {
				context.location(node.loc.end.line, node.loc.end.column);
			}
		},
		TSTypeParameter(node, context) {
			// Set location for the type parameter name
			if (node.loc) {
				context.location(node.loc.start.line, node.loc.start.column);
			}
			context.write(node.name);
			if (node.constraint) {
				context.write(' extends ');
				context.visit(node.constraint);
			}
			if (node.default) {
				context.write(' = ');
				context.visit(node.default);
			}
			if (node.loc) {
				context.location(node.loc.end.line, node.loc.end.column);
			}
		},
		ArrayPattern(node, context) {
			context.write('[');
			for (let i = 0; i < node.elements.length; i++) {
				if (i > 0) context.write(', ');
				if (node.elements[i]) {
					context.visit(/** @type {AST.Pattern} */ (node.elements[i]));
				}
			}
			context.write(']');
			// Visit type annotation if present
			if (node.typeAnnotation) {
				context.visit(node.typeAnnotation);
			}
		},
		FunctionDeclaration(node, context) {
			handle_function(node, context);
		},
		FunctionExpression(node, context) {
			handle_function(node, context);
		},
		ImportDeclaration(node, context) {
			if (node.phase === 'defer') {
				base_tsx.ImportDeclaration?.(node, context);
				return;
			}
			const loc = /** @type {AST.SourceLocation} */ (node.loc);
			// Write 'import' keyword with source location
			// to mark the beginning of the import statement for a full import mapping
			// The semicolon at the end with location will mark the end of the import statement
			context.location(loc.start.line, loc.start.column);
			context.write('import');

			// Handle 'import type' syntax (importKind on the declaration itself)
			if (node.importKind === 'type') {
				context.write(' type');
			}

			context.write(' ');

			// Write specifiers - handle default, namespace, and named imports
			if (node.specifiers && node.specifiers.length > 0) {
				let default_specifier = null;
				let namespace_specifier = null;
				const named_specifiers = [];

				for (const spec of node.specifiers) {
					if (spec.type === 'ImportDefaultSpecifier') {
						default_specifier = spec;
					} else if (spec.type === 'ImportNamespaceSpecifier') {
						namespace_specifier = spec;
					} else if (spec.type === 'ImportSpecifier') {
						named_specifiers.push(spec);
					}
				}

				// Write default import
				if (default_specifier) {
					context.visit(default_specifier);
					if (namespace_specifier || named_specifiers.length > 0) {
						context.write(', ');
					}
				}

				// Write namespace import
				if (namespace_specifier) {
					context.visit(namespace_specifier);
					if (named_specifiers.length > 0) {
						context.write(', ');
					}
				}

				// Write named imports
				if (named_specifiers.length > 0) {
					context.write('{ ');
					for (let i = 0; i < named_specifiers.length; i++) {
						if (i > 0) context.write(', ');
						context.visit(named_specifiers[i]);
					}
					context.write(' }');
				}

				context.write(' from ');
			}

			// Write source
			context.visit(node.source);
			// Write semicolon at the end
			// and record its position to mark the end of the import statement
			// This should work regardless of whether the source has a semi or not
			context.location(loc.end.line, loc.end.column - 1);
			context.write(';');
		},
		ImportDefaultSpecifier(node, context) {
			context.visit(node.local);
		},
		ImportNamespaceSpecifier(node, context) {
			context.write('* as ');
			context.visit(node.local);
		},
		ImportSpecifier(node, context) {
			if (node.importKind === 'type') {
				context.write('type ');
			}
			context.visit(node.imported);
			// Only write 'as local' if imported !== local
			if (/** @type {AST.Identifier} */ (node.imported).name !== node.local.name) {
				context.write(' as ');
				context.visit(node.local);
			}
		},
		TSParenthesizedType(node, context) {
			context.write('(');
			context.visit(/** @type {AST.TSTypeAnnotation} */ (node.typeAnnotation));
			context.write(')');
		},
		TSNamedTupleMember(node, context) {
			context.visit(node.label);
			if (node.optional) {
				context.write('?');
			}
			context.write(': ');
			context.visit(node.elementType);
		},
		TSMappedType(node, context) {
			context.write('{ ');
			if (node.readonly) {
				if (node.readonly === '+' || node.readonly === true) {
					context.write('readonly ');
				} else if (node.readonly === '-') {
					context.write('-readonly ');
				}
			}
			context.write('[');
			// Handle TSTypeParameter inline - mapped types use 'in' not 'extends'
			if (node.typeParameter) {
				const tp = node.typeParameter;
				if (tp.loc) {
					context.location(tp.loc.start.line, tp.loc.start.column);
				}
				// Write the parameter name
				context.write(tp.name);
				// In mapped types, constraint uses 'in' instead of 'extends'
				if (tp.constraint) {
					context.write(' in ');
					context.visit(tp.constraint);
				}
				// Handle 'as' clause for key remapping (e.g., { [K in Keys as NewKey]: V })
				if (node.nameType) {
					context.write(' as ');
					context.visit(node.nameType);
				}
			}
			context.write(']');
			if (node.optional) {
				if (node.optional === '+' || node.optional === true) {
					context.write('?');
				} else if (node.optional === '-') {
					context.write('-?');
				}
			}
			context.write(': ');
			// Visit the value type
			if (node.typeAnnotation) {
				context.visit(node.typeAnnotation);
			}
			context.write(' }');
		},
		TSTypeOperator(node, context) {
			context.write(node.operator);
			context.write(' ');
			context.visit(/** @type {AST.TSTypeAnnotation} */ (node.typeAnnotation));
		},
		TSInstantiationExpression(node, context) {
			// e.g., identity<string>, Array<number> when used as expressions
			context.visit(node.expression);
			if (node.typeArguments) {
				context.visit(node.typeArguments);
			}
		},
		// esrap ≥2.3.0 prints arrows fully (async/typeParameters/returnType and
		// `{`-first body wrapping); keep only the boundary markers — an arrow's
		// span can start at a bare `(`, which boundaryTokens does not anchor.
		ArrowFunctionExpression(node, context) {
			if (node.loc) context.location(node.loc.start.line, node.loc.start.column);
			base_tsx.ArrowFunctionExpression?.(node, context);
			if (node.loc) context.location(node.loc.end.line, node.loc.end.column);
		},
		ClassDeclaration(node, context) {
			if (node.loc) {
				context.location(node.loc.start.line, node.loc.start.column);
			}
			context.write('class ');
			if (node.loc) {
				context.location(node.loc.start.line, node.loc.start.column + 'class'.length);
			}
			if (node.id) {
				context.visit(node.id);
			}
			if (node.typeParameters) {
				context.visit(node.typeParameters);
			}
			if (node.superClass) {
				context.write(' extends ');
				context.visit(node.superClass);
				if (node.superTypeParameters) {
					context.visit(node.superTypeParameters);
				}
			}
			if (node.implements && node.implements.length > 0) {
				context.write(' implements ');
				for (let i = 0; i < node.implements.length; i++) {
					if (i > 0) context.write(', ');
					context.visit(node.implements[i]);
				}
			}
			context.write(' ');
			context.visit(node.body);
		},
		ClassExpression(node, context) {
			if (node.loc) {
				context.location(node.loc.start.line, node.loc.start.column);
			}
			context.write('class');
			if (node.loc) {
				context.location(node.loc.start.line, node.loc.start.column + 'class'.length);
			}
			if (node.id) {
				context.write(' ');
				context.visit(node.id);
			}
			if (node.typeParameters) {
				context.visit(node.typeParameters);
			}
			if (node.superClass) {
				context.write(' extends ');
				context.visit(node.superClass);
				if (node.superTypeParameters) {
					context.visit(node.superTypeParameters);
				}
			}
			if (node.implements && node.implements.length > 0) {
				context.write(' implements ');
				for (let i = 0; i < node.implements.length; i++) {
					if (i > 0) context.write(', ');
					context.visit(node.implements[i]);
				}
			}
			context.write(' ');
			context.visit(node.body);
		},
		TryStatement(node, context) {
			if (node.pending) {
				context.write('(() => ');
				context.visit(node.pending);
				context.write(')();');
				context.newline();
			}

			if (!node.handler && !node.finalizer) {
				context.write('(() => ');
				context.visit(node.block);
				context.write(')();');
				return;
			}

			context.write('try ');
			context.visit(node.block);

			if (node.handler) {
				context.write(' catch');
				if (node.handler.param && !node.handler.resetParam) {
					context.write(' (');
					context.visit(node.handler.param);
					context.write(')');
				}
				context.write(' ');
				if (node.handler.param && node.handler.resetParam) {
					// Emit as IIFE so both params are valid TS arrow function parameters
					context.write('{\n');
					context.indent();
					context.write('((');
					context.visit(node.handler.param);
					if (!node.handler.param.typeAnnotation) {
						context.write(': unknown');
					}
					context.write(', ');
					context.visit(node.handler.resetParam);
					if (!node.handler.resetParam.typeAnnotation) {
						context.write(': () => void');
					}
					context.write(') => ');
					context.visit(node.handler.body);
					context.write(')({}, () => {})\n');
					context.dedent();
					context.write('}');
				} else {
					context.visit(node.handler.body);
				}
			}

			if (node.finalizer) {
				context.write(' finally ');
				context.visit(node.finalizer);
			}
		},
	});
}

/**
 * Transform Ripple AST to JavaScript/TypeScript
 * @param {string} filename - Source filename
 * @param {string} source - Original source code
 * @param {AnalysisResult} analysis - Analysis result
 * @param {boolean} to_ts - Whether to generate TypeScript output
 * @param {boolean} minify_css - Whether to minify CSS output
 * @param {boolean} hmr - Whether to emit HMR wrapper code
 * @returns {{ ast: AST.Program, code: string, map: RawSourceMap, post_processing_changes?: PostProcessingChanges, line_offsets?: LineOffsets, css: string, cssHash: string | null, errors: CompileError[] }}
 */
export function transform_client(
	filename,
	source,
	analysis,
	to_ts,
	minify_css,
	hmr = false,
	hydration = true,
) {
	/** @type {TransformClientState} */
	const state = {
		hydration,
		imports: new Set(),
		events: new Set(),
		template: null,
		hoisted: [],
		init: null,
		inside_head: false,
		update: null,
		final: null,
		flush_node: null,
		scope: analysis.scope,
		scopes: analysis.scopes,
		ancestor_server_block: undefined,
		server_block_locals: [],
		// Filled by the style pre-pass in CSS emission order.
		stylesheets: analysis.stylesheets,
		to_ts,
		filename,
		namespace: 'html',
		metadata: {},
		errors: analysis.errors,
		skip_children_traversal: false,
	};

	// Add ripple internal import once for the entire module
	// Whatever is unused will be tree-shaken later, including a rare case
	// where nothing from ripple/internal/client is used
	if (!to_ts) {
		state.imports.add(`import * as _$_ from 'ripple/internal/client'`);
	}

	let program = /** @type {AST.Program} */ (walk(analysis.ast, { ...state }, visitors));

	/** @type {AST.TSRXProgram['body']} */
	let body = [];

	for (const import_node of state.imports) {
		if (typeof import_node === 'string') {
			body.push(b.stmt(b.id(import_node)));
		} else {
			body.push(import_node);
		}
	}

	for (const hoisted of state.hoisted) {
		body.push(hoisted);
	}

	body.push(...program.body);

	if (state.events.size > 0) {
		body.push(
			b.stmt(
				b.call('_$_.delegate', b.array(Array.from(state.events).map((name) => b.literal(name)))),
			),
		);
	}

	// HMR: wrap all named native TSRX functions with _$_.hmr() and emit import.meta.hot.accept()
	if (hmr && !to_ts) {
		const component_names = new Set(analysis.component_metadata.map((c) => c.id));

		// Track which components are exported and how
		/** @type {{ name: string, export_type: 'default' | 'named' }[]} */
		const exported_components = [];

		// Walk the body to find native TSRX functions and inject HMR wrapping.
		// Function declarations become FunctionExpression nodes via b.function().
		/** @type {AST.TSRXProgram['body']} */
		const hmr_body = [];

		for (const node of body) {
			hmr_body.push(node);

			if (node.type === 'ExportDefaultDeclaration') {
				const decl = /** @type {AST.FunctionExpression} */ (node.declaration);
				if (decl.metadata?.native_tsrx_function && decl.id && component_names.has(decl.id.name)) {
					const name = decl.id.name;
					exported_components.push({ name, export_type: 'default' });
					// Replace ExportDefaultDeclaration with plain FunctionExpression (printed as function declaration)
					hmr_body[hmr_body.length - 1] = decl;
					// Add: ComponentName = _$_.hmr(ComponentName);
					hmr_body.push(b.stmt(b.assignment('=', b.id(name), b.call('_$_.hmr', b.id(name)))));
					// Re-export as default
					hmr_body.push(b.export_default(b.id(name)));
				}
			} else if (node.type === 'ExportNamedDeclaration') {
				const decl = /** @type {AST.FunctionExpression | null | undefined} */ (node.declaration);
				if (
					decl &&
					decl.metadata?.native_tsrx_function &&
					decl.id &&
					component_names.has(decl.id.name)
				) {
					const name = decl.id.name;
					exported_components.push({ name, export_type: 'named' });
					// Replace ExportNamedDeclaration with plain FunctionExpression (printed as function declaration)
					hmr_body[hmr_body.length - 1] = decl;
					// Add: ComponentName = _$_.hmr(ComponentName);
					hmr_body.push(b.stmt(b.assignment('=', b.id(name), b.call('_$_.hmr', b.id(name)))));
					// Re-export as named export
					hmr_body.push(b.export_builder(null, [b.export_specifier(name)]));
				}
			} else if (
				node.type === 'FunctionExpression' &&
				node.metadata?.native_tsrx_function &&
				node.id &&
				component_names.has(node.id.name)
			) {
				const name = node.id.name;
				// Local (non-exported) component — wrap with HMR
				hmr_body.push(b.stmt(b.assignment('=', b.id(name), b.call('_$_.hmr', b.id(name)))));
			}
		}

		// Emit import.meta.hot.accept() block if there are exported components
		if (exported_components.length > 0) {
			const update_lines = exported_components.map(({ name, export_type }) => {
				const accessor = export_type === 'default' ? 'module.default' : `module.${name}`;
				return `${name}[_$_.HMR].update(${accessor});`;
			});

			const hmr_block_code =
				`if (import.meta.hot) {\n` +
				`  import.meta.hot.accept((module) => {\n` +
				update_lines.map((line) => `    ${line}`).join('\n') +
				`\n  });\n` +
				`}`;

			hmr_body.push(b.stmt(b.id(hmr_block_code)));
		}

		body = hmr_body;
	}

	/** @type {AST.TSRXProgram['body']} */ (program.body) = body;

	const language_handler = to_ts
		? create_tsx_with_typescript_support(analysis.comments)
		: /** @type {Visitors<AST.Node, TransformClientState>} */ (withDeferredImports(tsx()));

	const printed = print(program, language_handler, {
		sourceMapContent: source,
		sourceMapSource: path.basename(filename),
	});
	let { code } = printed;
	const { map } = printed;

	// Post-process TypeScript output to remove 'declare' from function overload signatures
	// Function overload signatures in regular .ts files should not have 'declare' keyword
	// Track changes for source map adjustment - organize them for efficient lookup
	/** @type {PostProcessingChanges | null} */
	let post_processing_changes = null;
	/** @type {LineOffsets} */
	let line_offsets = [];

	if (to_ts) {
		// Build line offset map for converting byte offset to line:column
		line_offsets = [0];
		for (let i = 0; i < code.length; i++) {
			if (code[i] === '\n') {
				line_offsets.push(i + 1);
			}
		}

		/**
		 * Convert byte offset to line number (1-based)
		 * @param {number} offset
		 * @returns {number}
		 */
		const offset_to_line = (offset) => {
			for (let i = 0; i < line_offsets.length; i++) {
				if (
					offset >= line_offsets[i] &&
					(i === line_offsets.length - 1 || offset < line_offsets[i + 1])
				) {
					return i + 1;
				}
			}
			return 1;
		};

		/** @type {Map<number, {offset: number, delta: number}>} */
		const line_deltas = new Map(); // line -> {offset: first change offset, delta: total delta for line}

		// Remove 'export declare function' -> 'export function' (for overloads only, not implementations)
		// Match: export declare function name(...): type;
		// Don't match: export declare function name(...): type { (has body)
		code = code.replace(
			/^(export\s+)declare\s+(function\s+\w+[^{\n]*;)$/gm,
			(match, p1, p2, offset) => {
				const replacement = p1 + p2;
				const line = offset_to_line(offset);
				const delta = replacement.length - match.length; // negative (removing 'declare ')

				// Track first change offset and total delta per line
				if (!line_deltas.has(line)) {
					line_deltas.set(line, { offset, delta });
				} else {
					// Additional change on same line - accumulate delta
					// @ts-ignore
					line_deltas.get(line).delta += delta;
				}

				return replacement;
			},
		);

		post_processing_changes = line_deltas;
	}

	const { css, cssHash } = renderCssResult(state.stylesheets, minify_css);

	/** @type {ReturnType<typeof transform_client>} */
	const result = {
		ast: program,
		code,
		map,
		css,
		cssHash,
		errors: state.errors,
	};

	if (post_processing_changes) {
		result.post_processing_changes = post_processing_changes;
	}

	if (line_offsets.length > 0) {
		result.line_offsets = line_offsets;
	}

	return result;
}
