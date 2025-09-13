---
title: Components in Ripple
---

# Components


### Children Components

Use `$children` prop for component composition:

```ripple
import type { Component } from 'ripple';

component Card(props: { $children: Component }) {
  <div class="card">
    <$children />
  </div>
}

// Usage
<Card>
  <p>{"Card content here"}</p>
</Card>
```

### Prop Shortcuts
```ripple
// Object spread
<div {...properties}>{"Content"}</div>

// Shorthand props (when variable name matches prop name)
<div {onClick} {className}>{"Content"}</div>

// Equivalent to:
<div onClick={onClick} className={className}>{"Content"}</div>
```
