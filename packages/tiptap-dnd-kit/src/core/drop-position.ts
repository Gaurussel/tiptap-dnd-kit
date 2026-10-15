import type { NodeType, Node as PMNode } from '@tiptap/pm/model'
import { dropPoint } from '@tiptap/pm/transform'
import type { EditorView } from '@tiptap/pm/view'
import { sliceForDrop } from './commit'
import { findDropPosAtY, indexToPos } from './layout'
import { snapToWordBoundary } from './text'
import type { DragLayout, DragSource } from './types'

export interface Point {
    x: number
    y: number
}

const CONTAINER_EDGE = 12

export function canAcceptAt(doc: PMNode, pos: number, type: NodeType): boolean {
    const $pos = doc.resolve(pos)
    const at = $pos.index()
    return $pos.parent.canReplaceWith(at, at, type) || !!$pos.parent.contentMatchAt(at).findWrapping(type)
}

export function resolveSliceDropPos(view: EditorView, source: DragSource, point: Point): number | null {
    // The drop zone may be padded, but posAtCoords returns null outside view.dom.
    const bounds = view.dom.getBoundingClientRect()
    const hit = view.posAtCoords({
        left: Math.min(Math.max(point.x, bounds.left + 1), bounds.right - 1),
        top: Math.min(Math.max(point.y, bounds.top + 1), bounds.bottom - 1),
    })
    if (!hit) return null
    const { doc } = view.state
    const $hit = doc.resolve(hit.pos)
    if (source.kind === 'text' && $hit.parent.inlineContent) return snapToWordBoundary($hit)
    // dropPoint prefers an unwrapped outer slot, so it never yields a position between list items.
    return dropPoint(doc, hit.pos, sliceForDrop(view.state, source, hit.pos)) ?? hit.pos
}

export function resolveBlockDropPos(
    view: EditorView,
    source: DragSource,
    point: Point,
    layout: DragLayout | null,
    nestedDrop: boolean,
): number {
    const topLevel = findDropPosAtY(view, point.y, layout)
    if (!layout || !nestedDrop) return topLevel

    const { doc } = view.state
    const relativeY = point.y - view.dom.getBoundingClientRect().top
    const index = layout.blocks.findIndex(({ top, height }) => relativeY >= top && relativeY < top + height)
    if (index === -1 || index >= doc.childCount) return topLevel

    const pos = indexToPos(doc, index)
    const container = doc.child(index)
    if (pos >= source.from && pos < source.to) return topLevel
    if (container.isTextblock || container.isAtom || !container.type.contentMatch.defaultType) return topLevel

    const { top, height } = layout.blocks[index]
    const edge = Math.min(CONTAINER_EDGE, height / 4)
    if (relativeY < top + edge || relativeY > top + height - edge) return topLevel

    const moved = doc.slice(source.from, source.to).content
    const hit = view.posAtCoords({ left: point.x, top: point.y })
    const movedNode = moved.childCount === 1 ? moved.firstChild : null
    if (!hit || !movedNode) return topLevel
    const $hit = doc.resolve(hit.pos)
    if ($hit.depth < 1 || $hit.before(1) !== pos) return topLevel

    let target = hit.pos
    if ($hit.depth > 1) {
        const childDom = view.nodeDOM($hit.before(2))
        const rect = childDom instanceof HTMLElement ? childDom.getBoundingClientRect() : null
        target = rect && point.y < rect.top + rect.height / 2 ? $hit.before(2) : $hit.after(2)
    }
    return canAcceptAt(doc, target, movedNode.type) ? target : topLevel
}

export function resolveDropPos(
    view: EditorView,
    source: DragSource,
    point: Point,
    options: { layout: DragLayout | null; nestedDrop: boolean; inlineGapClass: string; currentDropPos: number | null },
): number | null {
    if (source.kind === 'block') return resolveBlockDropPos(view, source, point, options.layout, options.nestedDrop)
    // The open gap reflows the line under the pointer; while hovering it, keep the drop point.
    const hovered = document.elementFromPoint(point.x, point.y)
    if (options.currentDropPos !== null && hovered?.closest(`.${options.inlineGapClass}`)) return options.currentDropPos
    return resolveSliceDropPos(view, source, point)
}
