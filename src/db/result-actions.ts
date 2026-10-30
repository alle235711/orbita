import { AppError } from '../i18n/errors'
import { canonicalResult, isGradedPass, validateResultDraft, type ResultDraft, type ResultField } from '../libretto/grades'
import type { OrbitaDB } from './db'
import { alive, remove, save } from './repo'
import type { ExamResult } from './schema'
import { getSetting, setSetting, type PendingCapture } from './settings'

export interface RecordOutcome {
  result: ExamResult
  captured: boolean
}

const MAX_PENDING = 200
const FIELD_ORDER: ResultField[] = ['course', 'date', 'grade']

export function normalizePendingCaptures(raw: unknown): PendingCapture[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: PendingCapture[] = []
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue
    const { resultId, courseId } = item as Record<string, unknown>
    if (typeof resultId !== 'string' || typeof courseId !== 'string' || seen.has(resultId)) continue
    seen.add(resultId)
    out.push({ resultId, courseId })
    if (out.length >= MAX_PENDING) break
  }
  return out
}

/** Crea (senza id) o modifica un risultato. Un voto nuovo finisce tra le catture in sospeso. */
export async function recordResult(db: OrbitaDB, draft: ResultDraft, opts: { id?: string } = {}): Promise<RecordOutcome> {
  return db.transaction('rw', db.results, db.courses, db.settings, async () => {
    const courseIds = new Set(alive(await db.courses.toArray()).map((c) => c.id))
    const errors = validateResultDraft(draft, courseIds)
    if (errors) {
      const field = FIELD_ORDER.find((f) => errors[f])!
      throw new AppError('resultInvalid', { field, code: errors[field]! })
    }
    const fields = canonicalResult(draft)
    let wasGradedPass = false
    if (opts.id) {
      const previous = await db.results.get(opts.id)
      wasGradedPass = !!previous && !previous.deletedAt && isGradedPass(previous)
    }
    // La riga si riscrive intera: nessun voto o lode vecchi, deletedAt azzerato.
    const saved = await save<ExamResult>(db.results, opts.id ? { id: opts.id, ...fields } : fields)
    const captured = isGradedPass(saved) && !wasGradedPass
    const pending = normalizePendingCaptures(await getSetting(db, 'pendingCaptures'))
    if (captured) {
      await setSetting(db, 'pendingCaptures', [...pending.filter((p) => p.resultId !== saved.id), { resultId: saved.id, courseId: saved.courseId }])
    } else if (!isGradedPass(saved) && pending.some((p) => p.resultId === saved.id)) {
      await setSetting(db, 'pendingCaptures', pending.filter((p) => p.resultId !== saved.id))
    }
    return { result: saved, captured }
  })
}

export async function removeResult(db: OrbitaDB, id: string): Promise<void> {
  await db.transaction('rw', db.results, db.settings, async () => {
    await remove(db.results, id)
    const pending = normalizePendingCaptures(await getSetting(db, 'pendingCaptures'))
    if (pending.some((p) => p.resultId === id)) await setSetting(db, 'pendingCaptures', pending.filter((p) => p.resultId !== id))
  })
}

/** Toglie una cattura dall'attesa (animata o scaduta). Idempotente: un id sconosciuto non fa nulla. */
export async function consumeCapture(db: OrbitaDB, resultId: string): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    const pending = normalizePendingCaptures(await getSetting(db, 'pendingCaptures'))
    const next = pending.filter((p) => p.resultId !== resultId)
    if (next.length !== pending.length) await setSetting(db, 'pendingCaptures', next)
  })
}
