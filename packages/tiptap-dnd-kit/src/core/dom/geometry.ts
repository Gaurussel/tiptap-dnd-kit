import type { EditorView } from '@tiptap/pm/view'
import type { DragRange } from '../types'

function toDOMRange(view: EditorView, { from, to }: DragRange): Range {
    const start = view.domAtPos(from, 1)
    const end = view.domAtPos(to, -1)
    const range = document.createRange()
    range.setStart(start.node, start.offset)
    range.setEnd(end.node, end.offset)
    return range
}

export function getRangeRect(view: EditorView, range: DragRange): DOMRect | null {
    const node = view.state.doc.nodeAt(range.from)
    const dom = view.nodeDOM(range.from)
    if (node && node.nodeSize === range.to - range.from && dom instanceof HTMLElement)
        return dom.getBoundingClientRect()
    const rect = toDOMRange(view, range).getBoundingClientRect()
    return rect.width || rect.height ? rect : null
}

export function isPointInRange(view: EditorView, range: DragRange, x: number, y: number): boolean {
    return Array.from(toDOMRange(view, range).getClientRects()).some(
        (rect) => x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom,
    )
}

export function blockLineRect(view: EditorView, pos: number): { left: number; width: number; y: number } | null {
    const $pos = view.state.doc.resolve(pos)
    const beforeDom = $pos.nodeBefore ? view.nodeDOM(pos - $pos.nodeBefore.nodeSize) : null
    const afterDom = $pos.nodeAfter ? view.nodeDOM(pos) : null
    const before = beforeDom instanceof HTMLElement ? beforeDom.getBoundingClientRect() : null
    const after = afterDom instanceof HTMLElement ? afterDom.getBoundingClientRect() : null
    const ref = after ?? before
    if (!ref) return null
    const y = before && after ? (before.bottom + after.top) / 2 : after ? after.top - 4 : ref.bottom + 4
    return { left: ref.left, width: ref.width, y }
}
