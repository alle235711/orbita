import { expect, type Page, type TestInfo } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
import { demoBackup } from './demo-data.js'

const pad = (n: number) => String(n).padStart(2, '0')
export const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

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
