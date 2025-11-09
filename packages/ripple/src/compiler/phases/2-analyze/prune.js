import { walk } from 'zimmerframe';
import { is_element_dom_element } from '../../utils.js';

const seen = new Set();
const regex_backslash_and_following_character = /\\(.)/g;
const FORWARD = 0;
const BACKWARD = 1;

// CSS selector constants
const descendant_combinator = { name: ' ', type: 'Combinator' };
const nesting_selector = {
	type: 'NestingSelector',
	name: '&',
	selectors: [],
	metadata: { scoped: false },
};
const any_selector = {
	type: 'RelativeSelector',
	selectors: [{ type: 'TypeSelector', name: '*' }],
	combinator: null,
	metadata: { scoped: false },
};

// Whitelist for attribute selectors on specific elements
const whitelist_attribute_selector = new Map([
	['details', ['open']],
	['dialog', ['open']],
	['form', ['novalidate']],
	['iframe', ['allow', 'allowfullscreen', 'allowpaymentrequest', 'loading', 'referrerpolicy']],
	['img', ['loading']],
	[
		'input',
		[
			'accept',
			'autocomplete',
			'capture',
			'checked',
			'disabled',
			'max',
			'maxlength',
			'min',
			'minlength',
			'multiple',
			'pattern',
			'placeholder',
			'readonly',
			'required',
			'size',
			'step',
		],
	],
	['object', ['typemustmatch']],
	['ol', ['reversed', 'start', 'type']],
	['optgroup', ['disabled']],
	['option', ['disabled', 'selected']],
	['script', ['async', 'defer', 'nomodule', 'type']],
	['select', ['disabled', 'multiple', 'required', 'size']],
	[
		'textarea',
		[
			'autocomplete',
			'disabled',
			'maxlength',
			'minlength',
			'placeholder',
			'readonly',
			'required',
			'rows',
			'wrap',
		],
	],
	['video', ['autoplay', 'controls', 'loop', 'muted', 'playsinline']],
]);

function get_relative_selectors(node) {
	const selectors = truncate(node);

	if (node.metadata.rule?.metadata.parent_rule && selectors.length > 0) {
		let has_explicit_nesting_selector = false;

		// nesting could be inside pseudo classes like :is, :has or :where
		for (let selector of selectors) {
			walk(selector, null, {
				// @ts-ignore
				NestingSelector() {
					has_explicit_nesting_selector = true;
				},
			});

			// if we found one we can break from the others
			if (has_explicit_nesting_selector) break;
		}

		if (!has_explicit_nesting_selector) {
			if (selectors[0].combinator === null) {
				selectors[0] = {
					...selectors[0],
					combinator: descendant_combinator,
				};
			}

			selectors.unshift(nesting_selector);
		}
	}

	return selectors;
}

function truncate(node) {
	const i = node.children.findLastIndex(({ metadata, selectors }) => {
		const first = selectors[0];
		return (
			// not after a :global selector
			!metadata.is_global_like &&
			!(first.type === 'PseudoClassSelector' && first.name === 'global' && first.args === null) &&
			// not a :global(...) without a :has/is/where(...) modifier that is scoped
			!metadata.is_global
		);
	});

	return node.children.slice(0, i + 1).map((child) => {
		// In case of `:root.y:has(...)`, `y` is unscoped, but everything in `:has(...)` should be scoped (if not global).
		// To properly accomplish that, we gotta filter out all selector types except `:has`.
		const root = child.selectors.find((s) => s.type === 'PseudoClassSelector' && s.name === 'root');
		if (!root || child.metadata.is_global_like) return child;

		return {
			...child,
			selectors: child.selectors.filter(
				(s) => s.type === 'PseudoClassSelector' && s.name === 'has',
			),
		};
	});
}

function apply_selector(relative_selectors, rule, element, direction) {
	const rest_selectors = relative_selectors.slice();
	const relative_selector = direction === FORWARD ? rest_selectors.shift() : rest_selectors.pop();

	const matched =
		!!relative_selector &&
		relative_selector_might_apply_to_node(relative_selector, rule, element, direction) &&
		apply_combinator(relative_selector, rest_selectors, rule, element, direction);

	if (matched) {
		if (!is_outer_global(relative_selector)) {
			relative_selector.metadata.scoped = true;
		}

		element.metadata.scoped = true;
	}

	return matched;
}

