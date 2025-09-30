---
title: Head Management in Ripple
---

# Head Management in Ripple

To manage the content within `<head>`, you may simply use the `<head>` tag
directly within the component. It works with both static and reactive data.

```ripple
export component App() {
	let curr_step = track(0);

	<head>
		<title>{`Step ${@curr_step}`}</title>
	</head>

	<button onClick={() => { @curr_step++ }}>Next Step</button>
}
```
