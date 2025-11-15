---
title: Bindings in Ripple
---

# Bindings

Bindings in Ripple provide a declarative way to synchronize DOM element
properties with reactive state. Instead of manually handling events and updates,
bindings create a two-way connection between your tracked variables and DOM
elements.

::: info
All binding functions require a `Tracked` object as their argument. If you pass
a non-tracked value, they will throw a `TypeError`.
:::

## Form Bindings

### bindValue

The `bindValue` binding creates a two-way connection between a tracked variable
and an input or select element's value.

**For text inputs:**

<Code>

```ripple
import { track, bindValue } from 'ripple';

export component App() {
  let name = track('');

  <div>
    <input type="text" {ref bindValue(name)} placeholder="Enter your name" />
    <p>{'Hello, '}{@name || 'stranger'}{'!'}</p>
    <button onClick={() => @name = ''}>{'Clear'}</button>
  </div>
}
```

</Code>

**For number inputs:**

<Code>

```ripple
import { track, bindValue } from 'ripple';

export component App() {
  let age = track(0);

  <div>
    <input type="number" {ref bindValue(age)} min="0" max="120" />
    <p>{'Age: '}{@age}{' years old'}</p>
    <button onClick={() => @age = @age + 1}>{'Increment'}</button>
  </div>
}
```

</Code>

**For select elements:**

<Code>

```ripple
import { track, bindValue } from 'ripple';

export component App() {
  let selectedFruit = track('apple');

  <div>
    <select {ref bindValue(selectedFruit)}>
      <option value="apple">{'Apple'}</option>
      <option value="banana">{'Banana'}</option>
      <option value="cherry">{'Cherry'}</option>
      <option value="durian">{'Durian'}</option>
    </select>
    <p>{'You selected: '}{@selectedFruit}</p>
  </div>
}
```

</Code>

**For multiple select:**

<Code>

```ripple
import { track, bindValue } from 'ripple';

export component App() {
  let selectedColors = track(['red', 'blue']);

  <div>
    <select multiple {ref bindValue(selectedColors)} style="height: 100px">
      <option value="red">{'Red'}</option>
      <option value="green">{'Green'}</option>
      <option value="blue">{'Blue'}</option>
      <option value="yellow">{'Yellow'}</option>
    </select>
    <p>{'Selected colors: '}{@selectedColors.join(', ')}</p>
  </div>
}
```

</Code>

### bindChecked

The `bindChecked` binding synchronizes a checkbox's checked state with a
tracked boolean value.

<Code>

```ripple
import { track, bindChecked } from 'ripple';

export component App() {
  let agreed = track(false);

  <div>
    <label>
      <input type="checkbox" {ref bindChecked(agreed)} />
      {' I agree to the terms and conditions'}
    </label>
    <p>{'Status: '}{@agreed ? 'Agreed' : 'Not agreed'}</p>
    <button disabled={!@agreed}>{'Submit'}</button>
  </div>
}
```

</Code>

::: info Note

- `bindChecked` only supports individual checkbox boolean binding. For checkbox
  groups or radio buttons, use `bindGroup` instead.

- For `radio` inputs, use `bindGroup` instead of `bindChecked`.
  :::

### bindIndeterminate

The `bindIndeterminate` binding synchronizes a checkbox's indeterminate state
with a tracked boolean value. The indeterminate state is commonly used for
"select all" checkboxes when only some (but not all) child items are selected.

<Code>

```ripple
import { track, bindChecked, bindIndeterminate } from 'ripple';

export component App() {
  let checked = track(false);
  let indeterminate = track(true);

  <div>
    <label>
      <input
        type="checkbox"
        {ref bindChecked(checked)}
        {ref bindIndeterminate(indeterminate)}
      />
      {' Select All'}
    </label>
    <p>{'Checked: '}{@checked ? 'Yes' : 'No'}</p>
    <p>{'Indeterminate: '}{@indeterminate ? 'Yes' : 'No'}</p>
    <button onClick={() => {
      @indeterminate = !@indeterminate;
      if (@indeterminate) {
        @checked = false;
      }
    }}>
      {'Toggle Indeterminate'}
    </button>
  </div>
}
```

</Code>

::: info Note

- The indeterminate state is purely visual and doesn't affect the checkbox's checked value.
- You can combine `bindIndeterminate` with `bindChecked` on the same checkbox.
- Common use case: "Select All" checkboxes when some (but not all) items are selected.
  :::

### bindGroup

The `bindGroup` binding allows you to bind a group of checkboxes to an array
or a group of radio buttons to a single value. This is essential for handling
multiple selections or mutually exclusive choices.

**For checkbox groups (array binding):**

<Code>

