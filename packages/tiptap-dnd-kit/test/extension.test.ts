import { DragDropManager } from '@dnd-kit/dom'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { DndKit, getDragState } from '../src/core/index'
import { present } from './helpers'

function createEditor(options = {}) {
    return new Editor({
        element: document.body.appendChild(document.createElement('div')),
        extensions: [StarterKit, DndKit.configure(options)],
        content: '<p>one</p><p>two</p>',
    })
}

test('the controller is created with the view and exposed via storage', () => {
    const editor = createEditor()
    const storage = editor.storage.dndKit
    expect(present(storage.controller).getState()).toEqual({
        enabled: true,
        phase: 'idle',
        hoveredBlock: null,
        source: null,
    })
    editor.destroy()
    expect(storage.controller).toBeNull()
})

test('commands toggle the enabled flag and notify subscribers', () => {
    const editor = createEditor()
    const controller = present(editor.storage.dndKit.controller)
    const seen: boolean[] = []
    controller.subscribe((state) => seen.push(state.enabled))
    editor.commands.disableDnd()
    editor.commands.toggleDnd()
    expect(seen).toEqual([false, true])
    expect(getDragState(editor.state).enabled).toBe(true)
    editor.destroy()
})

test('a read-only editor reports dnd as disabled', () => {
    const editor = createEditor()
    editor.setEditable(false)
    expect(present(editor.storage.dndKit.controller).getState().enabled).toBe(false)
    editor.setEditable(true)
    expect(present(editor.storage.dndKit.controller).getState().enabled).toBe(true)
    editor.destroy()
})

test('the enabled option sets the initial state', () => {
    const editor = createEditor({ enabled: false })
    expect(present(editor.storage.dndKit.controller).getState().enabled).toBe(false)
    editor.destroy()
})

test('setHoveredBlock resolves the node and is ignored while disabled', () => {
    const editor = createEditor()
    const controller = present(editor.storage.dndKit.controller)
    controller.setHoveredBlock(0)
    expect(controller.getState().hoveredBlock?.node.textContent).toBe('one')
    editor.commands.disableDnd()
    expect(controller.getState().hoveredBlock).toBeNull()
    controller.setHoveredBlock(0)
    expect(controller.getState().hoveredBlock).toBeNull()
    editor.destroy()
})

test('helper elements live outside the editor and are removed on destroy', () => {
    const editor = createEditor()
    const before = document.body.querySelectorAll('[aria-hidden="true"]').length
    expect(before).toBeGreaterThanOrEqual(3)
    expect(editor.view.dom.querySelector('[aria-hidden="true"]')).toBeNull()
    editor.destroy()
    expect(document.body.querySelectorAll('.dnd-kit-drop-line, .dnd-kit-preview').length).toBe(0)
})

test('an editor destroyed right after creation leaves nothing registered in a shared manager', async () => {
    const manager = new DragDropManager()
    const editor = createEditor({ manager })
    editor.destroy()
    await Promise.resolve()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect([...manager.registry.draggables]).toHaveLength(0)
    expect([...manager.registry.droppables]).toHaveLength(0)
    manager.destroy()
})

test('without a bound handle dnd-kit writes nothing into the editor DOM', async () => {
    const editor = createEditor()
    present(editor.storage.dndKit.controller).setHoveredBlock(0)
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(editor.view.dom.querySelector('[role], [tabindex], [aria-roledescription], [aria-pressed]')).toBeNull()
    editor.destroy()
})

test('a custom hover set via setHoveredBlock is not overwritten by built-in tracking', () => {
    const editor = createEditor()
    const controller = present(editor.storage.dndKit.controller)
    const secondPos = present(editor.state.doc.firstChild).nodeSize
    controller.setHoveredBlock(secondPos)
    editor.view.dom.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientY: 0 }))
    expect(controller.getState().hoveredBlock?.pos).toBe(secondPos)
    editor.destroy()
})

test('dnd commands inside a chain keep the other changes undoable', () => {
    const editor = createEditor()
    editor.chain().insertContentAt(1, 'X').disableDnd().run()
    expect(editor.getText()).toContain('Xone')
    editor.commands.undo()
    expect(editor.getText()).not.toContain('X')
    editor.destroy()
})

test('a throwing renderDropLine falls back to the default line instead of breaking the editor', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const editor = createEditor({
        renderDropLine: () => {
            throw new Error('broken line')
        },
    })
    expect(editor.storage.dndKit.controller).not.toBeNull()
    expect(document.body.querySelector('.dnd-kit-drop-line')).not.toBeNull()
    expect(error).toHaveBeenCalled()
    error.mockRestore()
    editor.destroy()
})

test("a shared manager gets the app's own Feedback overlay and drop animation back", async () => {
    const { Feedback } = await import('@dnd-kit/dom')
    const manager = new DragDropManager()
    const feedback = present(manager.registry.plugins.get(Feedback))
    const appOverlay = document.createElement('div')
    const appAnimation = { duration: 99, easing: 'linear' }
    feedback.overlay = appOverlay
    feedback.dropAnimation = appAnimation
    const editor = createEditor({ manager })
    const controller = editor.storage.dndKit.controller as unknown as { claimFeedback(): void; releaseFeedback(): void }
    controller.claimFeedback()
    expect(feedback.overlay).not.toBe(appOverlay)
    controller.releaseFeedback()
    expect(feedback.overlay).toBe(appOverlay)
    expect(feedback.dropAnimation).toBe(appAnimation)
    editor.destroy()
    manager.destroy()
})
