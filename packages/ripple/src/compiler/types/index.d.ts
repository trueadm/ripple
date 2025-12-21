import type * as AST from 'estree';
import type * as ESTreeJSX from 'estree-jsx';
import type { TSESTree } from '@typescript-eslint/types';
import type { NAMESPACE_URI } from '../../runtime/internal/client/constants.js';
import type { Parse } from '#parser';
import type * as ESRap from 'esrap';

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

	interface MethodDefinition {
		typeParameters?: TSTypeParameterDeclaration;
	}

	interface ClassDeclaration {
		typeParameters?: AST.TSTypeParameterDeclaration;
		superTypeArguments?: AST.TSTypeParameterInstantiation;
		implements?: AST.TSClassImplements[];
	}

	interface ClassExpression {
		typeParameters?: AST.TSTypeParameterDeclaration;
		superTypeArguments?: AST.TSTypeParameterInstantiation;
		implements?: AST.TSClassImplements[];
	}

	interface Identifier extends TrackedNode {
		metadata: BaseNode['metadata'] & {
			tracked_shorthand?: '#Map' | '#Set';
		};
	}

	interface MemberExpression extends AST.TrackedNode {}

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
		ParenthesizedExpression: ParenthesizedExpression;
	}

	interface ExpressionMap {
		TrackedArrayExpression: TrackedArrayExpression;
		TrackedObjectExpression: TrackedObjectExpression;
		TrackedMapExpression: TrackedMapExpression;
		TrackedSetExpression: TrackedSetExpression;
		TrackedExpression: TrackedExpression;
		Text: TextNode;
	}

	// Missing estree type
	interface ParenthesizedExpression extends AST.BaseNode {
		type: 'ParenthesizedExpression';
		expression: AST.Expression;
	}

	interface Comment {
		context?: Parse.CommentMetaData | null;
	}

	/**
	 * Custom Comment interface with location information
	 */
	type CommentWithLocation = AST.Comment & NodeWithLocation;

	interface TryStatement {
		pending?: AST.BlockStatement | null;
	}

	interface ForOfStatement {
		index?: AST.Identifier | null;
		key?: AST.Expression | null;
	}

	interface ServerIdentifier extends AST.BaseNode {
		type: 'ServerIdentifier';
	}

	interface ImportDeclaration {
		importKind: TSESTree.ImportDeclaration['importKind'];
	}
	interface ImportSpecifier {
		importKind: TSESTree.ImportSpecifier['importKind'];
	}
	interface ExportNamedDeclaration extends Omit<TSESTree.ExportNamedDeclaration, 'exportKind'> {
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

		comments?: Comment[];
	}

	interface NodeWithLocation {
		start: number;
		end: number;
		loc: AST.SourceLocation;
	}

	/**
	 * Ripple custom interfaces and types section
	 */
	interface Component extends AST.BaseNode {
		type: 'Component';
		// null is for anonymous components {component: () => {}}
		id: AST.Identifier | null;
		params: AST.Pattern[];
		body: AST.Node[];
		css: CSS.StyleSheet | null;
		metadata: BaseNodeMetaData & {
			inherited_css?: boolean;
		};
		default: boolean;
	}

	interface TsxCompat extends AST.BaseNode {
		type: 'TsxCompat';
		kind: string;
		attributes: Array<any>;
		children: ESTreeJSX.JSXElement['children'];
		selfClosing?: boolean;
		unclosed?: boolean;
	}

	interface Html extends AST.BaseNode {
		type: 'Html';
		expression: Expression;
	}

	interface Element extends AST.BaseNode {
		type: 'Element';
		id: AST.Identifier;
		attributes: RippleAttribute[];
		children: AST.Node[];
		selfClosing?: boolean;
		unclosed?: boolean;
		loc: SourceLocation;
		metadata: BaseNodeMetaData & {
			ts_name?: string;
			// for <style> tag
			styleScopeHash?: string;
			// for elements with scoped style classes
			css?: {
				scopedClasses: Map<
					string,
					{
						start: number;
						end: number;
						selector: CSS.ClassSelector;
					}
				>;
				topScopedClasses: Map<
					string,
					{
						start: number;
						end: number;
						selector: CSS.ClassSelector;
					}
				>;
				hash: string;
			};
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
		expression: AST.Expression;
		loc?: AST.SourceLocation;
	}

	interface ServerBlock extends AST.BaseNode {
		type: 'ServerBlock';
		body: BlockStatement;
		metadata: BaseNodeMetaData & {
			exports: string[];
		};
	}

	/**
	 * Tracked Expressions
	 */
	interface TrackedArrayExpression extends Omit<AST.ArrayExpression, 'type'> {
		type: 'TrackedArrayExpression';
		elements: (AST.Expression | AST.SpreadElement | null)[];
	}

	interface TrackedExpression extends AST.BaseNode {
		argument: AST.Expression;
		type: 'TrackedExpression';
	}

	interface TrackedObjectExpression extends Omit<AST.ObjectExpression, 'type'> {
		type: 'TrackedObjectExpression';
		properties: (AST.Property | AST.SpreadElement)[];
	}

	interface TrackedMapExpression extends AST.BaseNode {
		type: 'TrackedMapExpression';
		arguments: (AST.Expression | AST.SpreadElement)[];
	}

	interface TrackedSetExpression extends AST.BaseNode {
		type: 'TrackedSetExpression';
		arguments: (AST.Expression | AST.SpreadElement)[];
	}

	/**
	 * Ripple attribute nodes
	 */
	interface Attribute extends AST.BaseNode {
		type: 'Attribute';
		name: AST.Identifier;
		value: AST.Expression | null;
		loc?: AST.SourceLocation;
		shorthand?: boolean;
		metadata: BaseNodeMetaData & {
			delegated?: boolean;
		};
	}

	interface RefAttribute extends AST.BaseNode {
		type: 'RefAttribute';
		argument: AST.Expression;
		loc?: AST.SourceLocation;
	}

	interface SpreadAttribute extends AST.BaseNode {
		type: 'SpreadAttribute';
		argument: AST.Expression;
		loc?: AST.SourceLocation;
	}

	/**
	 * Ripple's extended Declaration type that includes Component
	 * Use this instead of Declaration when you need Component support
	 */
	export type RippleDeclaration = AST.Declaration | Component | AST.TSDeclareFunction;

	/**
	 * Ripple's extended ExportNamedDeclaration with Component support
	 */
	interface RippleExportNamedDeclaration extends Omit<AST.ExportNamedDeclaration, 'declaration'> {
		declaration?: RippleDeclaration | null | undefined;
	}

	/**
	 * Ripple's extended Program with Component support
	 */
	interface RippleProgram extends Omit<Program, 'body'> {
		body: (Program['body'][number] | Component)[];
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
		innerComments?: AST.Comment[];
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
	// Helper map for creating our own TypeNode
	// and to be used to extend estree's NodeMap
	interface TSNodeMap {
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
		TSExpressionWithTypeArguments: TSExpressionWithTypeArguments;
		TSClassImplements: TSClassImplements;
	}

	// Create our version of TypeNode with modified types to be used in replacements
	type TypeNode = TSNodeMap[keyof TSNodeMap];

	// Extend NodeMap to include TypeScript nodes
	interface NodeMap extends TSNodeMap {
		TypeNode: TypeNode;
	}

	type EntityName = AST.Identifier | AST.ThisExpression | TSQualifiedName;
	type Parameter =
		| AST.ArrayPattern
		| AST.AssignmentPattern
		| AST.Identifier
		| AST.ObjectPattern
		| AST.RestElement
		| TSParameterProperty;
	type TypeElement =
		| TSCallSignatureDeclaration
		| TSConstructSignatureDeclaration
		| TSIndexSignature
		| TSMethodSignature
		| TSPropertySignature;
	type TSPropertySignature = TSPropertySignatureComputedName | TSPropertySignatureNonComputedName;
	type PropertyNameComputed = AST.Expression;
	type PropertyNameNonComputed = AST.Identifier | NumberLiteral | StringLiteral;

	// TypeScript AST node interfaces from @sveltejs/acorn-typescript
	// Based on TSESTree types but adapted for acorn's output format
	interface TSAnyKeyword extends AcornTSNode<TSESTree.TSAnyKeyword> {}
	interface TSArrayType extends Omit<AcornTSNode<TSESTree.TSArrayType>, 'elementType'> {
		elementType: TypeNode;
	}
	interface TSAsExpression extends AcornTSNode<TSESTree.TSAsExpression> {
		// Have to override it to use our Expression for required properties like metadata
		expression: AST.Expression;
	}
	interface TSBigIntKeyword extends AcornTSNode<TSESTree.TSBigIntKeyword> {}
	interface TSBooleanKeyword extends AcornTSNode<TSESTree.TSBooleanKeyword> {}
	interface TSCallSignatureDeclaration
		extends Omit<
			AcornTSNode<TSESTree.TSCallSignatureDeclaration>,
			'typeParameters' | 'typeAnnotation'
		> {
		parameters: Parameter[];
		typeParameters: TSTypeParameterDeclaration | undefined;
		typeAnnotation: TSTypeAnnotation | undefined;
	}
	interface TSConditionalType
		extends Omit<
			AcornTSNode<TSESTree.TSConditionalType>,
			'checkType' | 'extendsType' | 'falseType' | 'trueType'
		> {
		checkType: TypeNode;
		extendsType: TypeNode;
		falseType: TypeNode;
		trueType: TypeNode;
	}
	interface TSConstructorType
		extends Omit<AcornTSNode<TSESTree.TSConstructorType>, 'typeParameters' | 'params'> {
		typeAnnotation: TSTypeAnnotation | undefined;
		typeParameters: TSTypeParameterDeclaration | undefined;
		parameters: AST.Parameter[];
	}
	interface TSConstructSignatureDeclaration
		extends Omit<
			AcornTSNode<TSESTree.TSConstructSignatureDeclaration>,
			'typeParameters' | 'typeAnnotation'
		> {
		parameters: Parameter[];
		typeParameters: TSTypeParameterDeclaration | undefined;
		typeAnnotation: TSTypeAnnotation | undefined;
	}
	interface TSDeclareFunction
		extends Omit<
			AcornTSNode<TSESTree.TSDeclareFunction>,
			'id' | 'params' | 'typeParameters' | 'returnType'
		> {
		id: AST.Identifier;
		params: Parameter[];
		typeParameters: TSTypeParameterDeclaration | undefined;
		returnType: TSTypeAnnotation | undefined;
	}
	interface TSEnumDeclaration
		extends Omit<AcornTSNode<TSESTree.TSEnumDeclaration>, 'id' | 'members'> {
		id: AST.Identifier;
		members: TSEnumMember[];
	}
	interface TSEnumMember extends Omit<AcornTSNode<TSESTree.TSEnumMember>, 'id' | 'initializer'> {
		id: AST.Identifier | StringLiteral;
		initializer: AST.Expression | undefined;
	}
	interface TSExportAssignment
		extends Omit<AcornTSNode<TSESTree.TSExportAssignment>, 'expression'> {
		expression: AST.Expression;
	}
	interface TSExternalModuleReference
		extends Omit<AcornTSNode<TSESTree.TSExternalModuleReference>, 'expression'> {
		expression: StringLiteral;
	}
	interface TSFunctionType
		extends Omit<AcornTSNode<TSESTree.TSFunctionType>, 'typeParameters' | 'params'> {
		typeAnnotation: TSTypeAnnotation | undefined;
		typeParameters: TSTypeParameterDeclaration | undefined;
		parameters: Parameter[];
	}
	interface TSImportEqualsDeclaration extends AcornTSNode<TSESTree.TSImportEqualsDeclaration> {}
	interface TSImportType
		extends Omit<AcornTSNode<TSESTree.TSImportType>, 'argument' | 'qualifier' | 'typeParameters'> {
		argument: TypeNode;
		qualifier: EntityName | null;
		// looks like acorn-typescript has typeParameters
		typeParameters: TSTypeParameterDeclaration | undefined | undefined;
	}
	interface TSIndexedAccessType
		extends Omit<AcornTSNode<TSESTree.TSIndexedAccessType>, 'indexType' | 'objectType'> {
		indexType: TypeNode;
		objectType: TypeNode;
	}
	interface TSIndexSignature
		extends Omit<AcornTSNode<TSESTree.TSIndexSignature>, 'parameters' | 'typeAnnotation'> {
		parameters: AST.Parameter[];
		typeAnnotation: TSTypeAnnotation | undefined;
	}
	interface TSInferType extends Omit<AcornTSNode<TSESTree.TSInferType>, 'typeParameter'> {
		typeParameter: TSTypeParameter;
	}
	interface TSInstantiationExpression extends AcornTSNode<TSESTree.TSInstantiationExpression> {
		expression: AST.Expression;
	}
	interface TSInterfaceBody extends Omit<AcornTSNode<TSESTree.TSInterfaceBody>, 'body'> {
		body: TypeElement[];
	}
	interface TSInterfaceDeclaration
		extends Omit<
			AcornTSNode<TSESTree.TSInterfaceDeclaration>,
			'id' | 'typeParameters' | 'body' | 'extends'
		> {
		id: AST.Identifier;
		typeParameters: TSTypeParameterDeclaration | undefined;
		body: TSInterfaceBody;
		extends: TSExpressionWithTypeArguments[];
	}
	interface TSIntersectionType extends Omit<AcornTSNode<TSESTree.TSIntersectionType>, 'types'> {
		types: TypeNode[];
	}
	interface TSIntrinsicKeyword extends AcornTSNode<TSESTree.TSIntrinsicKeyword> {}
	interface TSLiteralType extends Omit<AcornTSNode<TSESTree.TSLiteralType>, 'literal'> {
		literal: AST.Literal | AST.TemplateLiteral;
	}
	interface TSMappedType
		extends Omit<
			AcornTSNode<TSESTree.TSMappedType>,
			'typeParameter' | 'typeAnnotation' | 'nameType'
		> {
		typeAnnotation: TypeNode | undefined;
		typeParameter: TSTypeParameter;
		nameType: TypeNode | null;
	}
	interface TSMethodSignature
		extends Omit<
			AcornTSNode<TSESTree.TSMethodSignature>,
			'key' | 'typeParameters' | 'params' | 'typeAnnotation'
		> {
		key: PropertyNameComputed | PropertyNameNonComputed;
		typeParameters: TSTypeParameterDeclaration | undefined;
		parameters: Parameter[];
		// doesn't actually exist in the spec but acorn-typescript adds it
		typeAnnotation: TSTypeAnnotation | undefined;
	}
	interface TSModuleBlock extends Omit<AcornTSNode<TSESTree.TSModuleBlock>, 'body'> {
		body: AST.Statement[];
	}
	interface TSModuleDeclaration
		extends Omit<AcornTSNode<TSESTree.TSModuleDeclaration>, 'body' | 'id'> {
		body: TSModuleBlock;
		id: AST.Identifier;
	}
	interface TSNamedTupleMember
		extends Omit<AcornTSNode<TSESTree.TSNamedTupleMember>, 'elementType' | 'label'> {
		elementType: TypeNode;
		label: AST.Identifier;
	}
	interface TSNamespaceExportDeclaration
		extends Omit<AcornTSNode<TSESTree.TSNamespaceExportDeclaration>, 'id'> {
		id: AST.Identifier;
	}
	interface TSNeverKeyword extends AcornTSNode<TSESTree.TSNeverKeyword> {}
	interface TSNonNullExpression extends AcornTSNode<TSESTree.TSNonNullExpression> {
		expression: AST.Expression;
	}
	interface TSNullKeyword extends AcornTSNode<TSESTree.TSNullKeyword> {}
	interface TSNumberKeyword extends AcornTSNode<TSESTree.TSNumberKeyword> {}
	interface TSObjectKeyword extends AcornTSNode<TSESTree.TSObjectKeyword> {}
	interface TSOptionalType extends Omit<AcornTSNode<TSESTree.TSOptionalType>, 'typeAnnotation'> {
		typeAnnotation: TypeNode;
	}
	interface TSParameterProperty extends AcornTSNode<TSESTree.TSParameterProperty> {}
	interface TSPropertySignatureComputedName
		extends Omit<AcornTSNode<TSESTree.TSPropertySignatureComputedName>, 'key' | 'typeAnnotation'> {
		key: PropertyNameComputed;
		typeAnnotation: TSTypeAnnotation | undefined;
	}
	interface TSPropertySignatureNonComputedName
		extends Omit<
			AcornTSNode<TSESTree.TSPropertySignatureNonComputedName>,
			'key' | 'typeAnnotation'
		> {
		key: PropertyNameNonComputed;
		typeAnnotation: TSTypeAnnotation | undefined;
	}
	interface TSQualifiedName extends Omit<AcornTSNode<TSESTree.TSQualifiedName>, 'left' | 'right'> {
		left: EntityName;
		right: AST.Identifier;
	}
	interface TSRestType extends Omit<AcornTSNode<TSESTree.TSRestType>, 'typeAnnotation'> {
		typeAnnotation: TypeNode;
	}
	interface TSSatisfiesExpression extends AcornTSNode<TSESTree.TSSatisfiesExpression> {
		expression: AST.Expression;
	}
	interface TSStringKeyword extends AcornTSNode<TSESTree.TSStringKeyword> {}
	interface TSSymbolKeyword extends AcornTSNode<TSESTree.TSSymbolKeyword> {}
	interface TSThisType extends AcornTSNode<TSESTree.TSThisType> {}
	interface TSTupleType extends Omit<AcornTSNode<TSESTree.TSTupleType>, 'elementTypes'> {
		elementTypes: TypeNode[];
	}
	interface TSTypeAliasDeclaration
		extends Omit<
			AcornTSNode<TSESTree.TSTypeAliasDeclaration>,
			'id' | 'typeParameters' | 'typeAnnotation'
		> {
		id: AST.Identifier;
		typeAnnotation: TypeNode;
		typeParameters: TSTypeParameterDeclaration | undefined;
	}
	interface TSTypeAnnotation
		extends Omit<AcornTSNode<TSESTree.TSTypeAnnotation>, 'typeAnnotation'> {
		typeAnnotation: TypeNode;
	}
	interface TSTypeAssertion extends AcornTSNode<TSESTree.TSTypeAssertion> {
		expression: AST.Expression;
	}
	interface TSTypeLiteral extends Omit<AcornTSNode<TSESTree.TSTypeLiteral>, 'members'> {
		members: TypeElement[];
	}
	interface TSTypeOperator extends Omit<AcornTSNode<TSESTree.TSTypeOperator>, 'typeAnnotation'> {
		typeAnnotation: TypeNode | undefined;
	}
	interface TSTypeParameter
		extends Omit<AcornTSNode<TSESTree.TSTypeParameter>, 'name' | 'constraint' | 'default'> {
		constraint: TypeNode | undefined;
		default: TypeNode | undefined;
		name: AST.Identifier;
	}
	interface TSTypeParameterDeclaration
		extends Omit<AcornTSNode<TSESTree.TSTypeParameterDeclaration>, 'params'> {
		params: TypeNode[];
	}
	interface TSTypeParameterInstantiation
		extends Omit<AcornTSNode<TSESTree.TSTypeParameterInstantiation>, 'params'> {
		params: TypeNode[];
	}
	interface TSTypePredicate extends AcornTSNode<TSESTree.TSTypePredicate> {}
	interface TSTypeQuery
		extends Omit<AcornTSNode<TSESTree.TSTypeQuery>, 'exprName' | 'typeArguments'> {
		exprName: EntityName | TSImportType;
		typeArguments: TSTypeParameterInstantiation | undefined;
	}
	interface TSTypeReference
		extends Omit<AcornTSNode<TSESTree.TSTypeReference>, 'typeName' | 'typeArguments'> {
		typeArguments: TSTypeParameterInstantiation | undefined;
		typeName: EntityName;
	}
	interface TSUndefinedKeyword extends AcornTSNode<TSESTree.TSUndefinedKeyword> {}
	interface TSUnionType extends Omit<AcornTSNode<TSESTree.TSUnionType>, 'types'> {
		types: TypeNode[];
	}
	// TSInterfaceHeritage doesn't exist in acorn-typescript which uses TSExpressionWithTypeArguments
	interface TSInterfaceHeritage
		extends Omit<AcornTSNode<TSESTree.TSInterfaceHeritage>, 'expression' | 'typeParameters'> {
		expression: AST.Expression;
		// acorn-typescript uses typeParameters instead of typeArguments
		typeParameters: TSTypeParameterInstantiation | undefined;
	}
	// Extends TSInterfaceHeritage as it's the semantically the same as used by acorn-typescript
	interface TSExpressionWithTypeArguments extends Omit<TSInterfaceHeritage, 'type'> {
		type: 'TSExpressionWithTypeArguments';
	}

	interface TSClassImplements extends AcornTSNode<TSESTree.TSClassImplements> {}
	interface TSUnknownKeyword extends AcornTSNode<TSESTree.TSUnknownKeyword> {}
	interface TSVoidKeyword extends AcornTSNode<TSESTree.TSVoidKeyword> {}
	interface NumberLiteral extends AcornTSNode<TSESTree.NumberLiteral> {}
	interface StringLiteral extends AcornTSNode<TSESTree.StringLiteral> {}

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

export interface Context<T, U>
	extends Omit<ESRap.Context, 'path' | 'state' | 'visit' | 'next' | 'stop'> {
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
