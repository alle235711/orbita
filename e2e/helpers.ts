import { expect, type Page, type TestInfo } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
import { v1Fixture } from '../src/test/fixtures'
import { demoBackup } from './demo-data.js'

const pad = (n: number) => String(n).padStart(2, '0')
export const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
/** 1 = lunedì … 7 = domenica, come in src/lib/dates. */
export const isoWeekday = (d: Date) => ((d.getDay() + 6) % 7) + 1

/** Il file dei mazzi d'esempio: i nomi e gli id dei mazzi si leggono da qui, mai dal codice. */
export function sampleFile(): { corsi: { id: string; nome: string }[]; schede: unknown[] } {
  return JSON.parse(readFileSync(new URL('../content/schede-2026-27.json', import.meta.url), 'utf8'))
}

/** Dal primo passo del percorso guidato: "Ripristina un backup" con i dati dimostrativi, come farebbe una persona. */
export async function importDemo(page: Page, testInfo: TestInfo, today: string, extra: { settings?: { id: string; value: unknown; updatedAt: number }[]; courses?: unknown[]; results?: unknown[] } = {}): Promise<void> {
  const file = testInfo.outputPath('demo-backup.json')
  const backup = demoBackup(today, { deckIds: sampleFile().corsi.map((c) => c.id) })
  backup.tables.settings.push(...(extra.settings ?? []))
  backup.tables.courses.push(...(extra.courses ?? []))
  backup.tables.results.push(...(extra.results ?? []))
  writeFileSync(file, JSON.stringify(backup))
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Ripristina un backup' })).toBeVisible({ timeout: 20_000 })
  await page.locator('input[type=file]').first().setInputFiles(file)
  await expect(page.locator('.cover')).toBeVisible({ timeout: 20_000 })
}

/** Va avanti di un passo del percorso guidato. */
export const nextStep = (page: Page) => page.getByRole('button', { name: 'Avanti' }).click()

/**
 * Compila il percorso guidato fino al passo `upTo` (compreso) su un database nuovo.
 * Al passo 3 aggiunge un esame con il nome del primo mazzo d'esempio, con il solo mese;
 * con `acceptOffer` accetta il mazzo proposto e al passo 4 accende anche il peso.
 */
export async function walkWizard(page: Page, upTo: 1 | 2 | 3 | 4 | 5, options: { acceptOffer?: boolean } = {}): Promise<{ examName: string }> {
  // Un nome inventato, tranne quando serve il mazzo proposto: allora si legge dal file incluso.
  const examName = options.acceptOffer ? sampleFile().corsi[0]!.nome : 'Fisica Moderna'
  await page.goto('/')
  await expect(page.locator('.welcome')).toBeVisible({ timeout: 20_000 })
  await page.getByLabel('Come ti chiami').fill('Ada Demo')
  if (upTo >= 2) {
    await nextStep(page)
    await page.getByLabel('Ateneo').fill('Università di Prova')
  }
  if (upTo >= 3) {
    await nextStep(page)
    await page.getByRole('button', { name: 'Aggiungi un esame' }).click()
    await page.getByPlaceholder('Nome dell’esame').fill(examName)
    const date = new Date()
    date.setMonth(date.getMonth() + 4)
    await page.locator('.welcome__exam input[type=date]').fill(isoDate(date))
    await page.getByLabel('Giorno da fissare').check()
    if (options.acceptOffer) await page.getByRole('checkbox', { name: /Mazzo d’esempio/ }).check()
  }
  if (upTo >= 4) {
    await nextStep(page)
    if (options.acceptOffer) await page.getByRole('switch', { name: 'Peso' }).click()
  }
  if (upTo >= 5) {
    await nextStep(page)
    await page.getByLabel('Ore di studio e lavoro al giorno').fill('7')
    await page.keyboard.press('Tab')
  }
  return { examName }
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
  const chips = section.locator('.weekdays .chip')
  for (let day = 1; day <= 7; day++) {
    const chip = chips.nth(day - 1)
    const on = (await chip.getAttribute('aria-pressed')) === 'true'
    if (on !== settings.otherDays.includes(day)) await chip.click()
  }
  for (const day of settings.otherDays) await expect(chips.nth(day - 1)).toHaveAttribute('aria-pressed', 'true')
}

/** Gli archivi e gli indici della versione 1 (come SCHEMA_V1 in src/db/db.ts). */
const V1_STORES: Record<string, string[]> = {
  days: ['updatedAt'],
  sessions: ['date', 'type', 'courseId', 'updatedAt'],
  workouts: ['date', 'type', 'updatedAt'],
  weights: ['date', 'updatedAt'],
  events: ['date', 'updatedAt'],
  tasks: ['due', 'updatedAt'],
  courses: ['updatedAt'],
  deadlines: ['date', 'updatedAt'],
  cards: ['courseId', 'section', 'updatedAt'],
  cardState: ['due', 'updatedAt'],
  cardReviews: ['cardId', 'date', 'updatedAt'],
  typingRuns: ['date', 'lesson', 'updatedAt'],
  rules: ['updatedAt'],
  settings: ['updatedAt'],
}

/** Il timer in corso della fixture è di tanto tempo fa: per le prove a occhio si lascia fuori. */
function withoutTimer(rows: Record<string, { id: string }[]>): Record<string, object[]> {
  return { ...rows, settings: (rows.settings ?? []).filter((r) => r.id !== 'activeTimer') }
}

/**
 * Crea a mano il database della fase 1 (IndexedDB versione 10: Dexie moltiplica
 * per dieci) con le righe del `v1Fixture`, da una pagina della stessa origine
 * che non avvia l'app. Alla prossima apertura dell'app scatta l'aggiornamento.
 */
export async function seedV1Database(page: Page): Promise<void> {
  await page.goto('/manifest.webmanifest')
  await page.evaluate(
    async ({ stores, rows }) => {
      await new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('orbita', 10)
        open.onupgradeneeded = () => {
          for (const [name, indexes] of Object.entries(stores)) {
            const store = open.result.createObjectStore(name, { keyPath: 'id' })
            for (const index of indexes) store.createIndex(index, index)
          }
        }
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const db = open.result
          const tx = db.transaction(Object.keys(rows), 'readwrite')
          for (const [name, list] of Object.entries(rows)) for (const row of list as object[]) tx.objectStore(name).put(row)
          tx.oncomplete = () => {
            db.close()
            resolve()
          }
          tx.onerror = () => reject(tx.error)
        }
      })
    },
    { stores: V1_STORES, rows: withoutTimer(v1Fixture() as Record<string, { id: string }[]>) },
  )
}
