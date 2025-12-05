import type * as AST from 'estree';
import type * as ESTreeJSX from 'estree-jsx';
import type { TSESTree } from '@typescript-eslint/types';
import type { NAMESPACE_URI } from '../../runtime/internal/client/constants.js';
import type { Parse } from '#parser';

export type RpcModules = Map<string, [string, string]>;

declare global {
	var rpc_modules: RpcModules | undefined;
}

export type NameSpace = keyof typeof NAMESPACE_URI;
interface BaseNodeMetaData {
	scoped?: boolean;
	path: AST.Node[];
	has_template?: boolean;
	original_name?: string;
	is_capitalized?: boolean;
	has_await?: boolean;
	commentContainerId?: number;
	openingTagEnd?: number;
	openingTagEndLoc?: AST.Position;
	parenthesized?: boolean;
	elementLeadingComments?: AST.Comment[];
}

interface FunctionMetaData extends BaseNodeMetaData {
	was_component?: boolean;
	tracked?: boolean;
}

// Strip parent, loc, and range from TSESTree nodes to match @sveltejs/acorn-typescript output
// acorn-typescript uses start/end instead of range, and loc is optional
type AcornTSNode<T> = Omit<T, 'parent' | 'loc' | 'range' | 'expression'> & {
	start: number;
	end: number;
	loc?: AST.SourceLocation;
	range?: AST.BaseNode['range'];
	metadata: BaseNodeMetaData;

	leadingComments?: AST.Comment[] | undefined;
	trailingComments?: AST.Comment[] | undefined;
};

interface FunctionLikeTS {
	returnType?: AST.TSTypeAnnotation;
	typeParameters?: AST.TSTypeParameterDeclaration;
	typeAnnotation?: AST.TSTypeAnnotation;
}

// Ripple augmentation for ESTree function nodes
declare module 'estree' {
	interface FunctionDeclaration extends FunctionLikeTS {
		metadata: FunctionMetaData;
	}
	interface FunctionExpression extends FunctionLikeTS {
		metadata: FunctionMetaData;
	}
	interface ArrowFunctionExpression extends FunctionLikeTS {
		metadata: FunctionMetaData;
	}

	interface Identifier extends TrackedNode {
		metadata: BaseNode['metadata'] & {
			tracked_shorthand?: '#Map' | '#Set';
		};
	}

	interface MemberExpression extends TrackedNode {}

	interface TrackedNode {
		tracked?: boolean;
	}

	// Include TypeScript node types and Ripple-specific nodes in NodeMap
	interface NodeMap {
		Component: Component;
		TsxCompat: TsxCompat;
		Html: Html;
		Element: Element;
		Text: TextNode;
		ServerBlock: ServerBlock;
		ServerIdentifier: ServerIdentifier;
		TrackedExpression: TrackedExpression;
		Attribute: Attribute;
		RefAttribute: RefAttribute;
		SpreadAttribute: SpreadAttribute;
		// Stylesheet: AST.CSS.StyleSheet;
	}

	interface ExpressionMap {
		TrackedArrayExpression: TrackedArrayExpression;
		TrackedObjectExpression: TrackedObjectExpression;
		TrackedMapExpression: TrackedMapExpression;
		TrackedSetExpression: TrackedSetExpression;
		TrackedExpression: TrackedExpression;
		Text: TextNode;
	}

	interface Comment {
		context?: Parse.CommentMetaData | null;
	}

	/**
	 * Custom Comment interface with location information
	 */
	type CommentWithLocation = Comment & NodeWithLocation;

	interface TryStatement {
		pending?: BlockStatement | null;
	}

	interface ForOfStatement {
		index?: Identifier | null;
		key?: Expression | null;
	}

	interface ServerIdentifier extends BaseNode {
		type: 'ServerIdentifier';
	}

