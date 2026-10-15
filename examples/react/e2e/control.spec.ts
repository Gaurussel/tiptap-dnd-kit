import { expect, test } from '@playwright/test'
import { blockTexts, box, center, drag, editorCall, hoverBlock, open, pressMove, settle, textPoint } from './helpers'

test('disabling dnd hides the handle and stops dnd-kit drags', async ({ page }) => {
    await open(page, '/')
    await page.getByRole('button', { name: 'Disable DnD' }).click()
    await hoverBlock(page, 'A regular paragraph')
    await expect(page.locator('.drag-handle')).toBeHidden()
    const image = await center(page.locator('.tiptap img'))
    await page.mouse.move(image.x, image.y)
    await page.mouse.down()
    await page.mouse.move(image.x, image.y - 200, { steps: 10 })
    expect(await page.locator('[data-dnd-dragging]').count()).toBe(0)
    await page.mouse.up()
    await page.getByRole('button', { name: 'Enable DnD' }).click()
    await hoverBlock(page, 'A regular paragraph')
    await expect(page.locator('.drag-handle')).toBeVisible()
})

test('disabling mid-drag cancels the drag and keeps the document', async ({ page }) => {
    await open(page, '/')
    const before = await blockTexts(page)
    await hoverBlock(page, 'A regular paragraph')
    const handle = await center(page.locator('.drag-handle'))
    await pressMove(page, handle, { x: handle.x + 100, y: handle.y + 300 })
    await editorCall(page, 'disableDnd')
    await page.mouse.up()
    await settle(page)
    expect(await blockTexts(page)).toEqual(before)
})

test('a read-only editor shows no handle', async ({ page }) => {
    await open(page, '/')
    await page.getByRole('button', { name: 'Read-only' }).click()
    await hoverBlock(page, 'A regular paragraph')
    await expect(page.locator('.drag-handle')).toBeHidden()
})

test('a throwing onDrop cancels the move and logs the error', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (message) => message.type() === 'error' && errors.push(message.text()))
    await open(page, '/?onDrop=throw')
    const before = await blockTexts(page)
    await hoverBlock(page, 'A regular paragraph')
    const handle = await center(page.locator('.drag-handle'))
    const target = await box(page.locator('.tiptap > h3'))
    await drag(page, handle, { x: handle.x + 120, y: target.y + 4 })
    expect(await blockTexts(page)).toEqual(before)
    expect(errors.some((text) => text.includes('[tiptap-dnd-kit] onDrop threw'))).toBe(true)
    await page.locator('.tiptap p').first().click()
    await page.keyboard.type('ok')
    expect(await page.locator('.tiptap p').first().textContent()).toContain('ok')
})

test('two editors on one page do not interfere', async ({ page }) => {
    await open(page, '/?editors=2')
    const first = page.getByTestId('editor-1').locator('.tiptap')
    const second = page.getByTestId('editor-2').locator('.tiptap')
    const firstBefore = await blockTexts(page, first)
    await hoverBlock(page, 'A regular paragraph', second)
    const handle = await center(page.getByTestId('editor-2').locator('.drag-handle'))
    const target = await box(second.locator(':scope > blockquote'))
    await drag(page, handle, { x: handle.x + 120, y: target.y + target.height + 4 })
    expect(await blockTexts(page, first)).toEqual(firstBefore)
    expect(await blockTexts(page, second)).not.toEqual(firstBefore)
    await expect(page.getByTestId('editor-1').locator('.drag-handle')).toBeHidden()
})

test('selection drags respect the text point in the second editor', async ({ page }) => {
    await open(page, '/?editors=2')
    await page.getByTestId('editor-2').locator('strong').scrollIntoViewIfNeeded()
    const word = await textPoint(page, 'bold', 3, 1)
    await page.mouse.dblclick(word.x, word.y)
    const target = await textPoint(page, 'Last', 4, 1)
    await drag(page, word, { x: target.x + 2, y: target.y })
    const texts = await page.getByTestId('editor-2').locator('.tiptap > p').allTextContents()
    expect(texts).toContain('Last bold paragraph.')
    await settle(page)
})
