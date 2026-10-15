import { canAcceptAt } from '../src/core/drop-position'
import { posOf, schema, stateFromHTML } from './helpers'

const state = stateFromHTML('<ul><li><p>a</p></li><li><p>b</p></li></ul><blockquote><p>q</p></blockquote>')

test('a paragraph fits between list items through a listItem wrapper', () => {
    expect(canAcceptAt(state.doc, posOf(state, 'b') - 2, schema.nodes.paragraph)).toBe(true)
})

test('a paragraph fits directly between quoted blocks', () => {
    expect(canAcceptAt(state.doc, posOf(state, 'q') - 1, schema.nodes.paragraph)).toBe(true)
})

test('a paragraph never fits inside text', () => {
    expect(canAcceptAt(state.doc, posOf(state, 'q') + 1, schema.nodes.paragraph)).toBe(false)
})
