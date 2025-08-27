import { walk } from 'zimmerframe';

const seen = new Set();
const regex_backslash_and_following_character = /\\(.)/g;

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
				}
			});

			// if we found one we can break from the others
			if (has_explicit_nesting_selector) break;
		}

		if (!has_explicit_nesting_selector) {
			if (selectors[0].combinator === null) {
				selectors[0] = {
					...selectors[0],
					combinator: descendant_combinator
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
			selectors: child.selectors.filter((s) => s.type === 'PseudoClassSelector' && s.name === 'has')
		};
	});
}

function apply_selector(relative_selectors, rule, element) {
	const parent_selectors = relative_selectors.slice();
	const relative_selector = parent_selectors.pop();

	const matched =
		!!relative_selector &&
		relative_selector_might_apply_to_node(relative_selector, rule, element) &&
		apply_combinator(relative_selector, parent_selectors, rule, element);

	if (matched) {
		if (!is_outer_global(relative_selector)) {
			relative_selector.metadata.scoped = true;
		}

		element.metadata.scoped = true;
	}

	return matched;
}

function apply_combinator(relative_selector, parent_selectors, rule, node) {
	if (!relative_selector.combinator) return true;

	const name = relative_selector.combinator.name;

	switch (name) {
		case ' ':
		case '>': {
			let parent_matched = false;

			const path = node.metadata.path;
			let i = path.length;

			while (i--) {
				const parent = path[i];

				if (parent.type === 'Element') {
					if (apply_selector(parent_selectors, rule, parent)) {
						parent_matched = true;
					}

					if (name === '>') return parent_matched;
				}
			}

			return parent_matched || parent_selectors.every((selector) => is_global(selector, rule));
		}

		case '+':
		case '~': {
			const siblings = get_possible_element_siblings(node, name === '+');

			let sibling_matched = false;

			for (const possible_sibling of siblings.keys()) {
				if (possible_sibling.type === 'RenderTag' || possible_sibling.type === 'SlotElement') {
					// `{@render foo()}<p>foo</p>` with `:global(.x) + p` is a match
					if (parent_selectors.length === 1 && parent_selectors[0].metadata.is_global) {
						sibling_matched = true;
					}
				} else if (apply_selector(parent_selectors, rule, possible_sibling)) {
					sibling_matched = true;
				}
			}

			return (
				sibling_matched ||
				(get_element_parent(node) === null &&
					parent_selectors.every((selector) => is_global(selector, rule)))
			);
		}

		default:
			// TODO other combinators
			return true;
	}
}

function get_element_parent(node) {
	let path = node.metadata.path;
	let i = path.length;

	while (i--) {
		const parent = path[i];

		if (parent.type === 'RegularElement' || parent.type === 'SvelteElement') {
			return parent;
		}
	}

	return null;
}

function is_global(selector, rule) {
	if (selector.metadata.is_global || selector.metadata.is_global_like) {
		return true;
	}

	for (const s of selector.selectors) {
		/** @type {Compiler.AST.CSS.SelectorList | null} */
		let selector_list = null;
		let owner = rule;

		if (s.type === 'PseudoClassSelector') {
			if ((s.name === 'is' || s.name === 'where') && s.args) {
				selector_list = s.args;
			}
		}

		if (s.type === 'NestingSelector') {
			owner = /** @type {Compiler.AST.CSS.Rule} */ (rule.metadata.parent_rule);
			selector_list = owner.prelude;
		}

		const has_global_selectors = selector_list?.children.some((complex_selector) => {
			return complex_selector.children.every((relative_selector) =>
				is_global(relative_selector, owner)
			);
		});

		if (!has_global_selectors) {
			return false;
		}
	}

	return true;
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
		if (attribute.name.name.toLowerCase() !== name.toLowerCase()) continue;

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
		first.type === 'PseudoClassSelector' &&
		first.name === 'global' &&
		(first.args === null ||
			// Only these two selector types can keep the whole selector global, because e.g.
			// :global(button).x means that the selector is still scoped because of the .x
			relative_selector.selectors.every(
				(selector) =>
					selector.type === 'PseudoClassSelector' || selector.type === 'PseudoElementSelector'
			))
	);
}

