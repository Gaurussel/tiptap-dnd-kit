import type { Node as PMNode } from '@tiptap/pm/model'
import type { EditorView } from '@tiptap/pm/view'
import type { DragLayout, HoveredBlock } from './types'

export function getTopLevelBlocks(view: EditorView): HoveredBlock[] {
    const result: HoveredBlock[] = []
    view.state.doc.forEach((node, pos) => {
        const dom = view.nodeDOM(pos)
        if (dom instanceof HTMLElement) result.push({ pos, node, dom })
    })
    return result
}

export function findBlockAtY(view: EditorView, y: number): HoveredBlock | null {
    let closest: HoveredBlock | null = null
    let closestDistance = Infinity
    for (const block of getTopLevelBlocks(view)) {
        const { top, bottom } = block.dom.getBoundingClientRect()
        const distance = y < top ? top - y : y > bottom ? y - bottom : 0
        if (distance < closestDistance) {
            closest = block
            closestDistance = distance
        }
    }
    return closest
}

// Must run before any drag transforms are applied: shifts and drop slots are derived from this untransformed snapshot.
export function measureLayout(view: EditorView): DragLayout {
    const origin = view.dom.getBoundingClientRect().top
    const doms = getTopLevelBlocks(view).map(({ dom }) => dom)
    const blocks = doms.map((dom) => {
        const { top, height } = dom.getBoundingClientRect()
        return { top: top - origin, height }
    })
    const last = doms.at(-1)
    const end = last
        ? last.getBoundingClientRect().bottom - origin + parseFloat(getComputedStyle(last).marginBottom)
        : 0
    return { blocks, end }
}

export function indexToPos(doc: PMNode, index: number): number {
    let pos = 0
    for (let i = 0; i < index; i++) pos += doc.child(i).nodeSize
    return pos
}

export function findDropPosAtY(view: EditorView, y: number, layout: DragLayout | null): number {
    const { doc } = view.state
    if (!layout || layout.blocks.length !== doc.childCount) {
        for (const block of getTopLevelBlocks(view)) {
            const { top, height } = block.dom.getBoundingClientRect()
            if (y < top + height / 2) return block.pos
        }
        return doc.content.size
    }
    const relativeY = y - view.dom.getBoundingClientRect().top
    const index = layout.blocks.findIndex(({ top, height }) => relativeY < top + height / 2)
    return index === -1 ? doc.content.size : indexToPos(doc, index)
}

export function computeShifts({ blocks, end }: DragLayout, sourceStart: number, sourceEnd: number, dropIndex: number) {
    const top = (i: number) => (i < blocks.length ? blocks[i].top : end)
    const stride = top(sourceEnd) - top(sourceStart)
    const shifts = new Map<number, number>()
    if (dropIndex > sourceEnd) {
        for (let i = sourceEnd; i < dropIndex; i++) shifts.set(i, -stride)
        for (let i = sourceStart; i < sourceEnd; i++) shifts.set(i, top(dropIndex) - top(sourceEnd))
    } else if (dropIndex < sourceStart) {
        for (let i = dropIndex; i < sourceStart; i++) shifts.set(i, stride)
        for (let i = sourceStart; i < sourceEnd; i++) shifts.set(i, top(dropIndex) - top(sourceStart))
    }
    return shifts
}