	interface ImportDeclaration {
		importKind: TSESTree.ImportDeclaration['importKind'];
	}
	interface ImportSpecifier {
		importKind: TSESTree.ImportSpecifier['importKind'];
	}
	interface ExportNamedDeclaration {
		exportKind: TSESTree.ExportNamedDeclaration['exportKind'];
	}

	interface BaseNodeWithoutComments {
		// Adding start, end for now as always there
		// later might change to optional
		// And only define on certain nodes
		// BaseNode inherits from this interface
		start?: number;
		end?: number;
	}

	interface BaseNode {
		is_controlled?: boolean;
		// This is for Pattern but it's a type alias
		// So it's just easy to extend BaseNode even though
		// typeAnnotation, typeArguments do not apply to all nodes
		typeAnnotation?: TSTypeAnnotation;
		typeArguments?: TSTypeParameterInstantiation;

		// even though technically metadata starts out as undefined
		// metadata is always populated by the `_` visitor
		// which runs for every node before other visitors
		// so taking a practical approach and making it required
		// to avoid lots of typecasting or checking for undefined
		metadata: BaseNodeMetaData;

		comments?: AST.Comment[];
	}

	interface NodeWithLocation {
		start: number;
		end: number;
		loc: SourceLocation;
	}

	/**
	 * Ripple custom interfaces and types section
	 */
	interface Component extends BaseNode {
		type: 'Component';
		// null is for anonymous components {component: () => {}}
		id: Identifier | null;
		params: Pattern[];
		body: Node[];
		css: CSS.StyleSheet | null;
		metadata: BaseNodeMetaData & {
			inherited_css?: boolean;
		};
		default: boolean;
	}

	interface TsxCompat extends BaseNode {
		type: 'TsxCompat';
		kind: string;
		attributes: Array<any>;
		children: ESTreeJSX.JSXElement['children'];
		selfClosing?: boolean;
		unclosed?: boolean;
	}

	interface Html extends BaseNode {
		type: 'Html';
		expression: Expression;
	}

	interface Element extends BaseNode {
		type: 'Element';
		id: Identifier;
		attributes: RippleAttribute[];
		children: Node[];
		selfClosing?: boolean;
		unclosed?: boolean;
		loc: AST.SourceLocation;
		metadata: BaseNodeMetaData & {
			ts_name?: string;
		};

		// currently only for <style> and <script> tags
		openingElement?: ESTreeJSX.JSXOpeningElement;
		closingElement?: ESTreeJSX.JSXClosingElement;

		// for <style> tags
		css?: string;

		// for <script> tags
		content?: string;

		innerComments?: Comment[];
	}

	export interface TextNode extends AST.BaseNode {
		type: 'Text';
		expression: Expression;
		loc?: SourceLocation;
	}

	interface ServerBlock extends BaseNode {
		type: 'ServerBlock';
		body: BlockStatement;
		metadata: BaseNodeMetaData & {
			exports: string[];
		};
	}

	/**
	 * Tracked Expressions
	 */
	interface TrackedArrayExpression extends Omit<ArrayExpression, 'type'> {
		type: 'TrackedArrayExpression';
		elements: (Expression | SpreadElement | null)[];
	}

	interface TrackedExpression extends BaseNode {
		argument: Expression;
		type: 'TrackedExpression';
	}

	interface TrackedObjectExpression extends Omit<ObjectExpression, 'type'> {
		type: 'TrackedObjectExpression';
		properties: (Property | SpreadElement)[];
	}

	interface TrackedMapExpression extends BaseNode {
		type: 'TrackedMapExpression';
		arguments: (Expression | SpreadElement)[];
	}

	interface TrackedSetExpression extends BaseNode {
		type: 'TrackedSetExpression';
		arguments: (Expression | SpreadElement)[];
	}

	/**
	 * Ripple attribute nodes
	 */
	interface Attribute extends BaseNode {
		type: 'Attribute';
		name: Identifier;
		value: Expression | null;
		loc?: SourceLocation;
		shorthand?: boolean;
		metadata: BaseNodeMetaData & {
			delegated?: boolean;
		};
	}

