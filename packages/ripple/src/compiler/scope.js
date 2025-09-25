import is_reference from 'is-reference';
import { extract_identifiers, object, unwrap_pattern } from '../utils/ast.js';
import { walk } from 'zimmerframe';
import { is_reserved } from './utils.js';
import * as b from '../utils/builders.js';

export function create_scopes(ast, root, parent) {
  const scopes = new Map();
  const scope = new Scope(root, parent, false);
  scopes.set(ast, scope);

  const state = { scope };
  const references = [];
  const updates = [];

  function add_params(scope, params) {
    for (const param of params) {
      for (const node of extract_identifiers(param)) {
        scope.declare(node, 'normal', param.type === 'RestElement' ? 'rest_param' : 'param');
      }
    }
  }

  const create_block_scope = (node, { state, next }) => {
    const scope = state.scope.child(true);
    scopes.set(node, scope);

    if (node.type === 'ForOfStatement') {
      if (node.index) {
        state.scope.declare(node.index, 'normal', 'let');
      }
    }

    next({ scope });
  };

  walk(ast, state, {
    // references
    Identifier(node, { path, state }) {
      const parent = path.at(-1);
      if (
        parent &&
        is_reference(node, /** @type {Node} */ (parent)) &&
        // TSTypeAnnotation, TSInterfaceDeclaration etc - these are normally already filtered out,
        // but for the migration they aren't, so we need to filter them out here
        // TODO -> once migration script is gone we can remove this check
        !parent.type.startsWith('TS')
      ) {
        references.push([state.scope, { node, path: path.slice() }]);
      }
    },

    AssignmentExpression(node, { state, next }) {
      updates.push([state.scope, node.left]);
      next();
    },

    UpdateExpression(node, { state, next }) {
      updates.push([state.scope, /** @type {Identifier | MemberExpression} */ (node.argument)]);
      next();
    },

    ImportDeclaration(node, { state }) {
      for (const specifier of node.specifiers) {
        state.scope.declare(specifier.local, 'normal', 'import', node);
      }
    },

    Component(node, { state, next }) {
      const scope = state.scope.child();
      scopes.set(node, scope);

      if (node.id) scope.declare(node.id, 'normal', 'component');

      add_params(scope, node.params);
      next({ scope });
    },

    Element(node, { state, next }) {
      const scope = state.scope.child();
      scopes.set(node, scope);

      next({ scope });
    },

    FunctionExpression(node, { state, next }) {
      const scope = state.scope.child();
      scopes.set(node, scope);

      if (node.id) scope.declare(node.id, 'normal', 'function');

      add_params(scope, node.params);
      next({ scope });
    },

    FunctionDeclaration(node, { state, next }) {
      if (node.id) state.scope.declare(node.id, 'normal', 'function', node);

      const scope = state.scope.child();
      scopes.set(node, scope);

      add_params(scope, node.params);
      next({ scope });
    },

    ArrowFunctionExpression(node, { state, next }) {
      const scope = state.scope.child();
      scopes.set(node, scope);

      add_params(scope, node.params);
      next({ scope });
    },

    ForStatement: create_block_scope,
    ForInStatement: create_block_scope,
    ForOfStatement: create_block_scope,
    SwitchStatement: create_block_scope,
    BlockStatement(node, context) {
      const parent = context.path.at(-1);
      if (
        parent?.type === 'FunctionDeclaration' ||
        parent?.type === 'FunctionExpression' ||
        parent?.type === 'ArrowFunctionExpression'
      ) {
        // We already created a new scope for the function
        context.next();
      } else {
        create_block_scope(node, context);
      }
    },

    Eval(node, context) {
      const finalizer = node.finalizer;

      if (finalizer !== null) {
        for (const node of finalizer.body) {
          context.visit(node);
        }
      }
    },

    ClassDeclaration(node, { state, next }) {
      if (node.id) state.scope.declare(node.id, 'normal', 'let', node);
      next();
    },

    VariableDeclaration(node, { state, path, next }) {
      for (const declarator of node.declarations) {
        /** @type {Binding[]} */
        const bindings = [];

        state.scope.declarators.set(declarator, bindings);

        for (const id of extract_identifiers(declarator.id)) {
          const binding = state.scope.declare(id, 'normal', node.kind, declarator.init);
          bindings.push(binding);
        }
      }

      next();
    },

    CatchClause(node, { state, next }) {
      if (node.param) {
        const scope = state.scope.child(true);
        scopes.set(node, scope);

        for (const id of extract_identifiers(node.param)) {
          scope.declare(id, 'normal', 'let');
        }

        next({ scope });
      } else {
        next();
      }
    },
  });

  for (const [scope, { node, path }] of references) {
    scope.reference(node, path);
  }

  for (const [scope, node] of updates) {
    for (const expression of unwrap_pattern(node)) {
      const left = object(expression);
      const binding = left && scope.get(left.name);

      if (binding !== null && left !== binding.node) {
        binding.updated = true;

        if (left === expression) {
          binding.reassigned = true;
        } else {
          binding.mutated = true;
        }
      }
    }
  }

  return {
    scope,
    scopes,
  };
}