function get_ancestor_elements(node, adjacent_only, seen = new Set()) {
	const ancestors = [];

	const path = node.metadata.path;
	let i = path.length;

	while (i--) {
		const parent = path[i];

		if (parent.type === 'Element') {
			ancestors.push(parent);
			if (adjacent_only) {
				break;
			}
		}
	}

	return ancestors;
}

function get_descendant_elements(node, adjacent_only) {
	const descendants = [];

	function visit(current_node, depth = 0) {
		if (current_node.type === 'Element' && current_node !== node) {
			descendants.push(current_node);
			if (adjacent_only) return; // Only direct children for '>' combinator
		}

		// Visit children based on Ripple's AST structure
		if (current_node.children) {
			for (const child of current_node.children) {
				visit(child, depth + 1);
			}
		}

		if (current_node.body) {
			for (const child of current_node.body) {
				visit(child, depth + 1);
			}
		}

		// For template nodes and text interpolations
		if (current_node.expression && typeof current_node.expression === 'object') {
			visit(current_node.expression, depth + 1);
		}
	}

	// Start from node's children
	if (node.children) {
		for (const child of node.children) {
			visit(child);
		}
	}

	if (node.body) {
		for (const child of node.body) {
			visit(child);
		}
	}

	return descendants;
}

/**
 * Check if an element can render dynamic content that might affect CSS matching
 * @param {any} element
 * @param {boolean} check_classes - Whether to check for dynamic class attributes
 * @returns {boolean}
 */
function can_render_dynamic_content(element, check_classes = false) {
	if (!is_element_dom_element(element)) {
		return true;
	}

	// Either a dynamic element or component (only can tell at runtime)
	// But dynamic elements should return false ideally
	if (element.id?.tracked) {
		return true;
	}

	// Check for dynamic class attributes if requested (for class-based selectors)
	if (check_classes && element.attributes) {
		for (const attr of element.attributes) {
			if (attr.type === 'Attribute' && attr.name?.name === 'class') {
				// Check if class value is an expression (not a static string)
				if (attr.value && typeof attr.value === 'object') {
					// If it's a CallExpression or other dynamic value, it's dynamic
					if (attr.value.type !== 'Literal' && attr.value.type !== 'Text') {
						return true;
					}
				}
			}
		}
	}

	return false;
}

function get_possible_element_siblings(node, direction, adjacent_only) {
	const siblings = new Map();
	const parent = get_element_parent(node);

	if (!parent) {
		return siblings;
	}

	// Get the container that holds the siblings
	const container = parent.children || parent.body || [];
	const node_index = container.indexOf(node);

	if (node_index === -1) return siblings;

	// Determine which siblings to check based on direction
	let start, end, step;
	if (direction === FORWARD) {
		start = node_index + 1;
		end = container.length;
		step = 1;
	} else {
		start = node_index - 1;
		end = -1;
		step = -1;
	}

	// Collect siblings
	for (let i = start; i !== end; i += step) {
		const sibling = container[i];

		if (sibling.type === 'Element' || sibling.type === 'Component') {
			siblings.set(sibling, true);
			// Don't break for dynamic elements (children, Components, dynamic components)
			// as they can render dynamic content or might render nothing
			const isDynamic = can_render_dynamic_content(sibling, false);
			if (adjacent_only && !isDynamic) {
				break; // Only immediate sibling for '+' combinator
			}
		}
		// Stop at non-whitespace text nodes for adjacent selectors
		else if (adjacent_only && sibling.type === 'Text' && sibling.value?.trim()) {
			break;
		}
	}

	return siblings;
}

