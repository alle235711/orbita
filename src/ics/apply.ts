// Scrittura del piano nel database locale: una sola transazione, tutto passa da repo.ts (updatedAt, cancellazione logica).

import type { OrbitaDB } from '../db/db'
import { patch, remove, save } from '../db/repo'
import type { CalendarEvent } from '../db/schema'
import type { IcsImportPlan } from './plan'

export interface ApplyResult {
  added: number
  updated: number
  removed: number
}

export async function applyIcsPlan(db: OrbitaDB, plan: IcsImportPlan): Promise<ApplyResult> {
  await db.transaction('rw', db.events, async () => {
    for (const row of plan.add) await save<CalendarEvent>(db.events, row)
    for (const u of plan.update) await patch(db.events, u.id, u.changes)
    for (const id of plan.remove) await remove(db.events, id)
  })
  return { added: plan.add.length, updated: plan.update.length, removed: plan.remove.length }
}
