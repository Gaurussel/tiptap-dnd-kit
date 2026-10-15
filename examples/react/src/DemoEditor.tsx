import Image from '@tiptap/extension-image'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useState } from 'react'
import { DndKit, type DndKitOptions } from 'tiptap-dnd-kit'
import { useDndState } from 'tiptap-dnd-kit/react'
import { CustomHandle } from './CustomHandle'
import { content } from './content'
import { DemoHandle } from './DemoHandle'

const params = new URLSearchParams(location.search)
const onDropMode = params.get('onDrop')
const handleMode = params.get('handle')
const dropMs = Number(params.get('dropMs') ?? 220)

function demoOnDrop(): DndKitOptions['onDrop'] {
    if (onDropMode === 'throw') {
        return () => {
            throw new Error('demo onDrop failure')
        }
    }
    if (onDropMode === 'mutate') return ({ tr }) => tr.insertText('↪', 1)
    if (onDropMode === 'replace') return ({ editor }) => editor.state.tr.insertText('↪', 1)
    if (onDropMode === 'dispatch') {
        return ({ editor }) => {
            editor.commands.insertContentAt(1, '⚡')
        }
    }
    return null
}

export function DemoEditor({ testId }: { testId: string }) {
    const editor = useEditor({
        extensions: [
            StarterKit,
            Image,
            DndKit.configure({
                hoverArea: (view) => view.dom.closest<HTMLElement>('.editor-shell') ?? view.dom,
                dropAnimation: { duration: dropMs, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
                onDrop: demoOnDrop(),
                onDragEnd: ({ committed }) => {
                    window.__dndDragEnds = [...(window.__dndDragEnds ?? []), committed]
                },
            }),
        ],
        content,
        immediatelyRender: true,
    })
    const state = useDndState(editor)
    const [customHandle, setCustomHandle] = useState(false)
    const [readOnly, setReadOnly] = useState(false)

    return (
        <section className="demo" data-testid={testId}>
            <div className="toolbar">
                <button type="button" onClick={() => setCustomHandle((value) => !value)}>
                    {customHandle ? 'Default handle' : 'Custom handle'}
                </button>
                <button type="button" onClick={() => editor?.commands.toggleDnd()}>
                    {state?.enabled === false && !readOnly ? 'Enable DnD' : 'Disable DnD'}
                </button>
                <button
                    type="button"
                    onClick={() => {
                        editor?.setEditable(readOnly)
                        setReadOnly(!readOnly)
                    }}
                >
                    {readOnly ? 'Editable' : 'Read-only'}
                </button>
            </div>
            <div className="editor-shell">
                {handleMode === 'none' ? null : customHandle ? (
                    <CustomHandle editor={editor} />
                ) : (
                    <DemoHandle editor={editor} />
                )}
                <EditorContent editor={editor} />
            </div>
        </section>
    )
}