function apply_combinator(relative_selector, rest_selectors, rule, node, direction) {
	const combinator =
		direction == FORWARD ? rest_selectors[0]?.combinator : relative_selector.combinator;
	if (!combinator) return true;

	switch (combinator.name) {
		case ' ':
		case '>': {
			const is_adjacent = combinator.name === '>';
			const parents =
				direction === FORWARD
					? get_descendant_elements(node, is_adjacent)
					: get_ancestor_elements(node, is_adjacent);
			let parent_matched = false;

			for (const parent of parents) {
				if (apply_selector(rest_selectors, rule, parent, direction)) {
					parent_matched = true;
				}
			}

			return (
				parent_matched ||
				(direction === BACKWARD &&
					(!is_adjacent || parents.length === 0) &&
					rest_selectors.every((selector) => is_global(selector, rule)))
			);
		}

		case '+':
		case '~': {
			const siblings = get_possible_element_siblings(node, direction, combinator.name === '+');

			let sibling_matched = false;

			for (const possible_sibling of siblings.keys()) {
				// Check if this sibling can render dynamic content
				// For class selectors, also check if element has dynamic classes
				const has_class_selector = rest_selectors.some((sel) =>
					sel.selectors?.some((s) => s.type === 'ClassSelector'),
				);
				const is_dynamic = can_render_dynamic_content(possible_sibling, has_class_selector);

				if (is_dynamic) {
					if (rest_selectors.length > 0) {
						// Check if the first selector in the rest is global
						const first_rest_selector = rest_selectors[0];
						if (is_global(first_rest_selector, rule)) {
							// Global selector followed by possibly more selectors
							// Check if remaining selectors could match elements after this component
							const remaining = rest_selectors.slice(1);
							if (remaining.length === 0) {
								// Just a global selector, mark as matched
								sibling_matched = true;
							} else {
								// Check if there are any elements after this component that could match the remaining selectors
								const parent = get_element_parent(node);
								if (parent) {
									const container = parent.children || parent.body || [];
									const component_index = container.indexOf(possible_sibling);

									// For adjacent combinator, only check immediate next element
									// For general sibling, check all following elements
									const search_start = component_index + 1;
									const search_end = combinator.name === '+' ? search_start + 1 : container.length;

									for (let i = search_start; i < search_end; i++) {
										const subsequent = container[i];
										if (subsequent.type === 'Element') {
											if (apply_selector(remaining, rule, subsequent, direction)) {
												sibling_matched = true;
												break;
											}
											if (combinator.name === '+') break; // For adjacent, only check first element
										} else if (subsequent.type === 'Component') {
											// Skip components when looking for the target element
											if (combinator.name === '+') {
												// For adjacent, continue looking
												continue;
											}
										}
									}
								}
							}
						}
					} else if (rest_selectors.length === 1 && rest_selectors[0].metadata.is_global) {
						// Single global selector always matches
						sibling_matched = true;
					}
					// Don't apply_selector for dynamic elements - they won't match regular element selectors
				} else if (
					possible_sibling.type === 'Element' &&
					apply_selector(rest_selectors, rule, possible_sibling, direction)
				) {
					sibling_matched = true;
				}
			}

			return (
				sibling_matched ||
				(direction === BACKWARD &&
					get_element_parent(node) === null &&
					rest_selectors.every((selector) => is_global(selector, rule)))
			);
		}

		default:
			// TODO other combinators
			return true;
	}
}

function get_element_parent(node) {
	// Check if metadata and path exist
	if (!node.metadata || !node.metadata.path) {
		return null;
	}

	let path = node.metadata.path;
	let i = path.length;

	while (i--) {
		const parent = path[i];

		if (parent.type === 'Element') {
			return parent;
		}
	}

	return null;
}

/**
 * `true` if is a pseudo class that cannot be or is not scoped
 * @param {Compiler.AST.CSS.SimpleSelector} selector
 */
function is_unscoped_pseudo_class(selector) {
	return (
		selector.type === 'PseudoClassSelector' &&
		// These make the selector scoped
		((selector.name !== 'has' &&
			selector.name !== 'is' &&
			selector.name !== 'where' &&
			// :not is special because we want to scope as specific as possible, but because :not
			// inverses the result, we want to leave the unscoped, too. The exception is more than
			// one selector in the :not (.e.g :not(.x .y)), then .x and .y should be scoped
			(selector.name !== 'not' ||
				selector.args === null ||
				selector.args.children.every((c) => c.children.length === 1))) ||
			// selectors with has/is/where/not can also be global if all their children are global
			selector.args === null ||
			selector.args.children.every((c) => c.children.every((r) => is_global_simple(r))))
	);
}

