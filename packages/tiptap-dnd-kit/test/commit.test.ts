import { NodeSelection } from '@tiptap/pm/state'
import { buildMoveTransaction } from '../src/core/commit'
import { blocks, posOf, present, stateFromHTML } from './helpers'

function move(...args: Parameters<typeof buildMoveTransaction>) {
    return present(buildMoveTransaction(...args), 'move')
}

test('moving a word keeps single spaces on both ends', () => {
    const state = stateFromHTML('<p>one <strong>bold</strong> two</p><p>last para</p>')
    const from = posOf(state, 'bold')
    const result = move(state, { kind: 'text', from, to: from + 4 }, posOf(state, ' para'), {
        smartSpacing: true,
    })
    const next = state.apply(result.tr)
    expect(blocks(next)).toEqual(['paragraph:one two', 'paragraph:last bold para'])
    expect(next.doc.textBetween(result.landing.from, result.landing.to)).toBe('bold')
    expect(next.selection.from).toBe(result.landing.from)
})

test('without smart spacing the text is moved verbatim', () => {
    const state = stateFromHTML('<p>one bold two</p><p>last para</p>')
    const from = posOf(state, 'bold')
    const result = move(state, { kind: 'text', from, to: from + 4 }, posOf(state, ' para'), {
        smartSpacing: false,
    })
    expect(blocks(state.apply(result.tr))).toEqual(['paragraph:one  two', 'paragraph:lastbold para'])
})

test('a word before punctuation takes the leading space with it', () => {
    const state = stateFromHTML('<p>one two.</p><p>x</p>')
    const from = posOf(state, 'two')
    const result = move(state, { kind: 'text', from, to: from + 3 }, posOf(state, 'x') + 1, {
        smartSpacing: true,
    })
    expect(blocks(state.apply(result.tr))).toEqual(['paragraph:one.', 'paragraph:x two'])
})

test('a top-level block moves down and stays node-selected', () => {
    const state = stateFromHTML('<p>a</p><p>b</p><p>c</p>')
    const result = move(state, { kind: 'block', from: 0, to: 3 }, state.doc.content.size, {
        smartSpacing: true,
    })
    const next = state.apply(result.tr)
    expect(blocks(next)).toEqual(['paragraph:b', 'paragraph:c', 'paragraph:a'])
    expect(next.selection).toBeInstanceOf(NodeSelection)
})

test('a paragraph dropped between list items becomes a new list item', () => {
    const state = stateFromHTML('<p>moved</p><ul><li><p>a</p></li><li><p>b</p></li></ul>')
    const betweenItems = posOf(state, 'b') - 2
    const result = move(state, { kind: 'block', from: 0, to: 7 }, betweenItems, { smartSpacing: true })
    const next = state.apply(result.tr)
    const list = present(next.doc.firstChild)
    expect(list.type.name).toBe('bulletList')
    expect(list.childCount).toBe(3)
    expect(list.child(1).textContent).toBe('moved')
    expect(next.doc.nodeAt(result.landing.from)?.type.name).toBe('paragraph')
})

test('moving the only paragraph of a list item removes the emptied item', () => {
    const state = stateFromHTML('<ul><li><p>a</p></li><li><p>b</p></li></ul><p>end</p>')
    const itemParagraph = posOf(state, 'b') - 1
    const result = move(state, { kind: 'blocks', from: itemParagraph, to: itemParagraph + 3 }, state.doc.content.size, {
        smartSpacing: true,
    })
    const next = state.apply(result.tr)
    expect(present(next.doc.firstChild).childCount).toBe(1)
    expect(blocks(next)).toEqual(['bulletList:a', 'paragraph:end', 'paragraph:b'])
})

test('text dropped between blocks is inserted as a new paragraph', () => {
    const state = stateFromHTML('<p>one two</p><p>three</p>')
    const from = posOf(state, 'two')
    const result = move(state, { kind: 'text', from, to: from + 3 }, state.doc.content.size, {
        smartSpacing: true,
    })
    expect(blocks(state.apply(result.tr))).toEqual(['paragraph:one', 'paragraph:three', 'paragraph:two'])
})

test('dropping onto the source itself is a no-op', () => {
    const state = stateFromHTML('<p>a</p><p>b</p>')
    expect(buildMoveTransaction(state, { kind: 'block', from: 0, to: 3 }, 3, { smartSpacing: true })).toBeNull()
})

test('the move is a single history step and carries no drop uiEvent', () => {
    const state = stateFromHTML('<p>a</p><p>b</p>')
    const result = move(state, { kind: 'block', from: 0, to: 3 }, state.doc.content.size, {
        smartSpacing: true,
    })
    expect(result.tr.getMeta('addToHistory')).toBeUndefined()
    expect(result.tr.getMeta('uiEvent')).toBeUndefined()
})

test('moving the only node out of a container removes the emptied container', () => {
    const state = stateFromHTML('<blockquote><img src="x.png"></blockquote><p>end</p>')
    const imagePos = 1
    const result = move(state, { kind: 'node', from: imagePos, to: imagePos + 1 }, state.doc.content.size, {
        smartSpacing: true,
    })
    expect(blocks(state.apply(result.tr))).toEqual(['paragraph:end', 'image:'])
})
