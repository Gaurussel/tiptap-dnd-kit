import type { Editor } from '@tiptap/core'
import { useEffect, useState } from 'react'
import type { DndController } from '../core/types'

export function useDndController(editor: Editor | null): DndController | null {
    const [controller, setController] = useState<DndController | null>(() => editor?.storage.dndKit?.controller ?? null)
    useEffect(() => {
        const storage = editor?.storage.dndKit
        if (!storage) {
            setController(null)
            return
        }
        const sync = () => setController(storage.controller)
        sync()
        return storage.subscribeController(sync)
    }, [editor])
    return controller
}