/**
 * True if is `:global(...)` or `:global` and no pseudo class that is scoped.
 * @param {Compiler.AST.CSS.RelativeSelector} relative_selector
 */
function is_global_simple(relative_selector) {
	const first = relative_selector.selectors[0];

	return (
		first.type === 'PseudoClassSelector' &&
		first.name === 'global' &&
		(first.args === null ||
			// Only these two selector types keep the whole selector global, because e.g.
			// :global(button).x means that the selector is still scoped because of the .x
			relative_selector.selectors.every(
				(selector) =>
					is_unscoped_pseudo_class(selector) || selector.type === 'PseudoElementSelector',
			))
	);
}

function is_global(selector, rule) {
	if (selector.metadata.is_global || selector.metadata.is_global_like) {
		return true;
	}

	let explicitly_global = false;

	for (const s of selector.selectors) {
		/** @type {Compiler.AST.CSS.SelectorList | null} */
		let selector_list = null;
		let can_be_global = false;
		let owner = rule;

		if (s.type === 'PseudoClassSelector') {
			if ((s.name === 'is' || s.name === 'where') && s.args) {
				selector_list = s.args;
			} else {
				can_be_global = is_unscoped_pseudo_class(s);
			}
		}

		if (s.type === 'NestingSelector') {
			owner = /** @type {Compiler.AST.CSS.Rule} */ (rule.metadata.parent_rule);
			selector_list = owner.prelude;
		}

		const has_global_selectors = !!selector_list?.children.some((complex_selector) => {
			return complex_selector.children.every((relative_selector) =>
				is_global(relative_selector, owner),
			);
		});
		explicitly_global ||= has_global_selectors;

		if (!has_global_selectors && !can_be_global) {
			return false;
		}
	}

	return explicitly_global || selector.selectors.length === 0;
}

function is_text_attribute(attribute) {
	return attribute.value.type === 'Literal';
}

function test_attribute(operator, expected_value, case_insensitive, value) {
	if (case_insensitive) {
		expected_value = expected_value.toLowerCase();
		value = value.toLowerCase();
	}
	switch (operator) {
		case '=':
			return value === expected_value;
		case '~=':
			return value.split(/\s/).includes(expected_value);
		case '|=':
			return `${value}-`.startsWith(`${expected_value}-`);
		case '^=':
			return value.startsWith(expected_value);
		case '$=':
			return value.endsWith(expected_value);
		case '*=':
			return value.includes(expected_value);
		default:
			throw new Error("this shouldn't happen");
	}
}

function attribute_matches(node, name, expected_value, operator, case_insensitive) {
	for (const attribute of node.attributes) {
		if (attribute.type === 'SpreadAttribute') return true;

		if (attribute.type !== 'Attribute') continue;

		const lowerCaseName = name.toLowerCase();
		if (![lowerCaseName, `$${lowerCaseName}`].includes(attribute.name.name.toLowerCase())) continue;

		if (expected_value === null) return true;

		if (is_text_attribute(attribute)) {
			return test_attribute(operator, expected_value, case_insensitive, attribute.value.value);
		} else {
			return true;
		}
	}

	return false;
}

function is_outer_global(relative_selector) {
	const first = relative_selector.selectors[0];

	return (
		first &&
		first.type === 'PseudoClassSelector' &&
		first.name === 'global' &&
		(first.args === null ||
			// Only these two selector types can keep the whole selector global, because e.g.
			// :global(button).x means that the selector is still scoped because of the .x
			relative_selector.selectors.every(
				(selector) =>
					selector.type === 'PseudoClassSelector' || selector.type === 'PseudoElementSelector',
			))
	);
}

