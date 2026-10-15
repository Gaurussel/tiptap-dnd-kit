import { Editor } from '@tiptap/core'
import Image from '@tiptap/extension-image'
import StarterKit from '@tiptap/starter-kit'
import { defaultFeatures } from '../src/core/defaults'
import { pressedSource } from '../src/core/dom/press'
import { present } from './helpers'

function pressOn(target: Element) {
    return { target, clientX: 0, clientY: 0, button: 0 } as unknown as MouseEvent
}

test('pressing an interactive control inside an atom node view does not start a drag', () => {
    const editor = new Editor({
        element: document.body.appendChild(document.createElement('div')),
        extensions: [StarterKit, Image.configure({ resize: { enabled: true, directions: ['bottom-right'] } })],
        content: '<p>a</p><img src="x.png">',
    })
    const handle = present(editor.view.dom.querySelector('[data-resize-handle]'))
    expect(handle).not.toBeNull()
    expect(pressedSource(editor.view, pressOn(handle), defaultFeatures)).toBeNull()
    editor.commands.setNodeSelection(present(editor.state.doc.firstChild).nodeSize)
    expect(pressedSource(editor.view, pressOn(handle), defaultFeatures)).toBeNull()
    const image = present(editor.view.dom.querySelector('img'))
    expect(pressedSource(editor.view, pressOn(image), defaultFeatures)?.kind).toBe('node')
    editor.destroy()
})
