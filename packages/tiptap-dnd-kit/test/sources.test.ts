import { NodeSelection, TextSelection } from '@tiptap/pm/state'
import { asTopLevelBlocks, selectionForClick, sourceForBlock, sourceFromSelection } from '../src/core/sources'
import { posOf, stateFromHTML } from './helpers'

const html = '<p>first para</p><p>second para</p><ul><li><p>item one</p></li></ul><img src="x.png">'

function withSelection(from: number, to: number) {
    const state = stateFromHTML(html)
    return state.apply(state.tr.setSelection(TextSelection.create(state.doc, from, to)))
}

test('a word inside a paragraph is a text source', () => {
    const state = stateFromHTML(html)
    const from = posOf(state, 'para')
    expect(sourceFromSelection(withSelection(from, from + 4))).toEqual({ kind: 'text', from, to: from + 4 })
})

test('a selection covering a whole paragraph becomes a blocks source', () => {
    const state = stateFromHTML(html)
    const from = posOf(state, 'second para')
    expect(sourceFromSelection(withSelection(from, from + 11))).toEqual({
        kind: 'blocks',
        from: from - 1,
        to: from + 12,
    })
})

test("Chrome's triple-click selection that ends at the next block start still means the whole paragraph", () => {
    const state = stateFromHTML(html)
    const from = posOf(state, 'first para')
    const nextBlockStart = posOf(state, 'second para')
    expect(sourceFromSelection(withSelection(from, nextBlockStart))).toEqual({
        kind: 'blocks',
        from: from - 1,
        to: from + 11,
    })
})

test('a node selection is a node source', () => {
    const state = stateFromHTML(html)
    const imagePos = state.doc.content.size - 1
    const selected = state.apply(state.tr.setSelection(NodeSelection.create(state.doc, imagePos)))
    expect(sourceFromSelection(selected)).toEqual({ kind: 'node', from: imagePos, to: imagePos + 1 })
})

test('an empty selection is not a source', () => {
    expect(sourceFromSelection(withSelection(3, 3))).toBeNull()
})

test('asTopLevelBlocks promotes top-level ranges only', () => {
    const state = stateFromHTML(html)
    const top = { kind: 'blocks' as const, from: 0, to: 12 }
    const itemFrom = posOf(state, 'item one') - 1
    const nested = { kind: 'blocks' as const, from: itemFrom, to: itemFrom + 10 }
    expect(asTopLevelBlocks(state, top).kind).toBe('block')
    expect(asTopLevelBlocks(state, nested).kind).toBe('blocks')
    expect(asTopLevelBlocks(state, { kind: 'text', from: 1, to: 3 }).kind).toBe('text')
})

test('sourceForBlock gives block kind at top level and node kind deeper', () => {
    const state = stateFromHTML(html)
    expect(sourceForBlock(state, 0)).toEqual({ kind: 'block', from: 0, to: 12 })
    const itemParagraph = posOf(state, 'item one') - 1
    expect(sourceForBlock(state, itemParagraph)?.kind).toBe('node')
})

test('selectionForClick replays single, double and triple clicks', () => {
    const state = stateFromHTML(html)
    const pressed = { kind: 'text' as const, from: 1, to: 6 }
    const inPara = posOf(state, 'para') + 1
    expect(selectionForClick(state, pressed, inPara, 1).empty).toBe(true)
    const word = selectionForClick(state, pressed, inPara, 2)
    expect(state.doc.textBetween(word.from, word.to)).toBe('para')
    const block = selectionForClick(state, pressed, inPara, 3)
    expect(state.doc.textBetween(block.from, block.to)).toBe('first para')
})

test('selectionForClick selects a pressed atom', () => {
    const state = stateFromHTML(html)
    const imagePos = state.doc.content.size - 1
    const selection = selectionForClick(state, { kind: 'node', from: imagePos, to: imagePos + 1 }, imagePos, 1)
    expect(selection).toBeInstanceOf(NodeSelection)
    expect(selection.from).toBe(imagePos)
})
