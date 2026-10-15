import type { Editor } from '@tiptap/core'
import type {} from 'tiptap-dnd-kit'

declare global {
    interface Element {
        editor?: Editor
    }

    interface Window {
        __dndMutations?: string[]
        __overlayFlash?: number
        __dndDragEnds?: boolean[]
    }
}
