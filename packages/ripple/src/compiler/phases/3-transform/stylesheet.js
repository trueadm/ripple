import MagicString from 'magic-string';
import { walk } from 'zimmerframe';

const regex_css_browser_prefix = /^-((webkit)|(moz)|(o)|(ms))-/;
const regex_css_name_boundary = /^[\s,;}]$/;

const is_keyframes_node = (node) => remove_css_prefix(node.name) === 'keyframes';

function remove_css_prefix(name) {
	return name.replace(regex_css_browser_prefix, '');
}

function remove_preceding_whitespace(end, state) {
	let start = end;
	while (/\s/.test(state.code.original[start - 1])) start--;
	if (start < end) state.code.remove(start, end);
}

function is_used(rule) {
	return rule.prelude.children.some((selector) => selector.metadata.used);
}

function is_in_global_block(path) {
	return path.some((node) => node.type === 'Rule' && node.metadata.is_global_block);
}

function remove_global_pseudo_class(selector, combinator, state) {
	if (selector.args === null) {
		let start = selector.start;
		if (combinator?.name === ' ') {
			// div :global.x becomes div.x
			while (/\s/.test(state.code.original[start - 1])) start--;
		}
		state.code.remove(start, selector.start + ':global'.length);
	} else {
		state.code
			.remove(selector.start, selector.start + ':global('.length)
			.remove(selector.end - 1, selector.end);
	}
}

function escape_comment_close(node, code) {
	let escaped = false;
	let in_comment = false;

	for (let i = node.start; i < node.end; i++) {
		if (escaped) {
			escaped = false;
		} else {
			const char = code.original[i];
			if (in_comment) {
				if (char === '*' && code.original[i + 1] === '/') {
					code.prependRight(++i, '\\');
					in_comment = false;
				}
			} else if (char === '\\') {
				escaped = true;
			} else if (char === '/' && code.original[++i] === '*') {
				in_comment = true;
			}
		}
	}
}

function append_hash(state, index) {
	state.code.prependRight(index, `${state.hash}-`);
}

/**
 *  @param {AST.CSS.Rule} rule
 * @param {boolean} is_in_global_block
 */
function is_empty(rule, is_in_global_block) {
	if (rule.metadata.is_global_block) {
		return rule.block.children.length === 0;
	}

	for (const child of rule.block.children) {
		if (child.type === 'Declaration') {
			return false;
		}

		if (child.type === 'Rule') {
			if ((is_used(child) || is_in_global_block) && !is_empty(child, is_in_global_block)) {
				return false;
			}
		}

		if (child.type === 'Atrule') {
			if (child.block === null || child.block.children.length > 0) return false;
		}
	}

	return true;
}

