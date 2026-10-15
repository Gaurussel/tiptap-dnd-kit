import { getSchema } from '@tiptap/core'
import Image from '@tiptap/extension-image'
import { DOMParser } from '@tiptap/pm/model'
import { EditorState, type Plugin } from '@tiptap/pm/state'
import StarterKit from '@tiptap/starter-kit'

export const schema = getSchema([StarterKit, Image])

export function stateFromHTML(html: string, plugins: Plugin[] = []) {
    const element = document.createElement('div')
    element.innerHTML = html
    return EditorState.create({ schema, doc: DOMParser.fromSchema(schema).parse(element), plugins })
}

export function posOf(state: EditorState, text: string): number {
    let found = -1
    state.doc.descendants((node, pos) => {
        const nodeText = node.text ?? ''
        if (found === -1 && node.isText && nodeText.includes(text)) found = pos + nodeText.indexOf(text)
    })
    if (found === -1) throw new Error(`text not found: ${text}`)
    return found
}

export function blocks(state: EditorState): string[] {
    const result: string[] = []
    state.doc.forEach((node) => {
        result.push(`${node.type.name}:${node.textContent}`)
    })
    return result
}

export function present<T>(value: T | null | undefined, what = 'value'): T {
    if (value === null || value === undefined) throw new Error(`expected ${what} to be present`)
    return value
}
