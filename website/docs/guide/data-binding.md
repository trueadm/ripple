---
title: Data-binding in Ripple
---

# {{ $frontmatter.title }}

### Accessor Props

**Advanced Feature**: Ripple provides accessor props for debugging and two-way data binding on composite components using `$prop:={}` syntax (note the colon before equals).

#### Basic Accessor (Getter Only)
```ripple
component Person(props) {
  <div>{"Hello, "}{props.$name}</div>
}

// Accessor syntax requires a function and $ prefix (reactive)
component App() {
  let $name = 'Bob';

  const getName = () => {
    console.log('name accessed'); // Debugging capability
    return $name;
  };

  // Use := instead of = for accessor props
  <Person $name:={getName} />

  // Or inline:
  <Person $name:={() => {
    console.log('name accessed');
    return $name;
  }} />
}
```

#### Two-Way Binding (Getter + Setter)
```ripple
component Person(props) {
  const updateName = (newName) => {
    // Component can directly assign to trigger setter
    props.$name = newName;
  }

  <div>
    <span>{"Hello, "}{props.$name}</span>
    <button onClick={() => updateName("Alice")}>{"Change Name"}</button>
  </div>
}

component App() {
  let $name = 'Bob';

  const getName = () => $name;
  const setName = (newName) => $name = newName;

  // Provide both getter and setter functions
  <Person $name:={getName, setName} />

  // Or inline version:
  <Person $name:={() => $name, (newName) => $name = newName} />
}
```

**Key Rules:**
- Accessor props use `$prop:={}` syntax (colon before equals)
- Props must be `$` prefixed (Ripple considers accessor props reactive)
- Must pass function(s), not direct values
- Single function = getter only (read access + debugging)
- Two functions = getter + setter (separated by comma)
- Component can assign directly to `props.$name` to trigger setter
- Enables debugging prop access and two-way binding patterns