export class Scope {
  /** @type {ScopeRoot} */
  root;

  /**
   * The immediate parent scope
   * @type {Scope | null}
   */
  parent;

  /**
   * Whether or not `var` declarations are contained by this scope
   * @type {boolean}
   */
  #porous;

  /**
   * A map of every identifier declared by this scope, and all the
   * identifiers that reference it
   * @type {Map<string, Binding>}
   */
  declarations = new Map();

  /**
   * A map of declarators to the bindings they declare
   * @type {Map<VariableDeclarator | AST.LetDirective, Binding[]>}
   */
  declarators = new Map();

  /**
   * A set of all the names referenced with this scope
   * — useful for generating unique names
   * @type {Map<string, { node: Identifier; path: AST.Node[] }[]>}
   */
  references = new Map();

  /**
   * The scope depth allows us to determine if a state variable is referenced in its own scope,
   * which is usually an error. Block statements do not increase this value
   */
  function_depth = 0;

  /**
   * If tracing of reactive dependencies is enabled for this scope
   * @type {null | Expression}
   */
  tracing = null;

  /**
   *
   * @param {ScopeRoot} root
   * @param {Scope | null} parent
   * @param {boolean} porous
   */
  constructor(root, parent, porous) {
    this.root = root;
    this.parent = parent;
    this.#porous = porous;
    this.function_depth = parent ? parent.function_depth + (porous ? 0 : 1) : 0;
  }

  /**
   * @param {Identifier} node
   * @param {Binding['kind']} kind
   * @param {DeclarationKind} declaration_kind
   * @param {null | Expression | FunctionDeclaration | ClassDeclaration | ImportDeclaration} initial
   * @returns {Binding}
   */
  declare(node, kind, declaration_kind, initial = null) {
    if (this.parent) {
      if (declaration_kind === 'var' && this.#porous) {
        return this.parent.declare(node, kind, declaration_kind);
      }

      if (declaration_kind === 'import') {
        return this.parent.declare(node, kind, declaration_kind, initial);
      }
    }

    if (node.name === '_$_') {
      throw new Error('Cannot declare a variable named "_$_" as it is a reserved identifier');
    }

    if (this.declarations.has(node.name)) {
      throw new Error(`'${node.name}' has already been declared in the current scope`);
    }

    /** @type {Binding} */
    const binding = {
      node,
      references: [],
      initial,
      reassigned: false,
      mutated: false,
      updated: false,
      scope: this,
      kind,
      declaration_kind,
      is_called: false,
      metadata: null,
    };

    this.declarations.set(node.name, binding);
    this.root.conflicts.add(node.name);
    return binding;
  }

  child(porous = false) {
    return new Scope(this.root, this, porous);
  }

  /**
   * @param {string} preferred_name
   * @returns {string}
   */
  generate(preferred_name) {
    if (this.#porous) {
      return /** @type {Scope} */ (this.parent).generate(preferred_name);
    }

    preferred_name = preferred_name.replace(/[^a-zA-Z0-9_$]/g, '_').replace(/^[0-9]/, '_');
    let name = preferred_name;
    let n = 1;

    while (
      this.references.has(name) ||
      this.declarations.has(name) ||
      this.root.conflicts.has(name) ||
      is_reserved(name)
    ) {
      name = `${preferred_name}_${n++}`;
    }

    this.references.set(name, []);
    this.root.conflicts.add(name);
    return name;
  }

  /**
   * @param {string} name
   * @returns {Binding | null}
   */
  get(name) {
    return this.declarations.get(name) ?? this.parent?.get(name) ?? null;
  }

  /**
   * @param {VariableDeclarator | AST.LetDirective} node
   * @returns {Binding[]}
   */
  get_bindings(node) {
    const bindings = this.declarators.get(node);
    if (!bindings) {
      throw new Error('No binding found for declarator');
    }
    return bindings;
  }

  /**
   * @param {string} name
   * @returns {Scope | null}
   */
  owner(name) {
    return this.declarations.has(name) ? this : this.parent && this.parent.owner(name);
  }

  /**
   * @param {Identifier} node
   * @param {AST.Node[]} path
   */
  reference(node, path) {
    path = [...path]; // ensure that mutations to path afterwards don't affect this reference
    let references = this.references.get(node.name);

    if (!references) this.references.set(node.name, (references = []));

    references.push({ node, path });

    const binding = this.declarations.get(node.name);
    if (binding) {
      binding.references.push({ node, path });
    } else if (this.parent) {
      this.parent.reference(node, path);
    } else {
      // no binding was found, and this is the top level scope,
      // which means this is a global
      this.root.conflicts.add(node.name);
    }
  }
}

export class ScopeRoot {
  /** @type {Set<string>} */
  conflicts = new Set();

  /**
   * @param {string} preferred_name
   */
  unique(preferred_name) {
    preferred_name = preferred_name.replace(/[^a-zA-Z0-9_$]/g, '_');
    let final_name = preferred_name;
    let n = 1;

    while (this.conflicts.has(final_name)) {
      final_name = `${preferred_name}_${n++}`;
    }

    this.conflicts.add(final_name);
    const id = b.id(final_name);
    return id;
  }
}
