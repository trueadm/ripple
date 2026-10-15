import { acorn } from '@tsrx/core';
import ts from 'typescript';
import { compile, compile_to_volar_mappings } from '../src/index.js';
import { describe, expect, it } from 'vitest';
import { check_types, find_exact_mapping } from './test-utils.js';

describe('@tsrx/ripple TypeScript declarations in to_ts', () => {
	it('preserves global augmentations without submodule diagnostics', () => {
		const source =
			'export {};\n' +
			'declare global {\n' +
			'\tvar __tsrxGlobalValue: string | undefined;\n' +
			'}\n' +
			'const globalValue = globalThis.__tsrxGlobalValue;\n';
		const typeOutput = compile_to_volar_mappings(source, 'App.tsrx', { loose: true });
		const runtimeOutputs = [
			compile(source, 'App.tsrx', { loose: true }),
			compile(source, 'App.tsrx', { loose: true, mode: 'server' }),
		];

		expect(typeOutput.errors).toEqual([]);
		expect(typeOutput.code).toContain('declare global');
		expect(typeOutput.code).not.toContain('declare module global');
		expect(check_types(typeOutput.code)).toEqual({
			errors: [],
			types: { globalValue: 'string | undefined' },
		});
		for (const result of runtimeOutputs) {
			expect(result.errors).toEqual([]);
			expect(result.code).not.toContain('declare global');
			expect(result.code).not.toContain('declare module global');
			expect(result.code).not.toContain('var __tsrxGlobalValue');
			expect(result.code).toContain('globalThis.__tsrxGlobalValue');
		}
	});
});

describe('@tsrx/ripple namespaces written with `module`', () => {
	/** @param {string} source */
	function compile_all(source) {
		return {
			type_output: compile_to_volar_mappings(source, 'App.tsrx', { loose: true }),
			runtime_outputs: [
				compile(source, 'App.tsrx', { loose: true }),
				compile(source, 'App.tsrx', { loose: true, mode: 'server' }),
			],
		};
	}

	it.each([
		['a dotted ambient module', 'declare module A.B {\n\tconst x: number;\n}'],
		[
			'a module inside a declare namespace',
			'declare namespace A {\n\tmodule B {\n\t\tconst x: number;\n\t}\n\n\tconst y: typeof B.x;\n}',
		],
		[
			'an ambient module with a `server` name part',
			'declare module A.server {\n\tconst x: number;\n}',
		],
		[
			'a `module server` inside a declare namespace',
			'declare namespace A {\n\tmodule server {\n\t\tconst x: number;\n\t}\n\n\tconst y: typeof server.x;\n}',
		],
		[
			'two merged module blocks inside a declare namespace',
			'declare namespace A {\n\tmodule B {\n\t\tconst x: number;\n\t}\n\n\tmodule B {\n\t\tconst y: number;\n\t}\n}',
		],
	])('compiles %s as a namespace', (_, source) => {
		const { type_output, runtime_outputs } = compile_all(source);

		expect(type_output.errors).toEqual([]);
		expect(type_output.code).toBe(source);
		for (const result of runtime_outputs) {
			expect(result.errors).toEqual([]);
			expect(result.code).not.toContain('declare');
			expect(result.code).not.toContain('_$_server_$_');
		}
	});

	it.each([
		[
			'a dotted `module server` name',
			'module server.api {\n\texport function f() {}\n}',
			'`module server` cannot have a dotted name such as `module server.api`.',
		],
		[
			'a `module server` inside a namespace',
			'namespace A {\n\tmodule server {\n\t\texport function f() {}\n\t}\n}',
			'`module server` can only be declared at the module level.',
		],
		[
			'another module name inside a namespace',
			'namespace A {\n\tmodule B {\n\t\texport function f() {}\n\t}\n}',
			'Ripple only supports `module server` submodules, found `module B`.',
		],
	])('reports %s once and leaves it as a namespace', (_, source, message) => {
		const { type_output, runtime_outputs } = compile_all(source);

		expect(type_output.errors.map((error) => error.message)).toEqual([message]);
		expect(type_output.code).toBe(source);
		for (const result of runtime_outputs) {
			expect(result.errors.map((error) => error.message)).toEqual([message]);
			expect(result.code).not.toContain('_$_server_$_');
		}
		expect(() => compile(source, 'App.tsrx')).toThrow(message);
	});
});

describe('@tsrx/ripple deferred imports', () => {
	it('preserves deferred imports in client, server, and Volar output', () => {
		const source = `import defer * as feature from './feature.js';
			const lazy = import.defer('./lazy.js', { with: { type: 'json' } });

			export function App() {
				return <div>{feature.value}</div>;
			}`;
		const outputs = [
			compile(source, 'App.tsrx').code,
			compile(source, 'App.tsrx', { mode: 'server' }).code,
			compile_to_volar_mappings(source, 'App.tsrx', { loose: true }).code,
		];

		for (const code of outputs) {
			expect(code).toContain("import defer * as feature from './feature.js';");
			expect(code).toContain("import.defer('./lazy.js', { with: { type: 'json' } })");
		}
	});
});

describe('@tsrx/ripple exported import aliases', () => {
	it('keeps `export` on `export import X = Y` in Volar output and maps the statement', () => {
		const source = `namespace Foo { export const answer = 42; }
export import Alias = Foo;
export import Reader = require('./reader.js');
namespace Outer { export import Inner = Foo; }
import Local = Foo;`;
		const { code, mappings, errors } = compile_to_volar_mappings(source, 'App.tsrx', {
			loose: true,
		});

		expect(errors).toEqual([]);
		expect(code).toContain('import Local = Foo');
		expect(code).not.toContain('export import Local');

		for (const statement of [
			'export import Alias = Foo',
			"export import Reader = require('./reader.js')",
			'export import Inner = Foo',
		]) {
			const source_offset = source.indexOf(statement);
			const generated_offset = code.indexOf(statement);
			const statement_mapping = mappings.find(
				(mapping) =>
					mapping.sourceOffsets.length === 2 && mapping.sourceOffsets[0] === source_offset,
			);

			expect(generated_offset).toBeGreaterThan(-1);
			expect(
				find_exact_mapping(mappings, source_offset, generated_offset, 'export'.length),
			).toBeDefined();
			expect(statement_mapping?.sourceOffsets).toEqual([
				source_offset,
				source_offset + `${statement};`.length,
			]);
			expect(statement_mapping?.generatedOffsets[0]).toBe(generated_offset);
		}
	});
});

describe('@tsrx/ripple faithful text output', () => {
	it("keeps a single `@` text child as `<>@</>` instead of `{'@'}` in type-only output", () => {
		const { code, errors } = compile_to_volar_mappings(
			`export function App() @{
				<>@</>
			}`,
			'App.tsrx',
			{ loose: true },
		);

		expect(errors).toEqual([]);
		expect(code).toContain('<>@</>');
		expect(code).not.toContain("{'@'}");
	});

	it('does not promote ordinary single-text output into a string literal', () => {
		const { code, errors } = compile_to_volar_mappings(
			`export function App() @{
				<>Hello</>
			}`,
			'App.tsrx',
			{ loose: true },
		);

		expect(errors).toEqual([]);
		expect(code).toContain('<>Hello</>');
		expect(code).not.toContain("{'Hello'}");
	});

	it('lowers a single `@` text child to a faithful runtime text node', () => {
		const { code } = compile(
			`export function App() @{
				<>@</>
			}`,
			'App.tsrx',
			{ loose: true },
		);

		expect(code).toContain('_$_.text("@")');
	});

	it('renders nothing for a whitespace-only runtime output', () => {
		const { code } = compile(
			`export function App() {
				<>
				</>
			}`,
			'App.tsrx',
			{ loose: true },
		);

		// A nullish/whitespace-only output should emit no text node at all.
		expect(code).not.toContain('_$_.text');
	});

	it('emits a well-formed completion mapping for a `@` in a fragment (to_ts keeps text verbatim)', () => {
		// A `@` typed on its own line in a fragment (an in-progress `@if`/`@for`/…) is
		// recovered as text and compiles fine, so no compile-error fallback covers it. The
		// editor still needs a completion mapping there — and because Ripple keeps text
		// verbatim in to_ts (it does NOT trim as it does at runtime), the node's value and
		// location match, so the mapping has equal source/generated lengths and the completion
		// textEdit round-trips. The trimmed value + wide location combo used to produce a
		// mismatched mapping and VS Code silently dropped every item. Mirrors the reported
		// `@{ <> @ <Item/> </> }`.
		const source = 'function Comp(props) @{\n\t<>\n\t@\n\t\t<div>{"x"}</div>\n\t</>\n}';
		const { mappings } = compile_to_volar_mappings(source, 'App.tsrx', { loose: true });
		const cursor = source.indexOf('@', source.indexOf('<>')) + 1;

		const covering = mappings.filter(
			(m) =>
				m.data?.completion &&
				cursor >= m.sourceOffsets[0] &&
				cursor <= m.sourceOffsets[0] + m.lengths[0],
		);

		expect(covering.length).toBeGreaterThan(0);
		for (const m of covering) {
			expect(m.lengths[0]).toBe(m.generatedLengths[0]);
			expect(m.data?.verification).toBeFalsy();
		}
	});
});

describe('@tsrx/ripple unused template output in the TS view', () => {
	/** @param {string} source */
	function ts_view(source) {
		const { code, errors } = compile_to_volar_mappings(source, 'App.tsrx', { loose: true });
		const file = ts.createSourceFile(
			'App.tsx',
			code,
			ts.ScriptTarget.Latest,
			true,
			ts.ScriptKind.TSX,
		);
		// @ts-expect-error parseDiagnostics is internal
		const syntax_errors = /** @type {ts.Diagnostic[]} */ (file.parseDiagnostics);
		return { code, errors, syntax_errors };
	}

	it('keeps the `;` of template statements so TypeScript reports no second error', () => {
		const { code, errors, syntax_errors } = ts_view(`export function Test() {
	<div />;
	<><div /></>;
}`);

		expect(errors.map((e) => e.message)).toEqual([
			expect.stringContaining('This TSRX template output is unused'),
			expect.stringContaining('This TSRX template output is unused'),
		]);
		expect(syntax_errors).toEqual([]);
		expect(code).toContain('<div />;');
		expect(code).toContain('<><div /></>;');
	});

	it('keeps the `;` of a template in an `if` and `else` body', () => {
		const { code, errors, syntax_errors } = ts_view(`export function C({ x }: { x: boolean }) @{
	if (x) <div />
	else <b />
	<span />
}`);

		expect(errors).toHaveLength(2);
		expect(syntax_errors).toEqual([]);
		expect(code).toContain('if (x) <div />; else <b />;');
		expect(code).toContain('return <span />;');
	});
});

