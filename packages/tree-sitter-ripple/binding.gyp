{
  "targets": [
    {
      "target_name": "tree_sitter_ripple_binding",
      "include_dirs": [
        "node_modules/node-addon-api",
        "src"
      ],
      "sources": [
        "bindings/node/binding.cc",
        "src/parser.c",
        "src/scanner.c"
      ],
      "cflags_c": [
        "-std=c99"
      ],
      "defines": ["NAPI_VERSION=6", "NAPI_DISABLE_CPP_EXCEPTIONS"]
    }
  ]
}