	interface RefAttribute extends BaseNode {
		type: 'RefAttribute';
		argument: Expression;
		loc?: SourceLocation;
	}

	interface SpreadAttribute extends BaseNode {
		type: 'SpreadAttribute';
		argument: Expression;
		loc?: SourceLocation;
	}

	/**
	 * Ripple's extended Declaration type that includes Component
	 * Use this instead of AST.Declaration when you need Component support
	 */
	export type RippleDeclaration = AST.Declaration | AST.Component | AST.TSDeclareFunction;

	/**
	 * Ripple's extended ExportNamedDeclaration with Component support
	 */
	interface RippleExportNamedDeclaration extends Omit<AST.ExportNamedDeclaration, 'declaration'> {
		declaration?: RippleDeclaration | null | undefined;
	}

	/**
	 * Ripple's extended Program with Component support
	 */
	interface RippleProgram extends Omit<AST.Program, 'body'> {
		body: (AST.Program['body'][number] | Component)[];
	}

	export type RippleAttribute = Attribute | SpreadAttribute | RefAttribute;

	export namespace CSS {
		export interface BaseNode {
			start: number;
			end: number;
		}

		export interface StyleSheet extends BaseNode {
			type: 'StyleSheet';
			children: Array<Atrule | Rule>;
			source: string;
			hash: string;
		}

		export interface Atrule extends BaseNode {
			type: 'Atrule';
			name: string;
			prelude: string;
			block: Block | null;
		}

		export interface Rule extends BaseNode {
			type: 'Rule';
			prelude: SelectorList;
			block: Block;
			metadata: {
				parent_rule: Rule | null;
				has_local_selectors: boolean;
				is_global_block: boolean;
			};
		}

		/**
		 * A list of selectors, e.g. `a, b, c {}`
		 */
		export interface SelectorList extends BaseNode {
			type: 'SelectorList';
			/**
			 * The `a`, `b` and `c` in `a, b, c {}`
			 */
			children: ComplexSelector[];
		}

		/**
		 * A complex selector, e.g. `a b c {}`
		 */
		export interface ComplexSelector extends BaseNode {
			type: 'ComplexSelector';
			/**
			 * The `a`, `b` and `c` in `a b c {}`
			 */
			children: RelativeSelector[];
			metadata: {
				rule: Rule | null;
				used: boolean;
				is_global?: boolean;
			};
		}

		/**
		 * A relative selector, e.g the `a` and `> b` in `a > b {}`
		 */
		export interface RelativeSelector extends BaseNode {
			type: 'RelativeSelector';
			/**
			 * In `a > b`, `> b` forms one relative selector, and `>` is the combinator. `null` for the first selector.
			 */
			combinator: null | Combinator;
			/**
			 * The `b:is(...)` in `> b:is(...)`
			 */
			selectors: SimpleSelector[];

			metadata: {
				is_global: boolean;
				is_global_like: boolean;
				scoped: boolean;
			};
		}

		export interface TypeSelector extends BaseNode {
			type: 'TypeSelector';
			name: string;
		}

		export interface IdSelector extends BaseNode {
			type: 'IdSelector';
			name: string;
		}

		export interface ClassSelector extends BaseNode {
			type: 'ClassSelector';
			name: string;
		}

		export interface AttributeSelector extends BaseNode {
			type: 'AttributeSelector';
			name: string;
			matcher: string | null;
			value: string | null;
			flags: string | null;
		}

		export interface PseudoElementSelector extends BaseNode {
			type: 'PseudoElementSelector';
			name: string;
		}

		export interface PseudoClassSelector extends BaseNode {
			type: 'PseudoClassSelector';
			name: string;
			args: SelectorList | null;
		}

		export interface Percentage extends BaseNode {
			type: 'Percentage';
			value: string;
		}

