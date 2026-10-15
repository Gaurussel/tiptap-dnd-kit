import type { Editor } from '@tiptap/core'
import { useSyncExternalStore } from 'react'
import type { DndState } from '../core/types'
import { useDndController } from './useDndController'

const subscribeNothing = () => () => {}

export function useDndState(editor: Editor | null): DndState | null {
    const controller = useDndController(editor)
    return useSyncExternalStore(
        controller ? controller.subscribe : subscribeNothing,
        () => controller?.getState() ?? null,
        () => null,
    )
}
