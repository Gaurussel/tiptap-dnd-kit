import type { Decoration } from '@tiptap/pm/view'
import { buildDecorations } from '../src/core/decorations'
import { defaultClasses } from '../src/core/defaults'
import type { EditorDragState } from '../src/core/state'
import { initialDragState } from '../src/core/state'
import { posOf, present, stateFromHTML } from './helpers'

const html = '<p>one</p><ul><li><p>a</p></li><li><p>b</p></li></ul><p>two words</p><p>three</p>'

interface DecorationInternals {
    type: { attrs?: Record<string, string>; toDOM?: () => HTMLElement }
}

function specs(set: ReturnType<typeof buildDecorations>) {
    return (set?.find() ?? []).map((deco: Decoration) => ({
        from: deco.from,
        to: deco.to,
        attrs: (deco as unknown as DecorationInternals).type.attrs ?? {},
        widget: !!(deco as unknown as DecorationInternals).type.toDOM,
    }))
}

test('block mode shifts the blocks between source and drop', () => {
    const state = stateFromHTML(html)
    const layout = {
        blocks: [
            { top: 0, height: 20 },
            { top: 30, height: 40 },
            { top: 80, height: 20 },
            { top: 110, height: 20 },
        ],
        end: 140,
    }
    const threePos = state.doc.content.size - present(state.doc.lastChild).nodeSize
    const drag: EditorDragState = {
        ...initialDragState(true),
        source: { kind: 'block', from: 0, to: 5 },
        layout,
        dropPos: threePos,
    }
    const result = specs(buildDecorations(state, drag, defaultClasses, true))
    expect(result.find((d) => d.from === 0)?.attrs.class).toBe(defaultClasses.source)
    expect(result.filter((d) => String(d.attrs?.style ?? '').includes('translateY')).length).toBe(3)
})

test('nested drop keeps every top-level block in place', () => {
    const state = stateFromHTML(html)
    const layout = {
        blocks: [
            { top: 0, height: 20 },
            { top: 30, height: 40 },
            { top: 80, height: 20 },
            { top: 110, height: 20 },
        ],
        end: 140,
    }
    const betweenItems = posOf(state, 'b') - 2
    const drag: EditorDragState = {
        ...initialDragState(true),
        source: { kind: 'block', from: 0, to: 5 },
        layout,
        dropPos: betweenItems,
    }
    const result = specs(buildDecorations(state, drag, defaultClasses, true))
    expect(result.some((d) => String(d.attrs?.style ?? '').includes('translateY'))).toBe(false)
})

test('text drop into text renders an inline gap widget', () => {
    const state = stateFromHTML(html)
    const from = posOf(state, 'words')
    const drag: EditorDragState = {
        ...initialDragState(true),
        source: { kind: 'text', from, to: from + 5 },
        dropPos: posOf(state, 'three'),
        gapWidth: 42,
    }
    const result = specs(buildDecorations(state, drag, defaultClasses, true))
    expect(result.filter((d) => d.widget)).toHaveLength(1)
    expect(result.find((d) => d.from === from)?.attrs.class).toBe(defaultClasses.sourceInline)
})

test('block-level drop never inserts a widget between siblings', () => {
    const state = stateFromHTML(html)
    const from = posOf(state, 'words')
    const betweenItems = posOf(state, 'b') - 2
    const drag: EditorDragState = {
        ...initialDragState(true),
        source: { kind: 'text', from, to: from + 5 },
        dropPos: betweenItems,
        gapWidth: 42,
    }
    expect(specs(buildDecorations(state, drag, defaultClasses, true)).some((d) => d.widget)).toBe(false)
})

test('landing hides the landed range and nothing else', () => {
    const state = stateFromHTML(html)
    const drag: EditorDragState = { ...initialDragState(true), landing: { from: 0, to: 5 } }
    const result = specs(buildDecorations(state, drag, defaultClasses, true))
    expect(result).toEqual([
        { from: 0, to: 5, attrs: { class: defaultClasses.landing, style: 'opacity: 0' }, widget: false },
    ])
})

test('idle state has no decorations', () => {
    expect(buildDecorations(stateFromHTML(html), initialDragState(true), defaultClasses, true)).toBeNull()
})

const layout4 = {
    blocks: [
        { top: 0, height: 20 },
        { top: 30, height: 40 },
        { top: 80, height: 20 },
        { top: 110, height: 20 },
    ],
    end: 140,
}

test('block mode puts the shift transition on every top-level block so they also glide back', () => {
    const state = stateFromHTML(html)
    const drag: EditorDragState = {
        ...initialDragState(true),
        source: { kind: 'block', from: 0, to: 5 },
        layout: layout4,
        dropPos: null,
    }
    const result = specs(buildDecorations(state, drag, defaultClasses, true))
    expect(result).toHaveLength(4)
    expect(result.every((d) => String(d.attrs.style).includes('transition'))).toBe(true)
})

test('without motion no transition is emitted', () => {
    const state = stateFromHTML(html)
    const threePos = state.doc.content.size - present(state.doc.lastChild).nodeSize
    const drag: EditorDragState = {
        ...initialDragState(true),
        source: { kind: 'block', from: 0, to: 5 },
        layout: layout4,
        dropPos: threePos,
    }
    const result = specs(buildDecorations(state, drag, defaultClasses, false))
    expect(result.some((d) => String(d.attrs?.style ?? '').includes('transition'))).toBe(false)
    expect(result.some((d) => String(d.attrs?.style ?? '').includes('translateY'))).toBe(true)
})

test('the inline gap carries its own width without any stylesheet', () => {
    const state = stateFromHTML(html)
    const from = posOf(state, 'words')
    const drag: EditorDragState = {
        ...initialDragState(true),
        source: { kind: 'text', from, to: from + 5 },
        dropPos: posOf(state, 'three'),
        gapWidth: 42,
    }
    const widget = present(buildDecorations(state, drag, defaultClasses, false))
        .find()
        .map((deco) => deco as unknown as DecorationInternals)
        .find((deco) => deco.type.toDOM)
    const gap = present(present(widget).type.toDOM)()
    expect(gap.style.width).toBe('42px')
    expect(gap.style.display).toBe('inline-block')
})
