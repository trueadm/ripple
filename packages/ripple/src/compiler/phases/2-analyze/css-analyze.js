import { walk } from 'zimmerframe';

/**
 * True if is `:global` without arguments
 * @param {any} simple_selector
 */
function is_global_block_selector(simple_selector) {
	return (
		simple_selector.type === 'PseudoClassSelector' &&
		simple_selector.name === 'global' &&
		simple_selector.args === null
	);
}

/**
 * True if is `:global(...)` or `:global` and no pseudo class that is scoped.
 * @param {any} relative_selector
 */
function is_global(relative_selector) {
	const first = relative_selector.selectors[0];

	return (
		first?.type === 'PseudoClassSelector' &&
		first.name === 'global' &&
		(first.args === null ||
			// Only these two selector types keep the whole selector global, because e.g.
			// :global(button).x means that the selector is still scoped because of the .x
			relative_selector.selectors.every(
				(selector) =>
					selector.type === 'PseudoClassSelector' || selector.type === 'PseudoElementSelector',
			))
	);
}

/**
 * Analyze CSS and set metadata for global selectors
 * @param {any} css - The CSS AST
 */
export function analyze_css(css) {
	walk(css, { rule: null }, {
		Rule(node, context) {
			node.metadata.parent_rule = context.state.rule;

			// Check for :global blocks
			// A global block is when the selector starts with :global and has no local selectors before it
			for (const complex_selector of node.prelude.children) {
				let is_global_block = false;

				for (
					let selector_idx = 0;
					selector_idx < complex_selector.children.length;
					selector_idx++
				) {
					const child = complex_selector.children[selector_idx];
					const idx = child.selectors.findIndex(is_global_block_selector);

					if (is_global_block) {
						// All selectors after :global are unscoped
						child.metadata.is_global_like = true;
					}

					// Only set is_global_block if this is the FIRST RelativeSelector and it starts with :global
					if (selector_idx === 0 && idx === 0) {
						// `child` starts with `:global` and is the first selector in the chain
						is_global_block = true;
						node.metadata.is_global_block = is_global_block;
					} else if (idx === 0) {
						// :global appears later in the selector chain (e.g., `div :global p`)
						// Set is_global_block for marking subsequent selectors as global-like
						is_global_block = true;
					} else if (idx !== -1) {
						// `:global` is not at the start - this is invalid but we'll let it through for now
						// The transform phase will handle removal
					}
				}
			}

			// Pass the current rule as state to nested nodes
			const state = { rule: node };
			context.visit(node.prelude, state);
			context.visit(node.block, state);
		},

	ComplexSelector(node, context) {
		// Set the rule metadata before analyzing children
		node.metadata.rule = context.state.rule;

		context.next(); // analyse relevant selectors first

		{
			const global = node.children.find(is_global);

			if (global) {
				const idx = node.children.indexOf(global);
				if (global.selectors[0].args !== null && idx !== 0 && idx !== node.children.length - 1) {
					// ensure `:global(...)` is not used in the middle of a selector (but multiple `global(...)` in sequence are ok)
					for (let i = idx + 1; i < node.children.length; i++) {
						if (!is_global(node.children[i])) {
							throw new Error(
								`:global(...) can be at the start or end of a selector sequence, but not in the middle`,
							);
						}
					}
				}
			}
		}

		// Set is_global metadata
		node.metadata.is_global = node.children.every(
			({ metadata }) => metadata.is_global || metadata.is_global_like,
		);

		node.metadata.used ||= node.metadata.is_global;
	},

	PseudoClassSelector(node, context) {
		// Walk into :is(), :where(), :has(), and :not() to initialize metadata for nested selectors
		if (
			(node.name === 'is' || node.name === 'where' || node.name === 'has' || node.name === 'not') &&
			node.args
		) {
			context.next();
		}
	},		RelativeSelector(node, context) {
			// Check if this selector is a :global selector
			node.metadata.is_global = node.selectors.length >= 1 && is_global(node);

			// Check for :root and other global-like selectors
			if (
				node.selectors.length >= 1 &&
				node.selectors.every(
					(selector) =>
						selector.type === 'PseudoClassSelector' || selector.type === 'PseudoElementSelector',
				)
			) {
				const first = node.selectors[0];
				node.metadata.is_global_like ||=
					(first.type === 'PseudoClassSelector' && first.name === 'host') ||
					(first.type === 'PseudoClassSelector' && first.name === 'root');
			}

			context.next();
		},
	});
}
