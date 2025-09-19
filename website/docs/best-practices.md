---
title: Best Practices in Ripple
---

<!-- TODO: Elaborate -->
# Best Practices
A summary:

1. **Reactivity**: Use `track()` to create reactive variables and `@` to access them
2. **Strings**: Wrap string literals in `{"string"}` within templates
3. **Effects**: Use `effect()` for side effects, not direct reactive variable access
4. **Components**: Keep components focused and use TypeScript interfaces for props
5. **Styling**: Use scoped `<style>` elements for component-specific styles
6. **Collections**: Use RippleArray/RippleSet for reactive collections instead of regular arrays/sets
