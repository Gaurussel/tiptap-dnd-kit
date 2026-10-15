import { expect, type Page, test } from '@playwright/test'
import {
    blockTexts,
    box,
    center,
    dndPhase,
    editorCall,
    hoverBlock,
    open,
    pressMove,
    selectText,
    settle,
    textPoint,
} from './helpers'

async function startHandleDrag(page: Page) {
    await hoverBlock(page, 'A regular paragraph')
    const handle = await center(page.locator('.drag-handle'))
    const target = await box(page.locator('.tiptap > h3'))
    await pressMove(page, handle, { x: handle.x + 120, y: target.y + 4 })
}

test('shift+drag on a selection does not start a dnd drag', async ({ page }) => {
    await open(page)
    await selectText(page, 'bold')
    const word = await textPoint(page, 'bold', 3)
    const target = await textPoint(page, 'Last', 4)
    await page.keyboard.down('Shift')
    await pressMove(page, word, target)
    expect(await page.locator('[data-dnd-dragging]').count()).toBe(0)
    await page.mouse.up()
    await page.keyboard.up('Shift')
})

test('destroying the editor during the drop animation raises no error', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await open(page, '/?dropMs=1500')
    await startHandleDrag(page)
    await page.mouse.up()
    await editorCall(page, 'destroy')
    await page.waitForTimeout(1800)
    expect(errors).toEqual([])
})

test('disabling mid-drag reports the dropping phase while the overlay flies back', async ({ page }) => {
    await open(page, '/?dropMs=1500')
    await startHandleDrag(page)
    await editorCall(page, 'disableDnd')
    expect(await dndPhase(page)).toBe('dropping')
    await page.mouse.up()
})

test('a long drop animation keeps the landed block hidden until it finishes', async ({ page }) => {
    await open(page, '/?dropMs=1500')
    await startHandleDrag(page)
    await page.mouse.up()
    await page.waitForTimeout(1200)
    expect(await page.locator('.tiptap .dnd-kit-landing').count()).toBe(1)
    await settle(page)
})

test('extra steps added by onDrop keep the landing on the moved block', async ({ page }) => {
    await open(page, '/?onDrop=mutate&dropMs=1500')
    await startHandleDrag(page)
    await page.mouse.up()
    await expect(page.locator('.tiptap .dnd-kit-landing')).toHaveText(/^A regular paragraph/)
    await settle(page)
})

test('making the editor read-only mid-drag cancels the drag and keeps the document', async ({ page }) => {
    await open(page)
    const before = await blockTexts(page)
    await startHandleDrag(page)
    await editorCall(page, 'readOnly')
    await page.mouse.up()
    await settle(page)
    expect(await blockTexts(page)).toEqual(before)
})

async function watchOverlayFlash(page: Page) {
    await page.evaluate(() => {
        window.__overlayFlash = 0
        const tick = () => {
            document.querySelectorAll('.dnd-kit-preview').forEach((overlay) => {
                const style = getComputedStyle(overlay)
                const shown = overlay.childElementCount > 0 && style.display !== 'none' && style.visibility !== 'hidden'
                if (shown && !overlay.hasAttribute('data-dnd-dragging'))
                    window.__overlayFlash = (window.__overlayFlash ?? 0) + 1
            })
            requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
    })
}

test('the preview never shows outside a drag, even for a press-and-release', async ({ page }) => {
    await open(page)
    await watchOverlayFlash(page)
    await hoverBlock(page, 'A regular paragraph')
    const handle = await center(page.locator('.drag-handle'))
    await page.mouse.move(handle.x, handle.y)
    await page.mouse.down()
    await page.mouse.up()
    await settle(page)
    const image = await center(page.locator('.tiptap img'))
    await page.mouse.move(image.x, image.y)
    await page.mouse.down()
    await page.mouse.move(image.x + 8, image.y + 8, { steps: 4 })
    await page.mouse.move(image.x, image.y, { steps: 4 })
    await page.mouse.up()
    await settle(page)
    await page.waitForTimeout(300)
    expect(await page.evaluate(() => window.__overlayFlash)).toBe(0)
})
