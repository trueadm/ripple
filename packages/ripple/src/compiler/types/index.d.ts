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
}
import type { Comment, Position } from 'acorn';
import type {
	Program,
	Node,
	Identifier,
	VariableDeclarator,
	FunctionDeclaration,
	ClassDeclaration,
	ImportDeclaration,
	ArrayExpression,
	ObjectExpression,
	Expression,
	Property,
	SpreadElement,
	Pattern,
} from 'estree';

export interface CompileResult {
	// TODO
}

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

/**
 * Tracked object expression node
 */
export interface TrackedObjectExpression extends Omit<ObjectExpression, 'type'> {
	type: 'TrackedObjectExpression';
	properties: (Property | SpreadElement)[];
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
export type BindingKind = 'normal' | 'each' | 'rest_prop';

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
	declare(node: Identifier, kind: BindingKind, declaration_kind: DeclarationKind, initial?: null | Expression | FunctionDeclaration | ClassDeclaration | ImportDeclaration): Binding;
	/** Get binding by name */
	get(name: string): Binding | null;
	/** Get bindings for a declarator */
	get_bindings(node: VariableDeclarator): Binding[];
	/** Find the scope that owns a name */
	owner(name: string): ScopeInterface | null;
	/** Add a reference */
	reference(node: Identifier, path: Node[]): void;
}

/**
 * Union type for all Ripple AST nodes
 */
export type RippleNode = Node | Component | Element;
