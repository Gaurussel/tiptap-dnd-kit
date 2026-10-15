import { expect, test } from '@playwright/test'
import {
    blockTexts,
    box,
    center,
    drag,
    editorMutations,
    hoverBlock,
    open,
    pressMove,
    selectedNodeType,
    settle,
    watchEditorMutations,
} from './helpers'

test.beforeEach(async ({ page }) => {
    await open(page, '/')
    await watchEditorMutations(page)
})

test.afterEach(async ({ page }) => {
    expect(await editorMutations(page)).toEqual([])
})

test('a paragraph dropped between list items becomes a list item and the list never jumps', async ({ page }) => {
    await hoverBlock(page, 'Another paragraph')
    const handle = await center(page.locator('.drag-handle'))
    const items = page.locator('.tiptap li')
    const first = await box(items.nth(0))
    const second = await box(items.nth(1))
    const gap = { x: first.x + 60, y: (first.y + first.height + second.y) / 2 }
    await pressMove(page, handle, gap)
    const secondTops = new Set<number>()
    for (let i = 0; i < 5; i++) {
        await page.mouse.move(gap.x + i, gap.y + (i % 2), { steps: 2 })
        secondTops.add(Math.round((await box(items.nth(1))).y))
    }
    expect(secondTops.size).toBe(1)
    await expect(page.locator('.dnd-kit-drop-line')).toBeVisible()
    await page.mouse.up()
    await settle(page)
    await expect(page.locator('.tiptap li')).toHaveCount(3)
    await expect(page.locator('.tiptap li').nth(1)).toHaveText(/Another paragraph/)
})

test('an image drags straight away without being selected first', async ({ page }) => {
    const image = await center(page.locator('.tiptap img'))
    const heading = await box(page.locator('.tiptap > h2'))
    await drag(page, image, { x: image.x, y: heading.y + heading.height + 4 })
    expect((await blockTexts(page))[1]).toBe('IMG:')
    const selected = await selectedNodeType(page)
    expect(selected).toBe('image')
})

test('a plain click on an image selects it', async ({ page }) => {
    await page.locator('.tiptap img').click()
    const selected = await selectedNodeType(page)
    expect(selected).toBe('image')
})