```ripple
import { track, bindGroup } from 'ripple';

export component App() {
  let hobbies = track(['reading']);

  <div>
    <label>
      <input type="checkbox" value="reading" {ref bindGroup(hobbies)} />
      {' Reading'}
    </label>
    <label>
      <input type="checkbox" value="gaming" {ref bindGroup(hobbies)} />
      {' Gaming'}
    </label>
    <label>
      <input type="checkbox" value="sports" {ref bindGroup(hobbies)} />
      {' Sports'}
    </label>
    <label>
      <input type="checkbox" value="cooking" {ref bindGroup(hobbies)} />
      {' Cooking'}
    </label>
    <p>{'Selected: '}{@hobbies.join(', ') || 'none'}</p>
  </div>

  <button onClick={() => @hobbies = ['reading']}>{'Reset'}</button>
}
```

</Code>

**For radio button groups (value binding):**

<Code>

```ripple
import { track, bindGroup } from 'ripple';

export component App() {
  let size = track('medium');

  <div>
    <label>
      <input type="radio" name="size" value="small" {ref bindGroup(size)} />
      {' Small'}
    </label>
    <label>
      <input type="radio" name="size" value="medium" {ref bindGroup(size)} />
      {' Medium'}
    </label>
    <label>
      <input type="radio" name="size" value="large" {ref bindGroup(size)} />
      {' Large'}
    </label>
    <p>{'Selected size: '}{@size}</p>
  </div>

  <button onClick={() => @size = 'medium'}>{'Reset to "medium"'}</button>
}
```

</Code>

::: info Note

- **Checkboxes**: The tracked value should be an array. Checked boxes add
  their values to the array.
- **Radio buttons**: The tracked value should be a single value matching one
  of the radio button values.
- Ripple's `bindGroup` doesn't require inputs to be in the
  same component since it uses per-binding instance groups.
  :::

## Dimension Bindings

### bindClientWidth / bindClientHeight

These bindings track the inner dimensions of an element (excluding borders
and scrollbars).

<Code>

```ripple
import { track, bindClientWidth, bindClientHeight } from 'ripple';

export component App() {
  let width = track(0);
  let height = track(0);

  <div>
    <div
      {ref bindClientWidth(width)}
      {ref bindClientHeight(height)}
      style={{
        resize: 'both',
        overflow: 'auto',
        border: '2px solid blue',
        padding: '20px',
        minWidth: '200px',
        minHeight: '100px'
      }}
    >
      {'Resize me! (drag bottom-right corner)'}
      <p>{'Client Width: '}{@width}{'px'}</p>
      <p>{'Client Height: '}{@height}{'px'}</p>
    </div>
  </div>
}
```

</Code>

### bindOffsetWidth / bindOffsetHeight

These bindings track the full outer dimensions of an element (including
borders).

<Code>

```ripple
import { track, bindOffsetWidth, bindOffsetHeight } from 'ripple';

export component App() {
  let width = track(0);
  let height = track(0);

  <div>
    <div
      {ref bindOffsetWidth(width)}
      {ref bindOffsetHeight(height)}
      style={{
        border: '10px solid green',
        padding: '20px',
        width: '300px',
        height: '150px'
      }}
    >
      {'Box with borders'}
    </div>
    <p>{'Offset Width: '}{@width}{'px (includes borders)'}</p>
    <p>{'Offset Height: '}{@height}{'px (includes borders)'}</p>
  </div>
}
```

</Code>

## ResizeObserver Bindings

### bindContentRect

Tracks the element's content rectangle from the ResizeObserver API.

<Code>

```ripple
import { track, bindContentRect } from 'ripple';

export component App() {
  let rect = track({ width: 0, height: 0, top: 0, left: 0 });

  <div>
    <div
      {ref bindContentRect(rect)}
      style={{
        resize: 'both',
        overflow: 'auto',
        border: '2px solid purple',
        padding: '20px',
        minWidth: '200px',
        minHeight: '100px'
      }}
    >
      {'Resize me!'}
    </div>
    <pre>{JSON.stringify(@rect, null, 2)}</pre>
  </div>
}
```

</Code>

### bindContentBoxSize

Tracks the content box size (without padding or borders).

<Code>

```ripple
import { track, bindContentBoxSize } from 'ripple';

export component App() {
  let size = track([]);

  <div>
    <div
      {ref bindContentBoxSize(size)}
      style={{
        border: '5px solid orange',
        padding: '15px',
        width: '250px',
        height: '100px'
      }}
    >
      {'Content box size'}
    </div>
    <pre>
      {'Block size: '}{@size[0]?.blockSize || 0}{'px\n'}
      {'Inline size: '}{@size[0]?.inlineSize || 0}{'px'}
    </pre>
  </div>
}
```

</Code>

### bindBorderBoxSize

Tracks the border box size (including padding and borders).

<Code>

