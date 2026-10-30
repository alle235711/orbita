import { expect, test, type Page } from '@playwright/test'
import { importDemo, isoDate } from './helpers'

// Il Multiverso degli appelli con i dati dimostrativi: entrata dal Libretto e
// dalla cometa, tre universi, nessun filtro SVG/CSS (iPad), id unici, la scelta
// che sposta le comete, il carosello sul telefono.

const now = new Date()
now.setHours(10, 20, 0, 0)
const today = isoDate(now)

async function open(page: Page, testInfo: Parameters<typeof importDemo>[1], hash = '#/multiverso') {
  await page.clock.setFixedTime(now)
  await importDemo(page, testInfo, today)
  await page.goto(`/${hash}`)
  await page.waitForLoadState('networkidle')
}

test.describe('largo', () => {
  test.use({ viewport: { width: 1180, height: 820 }, reducedMotion: 'reduce' })

  test('dal Libretto al Multiverso, con la voce Libretto accesa', async ({ page }, testInfo) => {
    await open(page, testInfo, '#/libretto')
    await page.getByRole('link', { name: /Multiverso degli appelli/ }).click()
    await expect(page).toHaveURL(/#\/multiverso$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Multiverso' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Libretto', exact: true }).first()).toHaveAttribute('aria-current', 'page')
    await expect(page.locator('article.uni')).toHaveCount(3)
  })

  test('niente filtri, id unici, cieli leggeri, nessuno scroll orizzontale', async ({ page }, testInfo) => {
    await open(page, testInfo)
    await expect(page.locator('article.uni')).toHaveCount(3)
    expect(await page.locator('.multiverso filter, .multiverso feTurbulence, .multiverso feGaussianBlur, .multiverso animate, .multiverso animateTransform').count()).toBe(0)
    const bad = await page.evaluate(() => {
      const out: string[] = []
      for (const el of document.querySelectorAll('.multiverso *')) {
        const s = getComputedStyle(el)
        if (s.filter !== 'none') out.push(`filter ${el.className}`)
        if (s.backdropFilter && s.backdropFilter !== 'none') out.push(`backdrop ${el.className}`)
        if (s.mixBlendMode !== 'normal') out.push(`blend ${el.className}`)
        if (s.willChange !== 'auto') out.push(`will-change ${el.className}`)
      }
      return out
    })
    expect(bad).toEqual([])
    const ids = await page.evaluate(() => [...document.querySelectorAll('[id]')].map((e) => e.id))
    expect(new Set(ids).size).toBe(ids.length)
    const counts = await page.locator('svg.uni__svg').evaluateAll((els) => els.map((e) => e.querySelectorAll('*').length))
    expect(counts).toHaveLength(3)
    for (const n of counts) expect(n).toBeLessThanOrEqual(150)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })

  test('cambiando un appello cambia la data della laurea', async ({ page }, testInfo) => {
    await open(page, testInfo)
    const card = page.locator('article.uni').first()
    const grad = card.locator('.uni__fact--wide .uni__big').first()
    const before = await grad.textContent()
    await card.getByLabel('Appello per Cosmologia Osservativa').selectOption({ index: 2 })
    await expect(grad).not.toHaveText(before!)
  })

  test('aggiungere un appello lo mette nel menu delle schede', async ({ page }, testInfo) => {
    await open(page, testInfo)
    await expect(page.locator('article.uni')).toHaveCount(3)
    const select = page.locator('article.uni').first().getByLabel('Appello per Fisica Moderna')
    const before = await select.locator('option').count()
    await page.getByRole('button', { name: 'Gli appelli' }).click()
    const dialog = page.locator('dialog[open]')
    await dialog.getByRole('button', { name: 'Aggiungi un appello per Fisica Moderna' }).click()
    await expect(dialog.getByLabel(/^Appello 3$/).first()).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(select.locator('option')).toHaveCount(before + 1)
  })

  test('scegliere un universo sposta le date e le comete in copertina', async ({ page }, testInfo) => {
    await open(page, testInfo, '#/oggi')
    const list = page.locator('section[aria-labelledby="cosmos-h"] ul').first()
    await expect(page.locator('[data-comet]').first()).toBeAttached()
    const cometsBefore = await page.locator('[data-comet]').count()
    const textBefore = await list.textContent()
    await page.goto('/#/multiverso')
    await page.locator('article.uni').first().getByRole('button', { name: 'Scegli questo universo' }).click()
    const dialog = page.locator('dialog[open]')
    await expect(dialog.getByRole('heading', { name: /Scegliere Subito/ })).toBeVisible()
    await dialog.getByRole('button', { name: 'Aggiorna le date' }).click()
    await expect(page.locator('.toasts, [role=status]').getByText(/Date aggiornate/).first()).toBeVisible()
    await expect(page.locator('article.uni').first().getByText('Date in uso')).toBeVisible()
    await page.goto('/#/oggi')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('[data-comet]')).toHaveCount(cometsBefore)
    await expect(list).not.toHaveText(textBefore!)
  })

  test('una cometa della copertina porta al Multiverso', async ({ page }, testInfo) => {
    await open(page, testInfo, '#/oggi')
    await page.locator('.cosmos__hit').first().dispatchEvent('click')
    await expect(page).toHaveURL(/#\/multiverso$/)
  })
})

test.describe('telefono', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' })

  test('il carosello scorre e la pagina no', async ({ page }, testInfo) => {
    await open(page, testInfo)
    const box = page.locator('.mv__grid')
    await expect(box).toHaveAttribute('aria-roledescription', 'carosello')
    const m = await box.evaluate((e) => ({ scroll: e.scrollWidth, client: e.clientWidth }))
    expect(m.scroll).toBeGreaterThan(m.client)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    const first = await page.locator('article.uni').first().boundingBox()
    const second = await page.locator('article.uni').nth(1).boundingBox()
    expect(first!.x).toBeGreaterThanOrEqual(0)
    expect(first!.x + first!.width).toBeLessThanOrEqual(390)
    // la seconda scheda si intravede
    expect(second!.x).toBeLessThan(390)
    await box.evaluate((e) => e.scrollTo({ left: e.scrollWidth, behavior: 'instant' }))
    await expect(page.locator('.mv__dot--on')).toHaveCount(1)
  })
})
