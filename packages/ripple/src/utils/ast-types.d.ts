import type * as ESTree from 'estree';
import type * as acorn from '#acorn';

export type ExpressionProcessor = (node: ESTree.Pattern) => ESTree.Expression;
export type AcornExpressionProcessor = (node: acorn.Pattern) => acorn.Expression;

export interface Assignment {
    node: ESTree.Pattern;
    is_rest: boolean;
    has_default_value: boolean;
    expression: ExpressionProcessor;
    update_expression: ExpressionProcessor;
}

export interface AcornAssignment {
    node: acorn.Pattern;
    is_rest: boolean;
    has_default_value: boolean;
    expression: AcornExpressionProcessor;
    update_expression: AcornExpressionProcessor;
}

export type DestructuredAssignment = {
    expression: (object: ESTree.Pattern) => ESTree.Expression;
};
