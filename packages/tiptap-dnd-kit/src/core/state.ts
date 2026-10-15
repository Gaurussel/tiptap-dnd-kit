import { type EditorState, PluginKey, type Transaction } from '@tiptap/pm/state'
import type { DragLayout, DragRange, DragSource } from './types'

export interface EditorDragState {
    enabled: boolean
    source: DragSource | null
    dropPos: number | null
    layout: DragLayout | null
    gapWidth: number | null
    landing: DragRange | null
}

export type EditorDragMeta =
    | { type: 'setEnabled'; enabled: boolean }
    | { type: 'start'; source: DragSource; layout: DragLayout | null; gapWidth: number | null }
    | { type: 'over'; pos: number | null }
    | { type: 'end'; landing: DragRange | null }
    | { type: 'landed'; landing: DragRange }

export const dndKitPluginKey = new PluginKey<EditorDragState>('dndKit')

export function initialDragState(enabled: boolean): EditorDragState {
    return { enabled, source: null, dropPos: null, layout: null, gapWidth: null, landing: null }
}

const fallbackState = initialDragState(true)

export function getDragState(state: EditorState): EditorDragState {
    return dndKitPluginKey.getState(state) ?? fallbackState
}

export function isDragActive(state: EditorState): boolean {
    const { source, landing } = getDragState(state)
    return source !== null || landing !== null
}

export const isNoopDrop = ({ from, to }: DragRange, dropPos: number) => dropPos >= from && dropPos <= to

export function withDragMeta(tr: Transaction, meta: EditorDragMeta): Transaction {
    return tr.setMeta(dndKitPluginKey, meta).setMeta('addToHistory', false)
}

function mapRange(range: DragRange | null, tr: Transaction): DragRange | null {
    if (!range) return null
    const from = tr.mapping.map(range.from, 1)
    const to = tr.mapping.map(range.to, -1)
    return from < to ? { from, to } : null
}

function mapDragState(value: EditorDragState, tr: Transaction): EditorDragState {
    if (!tr.docChanged) return value
    const sourceRange = mapRange(value.source, tr)
    const source = value.source && sourceRange ? { ...value.source, ...sourceRange } : null
    return {
        enabled: value.enabled,
        source,
        dropPos: source && value.dropPos !== null ? tr.mapping.map(value.dropPos, -1) : null,
        layout: null,
        gapWidth: value.gapWidth,
        landing: mapRange(value.landing, tr),
    }
}

export function applyDragTransaction(value: EditorDragState, tr: Transaction): EditorDragState {
    const meta = tr.getMeta(dndKitPluginKey) as EditorDragMeta | undefined
    if (meta?.type === 'setEnabled') return { ...mapDragState(value, tr), enabled: meta.enabled }
    if (meta?.type === 'start') {
        return { ...initialDragState(value.enabled), source: meta.source, layout: meta.layout, gapWidth: meta.gapWidth }
    }
    if (meta?.type === 'end') return { ...initialDragState(value.enabled), landing: meta.landing }
    if (meta?.type === 'landed') return initialDragState(value.enabled)
    const next = mapDragState(value, tr)
    return meta?.type === 'over' && next.source ? { ...next, dropPos: meta.pos } : next
}