		export interface NestingSelector extends BaseNode {
			type: 'NestingSelector';
			name: '&';
		}

		export interface Nth extends BaseNode {
			type: 'Nth';
			value: string;
		}

		export type SimpleSelector =
			| TypeSelector
			| IdSelector
			| ClassSelector
			| AttributeSelector
			| PseudoElementSelector
			| PseudoClassSelector
			| Percentage
			| Nth
			| NestingSelector;

		export interface Combinator extends BaseNode {
			type: 'Combinator';
			name: string;
		}

		export interface Block extends BaseNode {
			type: 'Block';
			children: Array<Declaration | Rule | Atrule>;
		}

		export interface Declaration extends BaseNode {
			type: 'Declaration';
			property: string;
			value: string;
		}

		// for zimmerframe
		export type Node =
			| StyleSheet
			| Rule
			| Atrule
			| SelectorList
			| Block
			| ComplexSelector
			| RelativeSelector
			| Combinator
			| SimpleSelector
			| Declaration;
	}
}

declare module 'estree-jsx' {
	interface JSXAttribute {
		shorthand: boolean;
	}

	interface JSXEmptyExpression {
		loc: AST.SourceLocation;
		innerComments?: Comment[];
	}

	interface JSXOpeningFragment {
		attributes: Array<JSXAttribute | JSXSpreadAttribute>;
	}

	interface JSXElement {
		metadata: BaseNodeMetaData & {
			ts_name?: string;
		};
	}

	interface JSXExpressionContainer {
		html?: boolean;
	}

	interface JSXMemberExpression {
		computed?: boolean;
	}

	interface ExpressionMap {
		JSXIdentifier: JSXIdentifier;
	}
}

declare module 'estree' {
	interface NodeMap {
		// TypeScript nodes
		TSAnyKeyword: TSAnyKeyword;
		TSArrayType: TSArrayType;
		TSAsExpression: TSAsExpression;
		TSBigIntKeyword: TSBigIntKeyword;
		TSBooleanKeyword: TSBooleanKeyword;
		TSCallSignatureDeclaration: TSCallSignatureDeclaration;
		TSConditionalType: TSConditionalType;
		TSConstructorType: TSConstructorType;
		TSConstructSignatureDeclaration: TSConstructSignatureDeclaration;
		TSDeclareFunction: TSDeclareFunction;
		TSEnumDeclaration: TSEnumDeclaration;
		TSEnumMember: TSEnumMember;
		TSExportAssignment: TSExportAssignment;
		TSExternalModuleReference: TSExternalModuleReference;
		TSFunctionType: TSFunctionType;
		TSImportEqualsDeclaration: TSImportEqualsDeclaration;
		TSImportType: TSImportType;
		TSIndexedAccessType: TSIndexedAccessType;
		TSIndexSignature: TSIndexSignature;
		TSInferType: TSInferType;
		TSInstantiationExpression: TSInstantiationExpression;
		TSInterfaceBody: TSInterfaceBody;
		TSInterfaceDeclaration: TSInterfaceDeclaration;
		TSIntersectionType: TSIntersectionType;
		TSIntrinsicKeyword: TSIntrinsicKeyword;
		TSLiteralType: TSLiteralType;
		TSMappedType: TSMappedType;
		TSMethodSignature: TSMethodSignature;
		TSModuleBlock: TSModuleBlock;
		TSModuleDeclaration: TSModuleDeclaration;
		TSNamedTupleMember: TSNamedTupleMember;
		TSNamespaceExportDeclaration: TSNamespaceExportDeclaration;
		TSNeverKeyword: TSNeverKeyword;
		TSNonNullExpression: TSNonNullExpression;
		TSNullKeyword: TSNullKeyword;
		TSNumberKeyword: TSNumberKeyword;
		TSObjectKeyword: TSObjectKeyword;
		TSOptionalType: TSOptionalType;
		TSParameterProperty: TSParameterProperty;
		TSPropertySignature: TSPropertySignature;
		TSQualifiedName: TSQualifiedName;
		TSRestType: TSRestType;
		TSSatisfiesExpression: TSSatisfiesExpression;
		TSStringKeyword: TSStringKeyword;
		TSSymbolKeyword: TSSymbolKeyword;
		TSThisType: TSThisType;
		TSTupleType: TSTupleType;
		TSTypeAliasDeclaration: TSTypeAliasDeclaration;
		TSTypeAnnotation: TSTypeAnnotation;
		TSTypeAssertion: TSTypeAssertion;
		TSTypeLiteral: TSTypeLiteral;
		TSTypeOperator: TSTypeOperator;
		TSTypeParameter: TSTypeParameter;
		TSTypeParameterDeclaration: TSTypeParameterDeclaration;
		TSTypeParameterInstantiation: TSTypeParameterInstantiation;
		TSTypePredicate: TSTypePredicate;
		TSTypeQuery: TSTypeQuery;
		TSTypeReference: TSTypeReference;
		TSUndefinedKeyword: TSUndefinedKeyword;
		TSUnionType: TSUnionType;
		TSUnknownKeyword: TSUnknownKeyword;
		TSVoidKeyword: TSVoidKeyword;
		TSParenthesizedType: TSParenthesizedType;
	}

