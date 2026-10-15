import type { Locator, Page } from '@playwright/test'

export type XY = { x: number; y: number }

export async function box(locator: Locator) {
    const rect = await locator.boundingBox()
    if (!rect) throw new Error('element has no bounding box')
    return rect
}

export async function center(locator: Locator): Promise<XY> {
    const rect = await box(locator)
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
}

export async function blockTexts(page: Page, editor = page.locator('.tiptap').first()): Promise<string[]> {
    return editor.evaluate((root) =>
        Array.from(root.children, (el) => `${el.nodeName}:${(el.textContent ?? '').slice(0, 24)}`),
    )
}

export async function hoverBlock(page: Page, text: string, editor = page.locator('.tiptap').first()) {
    const block = editor.locator(':scope > *', { hasText: text }).first()
    await block.scrollIntoViewIfNeeded()
    const rect = await box(block)
    await page.mouse.move(rect.x + 40, rect.y + 8)
    return block
}

export async function pressMove(page: Page, from: XY, to: XY, steps = 20) {
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    await page.mouse.move(from.x + 2, from.y + 6, { steps: 3 })
    await page.mouse.move(to.x, to.y, { steps })
}

export async function drag(page: Page, from: XY, to: XY, steps = 20) {
    await pressMove(page, from, to, steps)
    await page.mouse.up()
    await settle(page)
}

export async function settle(page: Page) {
    await page.waitForFunction(
        () => !document.querySelector('.dnd-kit-landing, .dnd-kit-landing-inline, [data-dnd-dragging]'),
    )
}

type EditorCall = 'disableDnd' | 'enableDnd' | 'destroy' | 'readOnly'

export async function editorCall(page: Page, call: EditorCall, editorIndex = 0) {
    await page.evaluate(
        ({ call, editorIndex }) => {
            const editor = document.querySelectorAll('.tiptap')[editorIndex]?.editor
            if (!editor) throw new Error('editor not found')
            if (call === 'disableDnd') editor.commands.disableDnd()
            if (call === 'enableDnd') editor.commands.enableDnd()
            if (call === 'destroy') editor.destroy()
            if (call === 'readOnly') editor.setEditable(false)
        },
        { call, editorIndex },
    )
}

export async function dndPhase(page: Page) {
    return page.evaluate(() => document.querySelector('.tiptap')?.editor?.storage.dndKit.controller?.getState().phase)
}

export async function selectedNodeType(page: Page) {
    return page.evaluate(() => {
        const selection = document.querySelector('.tiptap')?.editor?.state.selection
        return selection && 'node' in selection ? (selection.node as { type: { name: string } }).type.name : null
    })
}

export async function selectionText(page: Page) {
    return page.evaluate(() => {
        const editor = document.querySelector('.tiptap')?.editor
        if (!editor) return ''
        return editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to)
    })
}

export async function selectText(page: Page, text: string) {
    await page.evaluate((text) => {
        const editor = document.querySelector('.tiptap')?.editor
        if (!editor) throw new Error('editor not found')
        let from = -1
        editor.state.doc.descendants((node, pos) => {
            if (from === -1 && node.isText && node.text?.includes(text)) from = pos + node.text.indexOf(text)
        })
        editor.commands.focus()
        editor.commands.setTextSelection({ from, to: from + text.length })
    }, text)
}

export async function textPoint(page: Page, text: string, offset = 0, editorIndex = 0): Promise<XY> {
    return page.evaluate(
        ({ text, offset, editorIndex }) => {
            const editor = document.querySelectorAll('.tiptap')[editorIndex]?.editor
            if (!editor) throw new Error('editor not found')
            let from = -1
            editor.state.doc.descendants((node, pos) => {
                if (from === -1 && node.isText && node.text?.includes(text)) from = pos + node.text.indexOf(text)
            })
            const coords = editor.view.coordsAtPos(from + offset)
            return { x: coords.left + 1, y: (coords.top + coords.bottom) / 2 }
        },
        { text, offset, editorIndex },
    )
}

export async function watchEditorMutations(page: Page) {
    await page.evaluate(() => {
        const found: string[] = []
        window.__dndMutations = found
        for (const root of document.querySelectorAll('.tiptap')) {
            new MutationObserver((list) => {
                for (const record of list) {
                    const name = record.attributeName ?? ''
                    if (record.type === 'attributes' && /^(data-dnd(?!-kit)|popover|role|tabindex|aria-)/.test(name)) {
                        found.push(name)
                    }
                    for (const node of record.addedNodes) {
                        if (node instanceof Element && node.hasAttribute('data-dnd-placeholder'))
                            found.push('placeholder')
                    }
                }
            }).observe(root, { attributes: true, childList: true, subtree: true })
        }
    })
}

export async function editorMutations(page: Page): Promise<string[]> {
    return page.evaluate(() => window.__dndMutations ?? [])
}

// Coordinates taken before the demo image loads go stale once it pushes the layout down.
export async function open(page: Page, url = '/') {
    await page.goto(url)
    await page.waitForFunction(() =>
        Array.from(document.images).every((image) => image.complete && image.naturalHeight > 0),
    )
}
