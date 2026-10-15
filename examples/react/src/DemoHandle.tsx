import type { Editor } from '@tiptap/core'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useDragHandle } from 'tiptap-dnd-kit/react'

const OFFSET = 8

function GripIcon() {
    return (
        <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden="true">
            {[2, 8, 14].map((cy) => (
                <g key={cy}>
                    <circle cx="2" cy={cy} r="1.5" />
                    <circle cx="8" cy={cy} r="1.5" />
                </g>
            ))}
        </svg>
    )
}

export function DemoHandle({ editor }: { editor: Editor | null }) {
    const { ref, block, isDragging, enabled, phase } = useDragHandle(editor)
    const elementRef = useRef<HTMLButtonElement | null>(null)
    const [position, setPosition] = useState<{ top: number; left: number } | null>(null)

    const setRefs = useCallback(
        (element: HTMLButtonElement | null) => {
            elementRef.current = element
            ref(element)
        },
        [ref],
    )

    const measure = useCallback(() => {
        const element = elementRef.current
        if (!element || !block) return setPosition(null)
        const parent = (element.offsetParent as HTMLElement | null) ?? document.documentElement
        const parentRect = parent.getBoundingClientRect()
        const rect = block.dom.getBoundingClientRect()
        const lineHeight = parseFloat(getComputedStyle(block.dom).lineHeight) || element.offsetHeight
        const top = rect.top - parentRect.top + parent.scrollTop + (lineHeight - element.offsetHeight) / 2
        const left = rect.left - parentRect.left + parent.scrollLeft - OFFSET - element.offsetWidth
        setPosition((prev) => (prev && prev.top === top && prev.left === left ? prev : { top, left }))
    }, [block])

    useLayoutEffect(measure, [measure])

    useEffect(() => {
        if (!editor || !block) return
        const observer = new ResizeObserver(measure)
        observer.observe(editor.view.dom)
        editor.on('transaction', measure)
        window.addEventListener('resize', measure)
        return () => {
            observer.disconnect()
            editor.off('transaction', measure)
            window.removeEventListener('resize', measure)
        }
    }, [editor, block, measure])

    const visible = enabled && block !== null && position !== null && phase !== 'dropping'

    return (
        <button
            ref={setRefs}
            type="button"
            aria-label="Drag block"
            className="drag-handle"
            data-dragging={isDragging || undefined}
            style={{ top: position?.top ?? 0, left: position?.left ?? 0, visibility: visible ? 'visible' : 'hidden' }}
        >
            <GripIcon />
        </button>
    )
}