	// TypeScript AST node interfaces from @sveltejs/acorn-typescript
	// Based on TSESTree types but adapted for acorn's output format
	interface TSAnyKeyword extends AcornTSNode<TSESTree.TSAnyKeyword> {}
	interface TSArrayType extends AcornTSNode<TSESTree.TSArrayType> {}
	interface TSAsExpression extends AcornTSNode<TSESTree.TSAsExpression> {
		// Have to override it to use our Expression for required properties like metadata
		expression: AST.Expression;
	}
	interface TSBigIntKeyword extends AcornTSNode<TSESTree.TSBigIntKeyword> {}
	interface TSBooleanKeyword extends AcornTSNode<TSESTree.TSBooleanKeyword> {}
	interface TSCallSignatureDeclaration extends AcornTSNode<TSESTree.TSCallSignatureDeclaration> {}
	interface TSConditionalType extends AcornTSNode<TSESTree.TSConditionalType> {}
	interface TSConstructorType extends AcornTSNode<TSESTree.TSConstructorType> {}
	interface TSConstructSignatureDeclaration
		extends AcornTSNode<TSESTree.TSConstructSignatureDeclaration> {}
	interface TSDeclareFunction extends AcornTSNode<TSESTree.TSDeclareFunction> {}
	interface TSEnumDeclaration extends AcornTSNode<TSESTree.TSEnumDeclaration> {}
	interface TSEnumMember extends AcornTSNode<TSESTree.TSEnumMember> {}
	interface TSExportAssignment extends AcornTSNode<TSESTree.TSExportAssignment> {}
	interface TSExternalModuleReference extends AcornTSNode<TSESTree.TSExternalModuleReference> {}
	interface TSFunctionType extends AcornTSNode<TSESTree.TSFunctionType> {}
	interface TSImportEqualsDeclaration extends AcornTSNode<TSESTree.TSImportEqualsDeclaration> {}
	interface TSImportType extends AcornTSNode<TSESTree.TSImportType> {}
	interface TSIndexedAccessType extends AcornTSNode<TSESTree.TSIndexedAccessType> {}
	interface TSIndexSignature extends AcornTSNode<TSESTree.TSIndexSignature> {}
	interface TSInferType extends AcornTSNode<TSESTree.TSInferType> {}
	interface TSInstantiationExpression extends AcornTSNode<TSESTree.TSInstantiationExpression> {
		expression: AST.Expression;
	}
	interface TSInterfaceBody extends AcornTSNode<TSESTree.TSInterfaceBody> {}
	interface TSInterfaceDeclaration extends AcornTSNode<TSESTree.TSInterfaceDeclaration> {}
	interface TSIntersectionType extends AcornTSNode<TSESTree.TSIntersectionType> {}
	interface TSIntrinsicKeyword extends AcornTSNode<TSESTree.TSIntrinsicKeyword> {}
	interface TSLiteralType extends AcornTSNode<TSESTree.TSLiteralType> {}
	interface TSMappedType extends AcornTSNode<TSESTree.TSMappedType> {}
	interface TSMethodSignature extends AcornTSNode<TSESTree.TSMethodSignature> {}
	interface TSModuleBlock extends AcornTSNode<TSESTree.TSModuleBlock> {}
	interface TSModuleDeclaration extends AcornTSNode<TSESTree.TSModuleDeclaration> {}
	interface TSNamedTupleMember extends AcornTSNode<TSESTree.TSNamedTupleMember> {}
	interface TSNamespaceExportDeclaration
		extends AcornTSNode<TSESTree.TSNamespaceExportDeclaration> {}
	interface TSNeverKeyword extends AcornTSNode<TSESTree.TSNeverKeyword> {}
	interface TSNonNullExpression extends AcornTSNode<TSESTree.TSNonNullExpression> {
		expression: AST.Expression;
	}
	interface TSNullKeyword extends AcornTSNode<TSESTree.TSNullKeyword> {}
	interface TSNumberKeyword extends AcornTSNode<TSESTree.TSNumberKeyword> {}
	interface TSObjectKeyword extends AcornTSNode<TSESTree.TSObjectKeyword> {}
	interface TSOptionalType extends AcornTSNode<TSESTree.TSOptionalType> {}
	interface TSParameterProperty extends AcornTSNode<TSESTree.TSParameterProperty> {}
	interface TSPropertySignature extends AcornTSNode<TSESTree.TSPropertySignature> {}
	interface TSQualifiedName extends AcornTSNode<TSESTree.TSQualifiedName> {}
	interface TSRestType extends AcornTSNode<TSESTree.TSRestType> {}
	interface TSSatisfiesExpression extends AcornTSNode<TSESTree.TSSatisfiesExpression> {
		expression: AST.Expression;
	}
	interface TSStringKeyword extends AcornTSNode<TSESTree.TSStringKeyword> {}
	interface TSSymbolKeyword extends AcornTSNode<TSESTree.TSSymbolKeyword> {}
	interface TSThisType extends AcornTSNode<TSESTree.TSThisType> {}
	interface TSTupleType extends AcornTSNode<TSESTree.TSTupleType> {}
	interface TSTypeAliasDeclaration extends AcornTSNode<TSESTree.TSTypeAliasDeclaration> {}
	interface TSTypeAnnotation extends AcornTSNode<TSESTree.TSTypeAnnotation> {}
	interface TSTypeAssertion extends AcornTSNode<TSESTree.TSTypeAssertion> {
		expression: AST.Expression;
	}
	interface TSTypeLiteral extends AcornTSNode<TSESTree.TSTypeLiteral> {}
	interface TSTypeOperator extends AcornTSNode<TSESTree.TSTypeOperator> {}
	interface TSTypeParameter extends AcornTSNode<TSESTree.TSTypeParameter> {}
	interface TSTypeParameterDeclaration extends AcornTSNode<TSESTree.TSTypeParameterDeclaration> {}
	interface TSTypeParameterInstantiation
		extends AcornTSNode<TSESTree.TSTypeParameterInstantiation> {}
	interface TSTypePredicate extends AcornTSNode<TSESTree.TSTypePredicate> {}
	interface TSTypeQuery extends AcornTSNode<TSESTree.TSTypeQuery> {}
	interface TSTypeReference extends AcornTSNode<TSESTree.TSTypeReference> {}
	interface TSUndefinedKeyword extends AcornTSNode<TSESTree.TSUndefinedKeyword> {}
	interface TSUnionType extends AcornTSNode<TSESTree.TSUnionType> {}
	interface TSUnknownKeyword extends AcornTSNode<TSESTree.TSUnknownKeyword> {}
	interface TSVoidKeyword extends AcornTSNode<TSESTree.TSVoidKeyword> {}

