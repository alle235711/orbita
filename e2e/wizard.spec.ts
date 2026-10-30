import { expect, test } from '@playwright/test'
import { nextStep, walkWizard } from './helpers'

// Il percorso guidato non corregge in silenzio i valori fuori limite e non
// taglia nulla sul telefono.

test('crediti non validi: errore in chiaro e si resta sul passo', async ({ page }) => {
  await walkWizard(page, 2)
  const cfu = page.getByLabel('Crediti totali (CFU)')
  const error = page.getByRole('alert').filter({ hasText: 'numero intero di crediti' })
  for (const bad of ['0', '601', '12.5']) {
    await cfu.fill(bad)
    await page.keyboard.press('Tab')
    await expect(error).toBeVisible()
    await expect(cfu).toHaveValue(bad)
    await nextStep(page)
    await expect(page.locator('.welcome__eyebrow')).toHaveText('2 di 5')
  }
  await cfu.fill('120')
  await page.keyboard.press('Tab')
  await expect(error).toHaveCount(0)
  await nextStep(page)
  await expect(page.locator('.welcome__eyebrow')).toHaveText('3 di 5')
})

test.describe('telefono', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

  test('i moduli non escono dallo schermo', async ({ page }) => {
    await walkWizard(page, 4)
    await expect(page.getByRole('switch', { name: 'Sport' })).toBeVisible()
    const boxes = await page.locator('.welcome__panel input, .welcome__panel select, .welcome__panel .switch').evaluateAll((els) =>
      els.map((e) => {
        const r = e.getBoundingClientRect()
        return { right: r.right, left: r.left, visible: r.width > 0 }
      }),
    )
    for (const b of boxes.filter((x) => x.visible)) {
      expect(b.left).toBeGreaterThanOrEqual(0)
      expect(b.right).toBeLessThanOrEqual(390)
    }
  })
})
