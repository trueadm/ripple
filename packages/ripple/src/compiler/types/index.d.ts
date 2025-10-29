// Ripple augmentation for ESTree function nodes
declare module 'estree' {
	interface FunctionDeclaration {
		metadata?: any;
	}
	interface FunctionExpression {
		metadata?: any;
	}
	interface ArrowFunctionExpression {
		metadata?: any;
	}
	interface Identifier {
		tracked?: boolean;
	}
}
import type { Comment, Position } from 'acorn';
import type {
	Program,
	Node,
	Identifier,
	VariableDeclarator,
	FunctionDeclaration,
	FunctionExpression,
	ArrowFunctionExpression,
	ClassDeclaration,
	ImportDeclaration,
	ArrayExpression,
	ObjectExpression,
	Expression,
	Property,
	SpreadElement,
	Pattern,
} from 'estree';

/**
 * Parse error information
 */
export interface ParseError {
	message: string;
	pos: number;
	loc: Position;
}

/**
 * Result of parsing operation
 */
export interface ParseResult {
	ast: Program;
	errors: ParseError[];
}

/**
 * Comment with location information
 */
export interface CommentWithLocation extends Comment {
	start: number;
	end: number;
}

/**
 * Tracked array expression node
 */
export interface TrackedArrayExpression extends Omit<ArrayExpression, 'type'> {
	type: 'TrackedArrayExpression';
	elements: (Expression | null)[];
}

export interface TrackedExpression extends Omit<Expression, 'type'> {
	argument: Expression;
	type: 'TrackedExpression';
}

/**
 * Tracked object expression node
 */
export interface TrackedObjectExpression extends Omit<ObjectExpression, 'type'> {
	type: 'TrackedObjectExpression';
	properties: (Property | SpreadElement)[];
}

/**
 * Tracked Map expression node
 */
export interface TrackedMapExpression extends Omit<Node, 'type'> {
	type: 'TrackedMapExpression';
	arguments: (Expression | SpreadElement)[];
}

/**
 * Tracked Set expression node
 */
export interface TrackedSetExpression extends Omit<Node, 'type'> {
	type: 'TrackedSetExpression';
	arguments: (Expression | SpreadElement)[];
}

/**
 * Ripple component node
 */
export interface Component extends Omit<Node, 'type'> {
	type: 'Component';
	id: Identifier;
	params: Pattern[];
	body: Node[];
	css: any;
	start?: number;
	end?: number;
	loc?: any;
}

/**
 * Ripple element node
 */
export interface Element extends Omit<Node, 'type'> {
	type: 'Element';
	id: Identifier;
	attributes: Array<Attribute | SpreadAttribute>;
	children: Node[];
	metadata: any;
}

/**
 * TSX compatibility node for elements with namespaces like <tsx:react>
 * Note: TsxCompat elements cannot be self-closing and must have a closing tag
 */
export interface TsxCompat extends Omit<Node, 'type'> {
	type: 'TsxCompat';
	kind: string;
	attributes: Array<Attribute | SpreadAttribute>;
	children: Node[];
	metadata: any;
}

/**
 * Ripple attribute node
 */
export interface Attribute {
	type: 'Attribute';
	name: Identifier;
	value: Expression | null;
	start?: number;
	end?: number;
	loc?: any;
}

/**
 * Ripple spread attribute node
 */
export interface SpreadAttribute {
	type: 'SpreadAttribute';
	argument: Expression;
	start?: number;
	end?: number;
	loc?: any;
}

/**
 * Configuration for Ripple parser plugin
 */
export interface RipplePluginConfig {
	allowSatisfies?: boolean;
}

/**
 * Types of declarations in scope
 */
export type DeclarationKind =
	| 'var'
	| 'let'
	| 'const'
	| 'function'
	| 'param'
	| 'rest_param'
	| 'component'
	| 'import'
	| 'using'
	| 'await using';

/**
 * Binding kinds
 */
