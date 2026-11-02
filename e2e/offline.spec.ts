import { expect, test } from '@playwright/test'
import { walkWizard } from './helpers'

// Dopo il percorso guidato e il primo caricamento l'app deve funzionare senza
// rete (in viaggio): si riapre, mostra le schede, salva i dati.

test('dal primo avvio funziona offline', async ({ page, context }) => {
  // I cinque passi su un database nuovo: nome, ateneo, un esame col solo mese
  // con il mazzo d'esempio accettato, un modulo, le ore al giorno.
  await walkWizard(page, 5, { acceptOffer: true })
  await page.getByRole('button', { name: 'Fine' }).click()
  await expect(page.locator('.cover')).toBeVisible({ timeout: 20_000 })

  // Le schede d'esempio arrivano in sottofondo: l'esercizio compare.
  await page.goto('/#/ripasso')
  await expect(page.locator('.exercise__text')).toBeVisible({ timeout: 30_000 })
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)

  await context.setOffline(true)
  await page.goto('/#/oggi')
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Una giornata')
  await page.getByRole('radio', { name: /Blazar/ }).click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('da teoria nuova')

  await page.goto('/#/ripasso')
  await expect(page.locator('.exercise__text')).toBeVisible()
  const fonts = await page.evaluate(async () => {
    await document.fonts.ready
    return {
      grotesk: document.fonts.check('900 20px "Schibsted Grotesk Variable"'),
      mono: document.fonts.check('20px "JetBrains Mono Variable"'),
    }
  })
  expect(fonts).toEqual({ grotesk: true, mono: true })

  // Le formule: il convertitore rende con KaTeX le proposte per le schede d'esempio,
  // e i font di KaTeX arrivano dal precache del service worker.
  await page.goto('/#/dati?vista=latex')
  await expect(page.locator('.latex-item .katex').first()).toBeVisible({ timeout: 20_000 })
  const katexFonts = await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all([document.fonts.load('20px KaTeX_Main'), document.fonts.load('italic 20px KaTeX_Math')])
    const faces = [...document.fonts].filter((f) => f.family.replace(/["']/g, '').startsWith('KaTeX_'))
    return {
      main: faces.some((f) => f.family.includes('KaTeX_Main') && f.style === 'normal' && f.weight === '400' && f.status === 'loaded'),
      math: faces.some((f) => f.family.includes('KaTeX_Math') && f.style === 'italic' && f.status === 'loaded'),
      errors: faces.filter((f) => f.status === 'error').map((f) => `${f.family} ${f.style} ${f.weight}`),
    }
  })
  expect(katexFonts).toEqual({ main: true, math: true, errors: [] })

  await page.goto('/#/statistiche')
  await expect(page.getByRole('heading', { name: 'Statistiche' })).toBeVisible()
  await context.setOffline(false)
})

test('il percorso guidato non nasconde i pulsanti dietro l’avviso offline', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.welcome')).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('.update-toast')).toBeVisible({ timeout: 20_000 })
  const next = await page.getByRole('button', { name: 'Avanti' }).boundingBox()
  const toast = await page.locator('.update-toast').boundingBox()
  // L'avviso sta sopra i pulsanti, non li copre.
  expect(next && toast && toast.y + toast.height <= next.y).toBe(true)
})

test('manifest e icone sono validi', async ({ request }) => {
  const manifest = await (await request.get('/manifest.webmanifest')).json()
  expect(manifest).toMatchObject({ name: 'Orbita', lang: 'it', display: 'standalone', start_url: './' })
  expect(manifest.description).not.toMatch(/laurea/i)
  for (const icon of manifest.icons) {
    const res = await request.get(`/${icon.src}`)
    expect(res.ok(), icon.src).toBe(true)
    expect(res.headers()['content-type']).toContain('image/png')
  }
  expect(manifest.icons.some((i: { purpose: string }) => i.purpose === 'maskable')).toBe(true)
})