const visitors = {
	_: (node, context) => {
		context.state.code.addSourcemapLocation(node.start);
		context.state.code.addSourcemapLocation(node.end);
		context.next();
	},
	Atrule(node, { state, next, path }) {
		if (is_keyframes_node(node)) {
			let start = node.start + node.name.length + 1;
			while (state.code.original[start] === ' ') start += 1;
			let end = start;
			while (state.code.original[end] !== '{' && state.code.original[end] !== ' ') end += 1;

			if (node.prelude.startsWith('-global-')) {
				state.code.remove(start, start + 8);
			} else if (!is_in_global_block(path)) {
				append_hash(state, start);
				state.keyframes[node.prelude]?.indexes.forEach((index) => append_hash(state, index));
				state.keyframes[node.prelude] = { indexes: [], local: true };
			}

			return; // don't transform anything within
		}

		next();
	},
	Declaration(node, { state }) {
		const property = node.property && remove_css_prefix(node.property.toLowerCase());
		if (property === 'animation' || property === 'animation-name') {
			let index = node.start + node.property.length + 1;
			let name = '';

			while (index < state.code.original.length) {
				const character = state.code.original[index];

				if (regex_css_name_boundary.test(character)) {
					if (character !== ' ') {
						const append_index = index - name.length;
						state.keyframes[name] ??= { indexes: [], local: undefined };
						if (state.keyframes[name].local) {
							append_hash(state, append_index);
						} else {
							state.keyframes[name].indexes.push(append_index);
						}
					}

					if (character === ';' || character === '}') {
						break;
					}

					name = '';
				} else {
					name += character;
				}

				index++;
			}
		}
	},
	Rule(node, { state, next, visit, path }) {
		if (is_empty(node, is_in_global_block(path))) {
			state.code.prependRight(node.start, '/* (empty) ');
			state.code.appendLeft(node.end, '*/');
			escape_comment_close(node, state.code);

			return;
		}

		if (!is_used(node) && !is_in_global_block(path)) {
			state.code.prependRight(node.start, '/* (unused) ');
			state.code.appendLeft(node.end, '*/');
			escape_comment_close(node, state.code);

			return;
		}

		if (node.metadata.is_global_block) {
			const selector = node.prelude.children[0];

			if (selector.children.length === 1 && selector.children[0].selectors.length === 1) {
				// `:global {...}`
				if (state.minify) {
					state.code.remove(node.start, node.block.start + 1);
					state.code.remove(node.block.end - 1, node.end);
				} else {
					state.code.prependRight(node.start, '/* ');
					state.code.appendLeft(node.block.start + 1, '*/');

					state.code.prependRight(node.block.end - 1, '/*');
					state.code.appendLeft(node.block.end, '*/');
				}

				// don't recurse into selectors but visit the body
				visit(node.block);
				return;
			}
		}

		next();
	},
	SelectorList(node, { state, next, path }) {
		// Only add comments if we're not inside a complex selector that itself is unused or a global block
		if (
			!is_in_global_block(path) &&
			!path.find((n) => n.type === 'ComplexSelector' && !n.metadata.used)
		) {
			const children = node.children;
			let pruning = false;
			let prune_start = children[0].start;
			let last = prune_start;
			let has_previous_used = false;

			for (let i = 0; i < children.length; i += 1) {
				const selector = children[i];

				if (selector.metadata.used === pruning) {
					if (pruning) {
						let i = selector.start;
						while (state.code.original[i] !== ',') i--;

						if (state.minify) {
							state.code.remove(prune_start, has_previous_used ? i : i + 1);
						} else {
							state.code.appendRight(has_previous_used ? i : i + 1, '*/');
						}
					} else {
						if (i === 0) {
							if (state.minify) {
								prune_start = selector.start;
							} else {
								state.code.prependRight(selector.start, '/* (unused) ');
							}
						} else {
							if (state.minify) {
								prune_start = last;
							} else {
								state.code.overwrite(last, selector.start, ` /* (unused) `);
							}
						}
					}

					pruning = !pruning;
				}

				if (!pruning && selector.metadata.used) {
					has_previous_used = true;
				}

				last = selector.end;
			}

			if (pruning) {
				if (state.minify) {
					state.code.remove(prune_start, last);
				} else {
					state.code.appendLeft(last, '*/');
				}
			}
		}

		// if we're in a `:is(...)` or whatever, keep existing specificity bump state
		let specificity = state.specificity;

		// if this selector list belongs to a rule, require a specificity bump for the
		// first scoped selector but only if we're at the top level
		let parent = path.at(-1);
		if (parent?.type === 'Rule') {
			specificity = { bumped: false };

			/** @type {AST.CSS.Rule | null} */
			let rule = parent.metadata.parent_rule;

			while (rule) {
				if (rule.metadata.has_local_selectors) {
					specificity = { bumped: true };
					break;
				}
				rule = rule.metadata.parent_rule;
			}
		}

		next({ ...state, specificity });
	},
	ComplexSelector(node, context) {
		const before_bumped = context.state.specificity.bumped;

		for (const relative_selector of node.children) {
			if (relative_selector.metadata.is_global) {
				const global = /** @type {AST.CSS.PseudoClassSelector} */ (relative_selector.selectors[0]);
				remove_global_pseudo_class(global, relative_selector.combinator, context.state);

				if (
					node.metadata.rule?.metadata.parent_rule &&
					global.args === null &&
					relative_selector.combinator === null
				) {
					// div { :global.x { ... } } becomes div { &.x { ... } }
					context.state.code.prependRight(global.start, '&');
				}
				continue;
			} else {
				// for any :global() or :global at the middle of compound selector
				for (const selector of relative_selector.selectors) {
					if (selector.type === 'PseudoClassSelector' && selector.name === 'global') {
						remove_global_pseudo_class(selector, null, context.state);
					}
				}
			}

			if (relative_selector.metadata.scoped) {
				if (relative_selector.selectors.length === 1) {
					// skip standalone :is/:where/& selectors
					const selector = relative_selector.selectors[0];
					if (
						selector.type === 'PseudoClassSelector' &&
						(selector.name === 'is' || selector.name === 'where')
					) {
						continue;
					}
				}

				if (relative_selector.selectors.some((s) => s.type === 'NestingSelector')) {
					continue;
				}

				// for the first occurrence, we use a classname selector, so that every
				// encapsulated selector gets a +0-1-0 specificity bump. thereafter,
				// we use a `:where` selector, which does not affect specificity
				let modifier = context.state.selector;
				if (context.state.specificity.bumped) modifier = `:where(${modifier})`;

				context.state.specificity.bumped = true;

				let i = relative_selector.selectors.length;
				while (i--) {
					const selector = relative_selector.selectors[i];

					if (
						selector.type === 'PseudoElementSelector' ||
						selector.type === 'PseudoClassSelector'
					) {
						if (selector.name !== 'root' && selector.name !== 'host') {
							if (i === 0) context.state.code.prependRight(selector.start, modifier);
						}
						continue;
					}

					if (selector.type === 'TypeSelector' && selector.name === '*') {
						context.state.code.update(selector.start, selector.end, modifier);
					} else {
						context.state.code.appendLeft(selector.end, modifier);
					}

					break;
				}
			}
		}

		context.next();

		context.state.specificity.bumped = before_bumped;
	},
	PseudoClassSelector(node, context) {
		if (node.name === 'is' || node.name === 'where' || node.name === 'has' || node.name === 'not') {
			context.next();
		}
	},
};

export function render_stylesheets(stylesheets) {
	let css = '';

	for (const stylesheet of stylesheets) {
		const code = new MagicString(stylesheet.source);
		const state = {
			code,
			hash: stylesheet.hash,
			selector: `.${stylesheet.hash}`,
			keyframes: {},
			specificity: {
				bumped: false,
			},
		};

		walk(stylesheet, state, visitors);
		css += code.toString();
	}

	return css;
}