describe('@tsrx/ripple hoisted component entries and control flow', () => {
	it('gives a component with a destructuring parameter a direct render entry', () => {
		const { code } = compile(
			`function Leaf({ path, depth = 0 }) @{
				<span>{path + depth}</span>
			}`,
			'App.tsrx',
		);

		// The pattern destructures in the render function's own signature; the
		// component takes the props object under `__props`.
		expect(code).toContain('function Leaf_render(__anchor, __block, { path, depth = 0 })');
		expect(code).toContain('Leaf[_$_.$r] = Leaf_render;');
		expect(code).toContain(
			'function Leaf(__props) {\n\treturn _$_.tsrx_element(Leaf_render, __props);',
		);
	});

	it('hoists an @if that captures several locals, packed into one object', () => {
		const { code } = compile(
			`function Node({ depth, path }) @{
				@if (depth > 0) {
					<div>{path}</div>
				} @else {
					<span>{path}</span>
				}
			}`,
			'App.tsrx',
		);

		// Condition and branches are module-level and each destructures the packed
		// captures it reads; the call builds the object from the locals at that
		// moment.
		expect(code).toContain('function if_1({ a: depth })');
		expect(code).toContain('function consequent(__anchor, { b: path })');
		expect(code).toContain('function alternate(__anchor, { b: path })');
		expect(code).toContain('_$_.if(__anchor, if_1, true, { a: depth, b: path });');
		expect(code).not.toContain('var consequent =');
	});

	it('boxes a let that hoisted code writes, so the hoist keeps closure semantics', () => {
		const { code } = compile(
			`import { track } from 'ripple';
			export function App() @{
				let div;
				const show = track(true);
				let clicks = 0;
				@if (show.value) {
					<div ref={div} onClick={() => clicks++}>{'x'}</div>
				}
			}`,
			'App.tsrx',
		);

		// Both lets are written by template code (a ref setter, a handler), so
		// they are boxed and the branch is hoisted with the boxes as captures.
		expect(code).toContain('let div = { v: void 0 };');
		expect(code).toContain('let clicks = { v: 0 };');
		expect(code).toContain('function consequent(__anchor, { b: div, c: clicks })');
		expect(code).toContain('_$_.ref(div_1, () => div.v, (v) => div.v = v);');
		expect(code).toContain('clicks.v++');
		// The condition reads tracked state: the enclosing render function
		// evaluates it and drives the if.
		expect(code).toContain(
			'var ifs = _$_.if_static(__anchor, if_1, 1, { a: show, b: div, c: clicks });',
		);
		expect(code).toContain('var __a = if_1({ a: __prev._a, b: __prev._b, c: __prev._c });');
		expect(code).toContain('_$_.if_update(__prev._d, __prev.a = __a);');
		expect(code).not.toContain('_$_.if(');
	});

	it('boxes rebound parameters, nested pattern names, catch parameters and pattern targets', () => {
		const { code } = compile(
			`import { track, trackAsync } from 'ripple';
			export function Panel({ mode = 'view' }) @{
				const show = track(true);
				const edit = () => { mode = 'edit'; };
				@if (show.value) {
					<button onClick={edit}>{mode}</button>
				}
			}
			export function Names(props) @{
				const count = track(0);
				let { user: { first, last = 'none' }, tags: [tag] } = props;
				const rename = () => { first = 'renamed'; tag = 't2'; };
				<span onClick={rename}>{first + last + tag + count.value}</span>
			}
			export function Loader() @{
				const n = track(0);
				@try {
					const data = trackAsync(() => Promise.resolve('x'));
					<p>{data.value}</p>
				} @catch (err) {
					const clear = () => { err = null; };
					<button onClick={clear}>{String(err) + n.value}</button>
				}
			}
			export function Pair() @{
				const tick = track(0);
				let label = 'a';
				let other = 'x';
				const swap = () => { [label] = ['b']; ({ other } = { other: 'y' }); for (label of ['c']) {} };
				<span onClick={swap}>{label + other + tick.value}</span>
			}`,
			'App.tsrx',
		);

		// A parameter is reboxed first thing in the body and the branch reads the box.
		expect(code).toContain('mode = { v: mode };');
		expect(code).toContain("mode.v = 'edit';");
		expect(code).toContain('() => mode.v');
		// Boxed names inside a pattern are renamed there and declared as boxes beside it.
		expect(code).toContain(
			"let { user: { first: first_1, last = 'none' }, tags: [tag_1] } = props,\n\t\tfirst = { v: first_1 },\n\t\ttag = { v: tag_1 };",
		);
		expect(code).toMatch(/__prev\._[a-z]+\.v\b/);
		// A catch parameter is reboxed at the top of the handler.
		expect(code).toContain('err = { v: err };');
		expect(code).toContain('err.v = null;');
		// A destructuring assignment target writes the box.
		expect(code).toContain("let label = { v: 'a' };");
		expect(code).toContain("[label.v] = ['b'];");
		expect(code).toContain("({ other: other.v } = { other: 'y' });");
		expect(code).toContain("for (label.v of ['c'])");
	});

	it('reboxes a reassigned function declaration at the top of its block', () => {
		const { code } = compile(
			`import { track } from 'ripple';
			export function App() @{
				const n = track(0);
				function greet() { return 'hi'; }
				const swap = () => { greet = () => 'bye'; };
				<span onClick={swap}>{greet() + n.value}</span>
			}`,
			'App.tsrx',
		);
		expect(code).toContain('greet = { v: greet };\n\n\tconst n');
		expect(code).toContain("greet.v = () => 'bye';");
		expect(code).toMatch(/__prev\._[a-z]+\.v\(\)/);
	});

	it('leaves a let alone that template code only reads', () => {
		const { code } = compile(
			`import { track } from 'ripple';
			export function App() @{
				const show = track(true);
				let label = 'x';
				@if (show.value) {
					<span>{label}</span>
				}
			}`,
			'App.tsrx',
		);
		expect(code).toContain("let label = 'x';");
		expect(code).not.toContain('{ v:');
	});

	it('writes rest and default destructuring targets through their boxes natively', () => {
		const { code } = compile(
			`export function App(props) @{
				let a = 1;
				let rest = {};
				let tail = [];
				const update = () => {
					({ a = 2, ...rest } = props.obj);
					[a, ...tail] = props.arr;
				};
				<button onClick={update}>{a}{rest.x}{tail.length}</button>
			}`,
			'App.tsrx',
		);

		// Member expressions are valid destructuring targets, rest included, so
		// the pattern keeps JavaScript's own rest and default semantics.
		expect(code).toContain('({ a: a.v = 2, ...rest.v } = props.obj);');
		expect(code).toContain('[a.v, ...tail.v] = props.arr;');
		expect(code).not.toContain('$$value');
	});

	it('passes a single captured local bare', () => {
		const { code } = compile(
			`function Node(props) @{
				@if (props.depth > 0) {
					<div>{props.path}</div>
				}
			}`,
			'App.tsrx',
		);
		expect(code).toContain('function if_1(props)');
		// A prop may be tracked: the render function drives the if, and the
		// runtime probes the condition once for a plain value.
		expect(code).toContain('var ifs = _$_.if_static(__anchor, if_1, 1, props);');
		expect(code).toContain('var __a = if_1(__prev._a);');
		expect(code).toContain('_$_.if_update(__prev._b, __prev.a = __a);');
	});

	it('lets a branch declare a local named like one its condition or a sibling reads', () => {
		const { code } = compile(
			`import { track } from 'ripple';
			export function Sibling({ show }) @{
				const label = track('outer');
				@if (show) {
					const label = 'inner';
					<div>{label}</div>
				} @else {
					<div>{label.value}</div>
				}
			}
			export function Condition() @{
				const label = track(true);
				@if (label.value) {
					const label = 'inner';
					<div>{label}</div>
				}
			}
			export function Arms({ mode }) @{
				const label = track('outer');
				@switch (mode) {
					@case 'a': {
						const label = 'inner';
						<div>{label}</div>
					}
					@default: {
						<div>{label.value}</div>
					}
				}
			}`,
			'App.tsrx',
		);

		// Each hoisted signature takes apart only the captures its function reads.
		expect(() => acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'module' })).not.toThrow();
		expect(code).toContain("function consequent(__anchor) {\n\tconst label = 'inner';");
		expect(code).toContain('function alternate(__anchor, { b: label })');
		expect(code).toContain('function if_1({ a: show })');
		expect(code).toContain("function consequent_1(__anchor) {\n\tconst label = 'inner';");
		expect(code).toContain('function if_2(label)');
		expect(code).toContain("function switch_case_0(__anchor) {\n\tconst label = 'inner';");
		expect(code).toContain('function switch_case_default(__anchor, { b: label })');
		expect(code).toContain('function switch_1({ a: mode })');
	});

	it('captures a local read beside a nested declaration of the same name', () => {
		const { code } = compile(
			`import { track } from 'ripple';
			export function App({ show, list }) @{
				const label = track('outer');
				@if (show) {
					const out = [];
					for (const label of list) out.push(label);
					<div>{label.value}{out.join()}</div>
				}
			}`,
			'App.tsrx',
		);

		// The loop's `label` shadows only the loop, so the branch still reads the
		// outer one and has to capture it.
		const [, key] = code.match(/function consequent\(__anchor, \{[^}]*\b(\w+): label \}\)/) ?? [];
		expect(key).toBeDefined();
		expect(code).toContain(`${key}: label });`);
	});

	it('rewrites a render block read beside a nested declaration of the same name', () => {
		const { code } = compile(
			`import { track } from 'ripple';
			export function App() @{
				const label = track('outer');
				const parts = ['a', 'b'];
				<div title={parts.map((part) => {
					for (const label of [part]) void label;
					return label.value + part;
				}).join()}>{'x'}</div>
			}`,
			'App.tsrx',
		);

		expect(code).toContain('for (const label of [part]) void label;');
		expect(code).toMatch(/return __prev\._\w+\.value \+ part;/);
		expect(code).toMatch(/_\$_\.render\(render, \{[^}]*_\w+: label[,\s]/);
	});
});

describe('@tsrx/ripple keyed @for pattern reads', () => {
	it('reads plain property and index chains off the per-key tracked item', () => {
		const { code } = compile(
			`export function App({ items }) @{
				@for (const { id, nested: { label }, tags: [first] } of items; key id) {
					<p>{label}{first}</p>
				}
			}`,
			'App.tsrx',
		);

		// The render lowering reads the item once per run (`__pattern`; a local
		// item, off its slot); each name is then a plain member chain on it.
		expect(code).toContain('var __pattern = __prev.$item;');
		expect(code).toContain('__pattern.nested.label');
		expect(code).toContain('__pattern.tags[0]');
		expect(code).toContain('(pattern) => pattern.id');
	});

	it('reads names behind a rest element or a default by destructuring the item', () => {
		const { code } = compile(
			`export function App({ items, pairs }) @{
				<>
					@for (const { id, ...rest } of items; key id) {
						<p>{rest.name}</p>
					}
					@for (const [first, second = 'x', ...others] of pairs; key first) {
						<p>{second}{others.length}</p>
					}
				</>
			}`,
			'App.tsrx',
		);

		// The loop runtime destructures each item once per change with the
		// authored pattern (the trailing `for_keyed` argument); the item's tracked
		// then holds the object of names, and the body reads members of it. The
		// key callback receives the raw item and reads its member chain.
		expect(code).toContain('({ id, ...rest }) => ({ id, rest })');
		expect(code).toContain('_$_.get(pattern).rest.name');
		expect(code).toContain('(pattern) => pattern.id');
		expect(code).toContain("([first, second = 'x', ...others]) => ({ first, second, others })");
		expect(code).toContain('__pattern_1.second');
		expect(code).toContain('__pattern_1.others.length');
		expect(code).not.toContain('_$_.derived');
		expect(code).not.toContain('exclude_from_object');
		expect(code).not.toContain('array_slice');
		expect(code).not.toContain('_$_.fallback');
	});
});

describe('@tsrx/ripple keyed @for key callbacks', () => {
	it('destructures inline only when the key reads a rest or default name', () => {
		const { code } = compile(
			`export function App({ items }) @{
				@for (const { id, ...rest } of items; key rest.key) {
					<p>{id}</p>
				}
			}`,
			'App.tsrx',
		);

		expect(code).toContain('(pattern) => (({ id, ...rest }) => ({ id, rest }))(pattern).rest.key');
	});
});

describe('@tsrx/ripple @switch client lowering', () => {
	it('lowers @switch onto the if runtime with hoisted cases', () => {
		const { code } = compile(
			`import { track } from 'ripple';
			export function Badge(props) @{
				const n = track(0);
				<>
					@switch (props.status) {
						@case 'busy': {
							<p>{'busy'}</p>
						}
						@case 'off': {
						}
						@default: {
							<p>{'idle'}</p>
						}
					}
					@switch (n.value % 2) {
						@case 0: {
							<span>{'even'}</span>
						}
					}
				</>
			}`,
			'App.tsrx',
		);

		// The selector returns the case function; an empty case returns nothing.
		expect(code).toContain("case 'busy':\n\t\t\treturn switch_case_0;");
		expect(code).toContain("case 'off':\n\t\t\treturn;");
		expect(code).toContain('default:\n\t\t\treturn switch_case_default;');
		// Cases and selector are module-level, with the one capture passed through
		// to the selector, which alone reads it.
		expect(code).toContain('function switch_case_0(__anchor) {');
		expect(code).toContain('function switch_1(props)');
		expect(code).toContain('_$_.switch(node, switch_1, false, props);');
		expect(code).toContain('function switch_2(n)');
		expect(code).toContain('_$_.switch(node_1, switch_2, false, n);');
		expect(code).not.toContain('result.push');
	});
});

describe('@tsrx/ripple @switch to_ts', () => {
	// Split the generated `switch (...) { … }` into per-case bodies (text between labels).
	const case_bodies = (code) =>
		code
			.slice(code.indexOf('switch'))
			.split(/\n\s*(?:case [^:]+:|default:)/)
			.slice(1)
			.map((segment) => segment.trim());

	it('emits a terminating return in every @switch case (avoids TS 7029 fallthrough)', () => {
		// `@case` always renders and cannot `break`/fall through, so each generated case must
		// definitely return in the type-only view — even when the render is conditional (an
		// `@if` with no else) or the case is empty. Otherwise TS reports "Fallthrough case in
		// switch (7029)".
		const { code } = compile_to_volar_mappings(
			`export function App({ value }) @{
				@switch (value) {
					@case 1: {
						@if (value) {
							<div>{'a'}</div>
						}
					}
					@case 2: {
					}
					@default: {
						<div>{'d'}</div>
					}
				}
			}`,
			'App.tsrx',
			{ loose: true },
		);

		const bodies = case_bodies(code);
		expect(bodies).toHaveLength(3);
		// Conditional case must end with a fallback return, not a bare `if` (the bug left it
		// falling through to the next case).
		expect(bodies[0]).toMatch(/return\s[^;]*;$/);
		// Empty case must still return (not fall through).
		expect(bodies[1]).toMatch(/^return\s/);
	});

	it('does not add an unreachable return when a case already returns on every path', () => {
		// A single render output, or an exhaustive `@if`/`@else`, already returns — no synthetic
		// return should be appended (it would be unreachable code).
		const { code } = compile_to_volar_mappings(
			`export function App({ value }) @{
				@switch (value) {
					@case 1: {
						@if (value) {
							<div>{'a'}</div>
						} @else {
							<div>{'b'}</div>
						}
					}
					@default: {
						<div>{'d'}</div>
					}
				}
			}`,
			'App.tsrx',
			{ loose: true },
		);

		const bodies = case_bodies(code);
		// The exhaustive if/else case ends with the `if/else` block, not an extra trailing
		// return.
		expect(bodies[0]).toMatch(/}$/);
		expect(bodies[0]).not.toMatch(/}\s*return\s/);
	});

	it('gives every @switch case a return when interleaved with sibling children', () => {
		// A `@switch` alongside other children in a fragment is lowered to its render value, so
		// every case returns (with a trailing `return null`) — none may fall through. Mirrors
		// the reported `<> @switch … @if … <Item/> </>`, where the switch cases (including empty
		// ones) had no returns and TS reported a fallthrough.
		const { code } = compile_to_volar_mappings(
			`function Comp(props) @{
				<>
					@switch (value) {
						@case 'case1': {
							<></>
						}
						@case 'case2': {
						}
						@default: {
						}
					}
					<Item></Item>
				</>
			}`,
			'App.tsrx',
			{ loose: true },
		);

		const bodies = case_bodies(code);
		expect(bodies.length).toBeGreaterThanOrEqual(3);
		// Every case — including the empty `case2`/`default` — must return, not fall through.
		for (const body of bodies) {
			expect(body).toMatch(/^return\b/);
		}
	});
});

