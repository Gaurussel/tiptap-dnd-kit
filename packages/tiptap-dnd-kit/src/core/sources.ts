import { type EditorState, NodeSelection, Selection, TextSelection } from '@tiptap/pm/state'
import { blockText, wordBounds } from './text'
import type { DragSource } from './types'

export function sourceFromSelection(state: EditorState): DragSource | null {
    const { selection } = state
    if (selection.empty) return null
    if (selection instanceof NodeSelection) return { kind: 'node', from: selection.from, to: selection.to }

    const { $from } = selection
    let { $to } = selection
    // Chrome's triple-click selection ends at the start of the next block.
    if ($to.parentOffset === 0 && $to.depth > 0 && $to.pos > $from.pos) {
        const $end = Selection.near(state.doc.resolve($to.before()), -1).$to
        if ($end.pos > $from.pos) $to = $end
    }

    const coversWholeBlocks =
        $from.parent.isTextblock &&
        $to.parent.isTextblock &&
        $from.depth === $to.depth &&
        $from.depth > 0 &&
        $from.parentOffset === 0 &&
        $to.parentOffset === $to.parent.content.size &&
        $from.node($from.depth - 1) === $to.node($to.depth - 1)
    if (coversWholeBlocks) return { kind: 'blocks', from: $from.before(), to: $to.after() }

    return { kind: 'text', from: $from.pos, to: $to.pos }
}

export function asTopLevelBlocks(state: EditorState, source: DragSource): DragSource {
    if (source.kind !== 'node' && source.kind !== 'blocks') return source
    const topLevel = state.doc.resolve(source.from).depth === 0 && state.doc.resolve(source.to).depth === 0
    return topLevel ? { ...source, kind: 'block' } : source
}

export function sourceForBlock(state: EditorState, pos: number): DragSource | null {
    const node = state.doc.nodeAt(pos)
    if (!node) return null
    return { kind: state.doc.resolve(pos).depth === 0 ? 'block' : 'node', from: pos, to: pos + node.nodeSize }
}

export function selectionForClick(state: EditorState, pressed: DragSource, pos: number, clickCount: number): Selection {
    const pressedNode = state.doc.nodeAt(pressed.from)
    if (pressed.kind === 'node' && pressedNode?.isAtom) return NodeSelection.create(state.doc, pressed.from)
    const $pos = state.doc.resolve(pos)
    if (!$pos.parent.isTextblock) return TextSelection.near($pos)
    if (clickCount >= 3) return TextSelection.create(state.doc, $pos.start(), $pos.end())
    if (clickCount === 2) {
        const { start, end } = wordBounds(blockText($pos.parent), $pos.parentOffset)
        if (start < end) return TextSelection.create(state.doc, $pos.start() + start, $pos.start() + end)
    }
    return TextSelection.create(state.doc, pos)
}
