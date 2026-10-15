import { expect, test } from '@playwright/test'
import { hoverBlock, open } from './helpers'

test('the demo loads and shows the handle next to a hovered block', async ({ page }) => {
    await open(page, '/')
    await hoverBlock(page, 'A regular paragraph')
    await expect(page.locator('.drag-handle')).toBeVisible()
})
