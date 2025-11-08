#include <tree_sitter/parser.h>
#include <wctype.h>

enum TokenType {
  AUTOMATIC_SEMICOLON,
  TEMPLATE_CHARS,
  TERNARY_QMARK,
  JSX_TEXT,
};

void *tree_sitter_ripple_external_scanner_create() { return NULL; }
void tree_sitter_ripple_external_scanner_destroy(void *p) {}
void tree_sitter_ripple_external_scanner_reset(void *p) {}
unsigned tree_sitter_ripple_external_scanner_serialize(void *p, char *buffer) { return 0; }
void tree_sitter_ripple_external_scanner_deserialize(void *p, const char *b, unsigned n) {}

static void advance(TSLexer *lexer) { lexer->advance(lexer, false); }
static void skip(TSLexer *lexer) { lexer->advance(lexer, true); }

static bool scan_whitespace_and_comments(TSLexer *lexer) {
  for (;;) {
    while (iswspace(lexer->lookahead)) {
      skip(lexer);
    }

    if (lexer->lookahead == '/') {
      skip(lexer);

      if (lexer->lookahead == '/') {
        skip(lexer);
        while (lexer->lookahead != 0 && lexer->lookahead != '\n') {
          skip(lexer);
        }
      } else if (lexer->lookahead == '*') {
        skip(lexer);
        while (true) {
          if (lexer->lookahead == 0) return false;
          if (lexer->lookahead == '*') {
            skip(lexer);
            if (lexer->lookahead == '/') {
              skip(lexer);
              break;
            }
          } else {
            skip(lexer);
          }
        }
      } else {
        return false;
      }
    } else {
      return true;
    }
  }
}

static bool scan_automatic_semicolon(TSLexer *lexer) {
  lexer->result_symbol = AUTOMATIC_SEMICOLON;
  lexer->mark_end(lexer);

  for (;;) {
    if (lexer->lookahead == 0) return true;
    if (lexer->lookahead == '}') return true;
    if (lexer->is_at_included_range_start(lexer)) return true;
    if (lexer->lookahead == '\n') break;
    if (!iswspace(lexer->lookahead)) return false;
    skip(lexer);
  }

  skip(lexer);

  if (!scan_whitespace_and_comments(lexer)) return false;

  if (lexer->lookahead == ',') return false;
  if (lexer->lookahead == '.') return false;
  if (lexer->lookahead == ':') return false;
  if (lexer->lookahead == ';') return false;
  if (lexer->lookahead == '*') return false;
  if (lexer->lookahead == '%') return false;
  if (lexer->lookahead == '^') return false;
  if (lexer->lookahead == '+') return false;
  if (lexer->lookahead == '-') return false;
  if (lexer->lookahead == '/') return false;
  if (lexer->lookahead == '<') return false;
  if (lexer->lookahead == '=') return false;
  if (lexer->lookahead == '>') return false;
  if (lexer->lookahead == '|') return false;
  if (lexer->lookahead == '&') return false;
  if (lexer->lookahead == '?') return false;
  if (lexer->lookahead == '[') return false;
  if (lexer->lookahead == '(') return false;

  return true;
}

static bool scan_template_chars(TSLexer *lexer) {
  lexer->result_symbol = TEMPLATE_CHARS;
  for (bool has_content = false;; has_content = true) {
    lexer->mark_end(lexer);
    switch (lexer->lookahead) {
      case '`':
        return has_content;
      case '$':
        advance(lexer);
        if (lexer->lookahead == '{') {
          return has_content;
        }
        break;
      case '\\':
        return has_content;
      case 0:
        return false;
      default:
        advance(lexer);
    }
  }
}

static bool scan_ternary_qmark(TSLexer *lexer) {
  for (;;) {
    if (!iswspace(lexer->lookahead)) break;
    skip(lexer);
  }

  if (lexer->lookahead == '?') {
    advance(lexer);

    if (lexer->lookahead != '?') {
      lexer->mark_end(lexer);
      lexer->result_symbol = TERNARY_QMARK;

      if (lexer->lookahead == '.') return false;

      return true;
    }
  }

  return false;
}

static bool scan_jsx_text(TSLexer *lexer) {
  lexer->result_symbol = JSX_TEXT;
  for (bool has_content = false;; has_content = true) {
    lexer->mark_end(lexer);
    switch (lexer->lookahead) {
      case '<':
      case '{':
      case 0:
        return has_content;
      default:
        advance(lexer);
    }
  }
}

bool tree_sitter_ripple_external_scanner_scan(void *payload, TSLexer *lexer,
                                                const bool *valid_symbols) {
  if (valid_symbols[TEMPLATE_CHARS]) {
    return scan_template_chars(lexer);
  }

  if (valid_symbols[AUTOMATIC_SEMICOLON]) {
    bool ret = scan_automatic_semicolon(lexer);
    if (!ret && !valid_symbols[TERNARY_QMARK] && lexer->lookahead == '?') {
      return false;
    }
    return ret;
  }

  if (valid_symbols[TERNARY_QMARK]) {
    return scan_ternary_qmark(lexer);
  }

  if (valid_symbols[JSX_TEXT]) {
    return scan_jsx_text(lexer);
  }

  return false;
}

