import type { Editor } from '@tiptap/core'
import { useEffect, useState } from 'react'
import type { DragSource } from '../core/types'
import { useDndController } from './useDndController'

export interface DragPreviewTarget {
    source: DragSource
    container: HTMLElement
}

export function useDragPreview(editor: Editor | null): DragPreviewTarget | null {
    const controller = useDndController(editor)
    const [target, setTarget] = useState<DragPreviewTarget | null>(null)

    useEffect(() => {
        if (!controller) return
        controller.setPreviewRenderer((ctx, container) => {
            setTarget({ source: ctx.source, container })
            return () => setTarget(null)
        })
        return () => controller.setPreviewRenderer(null)
    }, [controller])

    return target
}
