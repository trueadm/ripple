import type * as ESTree from 'estree';

export type ExpressionProcessor = (node: ESTree.Pattern) => ESTree.Expression;

export interface Assignment {
    node: ESTree.Pattern;
    is_rest: boolean;
    has_default_value: boolean;
    expression: ExpressionProcessor;
    update_expression: ExpressionProcessor;
}

export type DestructuredAssignment = {
    expression: (object: ESTree.Pattern) => ESTree.Expression;
};
