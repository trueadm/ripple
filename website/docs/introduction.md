---
title: Introduction
---

# Introduction

Ripple is an elegant, compiler-driven language and view library for the web
based on a superset of JSX, by Dominic Gannaway ([@trueadm](https://github.com/trueadm)).

Like JSX, Ripple is a JS-forward language. It extends JSX to allow for DOM
elements to be written as statements, rather than expressions.

<Code>

```ripple
import { track } from 'ripple'

export component App() {
  <div class="container">
    <h1>{"Welcome to Ripple!"}</h1>

    <div>
      let count = track(0);

      <button onClick={() => @count--}>{"-"}</button>
      <span class="count">{@count}</span>
      <button onClick={() => @count++}>{"+"}</button>
    </div>
  </div>

  <style>
    .container {
      text-align: center;
      font-family: "Arial", sans-serif;
    }

    button {
      height: 2rem;
      width: 2rem;
      margin: 1rem;
    }
  </style>
}
```

</Code>

::: info Prerequisites

The rest of the documentation assumes basic familiarity with HTML, CSS, and
JavaScript. If you are totally new to frontend development, it might not be the
best idea to jump right into a framework as your first step - grasp the basics
and then come back! You can check your knowledge level with these overviews for
[JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript/A_re-introduction_to_JavaScript),
[HTML](https://developer.mozilla.org/en-US/docs/Learn/HTML/Introduction_to_HTML)
and [CSS](https://developer.mozilla.org/en-US/docs/Learn/CSS/First_steps) if
needed. Prior experience with other frameworks helps, but is not required.
:::

## Features

- **Performant**: Fine-grained rendering with industry-leading performance and memory usage
- **TypeScript-first**: Full TypeScript integration with type checking
- **JSX-like syntax**: Familiar templating with Ripple-specific enhancements
- **Reactive-first**: Reactivity is a built-in language feature
- **Component-based**: Clean, reusable components with props and children

::: info Please Note!
Ripple is a new project, and is not production-ready.
:::

## Missing Features

- **SSR**: Ripple is currently an SPA only, this is because I haven't gotten around to it
