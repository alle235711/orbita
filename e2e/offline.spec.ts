import { expect, test } from '@playwright/test'

// Dopo la prima apertura l'app deve funzionare senza rete (alle Maldive):
// si riapre, mostra le schede, salva i dati.

test('funziona offline dopo il primo caricamento', async ({ page, context }) => {
  await page.goto('/#/dati')
  await expect(page.getByText(/502 schede/)).toBeVisible({ timeout: 20_000 })
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

  await page.goto('/#/statistiche')
  await expect(page.getByRole('heading', { name: 'Statistiche' })).toBeVisible()
  await context.setOffline(false)
})

test('manifest e icone sono validi', async ({ request }) => {
  const manifest = await (await request.get('/manifest.webmanifest')).json()
  expect(manifest).toMatchObject({ name: 'Orbita', lang: 'it', display: 'standalone', start_url: './' })
  for (const icon of manifest.icons) {
    const res = await request.get(`/${icon.src}`)
    expect(res.ok(), icon.src).toBe(true)
    expect(res.headers()['content-type']).toContain('image/png')
  }
  expect(manifest.icons.some((i: { purpose: string }) => i.purpose === 'maskable')).toBe(true)
})
