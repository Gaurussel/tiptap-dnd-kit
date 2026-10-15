import { act, renderHook } from '@testing-library/react'
import { Editor } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import StarterKit from '@tiptap/starter-kit'
import { DndKit, type DragSource } from '../src/core/index'
import { useDndController, useDndState, useDragHandle, useDragPreview } from '../src/react/index'
import { present } from './helpers'

function createEditor() {
    return new Editor({
        element: document.body.appendChild(document.createElement('div')),
        extensions: [StarterKit, DndKit],
        content: '<p>one</p><p>two</p>',
    })
}

test('useDndState follows enable commands', () => {
    const editor = createEditor()
    const { result } = renderHook(() => useDndState(editor))
    expect(result.current?.enabled).toBe(true)
    act(() => {
        editor.commands.disableDnd()
    })
    expect(result.current?.enabled).toBe(false)
    editor.destroy()
})

test('useDragHandle exposes the hovered block', () => {
    const editor = createEditor()
    const { result } = renderHook(() => useDragHandle(editor))
    expect(result.current.block).toBeNull()
    act(() => {
        present(editor.storage.dndKit.controller).setHoveredBlock(0)
    })
    expect(result.current.block?.node.textContent).toBe('one')
    editor.destroy()
})

test('useDragPreview hands the overlay container to the app while a preview is rendered', () => {
    const editor = createEditor()
    const { result } = renderHook(() => useDragPreview(editor))
    expect(result.current).toBeNull()
    const controller = editor.storage.dndKit.controller as unknown as {
        renderPreview(source: DragSource): void
        clearPreview(): void
    }
    act(() => controller.renderPreview({ kind: 'block', from: 0, to: 5 }))
    expect(result.current?.source).toEqual({ kind: 'block', from: 0, to: 5 })
    expect(result.current?.container).toBeInstanceOf(HTMLElement)
    expect(editor.view.dom.contains(present(result.current).container)).toBe(false)
    act(() => controller.clearPreview())
    expect(result.current).toBeNull()
    editor.destroy()
})

test('null editor is safe', () => {
    const { result } = renderHook(() => useDragHandle(null))
    expect(result.current.enabled).toBe(false)
})

test('hooks follow the controller when plugins are reconfigured', () => {
    const editor = createEditor()
    const { result } = renderHook(() => useDndController(editor))
    const first = result.current
    act(() => {
        editor.registerPlugin(new Plugin({ key: new PluginKey('extra') }))
    })
    expect(editor.storage.dndKit.controller).not.toBe(first)
    expect(result.current).toBe(editor.storage.dndKit.controller)
    editor.destroy()
})