describe('@tsrx/ripple @switch arm scopes', () => {
	// Each arm is its own block, so arms may declare the same local, both in a component
	// and in a `@switch` value outside one.
	const source = `export function App({ kind }: { kind: string }) @{
		@switch (kind) {
			@case 'a': {
				const label = 'Alpha';
				<div>{label}</div>
			}
			@case 'b': {
				const label = 'Beta';
				<div>{label}</div>
			}
		}
	}

	export function view(kind: string) {
		return @switch (kind) {
			@case 'a': {
				const label = 'Alpha';
				<div>{label}</div>
			}
			@case 'b': {
				const label = 'Beta';
				<div>{label}</div>
			}
		};
	}`;

	it('keeps same-name arm locals apart in the client and server output', () => {
		for (const mode of /** @type {const} */ (['client', 'server'])) {
			const { code } = compile(source, 'App.tsrx', { mode });
			// acorn tracks lexical scopes, so a redeclared `label` throws.
			expect(
				() => acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'module' }),
				mode,
			).not.toThrow();
		}
	});

	it('gives each declaring arm its own block in to_ts', () => {
		const { code, errors } = compile_to_volar_mappings(source, 'App.tsrx');

		expect(errors).toEqual([]);
		expect(code.match(/case 'a':\s*\{\s*const label = 'Alpha';/g)).toHaveLength(2);
		expect(code.match(/case 'b':\s*\{\s*const label = 'Beta';/g)).toHaveLength(2);
	});
});

describe('@tsrx/ripple style scope hashes', () => {
	const source = `export function Card() @{
	<>
		<style>
			.card { padding: 1.5rem; }
		</style>
		<div class="card">{'one'}</div>
	</>
}

export function Other() @{
	<>
		<style>
			.card { padding: 1.5rem; }
		</style>
		<div class="card">{'two'}</div>
	</>
}`;

	it('produces distinct hashes for identical style blocks in the same file', () => {
		const { cssHash } = compile(source, 'Card.tsrx');
		const hashes = cssHash.split(' ');
		expect(hashes).toHaveLength(2);
		expect(hashes[0]).not.toBe(hashes[1]);
	});

	it('produces distinct hashes for identical style blocks across files', () => {
		const { cssHash: a } = compile(source, 'a/Card.tsrx');
		const { cssHash: b } = compile(source, 'b/Card.tsrx');
		expect(a).not.toBe(b);
	});
});

describe('@tsrx/ripple dynamic tag syntax', () => {
	const source = `function App() @{
	const Tag = 'section';
	<{Tag} class="host">{'hello'}</{Tag}>
}`;

	it('renders dynamic tags directly through composite on the client', () => {
		const { code } = compile(source, 'App.tsrx');
		expect(code).not.toContain(`import { Dynamic as TsrxDynamic } from 'ripple';`);
		expect(code).toContain('_$_.composite(() => Tag, ');
		expect(code).toContain('class: "host"');
		expect(code).toContain('children: _$_.tsrx_element(');
	});

	it('lowers dynamic tags through the internal dynamic_element helper on the server', () => {
		const { code } = compile(source, 'App.tsrx', { mode: 'server' });
		// The tag and the element's own props are passed separately: the props
		// never carry an `is` entry, and the helper resolves a null tag itself.
		expect(code).toContain('_$_.dynamic_element(Tag, {');
		expect(code).not.toContain('is: Tag');
		expect(code).not.toContain('TsrxDynamic');
		expect(code).not.toContain('render_component');
	});

	it('keeps scoped type selectors and applies scope hashes for dynamic tags', () => {
		const { code, css, cssHash } = compile(
			`function App() @{
				const Tag = 'section';
				<>
					<{Tag} class="host">{'hello'}</{Tag}>
					<style>
						div { color: red; }
						.host { color: blue; }
						.unused { color: green; }
					</style>
				</>
			}`,
			'App.tsrx',
		);

		// The tag resolves at runtime, so it could be any element: type
		// selectors must survive pruning, matching classes get the hash, and
		// genuinely unused classes are still pruned.
		expect(css).toContain(`div.${cssHash} { color: red; }`);
		expect(css).toContain(`.host.${cssHash} { color: blue; }`);
		expect(css).toContain('/* (unused) .unused { color: green; }*/');
		expect(code).toContain(`class: 'host ${cssHash}'`);
	});

	it('emits valid to_ts output for dynamic tags', () => {
		const { code } = compile_to_volar_mappings(source, 'App.tsrx', { loose: true });
		expect(code).toContain(`import { Dynamic as TsrxDynamic } from 'ripple';`);
		expect(code).toContain(`<TsrxDynamic is={Tag} class="host"`);
		expect(code).toContain(`children={() =>`);
		expect(code).toContain(`'hello';`);
	});

	it('does not map generated Dynamic tag names over dynamic tag props', () => {
		const source = `function App() @{
	const tag = 'div';
	const className = 'test-class';
	<{tag} class={className} id="test" data-testid="dynamic-element">{'Content'}</{tag}>
}`;
		const result = compile_to_volar_mappings(source, 'App.tsrx', { loose: true });
		const generated_tag_offset = result.code.indexOf('<TsrxDynamic') + 1;
		const generated_is_value_offset = result.code.indexOf('tag', result.code.indexOf('is={'));
		const generated_class_offset = result.code.indexOf('class=', generated_tag_offset);
		const source_class_offset = source.indexOf('class=');
		const source_closing_tag_offset = source.indexOf('tag}', source.indexOf('</{'));

		const generated_tag_mapping = result.mappings.find((mapping) => {
			const generated_offset = mapping.generatedOffsets[0];
			const generated_length = mapping.generatedLengths?.[0] ?? mapping.lengths[0];
			return (
				generated_offset <= generated_tag_offset &&
				generated_tag_offset < generated_offset + generated_length
			);
		});
		const class_mapping = find_exact_mapping(
			result.mappings,
			source_class_offset,
			generated_class_offset,
			'class'.length,
		);
		const closing_tag_mapping = find_exact_mapping(
			result.mappings,
			source_closing_tag_offset,
			generated_is_value_offset,
			'tag'.length,
		);

		expect(generated_tag_mapping).toBeUndefined();
		expect(class_mapping).toBeDefined();
		expect(closing_tag_mapping).toBeDefined();
	});
});

describe('@tsrx/ripple Volar mappings cover declaration keywords', () => {
	/**
	 * @param {string} source
	 */
	const expect_class_keyword_mapping = (source) => {
		const result = compile_to_volar_mappings(source, 'App.tsrx', { loose: true });
		const source_class_offset = source.indexOf('class');
		const generated_class_offset = result.code.indexOf('class');
		const mapping = find_exact_mapping(
			result.mappings,
			source_class_offset,
			generated_class_offset,
			'class'.length,
		);

		expect(mapping?.data.structure).toBe(true);
	};

	it('maps named class keywords', () => {
		expect_class_keyword_mapping(`class Store {
	value = 1;
}`);
	});

	it('maps anonymous default class keywords', () => {
		expect_class_keyword_mapping(`export default class {
	value = 1;
}`);
	});
});

describe('@tsrx/ripple Volar mappings cover arrow functions', () => {
	it('adds a verification-only mapping for the whole arrow function', () => {
		const source = `function C() { const f = (x: number): number => x + 1; return <></>; }`;
		const result = compile_to_volar_mappings(source, 'App.tsrx', { loose: true });
		const source_arrow = '(x: number): number => x + 1';
		const source_offset = source.indexOf(source_arrow);
		const generated_offset = result.code.indexOf(source_arrow);
		const mapping = find_exact_mapping(
			result.mappings,
			source_offset,
			generated_offset,
			source_arrow.length,
		);

		expect(mapping?.data.verification).toBe(true);
		expect(mapping?.data.completion).toBeUndefined();
		expect(mapping?.data.semantic).toBeUndefined();
		expect(mapping?.data.navigation).toBeUndefined();
	});
});

