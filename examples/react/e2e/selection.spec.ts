import { expect, test } from '@playwright/test'
import { blockTexts, box, drag, editorMutations, open, selectionText, textPoint, watchEditorMutations } from './helpers'

test.beforeEach(async ({ page }) => {
    await open(page, '/')
    await watchEditorMutations(page)
})

test.afterEach(async ({ page }) => {
    expect(await editorMutations(page)).toEqual([])
})

test('double-click a word then drag it right away moves it with smart spaces', async ({ page }) => {
    const word = await textPoint(page, 'bold', 3)
    await page.mouse.dblclick(word.x, word.y)
    const target = await textPoint(page, 'Last', 4)
    await drag(page, word, { x: target.x + 2, y: target.y })
    const texts = await page.locator('.tiptap > p').allTextContents()
    expect(texts).toContain('Last bold paragraph.')
    expect(texts).toContain('Another paragraph with and italic text.')
})

test('triple-click a paragraph then drag it leaves no empty paragraph behind', async ({ page }) => {
    const point = await textPoint(page, 'Another', 2)
    await page.mouse.click(point.x, point.y, { clickCount: 3 })
    const target = await box(page.locator('.tiptap > h2'))
    await drag(page, point, { x: point.x, y: target.y + target.height + 6 })
    const order = await blockTexts(page)
    expect(order[1]).toMatch(/^P:Another/)
    expect(order.filter((t) => t === 'P:')).toHaveLength(0)
})

test('dragging across unselected text still selects it and never starts a dnd drag', async ({ page }) => {
    const from = await textPoint(page, 'Last paragraph', 0)
    const to = await textPoint(page, 'Last paragraph', 9)
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    await page.mouse.move(to.x, to.y, { steps: 10 })
    expect(await page.locator('[data-dnd-dragging]').count()).toBe(0)
    await page.mouse.up()
    const selected = await selectionText(page)
    expect(selected.length).toBeGreaterThan(3)
})
