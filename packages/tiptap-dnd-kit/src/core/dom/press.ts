import { NodeSelection } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import { sourceFromSelection } from '../sources'
import type { DndKitFeatures, DragSource } from '../types'
import { isPointInRange } from './geometry'

export function atomBlockAt(view: EditorView, target: Element): DragSource | null {
    const pos = view.posAtDOM(target, 0)
    const node = view.state.doc.nodeAt(pos)
    const dom = view.nodeDOM(pos)
    if (!node?.isAtom || !node.isBlock || !NodeSelection.isSelectable(node)) return null
    if (!(dom instanceof Element) || !dom.contains(target)) return null
    return { kind: 'node', from: pos, to: pos + node.nodeSize }
}

const INTERACTIVE =
    'input, textarea, select, button, [contenteditable="true"], [data-resize-handle], [data-drag-handle]'

// view.dom itself is contenteditable, so only elements strictly inside it count.
function isInteractive(view: EditorView, target: Element): boolean {
    for (let element: Element | null = target; element && element !== view.dom; element = element.parentElement) {
        if (element.matches(INTERACTIVE)) return true
    }
    return false
}

export function pressedSource(view: EditorView, event: MouseEvent, features: DndKitFeatures): DragSource | null {
    if (!view.editable || !(event.target instanceof Element) || !view.dom.contains(event.target)) return null
    if (isInteractive(view, event.target)) return null
    if (features.selectionDrag) {
        const selected = sourceFromSelection(view.state)
        if (selected) {
            const onSelection =
                view.state.selection instanceof NodeSelection
                    ? (view.nodeDOM(selected.from) as Node | null)?.contains(event.target)
                    : isPointInRange(view, selected, event.clientX, event.clientY)
            if (onSelection) return selected
        }
    }
    return features.atomDrag ? atomBlockAt(view, event.target) : null
}