	// acorn-typescript specific nodes (not in @typescript-eslint/types)
	interface TSParenthesizedType extends AST.BaseNode {
		type: 'TSParenthesizedType';
	}

	// Extend ExpressionMap for TypeScript expressions
	interface ExpressionMap {
		TSAsExpression: TSAsExpression;
		TSInstantiationExpression: TSInstantiationExpression;
		TSNonNullExpression: TSNonNullExpression;
		TSSatisfiesExpression: TSSatisfiesExpression;
		TSTypeAssertion: TSTypeAssertion;
	}
}

import type { Comment, Position } from 'acorn';
import type { M } from 'vitest/dist/chunks/environment.d.cL3nLXbE.js';

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
	ast: AST.Program;
	errors: ParseError[];
}

export interface AnalysisResult {
	ast: AST.Program;
	scopes: Map<AST.Node, ScopeInterface>;
	scope: ScopeInterface;
	component_metadata: Array<{ id: string; async: boolean }>;
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
export type BindingKind =
	| 'normal'
	| 'for_pattern'
	| 'rest_prop'
	| 'prop'
	| 'prop_fallback'
	| 'index';

/**
 * A variable binding in a scope
 */
export interface Binding {
	/** The identifier node that declares this binding */
	node: AST.Identifier;
	/** References to this binding */
	references: Array<{ node: AST.Identifier; path: AST.Node[] }>;
	/** Initial value/declaration */
	initial:
		| null
		| AST.Expression
		| AST.FunctionDeclaration
		| AST.ClassDeclaration
		| AST.ImportDeclaration;
	/** Whether this binding has been reassigned */
	reassigned: boolean;
	/** Whether this binding has been mutated (property access) */
	mutated: boolean;
	/** Whether this binding has been updated (reassigned or mutated) */
	updated: boolean;
	/** Whether this binding represents a called function */
	is_called: boolean;
	/** Additional metadata for this binding */
	metadata: {
		is_dynamic_component?: boolean;
		pattern?: AST.Identifier;
		is_tracked_object?: boolean;
	} | null;
	/** Kind of binding */
	kind: BindingKind;
	/** Declaration kind */
	declaration_kind?: DeclarationKind;
	/** The scope that contains this binding */
	scope: ScopeInterface;
	/** Transform functions for reading, assigning, and updating this binding */
	transform?: {
		read: (node?: AST.Identifier) => AST.Expression;
		assign?: (node: AST.Pattern, value: AST.Expression) => AST.AssignmentExpression;
		update?: (node: AST.UpdateExpression) => AST.UpdateExpression;
	};
}

/**
 * Root scope manager
 */
export interface ScopeRoot {
	/** Set of conflicting/reserved names */
	conflicts: Set<string>;
	/** Generate unique identifier name */
	unique(preferred_name: string): AST.Identifier;
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
	declarators: Map<AST.VariableDeclarator, Binding[]>;
	/** Map of references in this scope */
	references: Map<string, Array<{ node: AST.Identifier; path: AST.Node[] }>>;
	/** Function nesting depth */
	function_depth: number;
	/** Whether reactive tracing is enabled */
	tracing: null | AST.Expression;
	server_block?: boolean;