export type BindingKind = 'normal' | 'for_pattern' | 'rest_prop' | 'prop' | 'prop_fallback';

/**
 * A variable binding in a scope
 */
export interface Binding {
	/** The identifier node that declares this binding */
	node: Identifier;
	/** References to this binding */
	references: Array<{ node: Identifier; path: Node[] }>;
	/** Initial value/declaration */
	initial: null | Expression | FunctionDeclaration | ClassDeclaration | ImportDeclaration;
	/** Whether this binding has been reassigned */
	reassigned: boolean;
	/** Whether this binding has been mutated (property access) */
	mutated: boolean;
	/** Whether this binding has been updated (reassigned or mutated) */
	updated: boolean;
	/** Whether this binding represents a called function */
	is_called: boolean;
	/** Additional metadata for this binding */
	metadata?: any;
	/** Kind of binding */
	kind: BindingKind;
	/** Declaration kind */
	declaration_kind?: DeclarationKind;
	/** The scope that contains this binding */
	scope?: any;
}

/**
 * Root scope manager
 */
export interface ScopeRoot {
	/** Set of conflicting/reserved names */
	conflicts: Set<string>;
	/** Generate unique identifier name */
	unique(preferred_name: string): Identifier;
}

/**
 * Lexical scope for variable bindings
 */
export interface ScopeInterface {
	/** Root scope manager */
	root: ScopeRoot;
	/** Parent scope */
	parent: ScopeInterface | null;
	/** Map of declared bindings */
	declarations: Map<string, Binding>;
	/** Map of declarators to their bindings */
	declarators: Map<VariableDeclarator, Binding[]>;
	/** Map of references in this scope */
	references: Map<string, Array<{ node: Identifier; path: Node[] }>>;
	/** Function nesting depth */
	function_depth: number;
	/** Whether reactive tracing is enabled */
	tracing: null | Expression;

	/** Create child scope */
	child(porous?: boolean): ScopeInterface;
	/** Declare a binding */
	declare(
		node: Identifier,
		kind: BindingKind,
		declaration_kind: DeclarationKind,
		initial?: null | Expression | FunctionDeclaration | ClassDeclaration | ImportDeclaration,
	): Binding;
	/** Get binding by name */
	get(name: string): Binding | null;
	/** Get bindings for a declarator */
	get_bindings(node: VariableDeclarator): Binding[];
	/** Find the scope that owns a name */
	owner(name: string): ScopeInterface | null;
	/** Add a reference */
	reference(node: Identifier, path: Node[]): void;
	/** Generate unique identifier name */
	generate(preferred_name: string): string;
}

/**
 * Text node interface
 */
export interface TextNode {
	type: 'Text';
	expression: Expression;
	start?: number;
	end?: number;
	loc?: any;
}

/**
 * Union type for all Ripple AST nodes
 */
export type RippleNode = Node | Component | Element | TextNode;

/**
 * Compiler state object
 */
export interface CompilerState {
	/** Current scope */
	scope: ScopeInterface;
	/** Analysis data */
	analysis?: {
		/** Module analysis */
		module?: {
			/** Module scope */
			scope?: {
				/** Module references */
				references?: Set<string>;
			};
		};
		/** Exported identifiers */
		exports?: Array<{ name: string }>;
	};
	/** Scopes map */
	scopes?: Map<RippleNode, ScopeInterface>;
	/** Whether inside head element */
	inside_head?: boolean;
	/** Transform metadata */
	metadata?: {
		spread?: boolean;
		[key: string]: any;
	};
}

/**
 * Transform context object
 */
export interface TransformContext {
	/** Compiler state */
	state: CompilerState;
	/** AST path */
	path: RippleNode[];
	/** Visit function */
	visit: (node: any, state?: any) => any;
	/** Transform metadata */
	metadata?: any;
}

/**
 * Delegated event result
 */
export interface DelegatedEventResult {
	function?: FunctionExpression | FunctionDeclaration | ArrowFunctionExpression;
}
