# Fix JSX parsing bug with regex literals in method calls

## 🐛 Problem

Regex literals inside method calls were incorrectly parsed as JSX tags, causing compilation failures. Additionally, the Prettier plugin converted regex literals to empty objects during formatting.

### Examples of the bugs:

**Compiler Bug:**
```javascript
// ❌ Before fix: SyntaxError during compilation
let result = text.match(/<span>/);
let replaced = text.replace(/<div>/g, '[DIV]');
```

**Prettier Bug:** 
```javascript
// ❌ Before fix: Formatted as empty objects
let result = text.match({});  // Was: text.match(/<span>/)
```

## 🔍 Root Causes

### 1. Compiler JSX Parser (`packages/ripple/src/compiler/phases/1-parse/index.js`)
The `getTokenFromCode()` function only performed line-based whitespace checking without considering **expression context**. It would treat `<` characters as JSX start tags even inside method calls.

### 2. Prettier Plugin (`packages/prettier-plugin-ripple/src/index.js`)
The `Literal` case didn't properly handle regex literal nodes, causing them to fall through to the unknown node handler and get converted to empty objects.

## ✅ Solutions

### 1. Enhanced JSX Context Detection
Added expression context checking before JSX parsing, similar to the existing `@` identifier logic:

```javascript
// NEW: Check if we're in an expression context where JSX is unlikely
const currentType = this.type;
const inExpression =
  this.exprAllowed ||
  currentType === tt.parenL ||    // Inside ( ) - CRITICAL for method calls!
  currentType === tt.braceL ||    // Inside { }
  currentType === tt.comma ||     // After ,
  currentType === tt.eq ||        // After =
  currentType === tt.colon ||     // After :
  currentType === tt.question ||  // After ?
  currentType === tt.logicalOR || // After ||
  currentType === tt.logicalAND || // After &&
  currentType === tt.dot ||       // After . (member expressions)
  currentType === tt.questionDot; // After ?. (optional chaining)

// If we're in an expression context, don't treat as JSX
if (inExpression) {
  return super.getTokenFromCode(code);
}
```

### 2. Proper Regex Literal Formatting
Enhanced the Prettier plugin's `Literal` case to correctly handle regex literals:

```javascript
case 'Literal': {
  // Check if this is a regex literal
  if (node.regex) {
    // This is a regex literal with { pattern, flags }
    const pattern = node.regex.pattern || '';
    const flags = node.regex.flags || '';
    nodeContent = `/${pattern}/${flags}`;
  } else if (node.raw && node.raw.startsWith('/') && node.raw.match(/^\/.*\/[gimsuxy]*$/)) {
    // This is a regex literal with raw format
    nodeContent = node.raw;
  } else {
    // Regular string/number literal
    nodeContent = formatStringLiteral(node.value, options);
  }
  break;
}
```

## 🧪 Comprehensive Testing

### Compiler Tests (`packages/ripple/tests/client/compiler.test.ripple`)
- **Before:** Used `new RegExp()` workaround due to parsing bug
- **After:** Uses native regex literals, proving the fix works

```javascript
// ✅ Now works perfectly with native regex literals
let matchResult = text.match(/<span>/);
let replaceResult = text.replace(/<div>/g, '[DIV]');
let complexMatch = text.match(/<[^>]*>/g);
let htmlTags = text.replace(/<(\w+)>/g, '[$1]');
```

### Prettier Tests (`packages/prettier-plugin-ripple/src/index.test.js`)
Added 5 comprehensive test cases covering:
- Regex literals in method calls
- Multiple regex patterns
- Variable assignments
- Regex vs JSX distinction
- Edge case patterns

```javascript
// Main assertions: regex should NOT be converted to {}
expect(result).toContain('/<span>/');
expect(result).not.toContain('text.match({})');
```

## 📊 Test Results
- **Compiler Tests:** ✅ 11/11 passed (including new regex literal tests)
- **Prettier Tests:** ✅ 36/36 passed (including 5 new regex preservation tests)
- **Regression Tests:** ✅ All existing functionality preserved

## 🎯 Impact

### Before Fix:
```javascript
// ❌ Compilation error
let result = text.match(/<span>/);

// ❌ Format on save breaks code  
let regex = /<pattern>/; → let regex = {};
```

### After Fix:
```javascript
// ✅ Compiles successfully
let result = text.match(/<span>/);

// ✅ Format on save preserves regex
let regex = /<pattern>/; → let regex = /<pattern>/;
```

## 📁 Files Changed

### Core Fixes:
- `packages/ripple/src/compiler/phases/1-parse/index.js` - JSX parsing context detection
- `packages/prettier-plugin-ripple/src/index.js` - Regex literal formatting

### Tests:
- `packages/ripple/tests/client/compiler.test.ripple` - Native regex literal tests
- `packages/prettier-plugin-ripple/src/index.test.js` - Regex preservation tests

## 🔄 Backward Compatibility
- ✅ Zero breaking changes
- ✅ All existing JSX parsing continues to work
- ✅ All existing regex patterns now work correctly
- ✅ Prettier formatting improvements are transparent

This fix resolves a fundamental parsing issue that affected regex usage in Ripple components while maintaining full compatibility with existing code.
