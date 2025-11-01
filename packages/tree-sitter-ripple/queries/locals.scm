; Scopes
[
  (statement_block)
  (function_declaration)
  (arrow_function)
  (function_expression)
  (component_declaration)
  (fragment_declaration)
  (class_declaration)
  (for_statement)
  (for_of_statement)
  (for_in_statement)
  (while_statement)
  (catch_clause)
] @local.scope

; Definitions
(component_declaration
  name: (identifier) @local.definition.function)

(fragment_declaration
  name: (identifier) @local.definition.function)

(function_declaration
  name: (identifier) @local.definition.function)

(class_declaration
  name: (identifier) @local.definition.type)

(method_definition
  name: (property_name) @local.definition.method)

(variable_declarator
  name: (identifier) @local.definition.var)

(required_parameter
  pattern: (identifier) @local.definition.parameter)

(rest_parameter
  (identifier) @local.definition.parameter)

; References
(identifier) @local.reference

; Imports
(import_specifier
  name: (identifier) @local.definition.import)

(namespace_import
  (identifier) @local.definition.namespace)

; Exports
(export_specifier
  name: (identifier) @local.definition.export)
