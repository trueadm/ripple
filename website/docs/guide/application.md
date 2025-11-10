---
title: Creating a Ripple application
---

# Creating a Ripple application

We'll start with this code snippet, and break it down step by step.

```js
import { mount } from 'ripple';
// @ts-expect-error: known issue, we're working on it
import { App } from './App.ripple';

mount(App, {
	target: document.getElementById('app')!,
});
```

## The Root Component

The `App` "object" we've imported is actually a component. Every app requires a
"root component" that can contain other components as its children.

While many examples in this guide only need a single component, most real
applications are organized into a tree of nested, reusable components. For
example, a Todo application's component tree might look like this:

```text
App (root component)
├─ TodoList
│  └─ TodoItem
│     ├─ TodoDeleteButton
│     └─ TodoEditButton
└─ TodoFooter
   ├─ TodoClearButton
   └─ TodoStatistics
```

In later sections of the guide, we will discuss how to define and compose
multiple components together. Before that, we will focus on what happens inside
a single component.

## Mounting the App

To bring the app to life, we'll use the `mount` function that we imported to
attach the application to the DOM.

`mount()` expects a component, and an options object. Inside the options object,
we'll use `document.getElementById()` to acquire a reference to the DOM element
we want the app to be attached to the `target` property.
