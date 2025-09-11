// important question: should these just be referred to using the ESTree
// and ESTreeJSX namespaces respectively (with import *)? This could be kinda
// clunky... idk, this seemed like a nicer option, open to change

export type * from 'estree';
export type * from 'estree-jsx';
