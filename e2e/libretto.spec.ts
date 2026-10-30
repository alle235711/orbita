import { expect, test } from '@playwright/test'
import { importDemo, isoDate } from './helpers'

// Il Libretto con i dati dimostrativi: la media, un voto nuovo dal pannello,
// l'esame superato che esce da Registra, i dati che restano e il lavoro offline.

const today = isoDate(new Date())

test('libretto: un voto nuovo cambia i CFU e toglie l’esame dalle scelte', async ({ page, context }, testInfo) => {
  await page.setViewportSize({ width: 1180, height: 820 })
  await importDemo(page, testInfo, today)

  await page.getByRole('link', { name: 'Libretto' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Libretto' })).toBeVisible()
  const mean = page.locator('.lib__mean')
  await expect(mean).toBeVisible()
  await expect(mean).not.toHaveText('—')
  await expect(page.getByText('39 di 180 CFU').first()).toBeVisible()

  // Registra un 26 per Topologia Generale.
  await page.getByRole('button', { name: 'Registra un voto' }).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Esame', { exact: true }).selectOption({ label: 'Topologia Generale' })
  await dialog.getByLabel('Voto', { exact: true }).fill('26')
  await dialog.getByRole('button', { name: 'Salva' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText('51 di 180 CFU').first()).toBeVisible()
  await expect(page.locator('.lib__row-name', { hasText: 'Topologia Generale' })).toBeVisible()

  // Un secondo pannello non offre più quell'esame.
  await page.getByRole('button', { name: 'Registra un voto' }).first().click()
  const options = await page.getByRole('dialog').getByLabel('Esame', { exact: true }).locator('option').allTextContents()
  expect(options).not.toContain('Topologia Generale')
  expect(options).toContain('Fisica Moderna')
  await page.getByRole('dialog').getByRole('button', { name: 'Annulla' }).click()

  // Registra in Oggi non propone più l'esame superato.
  await page.goto('/#/oggi')
  await page.getByRole('button', { name: 'Registra' }).first().click()
  const logCourses = await page.getByRole('dialog').getByLabel('Corso').locator('option').allTextContents()
  expect(logCourses).not.toContain('Topologia Generale')
  expect(logCourses.length).toBeGreaterThan(0)
  await page.keyboard.press('Escape')

  // I dati restano dopo il ricaricamento.
  await page.goto('/#/libretto')
  await page.reload()
  await expect(page.getByText('51 di 180 CFU').first()).toBeVisible()

  // Senza rete il Libretto funziona ancora.
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('.lib__mean')).toBeVisible()
  await expect(page.getByText('51 di 180 CFU').first()).toBeVisible()
  await context.setOffline(false)
})

test('libretto: il simulatore risponde all’obiettivo', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await importDemo(page, testInfo, today)
  await page.goto('/#/libretto')
  const sentence = page.locator('.lib__sentence')
  await expect(sentence).toContainText('ti serve almeno')
  await page.getByLabel('Media obiettivo').fill('30')
  await page.getByLabel('Media obiettivo').blur()
  await expect(sentence).toContainText('non è più raggiungibile')
  // Nessuno scorrimento orizzontale sul telefono.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})

test('libretto: un divisore fuori limite mostra l’errore e non si salva', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1180, height: 820 })
  await importDemo(page, testInfo, today)
  await page.goto('/#/libretto')
  await page.getByRole('button', { name: 'Modifica la formula' }).click()
  const divisor = page.getByRole('dialog').getByLabel('Divisore (di solito 30)')
  await divisor.fill('0')
  await divisor.blur()
  await expect(page.getByRole('dialog').getByRole('alert').filter({ hasText: 'Scrivi un numero da 1 a 100' })).toBeVisible()
  await divisor.fill('30')
  await divisor.blur()
  await expect(page.getByRole('dialog').getByText('Scrivi un numero da 1 a 100')).toBeHidden()
})
