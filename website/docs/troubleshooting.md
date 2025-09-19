---
title: Troubleshooting in Ripple
---

# Troubleshooting Common Errors

## Unterminated regular expression

While this may be caused by an actual unterminated regular expression, most of
time, it's caused by not putting your DOM text nodes within expression {braces}.

```ripple
export component TextBrace() {
	// ✔️ valid
	<p>{'Hello world!'}</p>

	// ❌ invalid
	// <p>Hello world!</p>
}
```
Read more: [Syntax](/docs/guide/syntax)

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
Read more: [Syntax](/docs/guide/syntax)
