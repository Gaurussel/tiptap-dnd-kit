import type { Editor } from '@tiptap/core'
import { useCallback, useEffect, useRef } from 'react'
import type { DndPhase, HoveredBlock } from '../core/types'
import { useDndController } from './useDndController'
import { useDndState } from './useDndState'

export interface DragHandleBinding {
    ref: (element: HTMLElement | null) => void
    block: HoveredBlock | null
    isDragging: boolean
    enabled: boolean
    phase: DndPhase
}

export function useDragHandle(editor: Editor | null): DragHandleBinding {
    const controller = useDndController(editor)
    const state = useDndState(editor)
    const elementRef = useRef<HTMLElement | null>(null)
    const unbindRef = useRef<(() => void) | null>(null)

    const bind = useCallback(() => {
        unbindRef.current?.()
        unbindRef.current = elementRef.current && controller ? controller.bindHandle(elementRef.current) : null
    }, [controller])

    const ref = useCallback(
        (element: HTMLElement | null) => {
            elementRef.current = element
            bind()
        },
        [bind],
    )

    useEffect(() => {
        bind()
        return () => {
            unbindRef.current?.()
            unbindRef.current = null
        }
    }, [bind])

    return {
        ref,
        block: state?.hoveredBlock ?? null,
        isDragging: state?.phase === 'dragging',
        enabled: state?.enabled ?? false,
        phase: state?.phase ?? 'idle',
    }
}
