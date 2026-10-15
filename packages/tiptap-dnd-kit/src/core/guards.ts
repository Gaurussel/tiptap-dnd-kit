import type { Transaction } from '@tiptap/pm/state'

// Structural on purpose: with two prosemirror-state copies installed, `instanceof Transaction` fails.
export function isTransactionLike(value: unknown): value is Transaction {
    if (!value || typeof value !== 'object') return false
    const candidate = value as Partial<Transaction>
    return (
        Array.isArray(candidate.steps) &&
        !!candidate.doc &&
        !!candidate.before &&
        !!candidate.mapping &&
        typeof candidate.setMeta === 'function'
    )
}
