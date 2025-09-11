export interface StyleBlock {
    source: string;
    hash: `ripple-${string}`;
    type: 'StyleSheet';
    body: unknown[]; // TODO
}

declare namespace AST {
    namespace CSS {
        interface Node {
            start: number;
            end: number;
        }

        interface Declaration extends Node {
            type: 'Declaration';
            property: string;
            value: string;
        }

        interface AtRule extends Node {
            type: 'AtRule';
            name: string;
            prelude: string;
            block: Block | null;
        }

        interface SelectorList extends Node {
            type: 'SelectorList';
            children: ComplexSelector[];
        }

        interface SelectorMeta {
            is_global: boolean;
            is_global_like: boolean;
            scoped: boolean;
        }

        interface Combinator extends Node {
            type: 'Combinator';
            name: string;
        }

        interface ComplexSelector extends Node {
            type: 'ComplexSelector';
            children: SimpleSelector[];
            metadata: {
                rule: null;
                used: boolean;
            };
        }

        interface RelativeSelector extends Node {
            type: 'RelativeSelector';
            combinator: Combinator | null;
            selectors: unknown[];
            metadata: SelectorMeta;
        }

        interface TypeSelector extends Node {
            type: 'TypeSelector';
            name: string;
        }

        interface IdSelector extends Node {
            type: 'IdSelector';
            name: string;
        }

        interface ClassSelector extends Node {
            type: 'ClassSelector';
            name: string;
        }

        interface PseudoElementSelector extends Node {
            type: 'PseudoElementSelector';
            name: string;
        }

        interface PseudoClassSelector extends Node {
            type: 'PseudoClassSelector';
            name: string;
            args: SelectorList | null;
        }

        interface AttributeSelector extends Node {
            type: 'AttributeSelector';
            name: string;
            matcher: string | null;
            value: string | null;
            flags: string | null;
        }

        interface Nth extends Node {
            type: 'Nth';
            value: string;
        }

        interface Percentage extends Node {
            type: 'Percentage';
            value: string;
        }

        interface NestingSelector extends Node {
            type: 'NestingSelector';
            name: string;
        }

        type SimpleSelector = RelativeSelector | TypeSelector | IdSelector | ClassSelector | PseudoElementSelector | PseudoClassSelector | AttributeSelector | Nth | Percentage | NestingSelector;

        interface Rule extends Node {
            type: 'Rule';
            prelude: SelectorList;
            block: Block | null;
            metadata: {
                parent_rule: null;
                has_local_selectors: boolean;
                is_global_block: boolean;
            };
        }

        interface Block extends Node {
            type: 'Block';
            children: (Declaration | Rule | AtRule)[];
        }
    }
}
