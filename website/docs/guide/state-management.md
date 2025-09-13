---
title: State management in Ripple
---

# {{ $frontmatter.title }}

### Context
```ripple
import { createContext } from 'ripple';

const ThemeContext = createContext('light');

component Child() {
  const theme = ThemeContext.get();
  <div class={theme}>{"Themed content"}</div>
}

component Parent() {
  ThemeContext.set('dark');
  <Child />
}
```
