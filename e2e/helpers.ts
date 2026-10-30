import { expect, type Page, type TestInfo } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
import { demoBackup } from './demo-data.js'

const pad = (n: number) => String(n).padStart(2, '0')
export const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
/** 1 = lunedì … 7 = domenica, come in src/lib/dates. */
export const isoWeekday = (d: Date) => ((d.getDay() + 6) % 7) + 1

/** Importa i dati dimostrativi dalla pagina Dati, come farebbe una persona. */
export async function importDemo(page: Page, testInfo: TestInfo, today: string): Promise<void> {
  const cards = JSON.parse(readFileSync(new URL('../content/schede-2026-27.json', import.meta.url), 'utf8')).schede
  const file = testInfo.outputPath('demo-backup.json')
  writeFileSync(file, JSON.stringify(demoBackup(today, { cards })))
  await page.goto('/#/dati')
  await expect(page.getByText(/502 schede/)).toBeVisible({ timeout: 20_000 })
  await page.locator('input[type=file]').first().setInputFiles(file)
  await expect(page.getByText(/Backup importato/)).toBeVisible()
}

/**
 * Imposta la lingua dalla sezione "Lingua" di Dati, come farebbe una persona:
 * la lingua di base e i giorni (1 = lunedì … 7 = domenica) nell'altra lingua.
 * Dopo la chiamata l'interfaccia è già nella lingua del giorno.
 */
export async function setLanguage(page: Page, settings: { base: 'it' | 'en'; otherDays: number[] }): Promise<void> {
  await page.goto('/#/dati')
  const section = page.locator('#h-lingua').locator('xpath=..')
  await expect(section).toBeVisible({ timeout: 20_000 })
  await section.locator(`.segmented__item[lang=${settings.base}]`).click()
  const chips = section.locator('.dati__days .chip')
  for (let day = 1; day <= 7; day++) {
    const chip = chips.nth(day - 1)
    const on = (await chip.getAttribute('aria-pressed')) === 'true'
    if (on !== settings.otherDays.includes(day)) await chip.click()
  }
  for (const day of settings.otherDays) await expect(chips.nth(day - 1)).toHaveAttribute('aria-pressed', 'true')
}