function relative_selector_might_apply_to_node(relative_selector, rule, element) {
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
		/** @type {Array<Compiler.AST.RegularElement | Compiler.AST.SvelteElement>} */
		const child_elements = [];
		/** @type {Array<Compiler.AST.RegularElement | Compiler.AST.SvelteElement>} */
		const descendant_elements = [];
		/** @type {Array<Compiler.AST.RegularElement | Compiler.AST.SvelteElement>} */
		let sibling_elements; // do them lazy because it's rarely used and expensive to calculate

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
							(s.name === 'root' || (s.name === 'global' && s.args))
					)
				)
			);
		if (include_self) {
			child_elements.push(element);
			descendant_elements.push(element);
		}

		/**
		 * @param {Compiler.AST.SvelteNode} node
		 * @param {{ is_child: boolean }} state
		 */
		function walk_children(node, state) {
			walk(node, state, {
				_(node, context) {
					if (node.type === 'Element') {
						descendant_elements.push(node);

						if (context.state.is_child) {
							child_elements.push(node);
							context.state.is_child = false;
							context.next();
							context.state.is_child = true;
						} else {
							context.next();
						}
					} else {
						context.next();
					}
				}
			});
		}

		walk_children(element.fragment, { is_child: true });

		// :has(...) is special in that it means "look downwards in the CSS tree". Since our matching algorithm goes
		// upwards and back-to-front, we need to first check the selectors inside :has(...), then check the rest of the
		// selector in a way that is similar to ancestor matching. In a sense, we're treating `.x:has(.y)` as `.x .y`.
		for (const has_selector of has_selectors) {
			const complex_selectors = /** @type {Compiler.AST.CSS.SelectorList} */ (has_selector.args)
				.children;
			let matched = false;

			for (const complex_selector of complex_selectors) {
				const selectors = truncate(complex_selector);
				const left_most_combinator = selectors[0]?.combinator ?? descendant_combinator;
				// In .x:has(> y), we want to search for y, ignoring the left-most combinator
				// (else it would try to walk further up and fail because there are no selectors left)
				if (selectors.length > 0) {
					selectors[0] = {
						...selectors[0],
						combinator: null
					};
				}

				const descendants =
					left_most_combinator.name === '+' || left_most_combinator.name === '~'
						? (sibling_elements ??= get_following_sibling_elements(element, include_self))
						: left_most_combinator.name === '>'
						? child_elements
						: descendant_elements;

				let selector_matched = false;

				// Iterate over all descendant elements and check if the selector inside :has matches
				for (const element of descendants) {
					if (
						selectors.length === 0 /* is :global(...) */ ||
						(element.metadata.scoped && selector_matched) ||
						apply_selector(selectors, rule, element)
					) {
						complex_selector.metadata.used = true;
						selector_matched = matched = true;
					}
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
					return apply_selector(complex_selector.children, rule, element);
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
							}
						});
						const relative = truncate(complex_selector);

						if (complex_selector.children.length > 1) {
							// foo:not(bar foo) means that bar is an ancestor of foo (side note: ending with foo is the only way the selector make sense).
							// We can't fully check if that actually matches with our current algorithm, so we just assume it does.
							// The result may not match a real element, so the only drawback is the missing prune.
							for (const selector of relative) {
								selector.metadata.scoped = true;
							}

							/** @type {Compiler.AST.RegularElement | Compiler.AST.SvelteElement | null} */
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
						} else if (apply_selector(relative, rule, element)) {
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
					!whitelisted?.includes(selector.id.name.toLowerCase()) &&
					!attribute_matches(
						element,
						selector.name,
						selector.value && unquote(selector.value),
						selector.matcher,
						selector.flags?.includes('i') ?? false
					)
				) {
					return false;
				}
				break;
			}

			case 'ClassSelector': {
				if (
					!attribute_matches(element, 'class', name, '~=', false) &&
					!element.attributes.some(
						(attribute) => attribute.type === 'ClassDirective' && attribute.name === name
					)
				) {
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
					element.id.name.toLowerCase() !== name.toLowerCase() &&
					name !== '*' &&
					element.id.name[0].toLowerCase() === element.id.name[0]
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
						apply_selector(get_relative_selectors(complex_selector), parent, element) ||
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

export function prune_css(css, element) {
	walk(css, null, {
		Rule(node, context) {
			if (node.metadata.is_global_block) {
				context.visit(node.prelude);
			} else {
				context.next();
			}
		},
		ComplexSelector(node) {
			const selectors = get_relative_selectors(node);

			seen.clear();

			if (
				apply_selector(
					selectors,
					/** @type {Compiler.AST.CSS.Rule} */ (node.metadata.rule),
					element
				)
			) {
				node.metadata.used = true;
			}

			// note: we don't call context.next() here, we only recurse into
			// selectors that don't belong to rules (i.e. inside `:is(...)` etc)
			// when we encounter them below
		}
	});
}
