import { isTransactionLike } from '../src/core/guards'
import { stateFromHTML } from './helpers'

test('a transaction from another prosemirror-state copy is still recognised', () => {
    const tr = stateFromHTML('<p>a</p>').tr
    const foreign = { steps: tr.steps, doc: tr.doc, before: tr.before, mapping: tr.mapping, setMeta: tr.setMeta }
    expect(isTransactionLike(tr)).toBe(true)
    expect(isTransactionLike(foreign)).toBe(true)
})

test('false, undefined and plain values are not transactions', () => {
    expect(isTransactionLike(false)).toBe(false)
    expect(isTransactionLike(undefined)).toBe(false)
    expect(isTransactionLike({ steps: [] })).toBe(false)
})
