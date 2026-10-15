import type { Node as PMNode, ResolvedPos } from '@tiptap/pm/model'

export const WORD_CHAR = /[\p{L}\p{N}_]/u

const LEAF_TEXT = '￼'

export function blockText(node: PMNode): string {
    return node.textBetween(0, node.content.size, undefined, LEAF_TEXT)
}

export function wordBounds(text: string, offset: number): { start: number; end: number } {
    let start = offset
    let end = offset
    while (start > 0 && WORD_CHAR.test(text[start - 1])) start--
    while (end < text.length && WORD_CHAR.test(text[end])) end++
    return { start, end }
}

export function snapToWordBoundary($pos: ResolvedPos): number {
    const text = blockText($pos.parent)
    const offset = $pos.parentOffset
    if (!WORD_CHAR.test(text[offset - 1] ?? '') || !WORD_CHAR.test(text[offset] ?? '')) return $pos.pos
    const { start, end } = wordBounds(text, offset)
    return $pos.start() + (offset - start <= end - offset ? start : end)
}

export function charAt(doc: PMNode, pos: number): string {
    if (pos < 0 || pos > doc.content.size) return ''
    const $pos = doc.resolve(pos)
    if (!$pos.parent.inlineContent || pos < $pos.start() || pos >= $pos.end()) return ''
    return doc.textBetween(pos, pos + 1, undefined, LEAF_TEXT)
}
