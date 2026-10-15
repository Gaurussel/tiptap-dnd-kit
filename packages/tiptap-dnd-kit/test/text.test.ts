import { charAt, snapToWordBoundary, wordBounds } from '../src/core/text'
import { posOf, stateFromHTML } from './helpers'

test('wordBounds finds the word around an offset, including Cyrillic', () => {
    expect(wordBounds('один жирным два', 7)).toEqual({ start: 5, end: 11 })
})

test('snapToWordBoundary moves a mid-word position to the nearer edge', () => {
    const state = stateFromHTML('<p>alpha beta</p>')
    const nearStart = state.doc.resolve(posOf(state, 'beta') + 1)
    const nearEnd = state.doc.resolve(posOf(state, 'beta') + 3)
    expect(snapToWordBoundary(nearStart)).toBe(posOf(state, 'beta'))
    expect(snapToWordBoundary(nearEnd)).toBe(posOf(state, 'beta') + 4)
})

test('snapToWordBoundary keeps positions that already sit between words', () => {
    const state = stateFromHTML('<p>alpha beta</p>')
    const between = posOf(state, ' beta')
    expect(snapToWordBoundary(state.doc.resolve(between))).toBe(between)
})

test('charAt returns empty string outside inline content', () => {
    const state = stateFromHTML('<p>ab</p><p>cd</p>')
    expect(charAt(state.doc, posOf(state, 'ab'))).toBe('a')
    expect(charAt(state.doc, posOf(state, 'ab') + 2)).toBe('')
    expect(charAt(state.doc, -1)).toBe('')
})
