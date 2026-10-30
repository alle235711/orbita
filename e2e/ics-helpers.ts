import { expect, type Page, type TestInfo } from '@playwright/test'
import { writeFileSync } from 'node:fs'
import { orarioIcs } from './ics-fixture'

/** I corsi demo usati dall'orario inventato: uno per nome esatto, uno per nome con parentesi, uno per codice. */
export const ICS_COURSES = { fisica: 'Fisica Moderna', calcolo: 'Calcolo Numerico', codeCourse: 'ALC-301' }

/** Apre il foglio "Importa orario" dall'Agenda e sceglie il file inventato: arriva all'anteprima, senza scrivere nulla. */
export async function openIcsPreview(page: Page, testInfo: TestInfo, today: string): Promise<void> {
  const file = testInfo.outputPath('orario.ics')
  writeFileSync(file, orarioIcs(today, ICS_COURSES))
  await page.goto('/#/agenda')
  await page.getByRole('button', { name: 'Importa orario' }).click()
  await page.locator('dialog[open] input[type=file]').setInputFiles(file)
  await expect(page.locator('.ics-groups')).toBeVisible({ timeout: 10_000 })
}

/** Importa l'orario inventato come farebbe una persona: anteprima, conferma, foglio chiuso. */
export async function importIcs(page: Page, testInfo: TestInfo, today: string, choose: Record<string, string> = {}): Promise<void> {
  await openIcsPreview(page, testInfo, today)
  for (const [summary, option] of Object.entries(choose)) {
    await page.getByRole('combobox', { name: `Corso per «${summary}»` }).selectOption({ label: option })
  }
  await page.getByRole('button', { name: /^Importa \d+ lezion/ }).click()
  await expect(page.locator('dialog[open]')).toHaveCount(0)
}

/** Le righe di una tabella di Orbita, lette direttamente da IndexedDB. */
export async function readTable<T = Record<string, unknown>>(page: Page, table: string): Promise<T[]> {
  return page.evaluate(
    (name) =>
      new Promise<unknown[]>((resolve, reject) => {
        const open = indexedDB.open('orbita')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const db = open.result
          const req = db.transaction(name).objectStore(name).getAll()
          req.onsuccess = () => {
            db.close()
            resolve(req.result)
          }
          req.onerror = () => reject(req.error)
        }
      }),
    table,
  ) as Promise<T[]>
}
