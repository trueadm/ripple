---
title: Reactivity in Ripple
---

# {{ $frontmatter.title }}

## Control Flow

### If Statements
```ripple
component Conditional({ $isVisible }) {
  <div>
    if ($isVisible) {
      <span>{"Visible content"}</span>
    } else {
      <span>{"Hidden state"}</span>
    }
  </div>
}
```

### Async (Suspense boundaries)
```ripple
component SuspenseBoundary() {
	try {
		<AsyncComponent />
	} async {
		<p>Loading...</p> // fallback
	}
}
```


### For Loops
```ripple
component List({ items }) {
  <ul>
    for (const item of items) {
      <li>{item.text}</li>
    }
  </ul>
}
```

### Try-Catch (Error Boundaries)
```ripple
component ErrorBoundary() {
  <div>
    try {
      <ComponentThatMightFail />
    } catch (e) {
      <div>{"Error: "}{e.message}</div>
    }
  </div>
}
```
