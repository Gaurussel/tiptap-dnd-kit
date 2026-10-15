import { type Node as PMNode, Slice } from '@tiptap/pm/model'
import { type EditorState, NodeSelection, TextSelection, type Transaction } from '@tiptap/pm/state'
import { isNoopDrop } from './state'
import { charAt, WORD_CHAR } from './text'
import type { DragRange, DragSource } from './types'

export interface MoveResult {
    tr: Transaction
    landing: DragRange
}

// Open text slices dropped between blocks get stitched into whatever neighbours the fitter finds; insert whole blocks.
export function sliceForDrop(state: EditorState, source: DragRange, dropPos: number): Slice {
    const slice = state.doc.slice(source.from, source.to)
    const intoText = state.doc.resolve(dropPos).parent.inlineContent
    return intoText || (!slice.openStart && !slice.openEnd) ? slice : new Slice(slice.content, 0, 0)
}

function smartRemovalRange(doc: PMNode, { from, to }: DragRange): DragRange {
    const before = charAt(doc, from - 1)
    const after = charAt(doc, to)
    if (after === ' ' && (before === ' ' || before === '')) return { from, to: to + 1 }
    if (before === ' ' && (after === '' || /[\s.,!?;:)]/.test(after))) return { from: from - 1, to }
    return { from, to }
}

export function buildMoveTransaction(
    state: EditorState,
    source: DragSource,
    dropPos: number,
    options: { smartSpacing: boolean },
): MoveResult | null {
    if (isNoopDrop(source, dropPos)) return null
    const { doc } = state
    const slice = sliceForDrop(state, source, dropPos)
    const tr = state.tr
    const inlineMove = source.kind === 'text' && doc.resolve(source.from).sameParent(doc.resolve(source.to))

    if (inlineMove) {
        const removal = options.smartSpacing ? smartRemovalRange(doc, source) : source
        tr.delete(removal.from, removal.to)
    } else if (source.kind === 'text') {
        TextSelection.create(doc, source.from, source.to).replace(tr)
    } else if (source.kind === 'blocks' || source.kind === 'node') {
        tr.deleteRange(source.from, source.to)
    } else {
        tr.delete(source.from, source.to)
    }

    const insertPos = tr.mapping.map(dropPos)
    const node =
        slice.openStart === 0 && slice.openEnd === 0 && slice.content.childCount === 1 ? slice.content.firstChild : null
    const $insert = tr.doc.resolve(insertPos)
    const at = $insert.index()
    // replaceRangeWith would hop out of a list via insertPoint instead of wrapping the node in a list item.
    const wrapping =
        node && !$insert.parent.canReplaceWith(at, at, node.type)
            ? $insert.parent.contentMatchAt(at).findWrapping(node.type)
            : null
    if (node && wrapping)
        tr.insert(
            insertPos,
            wrapping.reduceRight<PMNode>((inner, type) => type.create(null, inner), node),
        )
    else if (node) tr.replaceRangeWith(insertPos, insertPos, node)
    else tr.replaceRange(insertPos, insertPos, slice)

    let landing: DragRange = { from: insertPos, to: insertPos }
    tr.mapping.maps[tr.mapping.maps.length - 1].forEach((_oldFrom, _oldTo, from, to) => {
        landing = { from, to }
    })
    if (wrapping) landing = { from: landing.from + wrapping.length, to: landing.to - wrapping.length }

    if (inlineMove && options.smartSpacing && tr.doc.resolve(landing.from).parent.inlineContent) {
        if (WORD_CHAR.test(charAt(tr.doc, landing.to))) tr.insert(landing.to, state.schema.text(' '))
        if (WORD_CHAR.test(charAt(tr.doc, landing.from - 1))) {
            tr.insert(landing.from, state.schema.text(' '))
            landing = { from: landing.from + 1, to: landing.to + 1 }
        }
    }

    const inserted = tr.doc.nodeAt(landing.from)
    tr.setSelection(
        node && inserted && NodeSelection.isSelectable(inserted) && inserted.nodeSize === landing.to - landing.from
            ? NodeSelection.create(tr.doc, landing.from)
            : TextSelection.between(tr.doc.resolve(landing.from), tr.doc.resolve(landing.to)),
    )
    return { tr, landing }
}
