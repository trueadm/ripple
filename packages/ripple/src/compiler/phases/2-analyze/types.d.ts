import type * as a from '#acorn';
import type * as z from 'zimmerframe';
import type { Scope } from '../../scope';

export interface ModuleInfo {
    ast: a.Program;
    scope: Scope;
    scopes: Map<a.RippleNode, Scope>;
    filename: string;
}

export interface AnalysisState {
    module: ModuleInfo;
    ast: a.Program;
    scope: Scope;
    scopes: Map<a.RippleNode, Scope>;
}

export interface VisitContext {
    scope: Scope;
    scopes: Map<a.RippleNode, Scope>;
    analysis: AnalysisState;

    metadata?: {
        await?: boolean;
        tracked?: boolean;
    };
}