function relative_selector_might_apply_to_node(relative_selector, rule, element, direction) {
	// Sort :has(...) selectors in one bucket and everything else into another
	const has_selectors = [];
	const other_selectors = [];

	for (const selector of relative_selector.selectors) {
		if (selector.type === 'PseudoClassSelector' && selector.name === 'has' && selector.args) {
			has_selectors.push(selector);
		} else {
			other_selectors.push(selector);
		}
	}

	// If we're called recursively from a :has(...) selector, we're on the way of checking if the other selectors match.
	// In that case ignore this check (because we just came from this) to avoid an infinite loop.
	if (has_selectors.length > 0) {
		// If this is a :has inside a global selector, we gotta include the element itself, too,
		// because the global selector might be for an element that's outside the component,
		// e.g. :root:has(.scoped), :global(.foo):has(.scoped), or :root { &:has(.scoped) {} }
		const rules = get_parent_rules(rule);
		const include_self =
			rules.some((r) => r.prelude.children.some((c) => c.children.some((s) => is_global(s, r)))) ||
			rules[rules.length - 1].prelude.children.some((c) =>
				c.children.some((r) =>
					r.selectors.some(
						(s) =>
							s.type === 'PseudoClassSelector' &&
							(s.name === 'root' || (s.name === 'global' && s.args)),
					),
				),
			);

		// :has(...) is special in that it means "look downwards in the CSS tree". Since our matching algorithm goes
		// upwards and back-to-front, we need to first check the selectors inside :has(...), then check the rest of the
		// selector in a way that is similar to ancestor matching. In a sense, we're treating `.x:has(.y)` as `.x .y`.
		for (const has_selector of has_selectors) {
			const complex_selectors = /** @type {Compiler.AST.CSS.SelectorList} */ (has_selector.args)
				.children;
			let matched = false;

			for (const complex_selector of complex_selectors) {
				const [first, ...rest] = truncate(complex_selector);
				// if it was just a :global(...)
				if (!first) {
					complex_selector.metadata.used = true;
					matched = true;
					continue;
				}

				if (include_self) {
					const selector_including_self = [
						first.combinator ? { ...first, combinator: null } : first,
						...rest,
					];
					if (apply_selector(selector_including_self, rule, element, FORWARD)) {
						complex_selector.metadata.used = true;
						matched = true;
					}
				}

				const selector_excluding_self = [
					any_selector,
					first.combinator ? first : { ...first, combinator: descendant_combinator },
					...rest,
				];
				if (apply_selector(selector_excluding_self, rule, element, FORWARD)) {
					complex_selector.metadata.used = true;
					matched = true;
				}
			}

			if (!matched) {
				return false;
			}
		}
	}

	for (const selector of other_selectors) {
		if (selector.type === 'Percentage' || selector.type === 'Nth') continue;

		const name = selector.name.replace(regex_backslash_and_following_character, '$1');

		switch (selector.type) {
			case 'PseudoClassSelector': {
				if (name === 'host' || name === 'root') return false;

				if (
					name === 'global' &&
					selector.args !== null &&
					relative_selector.selectors.length === 1
				) {
					const args = selector.args;
					const complex_selector = args.children[0];
					return apply_selector(complex_selector.children, rule, element, BACKWARD);
				}

				// We came across a :global, everything beyond it is global and therefore a potential match
				if (name === 'global' && selector.args === null) return true;

				// :not(...) contents should stay unscoped. Scoping them would achieve the opposite of what we want,
				// because they are then _more_ likely to bleed out of the component. The exception is complex selectors
				// with descendants, in which case we scope them all.
				if (name === 'not' && selector.args) {
					for (const complex_selector of selector.args.children) {
						walk(complex_selector, null, {
							ComplexSelector(node, context) {
								node.metadata.used = true;
								context.next();
							},
						});
						const relative = truncate(complex_selector);

						if (complex_selector.children.length > 1) {
							// foo:not(bar foo) means that bar is an ancestor of foo (side note: ending with foo is the only way the selector make sense).
							// We can't fully check if that actually matches with our current algorithm, so we just assume it does.
							// The result may not match a real element, so the only drawback is the missing prune.
							for (const selector of relative) {
								selector.metadata.scoped = true;
							}

							let el = element;
							while (el) {
								el.metadata.scoped = true;
								el = get_element_parent(el);
							}
						}
					}

					break;
				}

				if ((name === 'is' || name === 'where') && selector.args) {
					let matched = false;

					for (const complex_selector of selector.args.children) {
						const relative = truncate(complex_selector);
						const is_global = relative.length === 0;

						if (is_global) {
							complex_selector.metadata.used = true;
							matched = true;
						} else if (apply_selector(relative, rule, element, BACKWARD)) {
							complex_selector.metadata.used = true;
							matched = true;
						} else if (complex_selector.children.length > 1 && (name == 'is' || name == 'where')) {
							// foo :is(bar baz) can also mean that bar is an ancestor of foo, and baz a descendant.
							// We can't fully check if that actually matches with our current algorithm, so we just assume it does.
							// The result may not match a real element, so the only drawback is the missing prune.
							complex_selector.metadata.used = true;
							matched = true;
							for (const selector of relative) {
								selector.metadata.scoped = true;
							}
						}
					}

					if (!matched) {
						return false;
					}
				}

				break;
			}

			case 'PseudoElementSelector': {
				break;
			}

			case 'AttributeSelector': {
				const whitelisted = whitelist_attribute_selector.get(element.id.name.toLowerCase());
				if (
					!whitelisted?.includes(selector.name.toLowerCase()) &&
					!attribute_matches(
						element,
						selector.name,
						selector.value && unquote(selector.value),
						selector.matcher,
						selector.flags?.includes('i') ?? false,
					)
				) {
					return false;
				}
				break;
			}

			case 'ClassSelector': {
				if (!attribute_matches(element, 'class', name, '~=', false)) {
					return false;
				}

				break;
			}

			case 'IdSelector': {
				if (!attribute_matches(element, 'id', name, '=', false)) {
					return false;
				}

				break;
			}

			case 'TypeSelector': {
				if (
					element.id.type === 'Identifier' &&
					element.id.name.toLowerCase() !== name.toLowerCase() &&
					name !== '*'
				) {
					return false;
				}

				break;
			}

			case 'NestingSelector': {
				let matched = false;

				const parent = /** @type {Compiler.AST.CSS.Rule} */ (rule.metadata.parent_rule);

				for (const complex_selector of parent.prelude.children) {
					if (
						apply_selector(get_relative_selectors(complex_selector), parent, element, direction) ||
						complex_selector.children.every((s) => is_global(s, parent))
					) {
						complex_selector.metadata.used = true;
						matched = true;
					}
				}

				if (!matched) {
					return false;
				}

				break;
			}
		}
	}

	// possible match
	return true;
}

