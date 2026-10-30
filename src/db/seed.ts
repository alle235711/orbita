import type { OrbitaDB } from './db'

// Dalla versione 2 il seed scrive solo la versione: nessun corso, scadenza o
// regola. I valori predefiniti vengono dal codice (SETTING_DEFAULTS,
// defaultThresholds); updatedAt = 0 vuol dire "mai modificato".

export const SEED_VERSION = 2

/** Segna la versione del seed se manca o è più vecchia. */
export async function ensureSeed(db: OrbitaDB): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    const version = await db.settings.get('seedVersion')
    if (typeof version?.value === 'number' && version.value >= SEED_VERSION) return
    await db.settings.put({ id: 'seedVersion', value: SEED_VERSION, updatedAt: 0 })
  })
}
