import type { EditorState } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { computeShifts } from './layout'
import { type EditorDragState, isNoopDrop } from './state'
import type { DndKitClasses, DragLayout, DragRange, DragSource } from './types'

const EASING = 'cubic-bezier(0.2, 0, 0, 1)'
const SHIFT_TRANSITION = `transition: transform 200ms ${EASING}`
const HIDDEN = 'opacity: 0'

function blockShiftDecorations(
    state: EditorState,
    source: DragSource,
    dropPos: number | null,
    layout: DragLayout,
    classes: DndKitClasses,
    motion: boolean,
) {
    const positions: number[] = []
    state.doc.forEach((_, pos) => {
        positions.push(pos)
    })
    const sourceStart = positions.indexOf(source.from)
    const sourceEnd = source.to === state.doc.content.size ? positions.length : positions.indexOf(source.to)
    if (sourceStart === -1 || sourceEnd === -1 || layout.blocks.length !== positions.length) return null

    const nested = dropPos !== null && state.doc.resolve(dropPos).depth > 0
    const dropIndex =
        dropPos === null || nested
            ? -1
            : dropPos === state.doc.content.size
              ? positions.length
              : positions.indexOf(dropPos)
    const shifts =
        dropIndex === -1 ? new Map<number, number>() : computeShifts(layout, sourceStart, sourceEnd, dropIndex)

    // Every block carries the transition, not only shifted ones, so blocks also glide back when the drop point moves away.
    return positions.flatMap((pos, index) => {
        const isSource = index >= sourceStart && index < sourceEnd
        const shift = shifts.get(index)
        const styles = [motion ? SHIFT_TRANSITION : '', shift ? `transform: translateY(${shift}px)` : ''].filter(
            Boolean,
        )
        if (!isSource && styles.length === 0) return []
        const attrs: Record<string, string> = {}
        if (isSource) attrs.class = classes.source
        if (styles.length) attrs.style = styles.join('; ')
        return [Decoration.node(pos, pos + state.doc.child(index).nodeSize, attrs)]
    })
}

function rangeDecoration(state: EditorState, range: DragRange, nodeClass: string, inlineClass: string, style?: string) {
    const whole = state.doc.nodeAt(range.from)?.nodeSize === range.to - range.from
    const attrs: Record<string, string> = { class: whole ? nodeClass : inlineClass }
    if (style) attrs.style = style
    return whole ? Decoration.node(range.from, range.to, attrs) : Decoration.inline(range.from, range.to, attrs)
}

// A re-rendered (moved) widget replays the opening animation at the new spot.
function inlineGap(dropPos: number, gapWidth: number | null, className: string, motion: boolean) {
    const render = () => {
        const width = `${gapWidth ?? 0}px`
        const element = document.createElement('span')
        element.className = className
        Object.assign(element.style, {
            display: 'inline-block',
            position: 'relative',
            width,
            height: '1em',
            verticalAlign: 'baseline',
        })
        if (motion) element.animate?.([{ width: '0px' }, { width }], { duration: 180, easing: EASING })
        return element
    }
    return Decoration.widget(dropPos, render, { key: 'dnd-kit-inline-gap', side: -1, ignoreSelection: true })
}

export function buildDecorations(
    state: EditorState,
    drag: EditorDragState,
    classes: DndKitClasses,
    motion: boolean,
): DecorationSet | null {
    const { source, dropPos, layout, gapWidth, landing } = drag
    const decorations: Decoration[] = []
    if (source) {
        const shifted =
            source.kind === 'block' && layout
                ? blockShiftDecorations(state, source, dropPos, layout, classes, motion)
                : null
        if (shifted) {
            decorations.push(...shifted)
        } else {
            decorations.push(rangeDecoration(state, source, classes.source, classes.sourceInline))
            // Block-level drops get no widget: an element between siblings breaks sibling CSS (`li + li`) and makes the
            // drop point oscillate. Their line is drawn outside the editor.
            if (dropPos !== null && !isNoopDrop(source, dropPos) && state.doc.resolve(dropPos).parent.inlineContent) {
                decorations.push(inlineGap(dropPos, gapWidth, classes.inlineGap, motion))
            }
        }
    }
    if (landing) decorations.push(rangeDecoration(state, landing, classes.landing, classes.landingInline, HIDDEN))
    return decorations.length ? DecorationSet.create(state.doc, decorations) : null
}
