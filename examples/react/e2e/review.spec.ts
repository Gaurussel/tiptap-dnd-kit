import { expect, test } from '@playwright/test'
import {
    blockTexts,
    box,
    center,
    dndPhase,
    drag,
    editorMutations,
    hoverBlock,
    open,
    watchEditorMutations,
} from './helpers'

test('without any handle bound, hovering blocks writes nothing into the editor', async ({ page }) => {
    await open(page, '/?handle=none')
    await watchEditorMutations(page)
    await hoverBlock(page, 'A regular paragraph')
    await hoverBlock(page, 'Another paragraph')
    await page.waitForTimeout(200)
    expect(await editorMutations(page)).toEqual([])
})

test('onDragEnd fires when onDrop returns its own transaction', async ({ page }) => {
    await open(page, '/?onDrop=replace')
    await hoverBlock(page, 'A regular paragraph')
    const handle = await center(page.locator('.drag-handle'))
    const target = await box(page.locator('.tiptap > h3'))
    await drag(page, handle, { x: handle.x + 120, y: target.y + 4 })
    expect(await page.locator('.tiptap h2').textContent()).toContain('↪')
    await expect.poll(() => page.evaluate(() => window.__dndDragEnds)).toEqual([true])
})

test('an onDrop that dispatches on its own does not wedge later drags', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (message) => message.type() === 'error' && errors.push(message.text()))
    await open(page, '/?onDrop=dispatch')
    const before = await blockTexts(page)
    await hoverBlock(page, 'A regular paragraph')
    const handle = await center(page.locator('.drag-handle'))
    const target = await box(page.locator('.tiptap > h3'))
    await drag(page, handle, { x: handle.x + 120, y: target.y + 4 })
    expect(errors.some((text) => text.includes('[tiptap-dnd-kit]'))).toBe(true)
    await expect.poll(() => dndPhase(page)).toBe('idle')
    expect((await blockTexts(page)).slice(1)).toEqual(before.slice(1))
    await hoverBlock(page, 'A quote')
    await expect(page.locator('.drag-handle')).toBeVisible()
})
