import { todayISO } from '../lib/dates'
import { importCards, parseContentFile, type ContentFile } from './cards-io'
import type { OrbitaDB } from './db'
import { ensureSeed } from './seed'

type ContentLoader = () => Promise<unknown>

// Il JSON delle schede sta in un pezzo a parte: si carica solo al primo
// avvio e il service worker lo tiene in cache per l'offline.
const loadBundledCards: ContentLoader = () => import('../../content/schede-2026-27.json').then((m) => m.default)

/** Al primo avvio importa le schede incluse nell'app. */
export async function ensureCards(db: OrbitaDB, load: ContentLoader = loadBundledCards): Promise<boolean> {
  const done = await db.settings.get('cardsImported')
  if (done) return false
  const file: ContentFile = parseContentFile(await load())
  await importCards(db, file)
  await db.settings.put({ id: 'cardsImported', value: { version: file.versione, date: todayISO() }, updatedAt: 0 })
  return true
}

export async function initDb(db: OrbitaDB, load?: ContentLoader): Promise<void> {
  await ensureSeed(db)
  await ensureCards(db, load)
}

/** Chiede al browser di non cancellare i dati locali (Safari, Chrome). */
export async function requestPersistence(): Promise<boolean | undefined> {
  if (!navigator.storage?.persist) return undefined
  if (await navigator.storage.persisted()) return true
  return navigator.storage.persist()
}
