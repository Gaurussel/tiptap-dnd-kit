# tiptap-dnd-kit

Headless drag-and-drop for Tiptap built on [@dnd-kit/dom](https://dndkit.com). Every drag inside the document goes
through dnd-kit instead of ProseMirror's native HTML5 drag-and-drop: blocks by a handle (mouse and keyboard),
selected text and nodes, images and other atoms. Neighbouring blocks make room, text opens a gap, spacing is fixed
up automatically and blocks can be dropped into lists. dnd-kit never touches the editor DOM: everything shown inside
the editor is a ProseMirror decoration.

**[Live demo](https://gaurussel.github.io/tiptap-dnd-kit/)** · [GitHub](https://github.com/Gaurussel/tiptap-dnd-kit)

## Install

```bash
npm i tiptap-dnd-kit @dnd-kit/dom
```

## Core

```ts
import { DndKit } from 'tiptap-dnd-kit'

new Editor({ extensions: [StarterKit, DndKit.configure({ features: { smartSpacing: true } })] })

editor.commands.disableDnd() // enableDnd / toggleDnd
editor.setEditable(false) // dnd turns off automatically

const controller = editor.storage.dndKit.controller
const unbind = controller.bindHandle(myElement) // any element becomes the handle of the hovered block
controller.subscribe((state) => render(state.hoveredBlock))
```

## React

The library ships no components: the handle and the preview are always yours, the hooks only connect them to the
editor.

```tsx
import { createPortal } from 'react-dom'
import { useDndState, useDragHandle, useDragPreview } from 'tiptap-dnd-kit/react'

function MyHandle({ editor }) {
    const { ref, block, isDragging } = useDragHandle(editor) // block.dom is the hovered block
    return <button ref={ref} style={myPosition(block)}>⋮⋮</button>
}

function MyPreview({ editor }) {
    const target = useDragPreview(editor) // { source, container } while dragging
    return target ? createPortal(<Card kind={target.source.kind} />, target.container) : null
}

const state = useDndState(editor) // enabled, phase, hoveredBlock, source
```

## Styling

The package ships no CSS. It only sets functional inline styles: it hides landing content while the preview flies
to it, sizes the text gap and adds the shift transition (no animation with `features.animations: false` or
`prefers-reduced-motion`). Everything visual hooks into these classes (renamable through the `classes` option):

| Class / attribute | What it is |
|---|---|
| `.dnd-kit-source`, `.dnd-kit-source-inline` | the dragged block / text |
| `.dnd-kit-landing`, `.dnd-kit-landing-inline` | inserted content while the preview flies to it |
| `.dnd-kit-inline-gap` | the gap opened in text at the drop point |
| `.dnd-kit-drop-line` | the block drop line (a fixed element outside the editor; you set its height and colour) |
| `.dnd-kit-preview` | the container of the preview that follows the pointer |
| `[data-dnd-kit-drag="block" \| "node" \| "blocks" \| "text"]` | set on the editor while dragging |

```css
.dnd-kit-source, .dnd-kit-source-inline { opacity: 0.25; }
.dnd-kit-inline-gap::before { content: ''; position: absolute; left: 0; top: -0.15em; bottom: -0.25em; width: 2px; background: #2f6fed; }
.dnd-kit-drop-line { height: 2px; background: #2f6fed; }
.dnd-kit-preview { background: #fff; border-radius: 6px; box-shadow: 0 6px 24px rgb(0 0 0 / 0.14); }
```

## Options

| Option | Default | Purpose |
|---|---|---|
| `enabled` | `true` | Initial state |
| `manager` | `null` | Share the app's `DragDropManager` |
| `features` | all `true` | `selectionDrag`, `atomDrag`, `nestedDrop`, `smartSpacing`, `animations` |
| `classes` | `dnd-kit-*` | Your own class names for source, landing, gap, line and preview |
| `renderPreview` / `renderDropLine` | `null` | Your own DOM for the preview and the line |
| `dropAnimation` | `220ms` | Duration and easing of the drop flight |
| `hoverArea` | the editor's parent | Where block hover is tracked; also the drop zone. Must contain the handle, otherwise the handle hides while the pointer moves to it |
| `canDrag` / `canDrop` | `null` | Forbid a drag or a specific drop point |
| `onDragStart` / `onDrop` / `onDragEnd` | `null` | `onDrop` may return its own transaction or `false` |

## Limitations

- Gaps between top-level blocks must not depend on their neighbours: inner margins must not collapse outward.
- Nested drops only target the first level of a list or a quote.
- Text cannot be dragged out to other applications: native drag-and-drop inside the editor is replaced.
- With a shared `manager`, remove the `PreventSelection` plugin from it: it clears the DOM selection on every
  `selectionchange`, which makes the selection highlight blink.

## License

[MIT](LICENSE)