```ripple
import { track, bindBorderBoxSize } from 'ripple';

export component App() {
  let size = track([]);

  <div>
    <div
      {ref bindBorderBoxSize(size)}
      style={{
        border: '5px solid teal',
        padding: '15px',
        width: '250px',
        height: '100px'
      }}
    >
      {'Border box size'}
    </div>
    <pre>
      {'Block size: '}{@size[0]?.blockSize || 0}{'px\n'}
      {'Inline size: '}{@size[0]?.inlineSize || 0}{'px'}
    </pre>
  </div>
}
```

</Code>

### bindDevicePixelContentBoxSize

Tracks the content box size in device pixels (useful for high-DPI
displays).

<Code>

```ripple
import { track, bindDevicePixelContentBoxSize } from 'ripple';

export component App() {
  let size = track([]);

  <div>
    <div
      {ref bindDevicePixelContentBoxSize(size)}
      style={{
        border: '3px solid crimson',
        padding: '10px',
        width: '200px',
        height: '80px'
      }}
    >
      {'Device pixel content box'}
    </div>
    <pre>
      {'Block size: '}{@size[0]?.blockSize || 0}{'px\n'}
      {'Inline size: '}{@size[0]?.inlineSize || 0}{'px'}
    </pre>
  </div>
}
```

</Code>

## Content Editable Bindings

### bindInnerHTML

Binds to an element's innerHTML property, useful for rich text editors.

<Code>

```ripple
import { track, bindInnerHTML } from 'ripple';

export component App() {
  let content = track('<strong>Bold text</strong>');

  <div>
    <div
      contentEditable={true}
      {ref bindInnerHTML(content)}
      style={{
        border: '1px solid gray',
        padding: '10px',
        minHeight: '50px'
      }}
    />
    <p>{'Raw HTML:'}</p>
    <pre>{@content}</pre>
  </div>
}
```

</Code>

### bindInnerText

Binds to an element's innerText property (text with line breaks, no
HTML).

<Code>

```ripple
import { track, bindInnerText } from 'ripple';

export component App() {
  let text = track('Edit me!');

  <div>
    <div
      contentEditable={true}
      {ref bindInnerText(text)}
      style={{
        border: '1px solid gray',
        padding: '10px',
        minHeight: '50px'
      }}
    />
    <p>{'Text content: '}{@text}</p>
  </div>
}
```

</Code>

### bindTextContent

Binds to an element's textContent property (raw text, no
formatting).

<Code>

```ripple
import { track, bindTextContent } from 'ripple';

export component App() {
  let text = track('Type here');

  <div>
    <div
      contentEditable={true}
      {ref bindTextContent(text)}
      style={{
        border: '1px solid gray',
        padding: '10px',
        minHeight: '50px',
        whiteSpace: 'pre-wrap'
      }}
    />
    <p>{'Text content: '}{@text}</p>
  </div>
}
```

</Code>

## Element Reference Binding

### bindNode

A convenient way to get a reference to a DOM element.

<Code>

```ripple
import { track, bindNode } from 'ripple';

export component App() {
  let divElement = track();

  const handleFocus = () => {
    if (@divElement) {
      @divElement.focus();
      @divElement.style.backgroundColor = 'lightblue';
    }
  };

  <div>
    <div
      {ref bindNode(divElement)}
      tabIndex={0}
      style={{
        border: '2px solid navy',
        padding: '20px',
        outline: 'none'
      }}
    >
      {'Click the button to focus this div'}
    </div>
    <button onClick={handleFocus}>{'Focus Div'}</button>
  </div>
}
```

</Code>

## Combining Multiple Bindings

You can use multiple bindings on the same element by applying multiple
`{ref}` attributes:

<Code>

```ripple
import { track, bindValue, bindClientWidth, bindNode } from 'ripple';

export component App() {
  let text = track('');
  let width = track(0);
  let inputElement = track();

  const logInfo = () => {
    console.log('Input:', @inputElement);
    console.log('Value:', @text);
    console.log('Width:', @width);
  };

  <div>
    <input
      type="text"
      {ref bindValue(text)}
      {ref bindClientWidth(width)}
      {ref bindNode(inputElement)}
      placeholder="Type something..."
      style="width: 300px"
    />
    <p>{'Text: '}{@text}</p>
    <p>{'Width: '}{@width}{'px'}</p>
    <button onClick={logInfo}>{'Log Info'}</button>
  </div>
}
```

</Code>

## Best Practices

1. **Always use tracked variables**: All binding functions require `Tracked`
   objects created with `track()`.

2. **Cleanup is automatic**: Bindings automatically handle cleanup when
   elements are removed from the DOM.

3. **Performance**: Bindings use efficient observers (ResizeObserver for
   dimensions) with singleton patterns to minimize overhead.

4. **Type safety**: For number inputs, `bindValue` automatically converts
   values to numbers.

5. **Multiple refs**: You can apply multiple `{ref}` attributes to the same
   element for different bindings.
