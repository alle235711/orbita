import { expect, type Locator, type Page, type TestInfo } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
import { readTable } from './ics-helpers'

/** Un mercoledì alle 10:20, come per le altre prove (la lingua del giorno nelle fixture cambia di martedì). */
export { aWednesday } from './tex-helpers'

export interface DeckJson {
  app: string
  tipo: string
  versione: number
  mazzo: { id: string; nome: string; autore: string; ateneo: string; corso: string; anno: string; licenza: string; note: string; aggiornato: number; sezioni: string[] }
  schede: { id: string; sezione: string; titolo: string; testo: string; aggiornata: number; cancellata?: number }[]
}

interface Row {
  id: string
  courseId: string
  deletedAt?: number
}

/** Un corso con due schede brevissime: il mazzo ci sta nel codice QR. */
export const MINI = {
  courses: [{ id: 'mini-c', name: 'Mini Corso', sections: ['Uno'], difficulty: 2, updatedAt: 1 }],
  cards: [
    { id: 'mini-1', courseId: 'mini-c', section: 'Uno', kind: 'definizione', title: 'A', text: 'Vale $x$.', key: '', needsFix: false, userEdited: false, updatedAt: 1 },
    { id: 'mini-2', courseId: 'mini-c', section: 'Uno', kind: 'definizione', title: 'B', text: 'Vale $y$.', key: '', needsFix: false, userEdited: false, updatedAt: 1 },
  ],
}

/** Un corso con trenta schede dal testo lungo e vario: non ci sta in nessun QR. */
export function bigDeck() {
  let seed = 11
  const next = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff)
  return {
    courses: [{ id: 'grande-c', name: 'Corso Grande', sections: ['Uno', 'Due'], difficulty: 2, updatedAt: 1 }],
    cards: Array.from({ length: 30 }, (_, i) => ({
      id: `grande-${i}`,
      courseId: 'grande-c',
      section: i % 2 ? 'Due' : 'Uno',
      kind: 'teorema',
      title: `Teorema ${i}`,
      text: Array.from({ length: 40 }, () => next().toString(36)).join(' '),
      key: '',
      needsFix: false,
      userEdited: false,
      updatedAt: 1,
    })),
  }
}

export async function openMazzi(page: Page): Promise<void> {
  await page.goto('/#/mazzi')
  await expect(page.getByRole('heading', { level: 1, name: 'Mazzi' })).toBeVisible()
}

export const shareButton = (page: Page, name: string): Locator => page.getByRole('button', { name: `Condividi il mazzo ${name}` })

/** Apre il foglio di condivisione di un mazzo. */
export async function openShare(page: Page, name: string): Promise<Locator> {
  await shareButton(page, name).click()
  const sheet = page.getByRole('dialog', { name: 'Condividi il mazzo' })
  await expect(sheet).toBeVisible()
  // L'entrata del foglio è una transizione: si aspetta che finisca prima di agire.
  await page.waitForFunction(() => {
    const d = document.querySelector('dialog[open]')
    return !!d && getComputedStyle(d).opacity === '1'
  })
  return sheet
}

/** Preme un pulsante che scarica un file e lo salva nella cartella del test. */
export async function downloadWith(page: Page, testInfo: TestInfo, click: () => Promise<void>): Promise<{ path: string; name: string }> {
  const [download] = await Promise.all([page.waitForEvent('download'), click()])
  const path = testInfo.outputPath(download.suggestedFilename())
  await download.saveAs(path)
  return { path, name: download.suggestedFilename() }
}

export const readDeckJson = (path: string): DeckJson => JSON.parse(readFileSync(path, 'utf8'))

/** Scrive un mazzo (cambiato dal test) come file e restituisce il percorso. */
export function writeDeckJson(testInfo: TestInfo, name: string, deck: unknown): string {
  const path = testInfo.outputPath(name)
  writeFileSync(path, JSON.stringify(deck))
  return path
}

/** Una copia del mazzo come l'avrebbe fatta un'altra persona: stesso contenuto, tutti gli id diversi. */
export function asOtherPerson(deck: DeckJson, tag: string): DeckJson {
  return { ...structuredClone(deck), mazzo: { ...deck.mazzo, id: `${deck.mazzo.id}-${tag}` }, schede: deck.schede.map((s) => ({ ...s, id: `${tag}-${s.id}` })) }
}

/** Sceglie il file nella sezione «Importa un mazzo», come farebbe una persona. */
export async function chooseDeck(page: Page, path: string): Promise<void> {
  await page.locator('input[type=file]').setInputFiles(path)
}

export const importSection = (page: Page): Locator => page.locator('section', { has: page.getByRole('heading', { level: 2, name: 'Importa un mazzo' }) })

export async function aliveCards(page: Page, courseId?: string): Promise<Row[]> {
  return (await readTable<Row>(page, 'cards')).filter((c) => !c.deletedAt && (!courseId || c.courseId === courseId))
}
