import type { Editor } from '@tiptap/core'
import { useLayoutEffect, useRef, useState } from 'react'
import { useDragHandle } from 'tiptap-dnd-kit/react'

export function CustomHandle({ editor }: { editor: Editor | null }) {
    const { ref, block, isDragging } = useDragHandle(editor)
    const elementRef = useRef<HTMLDivElement | null>(null)
    const [top, setTop] = useState(0)

    useLayoutEffect(() => {
        const parent = elementRef.current?.offsetParent
        if (!block || !parent) return
        setTop(block.dom.getBoundingClientRect().top - parent.getBoundingClientRect().top)
    }, [block])

    return (
        <div
            ref={(element) => {
                elementRef.current = element
                ref(element)
            }}
            data-testid="custom-handle"
            className="custom-handle"
            data-dragging={isDragging || undefined}
            style={{ top, visibility: block ? 'visible' : 'hidden' }}
        >
            drag
        </div>
    )
}
