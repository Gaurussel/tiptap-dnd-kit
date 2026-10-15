import { Plugin, type PluginView } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import { buildDecorations } from './decorations'
import type { ResolvedConfig } from './defaults'
import { applyDragTransaction, dndKitPluginKey, type EditorDragState, getDragState, initialDragState } from './state'

export interface DndKitPluginParams {
    enabled: boolean
    config: ResolvedConfig
    view?: (view: EditorView) => PluginView
}

export function prefersMotion(animations: boolean): boolean {
    if (!animations) return false
    return typeof matchMedia !== 'function' || !matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function createDndKitPlugin({ enabled, config, view }: DndKitPluginParams): Plugin<EditorDragState> {
    return new Plugin<EditorDragState>({
        key: dndKitPluginKey,
        state: {
            init: () => initialDragState(enabled),
            apply: (tr, value) => applyDragTransaction(value, tr),
        },
        props: {
            attributes(state): Record<string, string> {
                const attrs: Record<string, string> = {}
                const { source } = getDragState(state)
                if (source) attrs['data-dnd-kit-drag'] = source.kind
                return attrs
            },
            decorations: (state) =>
                buildDecorations(state, getDragState(state), config.classes, prefersMotion(config.features.animations)),
        },
        view,
    })
}