describe('@tsrx/ripple lowers `@{ … }` code blocks in expression position', () => {
	const variants = {
		'assigned to a variable': `function App() {
	const view = @{
		const label = 'hi';
		<p>{label}</p>
	};
	return view;
}`,
		returned: `function make() {
	return @{ <p>{'hi'}</p> };
}`,
	};

	for (const [position, source] of Object.entries(variants)) {
		for (const mode of /** @type {const} */ (['client', 'server'])) {
			it(`compiles a code block ${position} to a tsrx_element (${mode})`, () => {
				const { code } = compile(source, 'App.tsrx', { mode });
				expect(code).toContain('_$_.tsrx_element');
				expect(code).toContain(`ripple/internal/${mode}`);
				expect(code).not.toContain('JSXCodeBlock');
			});
		}

		it(`emits valid to_ts for a code block ${position}`, () => {
			const { code } = compile_to_volar_mappings(source, 'App.tsrx', { loose: true });
			// The block lowers to an immediately-invoked arrow so the TSX printer
			// emits valid TS for type/editor support, rather than leaking a raw
			// `JSXCodeBlock` that prints as a malformed `= { … }`.
			expect(code).toContain('(() => {');
			expect(code).toContain('return <p>');
			expect(code).not.toContain('JSXCodeBlock');
			expect(code).not.toMatch(/=\s*\{\s*\n\s*const/);
		});
	}

	const code_only = `const Test = @{
	const y = 1;
};`;

	for (const mode of /** @type {const} */ (['client', 'server'])) {
		it(`compiles a code-only block in value position to a tsrx_element (${mode})`, () => {
			const { code, errors } = compile(code_only, 'App.tsrx', { mode });
			expect(errors).toEqual([]);
			// A render-less block in value position must not print as a bare
			// `= { … }` block (a malformed object literal); it lowers to the same
			// tsrx_element shape as a render-bearing block, just with no output.
			expect(code).toContain('_$_.tsrx_element');
			expect(code).toContain('const y = 1;');
			expect(code).not.toMatch(/=\s*\{\s*\n\s*const/);
		});
	}

	it('emits valid to_ts for a code-only block in value position', () => {
		const { code } = compile_to_volar_mappings(code_only, 'App.tsrx', { loose: true });
		expect(code).toContain('(() => {');
		expect(code).toContain('const y = 1;');
		expect(code).not.toContain('JSXCodeBlock');
		expect(code).not.toMatch(/=\s*\{\s*\n\s*const/);
	});

	it('keeps setup and variable identifiers navigable in to_ts output', () => {
		const source = `function App() {
	const view = @{
		const label = 'hi';
		<p>{label}</p>
	};
	return view;
}`;
		const result = compile_to_volar_mappings(source, 'App.tsrx', { loose: true });
		for (const token of ['label', 'view']) {
			const source_offset = source.indexOf(token);
			const generated_offset = result.code.indexOf(token);
			const mapping = find_exact_mapping(
				result.mappings,
				source_offset,
				generated_offset,
				token.length,
			);
			expect(mapping?.data.navigation).toBe(true);
		}
	});
});

describe('@tsrx/ripple lowers control flow combined into an expression', () => {
	// A `@if`/`@for`/`@switch`/`@try` directive (or `@{ … }` block) combined into an
	// operator expression is wrapped so it becomes a valid value: a `tsrx_element`
	// render on the client/server, a `<> … </>` in to_ts. It must NOT leak as a bare
	// `if (…) { … }` statement into expression position.
	const operand = `function App({ something }: { something: boolean }) @{
		const ad = (@if (something) { <div>Hello</div> }) || 'something else';
		<div>{ad}</div>
	}`;

	for (const mode of /** @type {const} */ (['client', 'server'])) {
		it(`wraps the directive in a tsrx_element render (${mode})`, () => {
			const { code, errors } = compile(operand, 'App.tsrx', { collect: true, mode });
			expect(errors).toEqual([]);
			// `const ad = _$_.tsrx_element(…) || 'something else'` — the directive lives
			// inside the render callback, not as a bare `if` in expression position.
			expect(code).toMatch(/const ad = _\$_\.tsrx_element\(/);
			expect(code).not.toMatch(/const ad = if\b/);
		});
	}

	it('wraps the directive in a fragment in to_ts output', () => {
		const { code, errors } = compile_to_volar_mappings(operand, 'App.tsrx', { loose: true });
		expect(errors).toEqual([]);
		// The directive value is wrapped in a `<> … </>` (a truthy fragment) as the `||`
		// operand, matching React and the client/server runtime — NOT lowered to a bare
		// `(something ? … : null) || …`, which would imply the fallback can fire when at
		// runtime the render handle is always truthy. The type view must agree.
		expect(code).toContain(
			"const ad = <>{something ? <div>Hello</div> : null}</> || 'something else';",
		);
		expect(code).not.toMatch(/const ad = \(/);
		expect(code).not.toMatch(/const ad = if\b/);
	});

	it('lowers a value-position @else if chain to a ternary chain in to_ts output', () => {
		const source = `function App({ x }: { x: number }) {
	const v = @if (x > 1) { <div>a</div> } @else if (x > 0) { <div>b</div> } @else { <div>c</div> }
	return <div>{v}</div>;
}`;
		// Each `@else if` link recurses into build_tsrx_ts_directive_value as a plain
		// IfStatement — it must lower like the rooting `@if` (the ternary's next arm),
		// not fall through to the `@try` lowering (which used to crash on the missing
		// `block`).
		const { code, errors } = compile_to_volar_mappings(source, 'App.tsrx', { loose: true });
		expect(errors).toEqual([]);
		expect(code).toContain('x > 1 ? <div>a</div> : x > 0 ? <div>b</div> : <div>c</div>');
	});

	it('wraps a @{ … } code block operand and a ternary branch', () => {
		const code_block = `function App() @{
			const ad = (@{ const x = 1; <span>{x}</span> }) || 'd';
			<div>{ad}</div>
		}`;
		const ternary = `function App({ o }: { o: boolean }) @{
			const ad = o ? @if (o) { <p>a</p> } @else { <p>b</p> } : <span>c</span>;
			<div>{ad}</div>
		}`;
		for (const source of [code_block, ternary]) {
			const { code, errors } = compile(source, 'App.tsrx', { collect: true });
			expect(errors, source).toEqual([]);
			expect(code, source).toContain('_$_.tsrx_element');
			expect(code, source).not.toMatch(/=\s*if\b/);
		}
	});

	// A directive leaks in EVERY value position, not just operands — the wrap is
	// keyed off the render-child/statement slots (allow-list), so it covers a
	// concise arrow body (idiomatic in `.map()`), a member object, a `return`
	// argument inside a nested function, etc., across all three modes.
	const valuePositions = {
		'concise arrow body (.map)': `function App({ xs }: { xs: number[] }) @{ <div>{xs.map((x) => @if (x) { <span>{x}</span> })}</div> }`,
		'member object': `function App({ c }: { c: boolean }) @{ const v = (@if (c) { <span>a</span> }).foo; <div>{v}</div> }`,
		'nested function return': `function App({ c }: { c: boolean }) @{ function inner() { return @if (c) { <span>a</span> }; } <div>{inner()}</div> }`,
	};
	for (const [kind, source] of Object.entries(valuePositions)) {
		for (const [mode, fn, opts] of /** @type {const} */ ([
			['client', compile, { collect: true }],
			['server', compile, { collect: true, mode: 'server' }],
			['to_ts', compile_to_volar_mappings, { loose: true }],
		])) {
			it(`wraps a directive in a ${kind} (${mode})`, () => {
				const { code, errors } = fn(source, 'App.tsrx', opts);
				expect(errors).toEqual([]);
				// No control-flow statement / raw JSX node leaked into expression position.
				expect(code).not.toMatch(/=\s*if\b/);
				expect(code).not.toMatch(/=>\s*if\b/);
				expect(code).not.toMatch(/return if\b/);
				expect(code).not.toContain('JSXIfExpression');
			});
		}
	}

	it('does not redundantly wrap a @{ … } code block in non-render value positions', () => {
		// Regression: a code block self-lowers to an IIFE/render of its own, so it must
		// NOT be wrapped in an extra fragment when used as e.g. an array element.
		const { code, errors } = compile(
			`function App() @{ let xs = [@{ let a = 1; <span>{a}</span> }]; <div>{xs}</div> }`,
			'App.tsrx',
			{ collect: true },
		);
		expect(errors).toEqual([]);
		expect(code).not.toContain('JSXCodeBlock');
		// The element scope hash etc. is unrelated; just ensure no stray fragment
		// wrapper was introduced around the code block in the array.
		expect(code).not.toMatch(/\[\s*_\$_\.tsrx_element\(\(__anchor[\s\S]*?\)\) *,?\s*\]/);
	});

	// A directive used as the SOLE value of a slot (`let cd = @if (…) { … }`) has no
	// native Ripple lowering, so without wrapping it leaked as `let cd = if (…) {}`
	// (invalid in every mode). It is now wrapped like any other value position.
	const soleValue = {
		'@if': `function App({ c }: { c: boolean }) @{ let cd = @if (c) { <p>a</p> }; <div>{cd}</div> }`,
		'@if empty': `function App({ c }: { c: boolean }) @{ let cd = @if (c) {}; <div>{cd}</div> }`,
		'@switch': `function App({ c }: { c: boolean }) @{ let cd = @switch (c) { @case true: { <p>a</p> } @default: { <p>b</p> } }; <div>{cd}</div> }`,
		assignment: `function App({ c }: { c: boolean }) @{ let cd; cd = @if (c) { <p>a</p> }; <div>{cd}</div> }`,
	};
	for (const [kind, source] of Object.entries(soleValue)) {
		for (const mode of /** @type {const} */ (['client', 'server'])) {
			it(`wraps a sole-value ${kind} directive (${mode})`, () => {
				const { code, errors } = compile(source, 'App.tsrx', { collect: true, mode });
				expect(errors).toEqual([]);
				expect(code).toContain('_$_.tsrx_element');
				expect(code).not.toMatch(/=\s*if\b/);
				expect(code).not.toMatch(/=\s*switch\b/);
			});
		}

		it(`wraps a sole-value ${kind} directive (to_ts)`, () => {
			const { code, errors } = compile_to_volar_mappings(source, 'App.tsrx', { loose: true });
			expect(errors).toEqual([]);
			// to_ts lowers a sole-value directive to a typed VALUE (matching the JS
			// targets): a ternary for `@if`, a returning IIFE for `@switch` — never a
			// void IIFE whose branches lack `return`.
			if (kind === '@switch') {
				expect(code).toContain('return null;');
				expect(code).toMatch(/case true:\s*return </);
			} else {
				expect(code).toMatch(/cd = c \?/);
			}
			expect(code).not.toMatch(/=\s*if\b/);
			expect(code).not.toMatch(/=\s*switch\b/);
		});
	}

	it('still lowers a sole-value @{ … } code block to an IIFE (not double-wrapped)', () => {
		const { code, errors } = compile(
			`function App() @{ let cd = @{ const x = 1; <span>{x}</span> }; <div>{cd}</div> }`,
			'App.tsrx',
			{ collect: true },
		);
		expect(errors).toEqual([]);
		expect(code).toContain('_$_.tsrx_element');
		expect(code).not.toMatch(/=\s*if\b/);
	});
});

describe('@tsrx/ripple lowers a directive value to a typed value in to_ts (like the JS targets)', () => {
	// A directive in VALUE position must lower to a value the const can be typed
	// from — a ternary / `.map` / returning IIFE — NOT a void IIFE whose branches
	// lack `return` (which would type the const as `void`).
	const ts = (src) => compile_to_volar_mappings(src, 'App.tsrx', { loose: true }).code;

	it('@if -> ternary', () => {
		expect(
			ts(`function App() @{ const v = @if (cond()) { <a /> } @else { <b /> }; <div>{v}</div> }`),
		).toContain('const v = cond() ? <a /> : <b />;');
	});

	it('@if without else -> ternary with null', () => {
		expect(ts(`function App() @{ const v = @if (cond()) { <a /> }; <div>{v}</div> }`)).toContain(
			'const v = cond() ? <a /> : null;',
		);
	});

	it('@switch -> returning IIFE with trailing return null', () => {
		const code = ts(
			`function App() @{ const v = @switch (cond()) { @case 1: { <a /> } @case 2: { <b /> } }; <div>{v}</div> }`,
		);
		expect(code).toMatch(/case 1:\s*return <a \/>;/);
		expect(code).toContain('return null;');
	});

	it('@try -> returning IIFE with try/catch', () => {
		const code = ts(
			`function App() @{ const v = @try { <a /> } @catch (e) { <b /> }; <div>{v}</div> }`,
		);
		expect(code).toMatch(/try \{\s*return <a \/>;/);
		expect(code).toMatch(/catch \(e\) \{\s*return <b \/>;/);
	});

	it('@for -> Array.from(iterable).map (iterable-safe, not an IIFE-with-for)', () => {
		const code = ts(
			`function App({ xs }: { xs: number[] }) @{ const v = @for (const x of xs) { <li>{x}</li> }; <div>{v}</div> }`,
		);
		expect(code).toMatch(/const v = Array\.from\(xs\)\.map\(\(x\) =>/);
		expect(code).toContain('return <li>{x}</li>;');
		expect(code).not.toMatch(/=\s*\(\(\)\s*=>\s*\{\s*for\b/);
	});

	// `@for` accepts any iterable, but `Set`/`Map`/generators have no `.length` or
	// `.map`. Lower through `Array.from(...)` so the binding and the `@empty` branch
	// type-check (the index `; index i` becomes the map callback's 2nd param).
	it('appends trailing static components into the parent without a placeholder', () => {
		const { code } = compile(
			`function Item() @{ <b>item</b> }
			function App() @{ <div><span>{'a'}</span><Item /><Item /></div> }`,
			'App.tsrx',
			{ mode: 'client' },
		);
		expect(code).toContain("_$_.template_el('div', null, [['span', null, 'a']])");
		expect(code).toMatch(
			/var node = _\$_\.hydrating \? _\$_\.hydrate_sibling\(\) : _\$_\.append_into\(div\);/,
		);
		expect(code).toMatch(
			/var node_1 = _\$_\.hydrating \? _\$_\.hydrate_sibling\(\) : _\$_\.append_into\(div\);/,
		);
	});

	it('inserts a component before its static element sibling without a placeholder', () => {
		const { code } = compile(
			`function Item() @{ <b>item</b> }
			function App({ label }) @{ <div><Item /><span>{label}</span></div> }`,
			'App.tsrx',
			{ mode: 'client' },
		);
		expect(code).toContain("_$_.template_el('div', null, [['span', null, ' ']])");
		expect(code).not.toContain('_$_.append_into(');
		// The client's `node` is the span itself; only hydration steps to it.
		expect(code).toMatch(
			/var node = _\$_\.hydrating \? _\$_\.hydrate_child\(\) : div\.firstChild;/,
		);
		expect(code).toContain('_$_.render_component(Item, node, {});');
		expect(code).toMatch(/var span = _\$_\.hydrating \? _\$_\.hydrate_sibling\(\) : node;/);
	});

	it('chains sibling components onto the static element that follows them', () => {
		const { code } = compile(
			`function Item() @{ <b>item</b> }
			function App({ label }) @{ <div><i>{label}</i><Item /><Item /><span>{label}</span></div> }`,
			'App.tsrx',
			{ mode: 'client' },
		);
		expect(code).toContain("_$_.template_el('div', null, [['i', null, ' '], ['span', null, ' ']])");
		expect(code).toMatch(
			/var node = _\$_\.hydrating \? _\$_\.hydrate_sibling\(\) : i\.nextSibling;/,
		);
		expect(code).toMatch(/var node_1 = _\$_\.hydrating \? _\$_\.hydrate_sibling\(\) : node;/);
		expect(code).toMatch(/var span = _\$_\.hydrating \? _\$_\.hydrate_sibling\(\) : node_1;/);
	});

	it('inserts a template @if and @for before their static element sibling', () => {
		const { code } = compile(
			`function App({ show, items, label }) @{
				<div>
					@if (show) { <b>{'b'}</b> }
					<span>{label}</span>
					@for (const item of items) { <i>{item}</i> }
					<em>{label}</em>
				</div>
			}`,
			'App.tsrx',
			{ mode: 'client' },
		);
		expect(code).toContain(
			"_$_.template_el('div', null, [['span', null, ' '], ['em', null, ' ']])",
		);
		expect(code).toContain('_$_.if(node, if_1, false, show);');
		expect(code).toMatch(/_\$_\.for\(\s*node_1,/);
		expect(code).toMatch(
			/var node = _\$_\.hydrating \? _\$_\.hydrate_child\(\) : div\.firstChild;/,
		);
		expect(code).toMatch(/var span = _\$_\.hydrating \? _\$_\.hydrate_sibling\(\) : node;/);
		expect(code).toMatch(
			/var node_1 = _\$_\.hydrating \? _\$_\.hydrate_sibling\(\) : span\.nextSibling;/,
		);
		expect(code).toMatch(/var em = _\$_\.hydrating \? _\$_\.hydrate_sibling\(\) : node_1;/);
	});

	it('aliases the next rendered sibling across a setup block between children', () => {
		const { code } = compile(
			`function Item() @{ <b>item</b> }
			function App({ label }) @{
				<div>
					<Item />
					@{ const upper = label.toUpperCase(); console.log(upper); }
					<span>{label}</span>
				</div>
			}`,
			'App.tsrx',
			{ mode: 'client' },
		);
		expect(code).toContain("_$_.template_el('div', null, [['span', null, ' ']])");
		expect(code).toMatch(
			/var node = _\$_\.hydrating \? _\$_\.hydrate_child\(\) : div\.firstChild;/,
		);
		expect(code).toContain('_$_.render_component(Item, node, {});');
		expect(code).toMatch(/var span = _\$_\.hydrating \? _\$_\.hydrate_sibling\(\) : node;/);
		expect(code).not.toContain('node.nextSibling');
	});

	it('lowers RippleArray statics to standalone runtime functions', () => {
		const source = `import { RippleArray } from 'ripple';
			function App() @{
				const a = new RippleArray(1, 2);
				const b = RippleArray.from([1]);
				const c = RippleArray.of(1);
				const d = RippleArray.fromAsync([1]);
				<div>{a.length + b.length + c.length}</div>
			}`;
		const client = compile(source, 'App.tsrx', { mode: 'client' }).code;
		expect(client).toContain('_$_.ripple_array(__block, 1, 2)');
		expect(client).toContain('_$_.ripple_array_from(__block, [1])');
		expect(client).toContain('_$_.ripple_array_of(__block, 1)');
		expect(client).toContain('_$_.ripple_array_from_async(__block, [1])');
		const server = compile(source, 'App.tsrx', { mode: 'server' }).code;
		expect(server).toContain('_$_.ripple_array(1, 2)');
		expect(server).toContain('_$_.ripple_array_from([1])');
		expect(server).toContain('_$_.ripple_array_of(1)');
		expect(server).toContain('_$_.ripple_array_from_async([1])');
	});

	it('keeps the placeholder for a component followed by text or a dynamic element', () => {
		const text = compile(
			`function Item() @{ <b>item</b> }
			function App() @{ <div><Item />{'a'}</div> }`,
			'App.tsrx',
			{ mode: 'client' },
		).code;
		expect(text).toContain("_$_.template_el('div', null, [null, 'a'])");
		const dynamic = compile(
			`function Item() @{ <b>item</b> }
			function App({ tag }) @{ <div><Item /><{tag}>{'a'}</{tag}></div> }`,
			'App.tsrx',
			{ mode: 'client' },
		).code;
		expect(dynamic).toContain("_$_.template_el('div', null, [null, null])");
	});

	it('@for keyed by the item itself passes no key callback', () => {
		const { code } = compile(
			`function App({ items }: { items: { id: number }[] }) @{ <ul>@for (const item of items; key item) { <li>{item.id}</li> }</ul> }`,
			'App.tsrx',
			{ mode: 'client' },
		);
		expect(code).toContain('_$_.for_keyed(');
		expect(code).not.toContain('(pattern) => _$_.get(pattern)');
		// flags, then an empty key slot ahead of the item body's update function
		expect(code).toMatch(
			/_\$_\.for_keyed\([\s\S]*?\n\s*\d+,\n\s*void 0,\n\s*void 0,\n\s*void 0,\n\s*render\n\s*\);/,
		);
	});

	it('@for keyed by the item itself keeps the @empty branch in its slot', () => {
		const { code } = compile(
			`function App({ items }: { items: { id: number }[] }) @{ <ul>@for (const item of items; key item) { <li>{item.id}</li> } @empty { <li>none</li> }</ul> }`,
			'App.tsrx',
			{ mode: 'client' },
		);
		expect(code).toMatch(/void 0,\s*\(__anchor\) => \{/);
	});

	it('@for keyed by a shadowing item name keeps the key callback', () => {
		const { code } = compile(
			`function App({ items }: { items: { id: number }[] }) @{ <ul>@for (const { id } of items; key id) { <li>{id}</li> }</ul> }`,
			'App.tsrx',
			{ mode: 'client' },
		);
		expect(code).toContain('_$_.for_keyed(');
		expect(code).toMatch(/\(pattern\) => /);
	});

	it('@for over a non-array iterable is iterable-safe via Array.from (+ index, + @empty)', () => {
		const empty = ts(
			`function App({ xs }: { xs: Set<number> }) @{ const v = @for (const x of xs; index i) { <li>{i}{x}</li> } @empty { <p>none</p> }; <div>{v}</div> }`,
		);
		// no bare `xs.length` / `xs.map` (Set has neither) — both go through Array.from.
		expect(empty).not.toMatch(/\bxs\.length\b/);
		expect(empty).not.toMatch(/\bxs\.map\b/);
		// `Array.from(xs)` is materialized ONCE (a generator would be exhausted twice),
		// then the length test and `.map` read the same bound array.
		expect(empty).toContain('const $$items = Array.from(xs);');
		expect(empty).toMatch(/\$\$items\.length === 0/);
		expect(empty).toMatch(/\$\$items\.map\(\(x, i\) =>/);
		expect((empty.match(/Array\.from/g) || []).length).toBe(1);
	});

	// `@for await` iterates an AsyncIterable, which `Array.from` does NOT accept — it
	// lowers to an awaited async IIFE with a real `for await` loop (no `Array.from`).
	it('@for await lowers to an awaited for-await IIFE (not Array.from of an AsyncIterable)', () => {
		const code = ts(
			`async function App({ xs }: { xs: AsyncIterable<number> }) @{ const v = @for await (const x of xs) { <li>{x}</li> } @empty { <p/> }; <div>{v}</div> }`,
		);
		expect(code).toMatch(/const v = await \(async \(\) =>/);
		expect(code).toMatch(/for await \(const x of xs\)/);
		expect(code).toMatch(/\$\$items\.length === 0 \? <p \/> : \$\$items/);
		// must NOT pass an AsyncIterable to Array.from (the bug).
		expect(code).not.toMatch(/Array\.from\(xs\)/);
	});

	it('a directive in RENDER position is unchanged (still renders, no value lowering)', () => {
		const code = ts(`function App() @{ <div>@if (cond()) { <a /> } @else { <b /> }</div> }`);
		// Render position keeps its render IIFE; it is NOT turned into a ternary value.
		expect(code).not.toMatch(/<div>\{cond\(\) \?/);
	});

	// A branch/case with multiple sibling templates must merge into ONE `return` of
	// a fragment — not several returns where only the first is reachable (which would
	// make the editor types disagree with the template).
	it('merges multiple sibling templates in a branch into a single return', () => {
		const ifCode = ts(
			`function App() @{ const v = @if (cond()) { <a /> <b /> } @else { <c /> }; <div>{v}</div> }`,
		);
		expect(ifCode).toContain('const v = cond() ? <><a /><b /></> : <c />;');

		const switchCode = ts(
			`function App() @{ const v = @switch (cond()) { @case 1: { <a /> <b /> } }; <div>{v}</div> }`,
		);
		// One return per case (the merged fragment), not two unreachable returns —
		// the `toMatch` would fail on `case 1: return <a />; return <b />;`.
		expect(switchCode).toMatch(/case 1:\s*return <><a \/><b \/><\/>;/);
		expect(switchCode).not.toMatch(/return <a \/>;\s*return <b \/>;/);

		const forCode = ts(
			`function App({ xs }: { xs: number[] }) @{ const v = @for (const x of xs) { <a /> <b /> }; <div>{v}</div> }`,
		);
		expect(forCode).toMatch(/\.map\(\(x\) => \{\s*return <><a \/><b \/><\/>;\s*\}\)/);
	});

	// A NESTED directive inside a branch/case is render content too: it must be
	// lowered to its own value and merged into the branch's returned fragment — not
	// emitted as a bare `if (…) { … }` dropped from the value.
	it('lowers a nested directive inside a branch to a value and includes it in the return', () => {
		const code = ts(
			`function App() @{ const v = @switch (cond()) { @case 1: { <a /> <b /> @if (cond()) { <div>Hello</div> } } }; <div>{v}</div> }`,
		);
		expect(code).toContain('return <><a /><b />{cond() ? <div>Hello</div> : null}</>;');
		// The nested @if must NOT leak as a bare render statement (no value).
		expect(code).not.toMatch(/if \(cond\(\)\) \{\s*<div>Hello<\/div>;/);
	});

	// A directive nested inside an authored fragment that is itself a branch's value
	// is value content too — it lowers to its own value (a `.map`, not the void
	// render IIFE-with-`for` that drops to `void`).
	it('lowers a directive nested in a fragment inside a branch value to a value', () => {
		const code = ts(
			`function App({ xs, c }: { xs: number[]; c: any }) @{ const v = @switch (c) { @case 1: { <><a /> @for (const x of xs) { <li>{x}</li> }</> } }; <div>{v}</div> }`,
		);
		// The inline space between `<a />` and the directive is significant sibling
		// whitespace (it would render between inline elements) and stays in the output.
		expect(code).toMatch(
			/<><a \/> \{Array\.from\(xs\)\.map\(\(x\) => \{\s*return <li>\{x\}<\/li>;\s*\}\)\}<\/>/,
		);
		// not a void IIFE-with-for inside the fragment.
		expect(code).not.toMatch(/<a \/> \{\(\(\) => \{\s*for \(/);
	});

	// The same nested directive in RENDER position (a direct child of the rendered
	// output) is NOT value-lowered — it still renders as a `for` loop.
	it('keeps a nested directive in render position rendering (not value-lowered)', () => {
		const code = ts(
			`export const Head = ({ scripts }: { scripts: { src: string }[] }) => @{ <head>@for (const script of scripts) { <script src={script.src} /> }</head> }`,
		);
		expect(code).toContain('for (const script of scripts)');
		expect(code).not.toMatch(/scripts\.map\(/);
	});
});

describe('@tsrx/ripple keeps fragments combined into an expression in to_ts output', () => {
	// A fragment is always truthy, but its single child may be falsy, so the to_ts
	// collapse of `<>{0}</>` to `0` would flip `<>{0}</> || 'd'` from rendering `0`
	// to rendering `'d'`. Keep the fragment when it is combined into an expression.
	it('keeps a fragment as a logical operand', () => {
		const { code } = compile_to_volar_mappings(
			`function App() @{ let c = <>{0}</> || "default"; <div>{c}</div> }`,
			'App.tsrx',
			{ loose: true },
		);
		expect(code).toContain('<>');
		expect(code).toContain('</>');
		expect(code).not.toMatch(/let c = 0 \|\|/);
	});

	it('keeps fragments as ternary branches', () => {
		const { code } = compile_to_volar_mappings(
			`function App({ o }: { o: boolean }) @{ let c = o ? <>{1}</> : <>{2}</>; <div>{c}</div> }`,
			'App.tsrx',
			{ loose: true },
		);
		expect(code).toContain('<>');
		expect(code).not.toMatch(/\?\s*1\s*:\s*2/);
	});

	it('keeps an authored fragment that is the sole value of a slot', () => {
		// An authored `<>…</>` is kept verbatim in value position (it must not unwrap
		// to a bare `1`); only generated directive wrappers collapse.
		const { code } = compile_to_volar_mappings(
			`function App() @{ const v = <>{1}</>; <div>{v}</div> }`,
			'App.tsrx',
			{ loose: true },
		);
		expect(code).toContain('const v = <>{1}</>;');
	});
});

describe('@tsrx/ripple Volar mappings style anchors', () => {
	it('omits stylesheet AST children from template style anchors', () => {
		const source = `function App() @{
	const items = ['one'];
	<>
		@try {
			<div className="content">{'hello'}</div>
		} @pending {
			<div>Hello</div>
		} @catch (err) {
			<p className="error">{'error'}</p>
		}

		@if (items.length > 0) {
			const hey = 'yo';
		} @else {
		}

		@for (const item of items) {
			<div>{item}</div>
		} @empty {
			<div>Nothing to see</div>
		}

		<style>
			.content {
				color: blue;
			}
			.error {
				color: red;
			}
		</style>
	</>
}`;
		const result = compile_to_volar_mappings(source, 'App.tsrx', { loose: true });
		const server = compile(source, 'App.tsrx', { mode: 'server', loose: true });
		/** @type {string[]} */
		const source_style_nodes = [];
		const seen = new WeakSet();
		/** @param {any} node */
		const collect_style_nodes = (node) => {
			if (!node || typeof node !== 'object' || seen.has(node)) return;
			seen.add(node);
			if (node.type === 'JSXStyleElement') {
				source_style_nodes.push(node.type);
			}
			for (const key in node) {
				if (key === 'parent' || key === 'metadata') continue;
				const value = node[key];
				if (Array.isArray(value)) {
					for (const child of value) collect_style_nodes(child);
				} else {
					collect_style_nodes(value);
				}
			}
		};
		collect_style_nodes(result.sourceAst);

		expect(result.code).toContain('<style></style>');
		expect(result.code).not.toContain('StyleSheet');
		expect(
			result.cssMappings.some((mapping) => mapping.data?.customData?.content?.includes('.content')),
		).toBe(true);
		expect(source_style_nodes).toEqual(['JSXStyleElement']);
		expect(server.code).not.toContain('StyleSheet');
		expect(server.css).toContain('.content');
	});
});

describe('@tsrx/ripple Volar mappings normalize to_ts source locations', () => {
	it('maps script tokens after multiline template children', () => {
		const source = `function App() @{
		const x = 1;
		<pre>
			{x}
		</pre>
}
expect(x).toBe(1);`;
		const result = compile_to_volar_mappings(source, 'App.tsrx', { loose: true });
		const source_expect_offset = source.indexOf('expect');
		const generated_expect_offset = result.code.indexOf('expect');
		const mapping = find_exact_mapping(
			result.mappings,
			source_expect_offset,
			generated_expect_offset,
			'expect'.length,
		);

		expect(mapping).toBeDefined();
	});

	it('keeps tracked value reads mapped to their source condition in @if output', () => {
		const source = `import { track } from 'ripple';
function App() @{
	const show = track(true);
	<>
		@if (show.value) {
			<Child />
		}
		<button onClick={() => (show.value = !show.value)}>{'Toggle Child'}</button>
	</>
}`;
		const result = compile_to_volar_mappings(source, 'App.tsrx', { loose: true });
		const generated_if_offset = result.code.indexOf('if (show.value)');
		const generated_show_offset = result.code.indexOf('show', generated_if_offset);
		const source_show_offset = source.indexOf('show.value) {');
		const mapping = find_exact_mapping(
			result.mappings,
			source_show_offset,
			generated_show_offset,
			'show'.length,
		);

		expect(result.code).toContain('if (show.value)');
		expect(result.code).not.toContain("show?.['#v']");
		expect(mapping).toBeDefined();
	});

	it('maps preserved TypeScript pragma comments at their source column', () => {
		const source = `import { RippleObject } from 'ripple';
import { TRACKED_OBJECT } from '../../src/runtime/internal/client/constants.js';
function ObjectTest() @{
	const obj = new RippleObject({ a: 0 });
	// @ts-expect-error TRACKED_OBJECT is internal
	expect(TRACKED_OBJECT in obj).toBe(true);
	<pre>{'done'}</pre>
}`;
		const result = compile_to_volar_mappings(source, 'object.test.tsrx', { loose: true });
		const source_comment_offset = source.indexOf('// @ts-expect-error');
		const generated_comment_offset = result.code.indexOf('// @ts-expect-error');
		const comment_length = '// @ts-expect-error TRACKED_OBJECT is internal'.length;
		const mapping = find_exact_mapping(
			result.mappings,
			source_comment_offset,
			generated_comment_offset,
			comment_length,
		);

		expect(source_comment_offset).toBeGreaterThan(
			source.lastIndexOf('\n', source_comment_offset) + 1,
		);
		expect(mapping).toBeDefined();
	});
});

describe('@tsrx/ripple Volar TypeScript output', () => {
	it('keeps expression braces for literal JSX attributes', () => {
		const { code } = compile_to_volar_mappings(
			`function App() @{
		<option value={1} label={'One'} selected={true}>{'One'}</option>
}`,
			'App.tsrx',
			{ loose: true },
		);

		expect(code).toContain("<option value={1} label={'One'} selected={true}>");
	});

	it('preserves attribute-only head scripts inside a loop', () => {
		const { code } = compile_to_volar_mappings(
			`export const Head = ({ scripts }: { scripts: { src: string }[] }) => @{
		<head>
			@for (const script of scripts) {
				<script src={script.src} />
			}
		</head>
}`,
			'Head.tsrx',
			{ loose: true },
		);

		expect(code).toContain('<script src={script.src} />');
		expect(code).toContain('for (const script of scripts)');
		expect(code).not.toContain('JSXCodeBlock');
	});

	it('does not collect statements from nested ordinary function bodies', () => {
		const { code } = compile_to_volar_mappings(
			`import { track } from 'ripple';
function App() @{
		let value = track('');
		const value_accessors = [
			() => value.value,
			(v: string) => {
				if (v.includes('c')) {
					v = v.replace(/c/g, '');
				}
				value.value = v;
			},
		];
		<input type="text" ref={bindValue(...value_accessors)} />
}`,
			'App.tsrx',
			{ loose: true },
		);

		expect(code.match(/if \(v\.includes\('c'\)\)/g)).toHaveLength(1);
		expect(code).not.toContain("let value = track('');\n\n\t\tif (v.includes('c'))");
	});
});

describe('@tsrx/ripple try pending fallbacks', () => {
	it('allows empty pending blocks as null fallbacks', () => {
		const { code } = compile(
			`function App() @{
				@try {
					<div>content</div>
				} @pending {}
			}`,
			'App.tsrx',
		);

		expect(code).toContain('_$_.try(');
		expect(code).toContain("template_el('div', null, 'content')");
	});

	it('prints pending blocks as valid TypeScript in Volar output', () => {
		const { code } = compile_to_volar_mappings(
			`function App() @{
				@try {
					<p>{'ok'}</p>
				} @pending {
					<p>{'loading...'}</p>
				} @catch (err) {
					<p>{'caught rejection'}</p>
				}
			}`,
			'App.tsrx',
			{ loose: true },
		);

		expect(code).toContain("return <p>{'loading...'}</p>;");
		expect(code).toContain('try {');
		expect(code).toContain('catch (err)');
		expect(code).not.toContain(' pending ');
	});
});

describe('@tsrx/ripple for empty fallbacks', () => {
	it('prints empty blocks as valid TypeScript in Volar output', () => {
		const { code } = compile_to_volar_mappings(
			`function App() @{
				const items = [];
				@for (const item of items) {
					<div>Hello</div>
				} @empty {
					<div>Nothing to see</div>
				}
			}`,
			'App.tsrx',
			{ loose: true },
		);

		expect(code).toContain('for (const item of items)');
		expect(code).toContain('return <div>Nothing to see</div>;');
		expect(code).not.toContain(' empty ');
	});
});

describe('@tsrx/ripple named ref props', () => {
	it('keeps named ref-like props ordinary for components', () => {
		const { code } = compile(
			`function Child(props) { return <></>; }
			function App() { return <>
				let input;
				<Child input_ref={input} />
			</>; }`,
			'App.tsrx',
		);

		expect(code).toContain('{ input_ref: input }');
	});

	it('wraps anonymous ref props for components', () => {
		const { code } = compile(
			`function Child(props) { return <></>; }
			function App() { return <>
				let input;
				<Child ref={input} />
			</>; }`,
			'App.tsrx',
		);

		expect(code).toContain('{ ref: _$_.create_ref_prop(() => input, (v) => input = v) }');
	});

	it('keeps named ref-like props ordinary on host elements', () => {
		const { code } = compile(
			`function App() { return <>
				let input;
				<input input_ref={input} />
			</>; }`,
			'App.tsrx',
		);

		expect(code).toContain('input_ref');
		expect(code).not.toContain('_$_.create_ref_prop');
	});

	it('adds assignment setters for host ref attributes with identifiers and member expressions', () => {
		const { code } = compile(
			`function App() { return <>
				let input;
				let state = {};
				<input ref={input} />
				<input ref={state.input} />
			</>; }`,
			'App.tsrx',
		);

		expect(code).toContain('_$_.ref(input_1, () => input, (v) => input = v)');
		expect(code).toContain('_$_.ref(input_2, () => state.input, (v) => state.input = v)');
	});

	it('prints named ref props in Volar TypeScript output', () => {
		const { code } = compile_to_volar_mappings(
			`function App() { return <>
				let input;
				<input input_ref={input} />
			</>; }`,
			'App.tsrx',
		);

		expect(code).not.toContain(
			"import { _$_RefProp__create } from 'ripple/compiler/internal/import';",
		);
		expect(code).toContain('<input input_ref={input} />');
	});

	it('preserves child namespaces for nested host ref props in Volar TypeScript output', () => {
		const { code } = compile_to_volar_mappings(
			`function App() { return <>
				let circle;
				let div;
				<svg>
					<circle circle_ref={circle} />
					<foreignObject>
						<div div_ref={div} />
					</foreignObject>
				</svg>
			</>; }`,
			'App.tsrx',
		);

		expect(code).toContain('<circle circle_ref={circle} />');
		expect(code).toContain('<div div_ref={div} />');
	});

	it('maps named ref-like prop values as ordinary props', () => {
		const source = `function Child(props: { inputRef?: any; otherRef?: any }) { return <>
	<input />
</>; }

function App() @{
	let input: HTMLInputElement | undefined;
	const state = { input: undefined as HTMLInputElement | undefined };
	<>
		<input type="text" input_ref={input} />
		<Child inputRef={input} otherRef={state.input} />
	</>
}`;
		const result = compile_to_volar_mappings(source, 'App.tsrx', { loose: true });

		expect(result.errors).toEqual([]);
		expect(result.code).toContain('input_ref={input}');
		expect(result.code).toContain('otherRef={state.input}');
	});
});

describe('@tsrx/ripple JSX fragment Volar output', () => {
	it('prints JSX converted from fragment expression containers', () => {
		const source = `function App() @{
	const content = <section>{<div>{'inside'}</div>}</section>;
	<>{content}</>
}`;
		const result = compile_to_volar_mappings(source, 'App.tsrx', { loose: true });

		expect(result.code).toContain('<section>');
		expect(result.code).toContain('<div>');
		expect(result.code).toContain("{'inside'}");
		expect(result.code).not.toContain('<tsx');
	});

	it('returns setup statements before a single fragment output', () => {
		const source = `class Foo { bar() @{ const x = 1; <><div>before</div><div>{x}</div></> } }`;
		const result = compile_to_volar_mappings(source, 'App.tsrx', { loose: true });
		const declaration = result.code.indexOf('const x = 1;');
		const returned_fragment = result.code.indexOf('return <><div>');
		const second_child = result.code.indexOf('<div>{x}</div>', returned_fragment + 1);

		expect(declaration).toBeGreaterThan(-1);
		expect(returned_fragment).toBeGreaterThan(-1);
		expect(second_child).toBeGreaterThan(-1);
		expect(declaration).toBeLessThan(returned_fragment);
		expect(returned_fragment).toBeLessThan(second_child);
	});

	it('returns JSX from root control-flow branches in Volar output', () => {
		const source = `function Component() @{
	const tracker = track<HTMLDivElement | null>(null);
	const show = track(true);
	captured = tracker;
	toggle = show;

	@if (show.value) {
		<div ref={tracker}>{'Hello World'}</div>
	}
}`;
		const result = compile_to_volar_mappings(source, 'App.tsrx', { loose: true });

		expect(result.code).toContain('if (show.value) {');
		expect(result.code).toContain("return <div ref={tracker}>{'Hello World'}</div>;");
		expect(result.code).not.toContain('return if');
		expect(result.code).not.toContain('(() =>');
	});

	it('prints statement-container setup before returning template output', () => {
		const source = `let logs: string[] = [];
function Child({ a, b, c }: { a: number; b: number; c: number }) @{
		effect(() => {
			logs.push(\`Child effect: \${a}, \${b}, \${c}\`);
		});
		<div>{a + ' ' + b + ' ' + c}</div>
}`;
		const result = compile_to_volar_mappings(source, 'App.tsrx', { loose: true });

		expect(result.code).toContain('effect(() => {');
		expect(result.code).toContain('return <div>');
		expect(result.code).not.toContain('<>effect(() =>');
	});
});

describe('@tsrx/ripple <> expression values', () => {
	it('passes plain identifier props directly in fragment shorthand values', () => {
		const { code } = compile(
			`function Some(props) { return <></>; }
			function Test() {
				const placeholder = 'value';
				return <><Some prop={placeholder} /></>;
			}`,
			'App.tsrx',
		);

		expect(code).toContain('_$_.render_component(Some, __anchor, { prop: placeholder });');
	});

	it('passes plain identifier props directly in tsx expression values', () => {
		const { code } = compile(
			`function Some(props) { return <></>; }
			function Test() {
				const placeholder = 'value';
				return <><Some prop={placeholder} /></>;
			}`,
			'App.tsrx',
		);

		expect(code).toContain('_$_.render_component(Some, __anchor, { prop: placeholder });');
	});

	it('passes plain identifier props directly in tsrx expression values', () => {
		const { code } = compile(
			`function Some(props) { return <></>; }
			function Test() {
				const placeholder = 'value';
				return <><Some prop={placeholder} /></>;
			}`,
			'App.tsrx',
		);

		expect(code).toContain('_$_.render_component(Some, __anchor, { prop: placeholder });');
	});

	it('passes plain identifier props directly in component bodies', () => {
		const { code } = compile(
			`function Some(props) { return <></>; }
			function Test() { return <>
				const placeholder = 'value';
				<Some prop={placeholder} />
			</>; }`,
			'App.tsrx',
		);

		expect(code).toContain('_$_.render_component(Some, node, { prop: placeholder });');
	});

	it('passes plain non-tracked expression props directly', () => {
		const { code } = compile(
			`function Some(props) { return <></>; }
			function Test() {
				const first = 'hello';
				const second = 'world';
				return <><Some prop={first + second} /></>;
			}`,
			'App.tsrx',
		);

		expect(code).toContain('{ prop: first + second }');
	});

	it('passes member expression props as plain values', () => {
		const { code } = compile(
			`function Some(props) { return <></>; }
			function Test() {
				const obj = { value: 'value' };
				return <><Some prop={obj.value} /></>;
			}`,
			'App.tsrx',
		);

		expect(code).toContain('{ prop: obj.value }');
		expect(code).not.toContain('get prop()');
	});

	it('passes computed member expression props as plain values', () => {
		const { code } = compile(
			`function Some(props) { return <></>; }
			function Test() {
				const obj = { value: 'value' };
				const key = 'value';
				return <><Some prop={obj[key]} /></>;
			}`,
			'App.tsrx',
		);

		expect(code).toContain('{ prop: obj[key] }');
	});

	it('passes call expression props as plain values', () => {
		const { code } = compile(
			`function Some(props) { return <></>; }
			function getValue() {
				return 'value';
			}
			function Test() {
				return <><Some prop={getValue()} /></>;
			}`,
			'App.tsrx',
		);

		expect(code).toContain('{ prop: _$_.with_scope(__block, getValue) }');
	});

	it('passes call expression props in fragment shorthand values as plain values', () => {
		const { code } = compile(
			`function Some(props) { return <></>; }
			function getValue() {
				return 'value';
			}
			function Test() {
				return <><Some prop={getValue()} /></>;
			}`,
			'App.tsrx',
		);

		expect(code).toContain('{ prop: _$_.with_scope(__block, getValue) }');
	});

	it('passes call expression props in component bodies as plain values', () => {
		const { code } = compile(
			`function Some(props) { return <></>; }
			function getValue() {
				return 'value';
			}
			function Test() { return <>
				<Some prop={getValue()} />
			</>; }`,
			'App.tsrx',
		);

		expect(code).toContain('{ prop: _$_.with_scope(__block, getValue) }');
	});

	it('reads tracked value props in fragment shorthand values once', () => {
		const { code } = compile(
			`import { track } from 'ripple';
			function Some(props) { return <></>; }
			function Test() @{
				const count = track(0);
				const content = <><Some prop={count.value} /></>;
				<>{content}</>
			}`,
			'App.tsrx',
		);

		// A prop is a value: the tracked value is read when the component is called.
		expect(code).toContain('{ prop: count.value }');
	});

	it('reads tracked value props in function fragment returns once', () => {
		const { code } = compile(
			`import { track } from 'ripple';
			function Some(props) { return <></>; }
			function Test() {
				const count = track(0);
				return <><Some prop={count.value} /></>;
			}`,
			'App.tsrx',
		);

		// A prop is a value: the tracked value is read when the component is called.
		expect(code).toContain('{ prop: count.value }');
	});

	it('reads tracked expression props once', () => {
		const { code } = compile(
			`import { track } from 'ripple';
			function Some(props) { return <></>; }
			function Test() @{
				const count = track(0);
				const content = <><Some prop={count.value % 2 ? 'odd' : 'even'} /></>;
				<>{content}</>
			}`,
			'App.tsrx',
		);

		expect(code).toContain(`{ prop: count.value % 2 ? 'odd' : 'even' }`);
	});

	it('passes a Tracked object as a static prop', () => {
		const { code } = compile(
			`import { track } from 'ripple';
			function Some(props) { return <></>; }
			function Test() @{
				const count = track(0);
				<Some tracked={count} />
			}`,
			'App.tsrx',
		);

		expect(code).toContain('{ tracked: count }');
	});

	it('leaves own-property enumeration and object spread of props alone', () => {
		const { code } = compile(
			`function Test(props) @{
				const keys = Object.keys(props);
				const values = Object.values(props);
				const entries = Object.entries(props);
				const copy = { ...props, extra: true };
				<span>{keys.length + values.length + entries.length + copy.extra}</span>
			}`,
			'App.tsrx',
		);

		// Props are plain objects, so the `Object` calls and the spread stay as written.
		expect(code).toContain('Object.keys(props)');
		expect(code).toContain('Object.values(props)');
		expect(code).toContain('Object.entries(props)');
		expect(code).toContain('{ ...props, extra: true }');
	});

	it('lowers tsx values nested in template expressions', () => {
		const { code } = compile(
			`function App() @{
				const primary = true;
				<div>
					{primary
						? ['first:', <strong>one</strong>, ':tail']
						: ['second:', <strong>two</strong>, ':done']}
				</div>
			}`,
			'App.tsrx',
		);

		expect(code).toContain('_$_.tsrx_element');
		expect(code).toContain('? [');
		expect(code).not.toContain('<>');
	});

	it('lowers native element values outside components', () => {
		const { code } = compile(`const test = <button>Hello</button>;`, 'App.tsrx');

		expect(code).toContain('const test = _$_.tsrx_element');
		expect(code).toContain("template_el('button', null, 'Hello')");
	});

	it('lowers bare native element expression statements outside components', () => {
		const { code } = compile(`<button>Hello</button>;`, 'App.tsrx');

		expect(code).toContain('_$_.tsrx_element');
		expect(code).toContain("template_el('button', null, 'Hello')");
	});

	it('renders native element values assigned inside returned templates on the server', () => {
		const { code } = compile(
			`function App() @{
				const test = <button>Hello</button>;
				<>{test}</>
			}`,
			'App.tsrx',
			{ mode: 'server' },
		);

		expect(code).toContain('const test = _$_.tsrx_element');
		expect(code).toContain('_$_.render_expression(test)');
		expect(code).not.toContain('_$_.escape(test)');
	});

	it('keeps direct arrow component returns on the render path', () => {
		const { code } = compile(`const App = () => <button>Hello</button>;`, 'App.tsrx');

		expect(code).toContain("template_el('button', null, 'Hello')");
		expect(code).toContain('_$_.append(__anchor, button)');
		expect(code).not.toContain('template(``');
	});

	it('keeps returned elements after comments on the render path', () => {
		const { code } = compile(
			`function App() {
				return /* comment */ <div>Commented</div>;
			}`,
			'App.tsrx',
		);

		expect(code).toContain("template_el('div', null, 'Commented')");
		expect(code).toContain('_$_.append(__anchor, div)');
	});

	it('keeps directly called PascalCase numeric helpers as ordinary functions', () => {
		const { code } = compile(
			`function StatusCode() {
				return 200;
			}
			const value = StatusCode();`,
			'App.tsrx',
		);

		expect(code).toContain('function StatusCode()');
		expect(code).toContain('return 200;');
		expect(code).toContain('const value = StatusCode();');
		expect(code).not.toContain('function StatusCode(__anchor');
		expect(code).not.toContain('template(`200`');
	});

	it('keeps directly called PascalCase template literal helpers as ordinary functions', () => {
		const { code } = compile(
			`function FormatName(first, last) {
				return \`\${first} \${last}\`;
			}
			const label = FormatName("Ada", "Lovelace");`,
			'App.tsrx',
		);

		expect(code).toContain('function FormatName(first, last)');
		expect(code).toContain('return `${first} ${last}`;');
		expect(code).toContain('const label = FormatName("Ada", "Lovelace");');
		expect(code).not.toContain('function FormatName(__anchor');
	});

	it('keeps renderable-only PascalCase functions as plain functions', () => {
		const { code } = compile(
			`function Label() {
				return "Hi";
			}
			function App() {
				return <Label />;
			}`,
			'App.tsrx',
		);

		expect(code).toContain('function Label()');
		expect(code).toContain('return "Hi";');
		expect(code).toContain('_$_.render_component(Label, __anchor, {})');
	});

	it('uses server render_expression for conditional array expression values', () => {
		const { code } = compile(
			`function App() @{
				const condition = true;
				const ternary_items = condition ? ['start:', ['one', 2], ':end'] : ['fallback'];
				const logical_items = condition && ['start:', ['one', 2], ':end'];

				<>
					<div>{ternary_items}</div>
					<div>{logical_items}</div>
				</>
			}`,
			'App.tsrx',
			{ mode: 'server' },
		);

		expect(code).toContain('_$_.render_expression(ternary_items)');
		expect(code).toContain('_$_.render_expression(logical_items)');
		expect(code).not.toContain('_$_.escape(ternary_items)');
		expect(code).not.toContain('_$_.escape(logical_items)');
	});

	it('uses client expression anchors that can hydrate conditional array markers', () => {
		const { code } = compile(
			`function App() @{
				const condition = true;
				const items = condition ? ['start:', ['one', 2], ':end'] : ['fallback'];

				<div>{items}</div>
			}`,
			'App.tsrx',
		);

		expect(code).toContain("template_el('div', null, ' ')");
		expect(code).toContain('_$_.hydrating ? _$_.hydrate_child() : div.firstChild');
		expect(code).not.toContain('_$_.hydrate_child(true) : div.firstChild');
		expect(code).toContain('_$_.expression(');
	});
});

describe('@tsrx/ripple nested function fragment returns', () => {
	it('keeps special fragment returns inside component prop arrow functions', () => {
		const { code } = compile(
			`function Child(props) { return <></>; }

			export function App() { return <>
				<Child
					fragment={() => {
						return <><div>fragment</div></>;
					}}
					tsx={() => {
						return <><div>tsx</div></>;
					}}
					tsrx={() => {
						return <><div>tsrx</div></>;
					}}
				/>
			</>; }`,
			'App.tsrx',
		);

		expect(code).toContain('fragment: () => {');
		expect(code.match(/\(\) => \{\s+return _\$_\.tsrx_element/g)).toHaveLength(3);
	});

	it('allows return-value branches inside nested component prop functions', () => {
		const source = `function Page(props) { return <></>; }

			export function Test() { return <>
				<Page
					params={{
						menuAlt: (isAdmin) => {
							if (isAdmin) {
								return [<>Delete</>, <>Edit</>];
							} else {
								return [<>View</>];
							}
						},
						bySwitch: (role) => {
							switch (role) {
								case 'admin':
									return [<>Edit</>];
								default:
									return [<>View</>];
							}
						},
					}}
				/>
		</>; }`;
		const { code } = compile(source, 'App.tsrx');
		const server = compile(source, 'App.tsrx', { mode: 'server' });

		expect(code).toMatch(/menuAlt: \(isAdmin\) => \{/);
		expect(code).toMatch(/bySwitch: \(role\) => \{/);
		expect(code).toContain("case 'admin':");
		expect(code).toContain('_$_.tsrx_element');
		expect(server.code).toContain('return [');
		expect(server.code).toContain('_$_.tsrx_element');
	});

	it('allows any returns inside nested component prop functions', () => {
		const source = `function Page(props) { return <></>; }

			export function Test() { return <>
				<Page fn={() => {
					if (true) {
						return;
					}
					return undefined;
				}} />
			</>; }`;
		const { code } = compile(source, 'App.tsrx');
		const server = compile(source, 'App.tsrx', { mode: 'server' });
		const tsx = compile_to_volar_mappings(source, 'App.tsrx', { loose: true });

		expect(code).toContain('return;');
		expect(code).toContain('return undefined;');
		expect(server.code).toContain('return;');
		expect(server.code).toContain('return undefined;');
		expect(tsx.code).toContain('return;');
		expect(tsx.code).toContain('return undefined;');
		expect(code).not.toContain('Return statements are not allowed');
	});

	it('compiles multiple component guard returns as plain control flow', () => {
		const source = `function Test({ done }) @{
			if (done.value) {
				return <p>Done</p>;
			} else if (done.value === 'test') {
				return <p>Not done</p>;
			}

			const loop = () => <>
				@for (const item of items) {
					<div>{item}</div>
				}
			</>;

			<>{loop()}</>
		}`;
		const client = compile(source, 'App.tsrx');
		const server = compile(source, 'App.tsrx', { mode: 'server' });
		const tsx = compile_to_volar_mappings(source, 'App.tsrx', { loose: true });

		// Plain JS guards are ordinary early returns now — no `return_guard`
		// bookkeeping. Each guard returns a `tsrx_element` directly.
		expect(client.code).not.toContain('return_guard');
		expect(client.code).toContain('if (done.value)');
		expect(client.code).toContain("} else if (done.value === 'test')");
		expect(client.code).toContain('return _$_.tsrx_element((__anchor, __block) =>');
		expect(client.code).toContain('_$_.for(');
		expect(client.code).toContain('_$_.render_tsrx_element(_$_.with_scope(__block, loop),');
		expect(server.code).not.toContain('return_guard');
		expect(server.code).toContain('if (done.value)');
		expect(server.code).toContain('return _$_.tsrx_element(() =>');
		expect(server.code).toContain('_$_.render_tsrx_element(loop())');
		expect(tsx.code).toContain('if (done.value)');
		expect(tsx.code).toContain('return <p>Done</p>');
	});

	it('compiles guard returns in separate functions as plain control flow', () => {
		const source = `function First(flag) @{
			if (flag) {
				return <p>first</p>;
			}
			<span>fallback</span>
		}

		function Second(flag) @{
			if (flag) {
				return <p>second</p>;
			}
			<span>fallback</span>
		}`;
		const client = compile(source, 'App.tsrx');
		const server = compile(source, 'App.tsrx', { mode: 'server' });

		expect(client.code).not.toContain('return_guard');
		expect(client.code.match(/if \(flag\) \{/g)).toHaveLength(2);
		expect(server.code).not.toContain('return_guard');
		expect(server.code.match(/if \(flag\) \{/g)).toHaveLength(2);
	});

	it('does not synthesize a return_guard binding that could clash with user names', () => {
		const source = `function Test(return_guard) @{
			if (return_guard) {
				return <p>done</p>;
			}
			<span>{return_guard}</span>
		}`;
		const client = compile(source, 'App.tsrx');
		const server = compile(source, 'App.tsrx', { mode: 'server' });

		// No compiler-generated return_guard binding exists, so the user's
		// `return_guard` parameter is used as-is with no `_1` suffix.
		expect(client.code).not.toContain('return_guard_1');
		expect(client.code).toContain('if (return_guard)');
		expect(server.code).not.toContain('return_guard_1');
		expect(server.code).toContain('if (return_guard)');
	});
});

describe('@tsrx/ripple unified function and component compilation', () => {
	const expect_value_function = (source) => {
		const client = compile(source, 'App.tsrx');
		const server = compile(source, 'App.tsrx', { mode: 'server' });

		expect(client.code).toContain('_$_.tsrx_element((__anchor, __block) =>');
		expect(server.code).toContain('_$_.tsrx_element(() =>');
		expect(client.code).not.toContain('function Test(__anchor');
		expect(server.code).not.toContain('_$_.push_component()');
		expect(server.code).not.toContain('_$_.pop_component()');
	};

	it('compiles native template returns as value-producing functions', () => {
		expect_value_function(`function Test() { return <p />; }`);
	});

	it('compiles template variables and alternate returns as renderable values', () => {
		expect_value_function(`function Test(flag) {
			const alt = <p />;
			if (flag === 'array') return [alt, 'text'];
			if (flag === 'null') return null;
			if (flag === 'undefined') return undefined;
			return alt;
		}`);
	});

	it('guards regular statements after conditional component returns', () => {
		const source = `function Test(flag) @{
			if (flag) return;
			sideEffect();
			<p />
		}`;
		const client = compile(source, 'App.tsrx');
		const server = compile(source, 'App.tsrx', { mode: 'server' });

		expect(client.code).toContain('if (flag) return;');
		expect(client.code).toContain('_$_.with_scope(__block, sideEffect);');
		expect(client.code).not.toContain('return_guard');
		expect(server.code).toContain('if (flag) return;');
		expect(server.code).toContain('sideEffect();');
		expect(server.code).not.toContain('return_guard');
	});

	it('preserves ordinary control flow for plain functions returning templates', () => {
		const source = `function Dashboard({ user }) {
			if (!user) {
				return <p>No user found</p>;
			}

			return <>
				<h1>Welcome,{user}</h1>
				<p>Here is your dashboard.</p>
			</>;
		}`;
		const client = compile(source, 'App.tsrx');
		const server = compile(source, 'App.tsrx', { mode: 'server' });

		expect(client.code).toContain('if (!user)');
		expect(client.code).toContain('return _$_.tsrx_element((__anchor, __block) =>');
		expect(client.code).not.toContain('return_guard');
		expect(client.code).not.toContain('_$_.if(');
		expect(server.code).toContain('if (!user)');
		expect(server.code).not.toContain('return_guard');
	});

	it('does not use direct calls to disqualify native template functions', () => {
		const source = `function Test() { return <p />; }
			function App() { return <>{Test()}</>; }`;
		const client = compile(source, 'App.tsrx');
		const server = compile(source, 'App.tsrx', { mode: 'server' });

		expect(client.code).toContain('function Test()');
		expect(client.code).toContain('() => _$_.with_scope(__block, Test)');
		expect(client.code).not.toContain('Test(__anchor');
		expect(server.code).toContain('_$_.render_expression(Test())');
	});

	it('emits component calls through the runtime component helper', () => {
		const source = `function Test() { return <p />; }
			function App() { return <><Test /></>; }`;
		const client = compile(source, 'App.tsrx');
		const server = compile(source, 'App.tsrx', { mode: 'server' });

		expect(client.code).toContain('_$_.render_component(Test, __anchor, {})');
		expect(server.code).toContain('_$_.render_component(comp, ...args)');
	});

	it('does not classify plain functions as JSX-producing TSRX functions', () => {
		const source = `function App() @{
			function Plain() { return 'plain'; }
			function Compat() { return <><div /></>; }
			<></>
		}`;
		const client = compile(source, 'App.tsrx');
		const server = compile(source, 'App.tsrx', { mode: 'server' });

		expect(client.code).toContain("return 'plain';");
		expect(client.code).not.toContain('Plain(__anchor');
		expect(client.code).not.toContain('Compat(__anchor');
		expect(server.code).not.toContain('Plain(__output');
		expect(server.code).not.toContain('Compat(__output');
	});
});

describe('@tsrx/ripple template comments', () => {
	const source = `function TodoList() @{
<>
  /* world 0 */
  // hello
  /* world 1 */
  <ul>
  // hello
  /* world 2 */

  </ul>

  <ul>
  // hello
  /* world 3 */
  // hello
  </ul>
  /* world 4 */
  </>
}`;

	it('keeps line and block comments out of client templates', () => {
		const { code } = compile(source, 'App.tsrx');
		expect(code).not.toMatch(/world|hello/);
		expect(code).toContain('<ul></ul><ul>`');
	});

	it('keeps line and block comments out of server output', () => {
		const { code } = compile(source, 'App.tsrx', { mode: 'server' });
		expect(code).not.toMatch(/world|hello/);
	});

	it('keeps template comments out of to_ts output', () => {
		const { code } = compile_to_volar_mappings(source, 'App.tsrx', { loose: true });
		expect(code).not.toMatch(/world|hello/);
	});
});

describe('@tsrx/ripple template elements in expression position', () => {
	// An element inside an expression container or attribute value is a value,
	// not a rendered child — it must lower to a `_$_.tsrx_element(…)` handle in
	// both modes instead of leaking raw JSX (or a raw directive node) to the
	// printer.
	const attribute_source = `export function App() @{
			<Child prop={<h1>@if (true) { <div>1</div> } @else { <div>2</div> }</h1>} />
		}`;
	const container_source = `export function App() @{
			<div>{<h1>@if (true) { <span>1</span> } @else { <span>2</span> }</h1>}</div>
		}`;

	it('lowers an element-valued attribute with control flow in client and server output', () => {
		for (const mode of ['client', 'server']) {
			const { code } = compile(attribute_source, 'App.tsrx', { mode });
			expect(code).toContain('prop: _$_.tsrx_element(');
			expect(code).not.toContain('@if');
			expect(code).not.toContain('<h1>@if');
		}
	});

	it('lowers an element inside a child expression container in client and server output', () => {
		const client = compile(container_source, 'App.tsrx', { mode: 'client' });
		expect(client.code).toContain('_$_.expression(expression, () => _$_.tsrx_element(');
		expect(client.code).not.toContain('() => <h1>');

		const server = compile(container_source, 'App.tsrx', { mode: 'server' });
		expect(server.code).toContain('_$_.render_expression(_$_.tsrx_element(');
	});
});

describe('@tsrx/ripple server expression classification', () => {
	// Only provably-string expressions may use the inline-escape fast path;
	// anything else can hold a template value and must render through
	// `render_expression`. `<title>` is text-only per spec, so its expression
	// children always escape — hydration markers must never reach
	// `document.title`.
	it('escapes provably-primitive expressions and defers the rest to render_expression', () => {
		const { code } = compile(
			`export function App(props: { n: number, s: string }) @{
				<>
					<div>{props.s}</div>
					<em>{'lit' + props.n}</em>
					<b>{String(props.n)}</b>
					<i>{props.n as string}</i>
					<span>{props.n}</span>
					<section>{props.anything}</section>
				</>
			}`,
			'App.tsrx',
			{ mode: 'server', loose: true },
		);

		expect(code).toContain('_$_.escape(props.s)');
		expect(code).toContain("_$_.escape('lit' + props.n)");
		expect(code).toContain('_$_.escape(String(props.n))');
		// `props.n` is number-typed — provably a text primitive, so it escapes.
		expect(code).toContain('_$_.escape(props.n)');
		expect(code).toContain('_$_.render_expression(props.anything)');
		expect(code).not.toContain('_$_.render_expression(props.s)');
	});

	it('keeps title expression children on the escaping text path', () => {
		const { code } = compile(
			`export function App(props: { anything: unknown }) @{
				<head>
					<title>{props.anything}</title>
				</head>
			}`,
			'App.tsrx',
			{ mode: 'server', loose: true },
		);

		expect(code).toContain('_$_.escape(props.anything)');
		expect(code).not.toContain('_$_.render_expression');
	});

	it('lowers a template value declared in a control-flow branch', () => {
		const style = `<style>
			.x {
				color: red;
			}
		</style>`;
		const body = `const theme = ${style};
			const el = <span>{'hi'}</span>;
			<div class={theme.x}>{el}</div>`;
		const { code } = compile(
			`export function App({ show, items, mode }) @{
				<>
					@if (show) {
						${body}
					} @else {
						${body}
					}
					@switch (mode) {
						@case 'a': {
							${body}
						}
					}
					@for (const item of items) {
						${body}
					}
					@try {
						${body}
					} @catch (error) {
						<p>{'error'}</p>
					}
				</>
			}`,
			'App.tsrx',
			{ mode: 'server' },
		);

		// A declaration's value is a value position in a branch as it is in the
		// component body: a class map of getters and a template element.
		expect(() => acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'module' })).not.toThrow();
		expect(code.match(/const theme = \{\n\s*get '\$class'\(\)/g)).toHaveLength(5);
		expect(code.match(/const el = _\$_\.tsrx_element\(/g)).toHaveLength(5);
	});
});

describe('@tsrx/ripple fragment children flatten', () => {
	// A fragment in children position is transparent grouping: it must add
	// ZERO dom — no comment anchor, no runtime expression wrapper — and its
	// text merges into the surrounding run.
	it('renders fragment children inline with no extra nodes', () => {
		const source = `export function App() @{
				<div>{'a'}<>{'b'}<span>{'c'}</span></>{'d'}</div>
			}`;

		const { code } = compile(source, 'App.tsrx');
		expect(code).toContain("_$_.template_el('div', null, ['ab', ['span', null, 'c'], 'd'])");
		expect(code).not.toContain('<!>');
		expect(code).not.toContain('_$_.expression');

		const server = compile(source, 'App.tsrx', { mode: 'server' });
		expect(server.code).toContain(`'<div>ab<span>c</span>d</div>'`);
	});

	it('flattens nested fragments recursively', () => {
		const source = `export function App() @{
				<div>{'a'}<><>{'b'}</><>{'c'}<span>{'d'}</span></></></div>
			}`;

		const { code } = compile(source, 'App.tsrx');
		expect(code).toContain("_$_.template_el('div', null, ['abc', ['span', null, 'd']])");
		expect(code).not.toContain('<!>');

		const server = compile(source, 'App.tsrx', { mode: 'server' });
		expect(server.code).toContain(`'<div>abc<span>d</span></div>'`);
	});

	it('handles control flow inside a flattened fragment at the parent level', () => {
		const source = `export function App({ ok }) @{
				<div>{'a'}<>@if (ok) { <b>{'y'}</b> } @else { <i>{'n'}</i> }</>{'z'}</div>
			}`;

		const { code } = compile(source, 'App.tsrx');
		// The directive anchors directly in the parent template — exactly one
		// placeholder comment, no fragment wrapper expression around it.
		expect(code).toContain('_$_.if(');
		expect(code).toContain("_$_.template_el('div', null, ['a', null, 'z'])");
		expect(code).not.toContain('_$_.expression(');

		const server = compile(source, 'App.tsrx', { mode: 'server' });
		expect(server.code).toContain('if (ok) {');
	});

	it('extracts head elements from inside flattened fragments in client output', () => {
		const source = `export function App({ ok }) @{
				@if (ok) {
					<>
						<head>
							<title>{'late'}</title>
						</head>
						<p>{'content'}</p>
					</>
				}
			}`;

		const { code } = compile(source, 'App.tsrx');
		expect(code).toContain('_$_.head(');
		expect(code).toContain('_$_.document.title');
	});
});

describe('@tsrx/ripple removed syntax', () => {
	it.each(['let &[count] = track(0);', 'const &{ count } = props;', '&[count] = track(0);'])(
		'rejects lazy destructuring `%s` as a syntax error',
		(statement) => {
			expect(() =>
				compile(
					`import { track } from 'ripple';
					function App(props) @{
						${statement}
						<span />
					}`,
					'App.tsrx',
				),
			).toThrow();
		},
	);
});
