import { Extension } from '@tiptap/core'
import { type ControllerStorage, EditorDndController } from './controller'
import { resolveConfig } from './defaults'
import { createDndKitPlugin } from './plugin'
import { dndKitPluginKey, getDragState } from './state'
import type { DndKitOptions, DndKitStorage } from './types'

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        dndKit: {
            enableDnd: () => ReturnType
            disableDnd: () => ReturnType
            toggleDnd: () => ReturnType
        }
    }
    interface Storage {
        dndKit: DndKitStorage
    }
}

export const DndKit = Extension.create<DndKitOptions, DndKitStorage>({
    name: 'dndKit',

    addOptions() {
        return {
            enabled: true,
            manager: null,
            features: {},
            classes: {},
            renderPreview: null,
            renderDropLine: null,
            dropAnimation: { duration: 220, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
            hoverArea: null,
            canDrag: null,
            canDrop: null,
            onDragStart: null,
            onDrop: null,
            onDragEnd: null,
        }
    },

    addStorage() {
        const listeners = new Set<() => void>()
        const storage: ControllerStorage = {
            controller: null,
            subscribeController(listener) {
                listeners.add(listener)
                return () => {
                    listeners.delete(listener)
                }
            },
            notifyController() {
                for (const listener of listeners) listener()
            },
        }
        return storage
    },

    // No addToHistory:false here: commands share the chain's transaction, and history already skips step-less ones.
    addCommands() {
        return {
            enableDnd:
                () =>
                ({ tr, dispatch }) => {
                    dispatch?.(tr.setMeta(dndKitPluginKey, { type: 'setEnabled', enabled: true }))
                    return true
                },
            disableDnd:
                () =>
                ({ tr, dispatch }) => {
                    dispatch?.(tr.setMeta(dndKitPluginKey, { type: 'setEnabled', enabled: false }))
                    return true
                },
            toggleDnd:
                () =>
                ({ state, tr, dispatch }) => {
                    dispatch?.(
                        tr.setMeta(dndKitPluginKey, { type: 'setEnabled', enabled: !getDragState(state).enabled }),
                    )
                    return true
                },
        }
    },

    addProseMirrorPlugins() {
        const config = resolveConfig(this.options)
        return [
            createDndKitPlugin({
                enabled: this.options.enabled,
                config,
                view: (view) =>
                    new EditorDndController({
                        view,
                        editor: this.editor,
                        options: this.options,
                        config,
                        storage: this.storage,
                    }),
            }),
        ]
    },
})
