import { DOMSerializer } from '@tiptap/pm/model'
import type { EditorView } from '@tiptap/pm/view'
import type { DragSource } from '../types'

export function renderDefaultPreview(
    view: EditorView,
    source: DragSource,
    element: HTMLElement | null,
    container: HTMLElement,
): void {
    const content = document.createElement('div')
    content.className = Array.from(view.dom.classList)
        .filter((name) => !name.startsWith('ProseMirror-'))
        .join(' ')
    if (element) {
        content.innerHTML = element.outerHTML
    } else {
        const fragment = view.state.doc.slice(source.from, source.to).content
        content.appendChild(DOMSerializer.fromSchema(view.state.schema).serializeFragment(fragment))
    }
    container.replaceChildren(content)
}
