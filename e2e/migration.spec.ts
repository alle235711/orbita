import { expect, test } from '@playwright/test'
import { seedV1Database } from './helpers'

// Chi aggiorna dalla fase 1 trova i suoi dati: l'aggiornamento di Dexie (da
// IndexedDB 10 a 30) li porta al formato nuovo e la copertina invita a
// completare il profilo.

// La fixture della fase 1 ha la lingua «martedì in inglese» (otherDays: [2]):
// il giorno vero cambia l'interfaccia. Si fissa un mercoledì, giorno nella
// lingua di base, così la prova non dipende dal giorno in cui gira.
const MERCOLEDI = new Date('2026-11-04T10:00:00+01:00')

test('un database della fase 1 si aggiorna e conserva i dati', async ({ page }) => {
  await page.clock.setFixedTime(MERCOLEDI)
  await seedV1Database(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Completa il profilo' })).toBeVisible({ timeout: 20_000 })

  // La versione è salita a 60 e le righe sono nel formato nuovo.
  const state = await page.evaluate(
    () =>
      new Promise<{ version: number; sessionTypes: Record<string, string>; ruleIds: string[]; deadlineIds: string[]; profile: unknown; resultsIndexes: string[]; appelliIndexes: string[]; universesIndexes: string[] }>((resolve, reject) => {
        const open = indexedDB.open('orbita')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const db = open.result
          const tx = db.transaction(['sessions', 'rules', 'deadlines', 'settings'], 'readonly')
          const all = (name: string) =>
            new Promise<{ id: string; type?: string; value?: unknown }[]>((res) => {
              const req = tx.objectStore(name).getAll()
              req.onsuccess = () => res(req.result)
            })
          void Promise.all([all('sessions'), all('rules'), all('deadlines'), all('settings')]).then(([sessions, rules, deadlines, settings]) => {
            const version = db.version
            const resultsIndexes = db.objectStoreNames.contains('results') ? [...db.transaction('results', 'readonly').objectStore('results').indexNames] : []
            const indexesOf = (name: string) => (db.objectStoreNames.contains(name) ? [...db.transaction(name, 'readonly').objectStore(name).indexNames] : [])
            const appelliIndexes = indexesOf('appelli')
            const universesIndexes = indexesOf('universes')
            db.close()
            resolve({
              appelliIndexes,
              universesIndexes,
              version,
              resultsIndexes,
              sessionTypes: Object.fromEntries(sessions.map((s) => [s.id, s.type ?? ''])),
              ruleIds: rules.map((r) => r.id),
              deadlineIds: deadlines.map((d) => d.id),
              profile: settings.find((s) => s.id === 'profile')?.value,
            })
          })
        }
      }),
  )
  // Dexie moltiplica per dieci: versione 6 (tabella dei mazzi) = 60
  expect(state.version).toBe(60)
  expect(state.appelliIndexes).toEqual(expect.arrayContaining(['courseId', 'date', 'updatedAt']))
  expect(state.universesIndexes).toEqual(expect.arrayContaining(['order', 'updatedAt']))
  expect(state.resultsIndexes).toEqual(expect.arrayContaining(['courseId', 'date', 'updatedAt']))
  expect(state.sessionTypes).toMatchObject({ s1: 'abilita', s2: 'lingua', s3: 'studio' })
  expect(state.ruleIds).toEqual(expect.arrayContaining(['abilita', 'periodo']))
  expect(state.ruleIds).not.toContain('lean')
  expect(state.deadlineIds).not.toContain('laurea')
  expect(state.profile).toMatchObject({ graduationTarget: '2027-07' })

  // I corsi e il periodo ci sono ancora, in Dati.
  await page.goto('/#/dati')
  await expect(page.locator('input[aria-label="Nome dell’esame"]').first()).toBeVisible({ timeout: 20_000 })
  const names = await page.locator('input[aria-label="Nome dell’esame"]').evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value))
  expect(names).toEqual(expect.arrayContaining(['Fisica Moderna', 'Calcolo Numerico']))
  const periods = await page.locator('input[aria-label="Nome del periodo"]').evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value))
  expect(periods).toEqual(['Periodo estivo'])
})

test('la scheda del profilo non sposta orbita, chip e gesso sul layout largo', async ({ page }) => {
  await page.clock.setFixedTime(MERCOLEDI)
  await page.setViewportSize({ width: 1180, height: 820 })
  await seedV1Database(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Completa il profilo' })).toBeVisible({ timeout: 20_000 })
  await page.waitForTimeout(1500)
  const labels = page.locator('.orbit--planets text')
  await expect(labels.first()).toBeVisible()
  type Box = { left: number; right: number; top: number; bottom: number }
  const chips = await page.locator('.energy__option').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON() as Box))
  const texts = await labels.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON() as Box))
  expect(chips.length).toBe(5)
  const touches = (a: Box, b: Box) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
  for (const text of texts) for (const chip of chips) expect(touches(text, chip), 'etichetta sopra un chip').toBe(false)
  // il numero del giorno in gesso sta sotto i chip, come sulla copertina senza la scheda
  const day = (await page.locator('.cover__day').evaluate((e) => e.getBoundingClientRect().toJSON())) as Box
  for (const chip of chips) expect(day.top).toBeGreaterThanOrEqual(chip.bottom - 40)
})
