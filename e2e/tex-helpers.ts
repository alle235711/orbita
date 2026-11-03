import { expect, type Page, type TestInfo } from '@playwright/test'
import { writeFileSync } from 'node:fs'

/** Un mercoledì alle 10:20 (il prossimo, o oggi): la lingua del giorno nelle fixture cambia di martedì, qui non deve contare. */
export function aWednesday(): Date {
  const d = new Date()
  d.setHours(10, 20, 0, 0)
  while (d.getDay() !== 3) d.setDate(d.getDate() + 1)
  return d
}

/** Scrive un .tex generato dal test e lo restituisce come percorso da scegliere nel file input. */
export function writeTex(testInfo: TestInfo, name: string, content: string): string {
  const file = testInfo.outputPath(name)
  writeFileSync(file, content)
  return file
}

/** Apre "Importa da file .tex" dalla pagina Dati e sceglie i file, come farebbe una persona. */
export async function chooseTexFiles(page: Page, files: string[]): Promise<void> {
  await page.getByRole('heading', { level: 1, name: 'Importa schede da file .tex' }).waitFor()
  await page.locator('input[type=file]').setInputFiles(files)
  await expect(page.locator('.tex-table')).toBeVisible()
}

export async function openTexImport(page: Page): Promise<void> {
  await page.goto('/#/dati')
  await page.getByRole('link', { name: 'Importa da file .tex' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Importa schede da file .tex' })).toBeVisible()
}
