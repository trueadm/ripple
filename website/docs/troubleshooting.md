---
title: Troubleshooting in Ripple
---

# Troubleshooting Common Errors

## Unexpected token `}`. Did you mean `&rbrace;` or `{"}"}`?

If you've verified that you don't have any unclosed braces and are still
encountering this, check for any usage of void elements that aren't using JSX
self-closing syntax.

```ripple
export component Bracey() {
	// ✔️ valid
	<input />
	<img />
	<hr />
	<br />

	// ❌ invalid
	// <input>
	// <img>
	// <hr>
	// <br>
}
```
