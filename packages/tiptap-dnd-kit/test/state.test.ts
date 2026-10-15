import { applyDragTransaction, dndKitPluginKey, initialDragState, isNoopDrop, withDragMeta } from '../src/core/state'
import { posOf, stateFromHTML } from './helpers'

const source = { kind: 'text' as const, from: 1, to: 4 }

test('start → over → end → landed lifecycle', () => {
    const state = stateFromHTML('<p>abc def</p>')
    let drag = initialDragState(true)
    drag = applyDragTransaction(drag, withDragMeta(state.tr, { type: 'start', source, layout: null, gapWidth: 30 }))
    expect(drag.source).toEqual(source)
    expect(drag.gapWidth).toBe(30)
    drag = applyDragTransaction(drag, withDragMeta(state.tr, { type: 'over', pos: 6 }))
    expect(drag.dropPos).toBe(6)
    drag = applyDragTransaction(drag, withDragMeta(state.tr, { type: 'end', landing: { from: 5, to: 8 } }))
    expect(drag.source).toBeNull()
    expect(drag.landing).toEqual({ from: 5, to: 8 })
    drag = applyDragTransaction(drag, withDragMeta(state.tr, { type: 'landed', landing: { from: 5, to: 8 } }))
    expect(drag).toEqual(initialDragState(true))
})

test('setEnabled flips the flag without touching an ongoing drag', () => {
    const state = stateFromHTML('<p>abc</p>')
    let drag = applyDragTransaction(
        initialDragState(true),
        withDragMeta(state.tr, { type: 'start', source, layout: null, gapWidth: null }),
    )
    drag = applyDragTransaction(drag, withDragMeta(state.tr, { type: 'setEnabled', enabled: false }))
    expect(drag.enabled).toBe(false)
    expect(drag.source).toEqual(source)
})

test('edits before the source map positions and drop the layout snapshot', () => {
    const state = stateFromHTML('<p>abc def</p>')
    const from = posOf(state, 'def')
    let drag = applyDragTransaction(
        initialDragState(true),
        withDragMeta(state.tr, {
            type: 'start',
            source: { kind: 'text', from, to: from + 3 },
            layout: { blocks: [], end: 0 },
            gapWidth: null,
        }),
    )
    drag = applyDragTransaction(drag, withDragMeta(state.tr, { type: 'over', pos: 1 }))
    drag = applyDragTransaction(drag, state.tr.insertText('XX', 1))
    expect(drag.source).toEqual({ kind: 'text', from: from + 2, to: from + 5 })
    expect(drag.dropPos).toBe(1)
    expect(drag.layout).toBeNull()
})

test('deleting the source cancels the drag', () => {
    const state = stateFromHTML('<p>abc def</p>')
    const from = posOf(state, 'def')
    let drag = applyDragTransaction(
        initialDragState(true),
        withDragMeta(state.tr, {
            type: 'start',
            source: { kind: 'text', from, to: from + 3 },
            layout: null,
            gapWidth: null,
        }),
    )
    drag = applyDragTransaction(drag, state.tr.delete(from - 1, from + 3))
    expect(drag.source).toBeNull()
})

test('drag metas never enter undo history', () => {
    const state = stateFromHTML('<p>abc</p>')
    const tr = withDragMeta(state.tr, { type: 'over', pos: 1 })
    expect(tr.getMeta('addToHistory')).toBe(false)
    expect(tr.getMeta(dndKitPluginKey)).toEqual({ type: 'over', pos: 1 })
})

test('isNoopDrop covers both edges of the source', () => {
    expect(isNoopDrop({ from: 5, to: 9 }, 5)).toBe(true)
    expect(isNoopDrop({ from: 5, to: 9 }, 9)).toBe(true)
    expect(isNoopDrop({ from: 5, to: 9 }, 10)).toBe(false)
})
