// Scritture del Multiverso: appelli, universi, scelta. Tutto passa da save/patch/remove.

import { AppError } from '../i18n/errors'
import type { ISODate } from '../lib/dates'
import { gradeProfile, MAX_GRADE, MIN_GRADE, normalizeGraduation } from '../libretto/grades'
import { applyUniverse, evaluateUniverse, examSet, isUsableDate, MAX_NOTE, MAX_UNIVERSES, MIN_UNIVERSES, normalizeMultiverse, suggestPicks, type ExamDateChange } from '../multiverse/scenario'
import type { OrbitaDB } from './db'
import { normalizeProfile } from './profile'
import { alive, patch, remove, save } from './repo'
import type { Appello, Universe } from './schema'
import { getSetting } from './settings'

export type AppelloField = 'course' | 'date'
export type AppelloErrorCode = 'required' | 'invalid' | 'duplicate'

const MAX_NAME = 40

const fail = (field: AppelloField, code: AppelloErrorCode): never => {
  throw new AppError('appelloInvalid', { field, code })
}

function cleanNote(note: string | null | undefined): string | undefined {
  const n = typeof note === 'string' ? note.trim().slice(0, MAX_NOTE).trim() : ''
  return n || undefined
}

async function checkAppello(db: OrbitaDB, courseId: string, date: string, selfId?: string): Promise<void> {
  if (!courseId) fail('course', 'required')
  const course = await db.courses.get(courseId)
  if (!course || course.deletedAt) fail('course', 'invalid')
  if (!date) fail('date', 'required')
  if (!isUsableDate(date)) fail('date', 'invalid')
  const same = alive(await db.appelli.where('courseId').equals(courseId).toArray())
  if (same.some((a) => a.date === date && a.id !== selfId)) fail('date', 'duplicate')
}

export async function addAppello(db: OrbitaDB, draft: { courseId: string; date: string; note?: string }): Promise<Appello> {
  return db.transaction('rw', db.courses, db.appelli, async () => {
    await checkAppello(db, draft.courseId, draft.date)
    const note = cleanNote(draft.note)
    return save<Appello>(db.appelli, { courseId: draft.courseId, date: draft.date, ...(note ? { note } : {}) })
  })
}

export async function editAppello(db: OrbitaDB, id: string, changes: { date?: string; note?: string | null }): Promise<Appello> {
  return db.transaction('rw', db.courses, db.appelli, async () => {
    const current = await db.appelli.get(id)
    if (!current || current.deletedAt) return fail('course', 'invalid')
    const date = changes.date ?? current.date
    await checkAppello(db, current.courseId, date, id)
    const note = 'note' in changes ? cleanNote(changes.note) : current.note
    // La riga si riscrive intera: una nota tolta sparisce davvero.
    return save<Appello>(db.appelli, { id, courseId: current.courseId, date, ...(note ? { note } : {}) })
  })
}

/** Toglie l'appello e la sua scelta da ogni universo vivo, nella stessa transazione. */
export async function removeAppello(db: OrbitaDB, id: string): Promise<void> {
  await db.transaction('rw', db.appelli, db.universes, async () => {
    const current = await db.appelli.get(id)
    if (!current || current.deletedAt) return
    await remove(db.appelli, id)
    for (const u of alive(await db.universes.toArray())) {
      const hit = Object.entries(u.picks).filter(([, v]) => v === id)
      if (!hit.length) continue
      const picks = { ...u.picks }
      for (const [k] of hit) delete picks[k]
      await patch<Universe>(db.universes, u.id, { picks })
    }
  })
}

export async function createUniverse(db: OrbitaDB, today: ISODate): Promise<Universe> {
  return db.transaction('rw', db.courses, db.results, db.appelli, db.universes, async () => {
    const live = alive(await db.universes.toArray())
    if (live.length >= MAX_UNIVERSES) throw new AppError('universeLimit')
    const order = live.length ? Math.max(...live.map((u) => u.order)) + 1 : 0
    const picks = suggestPicks(alive(await db.courses.toArray()), alive(await db.results.toArray()), alive(await db.appelli.toArray()), today, live.length)
    return save<Universe>(db.universes, { name: '', picks, grades: {}, order })
  })
}

export async function removeUniverse(db: OrbitaDB, id: string): Promise<void> {
  await db.transaction('rw', db.universes, async () => {
    const live = alive(await db.universes.toArray())
    if (!live.some((u) => u.id === id)) return
    if (live.length <= MIN_UNIVERSES) throw new AppError('universeMin')
    await remove(db.universes, id)
  })
}

export async function renameUniverse(db: OrbitaDB, id: string, name: string): Promise<void> {
  await patch<Universe>(db.universes, id, { name: name.trim().slice(0, MAX_NAME).trim() })
}

export async function setPick(db: OrbitaDB, universeId: string, courseId: string, appelloId: string | null): Promise<void> {
  await db.transaction('rw', db.appelli, db.universes, async () => {
    const u = await db.universes.get(universeId)
    if (!u || u.deletedAt) return
    const picks = { ...u.picks }
    if (appelloId === null) delete picks[courseId]
    else {
      const a = await db.appelli.get(appelloId)
      if (!a || a.deletedAt || a.courseId !== courseId) return fail('course', 'invalid')
      picks[courseId] = appelloId
    }
    await patch<Universe>(db.universes, universeId, { picks })
  })
}

export async function setExpectedGrade(db: OrbitaDB, universeId: string, courseId: string, grade: number | null): Promise<void> {
  await db.transaction('rw', db.universes, async () => {
    const u = await db.universes.get(universeId)
    if (!u || u.deletedAt) return
    const grades = { ...u.grades }
    if (grade === null || !Number.isFinite(grade)) delete grades[courseId]
    else grades[courseId] = Math.round(Math.min(MAX_GRADE, Math.max(MIN_GRADE, grade)) * 10) / 10
    await patch<Universe>(db.universes, universeId, { grades })
  })
}

/** Le date d'esame dell'app diventano quelle dell'universo. Scrive solo `courses.examDate`. */
export async function chooseUniverse(db: OrbitaDB, universeId: string, today: ISODate): Promise<ExamDateChange[]> {
  return db.transaction('rw', [db.courses, db.results, db.appelli, db.universes, db.settings, db.deadlines], async () => {
    const u = await db.universes.get(universeId)
    if (!u || u.deletedAt) return []
    const courses = alive(await db.courses.toArray())
    const evaluation = evaluateUniverse({
      universe: u,
      courses,
      results: alive(await db.results.toArray()),
      appelli: alive(await db.appelli.toArray()),
      periods: alive(await db.deadlines.toArray()),
      today,
      params: normalizeMultiverse(await getSetting(db, 'multiverse')),
      profile: gradeProfile(normalizeProfile(await getSetting(db, 'profile'))),
      formula: normalizeGraduation(await getSetting(db, 'graduation')).formula,
    })
    const changes = applyUniverse(evaluation, courses)
    for (const c of changes) await patch(db.courses, c.courseId, { examDate: c.to })
    return changes
  })
}

/** Porta gli universi a MIN_UNIVERSES (solo dal pulsante dello stato vuoto). Restituisce quanti ne ha creati. */
export async function ensureUniverses(db: OrbitaDB, today: ISODate): Promise<number> {
  const set = examSet(alive(await db.courses.toArray()), alive(await db.results.toArray()), alive(await db.appelli.toArray()), today)
  if (!set.length) return 0
  let created = 0
  while (alive(await db.universes.toArray()).length < MIN_UNIVERSES) {
    await createUniverse(db, today)
    created++
  }
  return created
}
