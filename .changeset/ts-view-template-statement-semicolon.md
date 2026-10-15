---
'@tsrx/ripple': patch
---

A template element or fragment whose output is unused, such as `<div />;` or the
body of `if (x) <div />`, now keeps its `;` in editor output. Before, the editor
showed a TypeScript syntax error (`JSX expressions must have one parent element`
or `';' expected`) next to the real "template output is unused" error.