// Utility functions for parsing CSS values
function unquote(str) {
	if (
		(str[0] === '"' && str[str.length - 1] === '"') ||
		(str[0] === "'" && str[str.length - 1] === "'")
	) {
		return str.slice(1, -1);
	}
	return str;
}

function get_parent_rules(rule) {
	const rules = [rule];
	let current = rule;

	while (current.metadata.parent_rule) {
		current = current.metadata.parent_rule;
		rules.unshift(current);
	}

	return rules;
}

export function prune_css(css, element) {
	walk(css, null, {
		Rule(node, context) {
			if (node.metadata.is_global_block) {
				context.visit(node.prelude);
			} else {
				context.next();
			}
		},
		ComplexSelector(node, context) {
			const selectors = get_relative_selectors(node);

			seen.clear();

			if (
				apply_selector(
					selectors,
					/** @type {Compiler.AST.CSS.Rule} */ (node.metadata.rule),
					element,
					BACKWARD,
				)
			) {
				node.metadata.used = true;
			}

			context.next();
		},
		PseudoClassSelector(node, context) {
			// Visit nested selectors inside :has(), :is(), :where(), and :not()
			if (
				(node.name === 'has' ||
					node.name === 'is' ||
					node.name === 'where' ||
					node.name === 'not') &&
				node.args
			) {
				context.next();
			}
		},
	});
}