	/** Create child scope */
	child(porous?: boolean): ScopeInterface;
	/** Declare a binding */
	declare(
		node: AST.Identifier,
		kind: BindingKind,
		declaration_kind: DeclarationKind,
		initial?:
			| null
			| AST.Expression
			| AST.FunctionDeclaration
			| AST.ClassDeclaration
			| AST.ImportDeclaration,
	): Binding;
	/** Get binding by name */
	get(name: string): Binding | null;
	/** Get bindings for a declarator */
	get_bindings(node: AST.VariableDeclarator): Binding[];
	/** Find the scope that owns a name */
	owner(name: string): ScopeInterface | null;
	/** Add a reference */
	reference(node: AST.Identifier, path: AST.Node[]): void;
	/** Generate unique identifier name */
	generate(preferred_name: string): string;
}

/**
 * Compiler state object
 */

interface BaseStateMetaData {
	tracking?: boolean | null;
	await?: boolean;
}

export interface BaseState {
	/** For utils */
	scope: ScopeInterface;
	scopes: Map<AST.Node | AST.Node[], ScopeInterface>;
	inside_head?: boolean;

	/** Common For All */
	to_ts: boolean;
	component?: AST.Component;
}

export interface AnalysisState extends BaseState {
	analysis: AnalysisResult & {
		module: {
			ast: AnalysisResult['ast'];
			scope: AnalysisResult['scope'];
			scopes: AnalysisResult['scopes'];
			filename: string;
		};
	};
	elements?: AST.Element[];
	function_depth?: number;
	inside_server_block?: boolean;
	loose?: boolean;
	metadata: BaseStateMetaData;
}

export interface TransformServerState extends BaseState {
	imports: Set<string>;
	init: Array<AST.Statement> | null;
	stylesheets: AST.CSS.StyleSheet[];
	component_metadata: AnalysisResult['component_metadata'];
	inside_server_block: boolean;
	filename: string;
	metadata: BaseStateMetaData;
	namespace: NameSpace;
}

type UpdateList = Array<{
	identity?: AST.Identifier | AST.Expression;
	initial?: AST.Expression;
	operation: (expr?: AST.Expression, prev?: AST.Expression) => AST.ExpressionStatement;
	expression?: AST.Expression;
	needsPrevTracking?: boolean;
}> & { async?: boolean };

export interface TransformClientState extends BaseState {
	events: Set<string>;
	filename: string;
	final: Array<AST.Statement> | null;
	flush_node: ((is_controlled?: boolean) => AST.Identifier) | null;
	hoisted: Array<AST.Statement>;
	imports: Set<string>;
	init: Array<AST.Statement> | null;
	metadata: BaseStateMetaData;
	namespace: NameSpace;
	ripple_user_imports: Map<string, string>;
	setup: Array<AST.Statement> | null;
	stylesheets: Array<AST.CSS.StyleSheet>;
	template: Array<string | AST.Expression> | null;
	update: UpdateList | null;
}

/** Override zimmerframe types and provide our own */
type NodeOf<T extends string, X> = X extends { type: T } ? X : never;

type SpecializedVisitors<T extends AST.Node | AST.CSS.Node, U> = {
	[K in T['type']]?: Visitor<NodeOf<K, T>, U, T>;
};

export type Visitor<T, U, V> = (node: T, context: Context<V, U>) => V | void;

export type Visitors<T extends AST.Node | AST.CSS.Node, U> = T['type'] extends '_'
	? never
	: SpecializedVisitors<T, U> & { _?: Visitor<T, U, T> };

export interface Context<T, U> {
	next: (state?: U) => T | void;
	path: T[];
	state: U;
	stop: () => void;
	visit: (node: T, state?: U) => T;
}

/**
 * Transform context object
 */
export type TransformClientContext = Context<AST.Node, TransformClientState>;
export type TransformServerContext = Context<AST.Node, TransformServerState>;
export type AnalysisContext = Context<AST.Node, AnalysisState>;
export type CommonContext = TransformClientContext | TransformServerContext | AnalysisContext;
export type VisitorClientContext = TransformClientContext & { root?: boolean };

/**
 * Delegated event result
 */
export interface DelegatedEventResult {
	function?: AST.FunctionExpression | AST.FunctionDeclaration | AST.ArrowFunctionExpression;
}
