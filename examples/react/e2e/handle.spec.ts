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

test('dragging a block down by its handle moves it without a jump on drop', async ({ page }) => {
    await hoverBlock(page, 'A regular paragraph')
    const handle = await center(page.locator('.drag-handle'))
    const target = await box(page.locator('.tiptap > h3'))
    await pressMove(page, handle, { x: handle.x + 120, y: target.y + 4 })
    await page.waitForTimeout(400)
    const during = await page
        .locator('.editor-shell .tiptap > *')
        .evaluateAll((els) =>
            els.map((el) => [
                `${el.nodeName}:${el.textContent?.slice(0, 12)}`,
                Math.round(el.getBoundingClientRect().top),
            ]),
        )
    await page.mouse.up()
    await settle(page)
    const after = await page
        .locator('.editor-shell .tiptap > *')
        .evaluateAll((els) =>
            els.map((el) => [
                `${el.nodeName}:${el.textContent?.slice(0, 12)}`,
                Math.round(el.getBoundingClientRect().top),
            ]),
        )
    for (const [text, top] of after) {
        const before = during.find(([key]) => key === text)
        expect(Math.abs((before?.[1] as number) - (top as number))).toBeLessThanOrEqual(1)
    }
    const order = await blockTexts(page)
    expect(order.findIndex((t) => t.startsWith('P:A regular'))).toBe(order.findIndex((t) => t.startsWith('H3')) - 1)
})

test('one undo restores the document after a move', async ({ page }) => {
    const before = await blockTexts(page)
    await hoverBlock(page, 'A regular paragraph')
    const handle = await center(page.locator('.drag-handle'))
    const target = await box(page.locator('.tiptap > h3'))
    await drag(page, handle, { x: handle.x + 120, y: target.y + 4 })
    expect(await blockTexts(page)).not.toEqual(before)
    await page.keyboard.press('ControlOrMeta+z')
    expect(await blockTexts(page)).toEqual(before)
})

test('keyboard: Space, arrows and Enter move a block; Escape cancels', async ({ page }) => {
    const before = await blockTexts(page)
    await hoverBlock(page, 'A regular paragraph')
    await page.locator('.drag-handle').focus()
    await page.keyboard.press('Space')
    await page.keyboard.press('ArrowDown', { delay: 30 })
    for (let i = 0; i < 9; i++) await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Escape')
    await settle(page)
    expect(await blockTexts(page)).toEqual(before)

    await hoverBlock(page, 'A regular paragraph')
    await page.locator('.drag-handle').focus()
    await page.keyboard.press('Space')
    for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    await settle(page)
    expect(await blockTexts(page)).not.toEqual(before)
    await expect(page.locator('.drag-handle')).toBeFocused()
})

test('a custom handle built with useDragHandle drags blocks too', async ({ page }) => {
    await page.getByRole('button', { name: 'Custom handle' }).click()
    await hoverBlock(page, 'A regular paragraph')
    const handle = page.getByTestId('custom-handle')
    await expect(handle).toBeVisible()
    const target = await box(page.locator('.tiptap > h3'))
    await drag(page, await center(handle), { x: 500, y: target.y + 4 })
    const order = await blockTexts(page)
    expect(order.findIndex((t) => t.startsWith('P:A regular'))).toBeGreaterThan(
        order.findIndex((t) => t.startsWith('PRE')),
    )
})

test('handle drags land where pointed on a scrolled page', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 500 })
    await page.mouse.wheel(0, 450)
    await page.waitForTimeout(100)
    await hoverBlock(page, 'Another paragraph')
    const handle = await center(page.locator('.drag-handle'))
    const target = await box(page.locator('.tiptap > h3'))
    await drag(page, handle, { x: handle.x + 120, y: target.y + target.height + 6 })
    const order = await blockTexts(page)
    expect(order.findIndex((t) => t.startsWith('P:Another'))).toBe(order.findIndex((t) => t.startsWith('H3')) + 1)
})

test('dropping in the editor padding below the last block moves the block to the end', async ({ page }) => {
    await hoverBlock(page, 'A regular paragraph')
    const handle = await center(page.locator('.drag-handle'))
    const editorBox = await box(page.locator('.tiptap'))
    const shellBox = await box(page.locator('.editor-shell'))
    const belowContent = (editorBox.y + editorBox.height + shellBox.y + shellBox.height) / 2
    await drag(page, handle, { x: handle.x + 120, y: belowContent })
    const order = await blockTexts(page)
    expect(order.at(-1)).toMatch(/^P:A regular/)
})

test('the handle follows its block when the layout reflows without a document change', async ({ page }) => {
    const block = await hoverBlock(page, 'Another paragraph')
    await page.setViewportSize({ width: 520, height: 1400 })
    await page.waitForTimeout(200)
    const blockBox = await box(block)
    const handleBox = await box(page.locator('.drag-handle'))
    expect(Math.abs(handleBox.y + handleBox.height / 2 - (blockBox.y + 13))).toBeLessThan(14)
})
