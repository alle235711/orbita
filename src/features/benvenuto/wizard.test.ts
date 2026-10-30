import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createDb, type OrbitaDB } from '../../db/db'
import type { Course, RuleConfig } from '../../db/schema'
import { getSetting } from '../../db/settings'
import { DEFAULT_MODULES, DEFAULT_STUDY_BLOCK } from '../../modules/types'
import { applyDraft, draftFromExisting, draftToRecords, emptyDraft, validateStep, type WizardDraft, type WizardExisting } from './wizard'

const NOW = 1_800_000_000_000
let n = 0
const newId = () => `new-${++n}`

const course = (over: Partial<Course> = {}): Course => ({ id: 'c1', name: 'Corso finto', sections: ['uno'], difficulty: 2, updatedAt: 5, ...over })
const empty = (): WizardExisting => ({ profile: null, courses: [], rules: [], studyBlock: DEFAULT_STUDY_BLOCK, modules: DEFAULT_MODULES })
const draft = (over: Partial<WizardDraft> = {}): WizardDraft => ({ ...emptyDraft('it'), ...over })

describe('emptyDraft', () => {
  it('parte dai predefiniti: 180 CFU, 6 ore, 50/10, nessun giorno nell’altra lingua', () => {
    const d = emptyDraft('en')
    expect(d).toMatchObject({ lang: 'en', totalCfu: 180, hoursPerDay: 6, preset: '50/10', otherDays: [], exams: [], sampleDecks: [] })
    expect(d.modules).toEqual(DEFAULT_MODULES)
    expect(d.modules).not.toBe(DEFAULT_MODULES)
  })
})

describe('validateStep', () => {
  it('i passi 1 e 4 non hanno errori', () => {
    expect(validateStep(1, draft())).toBeNull()
    expect(validateStep(4, draft())).toBeNull()
  })

  it('passo 2: i CFU totali sono interi da 1 a 600', () => {
    expect(validateStep(2, draft())).toBeNull()
    for (const bad of [0, 601, 12.5, Number.NaN]) expect(validateStep(2, draft({ totalCfu: bad }))).toEqual({ totalCfu: 'range' })
    expect(validateStep(2, draft({ totalCfu: 600 }))).toBeNull()
  })

  it('passo 3: i CFU di un esame da 1 a 60 se ci sono; i nomi doppi vanno bene', () => {
    const ok = [
      { key: 'a', name: 'Uguale', difficulty: 2 as const },
      { key: 'b', name: 'Uguale', cfu: 60, difficulty: 2 as const },
    ]
    expect(validateStep(3, draft({ exams: ok }))).toBeNull()
    expect(validateStep(3, draft({ exams: [...ok, { key: 'c', name: 'x', cfu: 61, difficulty: 1 }, { key: 'd', name: 'y', cfu: 0, difficulty: 1 }] }))).toEqual({ 'cfu:c': 'range', 'cfu:d': 'range' })
  })

  it('passo 5: ore da 1 a 12; al massimo tre giorni distinti da 1 a 7', () => {
    expect(validateStep(5, draft({ hoursPerDay: 12, otherDays: [1, 3, 7] }))).toBeNull()
    expect(validateStep(5, draft({ hoursPerDay: 0.5 }))).toEqual({ hoursPerDay: 'range' })
    expect(validateStep(5, draft({ hoursPerDay: 12.5 }))).toEqual({ hoursPerDay: 'range' })
    for (const days of [[1, 2, 3, 4], [2, 2], [0], [8]]) expect(validateStep(5, draft({ otherDays: days }))).toEqual({ otherDays: 'range' })
  })
})

describe('draftToRecords: primo avvio', () => {
  it('profilo con i testi puliti, completedAt = adesso, lode e inizio anno predefiniti', () => {
    const r = draftToRecords(draft({ name: '  Ada ', university: '', degree: ' Fisica ', totalCfu: 120, graduationTarget: '2028-07' }), empty(), NOW, newId)
    expect(r.profile).toEqual({ name: 'Ada', degree: 'Fisica', totalCfu: 120, lodeValue: 30, yearStart: '09-01', graduationTarget: '2028-07', completedAt: NOW })
  })

  it('moduli normalizzati, preset nello studyBlock, lingua con i giorni scelti', () => {
    const modules = structuredClone(DEFAULT_MODULES)
    modules.abilita = { enabled: true, name: '  Chitarra  ' }
    const r = draftToRecords(draft({ modules, preset: '90/15', lang: 'en', otherDays: [3, 1] }), empty(), NOW, newId)
    expect(r.modules.abilita.name).toBe('Chitarra')
    expect(r.studyBlock).toEqual({ ...DEFAULT_STUDY_BLOCK, preset: '90/15' })
    expect(r.language).toEqual({ base: 'en', otherDays: [1, 3] })
  })

  it('gli esami con il nome diventano corsi nuovi, quelli senza nome si scartano', () => {
    const r = draftToRecords(
      draft({
        exams: [
          { key: 'a', name: '  Analisi  ', cfu: 9, date: '2027-02', difficulty: 3 },
          { key: 'b', name: '   ', difficulty: 2 },
          { key: 'c', name: 'Fisica', difficulty: 1 },
        ],
      }),
      empty(),
      NOW,
      newId,
    )
    expect(r.courses).toEqual([
      { id: 'new-1', name: 'Analisi', cfu: 9, examDate: '2027-02', difficulty: 3, sections: [], updatedAt: NOW },
      { id: 'new-2', name: 'Fisica', difficulty: 1, sections: [], updatedAt: NOW },
    ])
    expect(r.examIds).toEqual({ a: 'new-1', c: 'new-2' })
    expect(r.removedCourseIds).toEqual([])
  })

  it('la regola delle ore tiene le altre soglie e prende le ore dalla bozza', () => {
    const rules: RuleConfig[] = [{ id: 'ore-settimana', enabled: false, thresholds: { hoursPerDay: 8, maxHours: 11 }, updatedAt: 3 }]
    const r = draftToRecords(draft({ hoursPerDay: 7.5 }), { ...empty(), rules }, NOW, newId)
    expect(r.rule).toMatchObject({ id: 'ore-settimana', enabled: false, updatedAt: NOW })
    expect(r.rule.thresholds).toMatchObject({ hoursPerDay: 7.5, maxHours: 11 })
    expect(draftToRecords(draft(), empty(), NOW, newId).rule).toMatchObject({ enabled: true, thresholds: { hoursPerDay: 6 } })
  })
})

describe('riapertura con i dati esistenti', () => {
  const existing = (): WizardExisting => ({
    profile: { name: 'Ada', totalCfu: 150, lodeValue: 32, yearStart: '10-01', graduationTarget: '2028-07', completedAt: 111 },
    courses: [
      course({ id: 'c1', name: 'Uno', code: 'K1', degree: 'D', examNotes: 'note', semester: 1, color: '#fff', sampleDeck: 'deck', cfu: 6, examDate: '2027-01-20', sections: ['s'] }),
      course({ id: 'c2', name: 'Due' }),
      course({ id: 'c3', name: 'Tre', deletedAt: 9 }),
    ],
    rules: [{ id: 'ore-settimana', enabled: true, thresholds: { hoursPerDay: 7 }, updatedAt: 1 }],
    studyBlock: { ...DEFAULT_STUDY_BLOCK, preset: '90/15' },
    modules: { ...DEFAULT_MODULES, peso: { enabled: true } },
  })

  it('draftFromExisting elenca tutti i corsi vivi e precompila ogni campo', () => {
    const d = draftFromExisting(existing(), 'en', [2, 5])
    expect(d).toMatchObject({ name: 'Ada', lang: 'en', totalCfu: 150, graduationTarget: '2028-07', hoursPerDay: 7, preset: '90/15', otherDays: [2, 5] })
    expect(d.modules.peso.enabled).toBe(true)
    expect(d.exams.map((e) => [e.id, e.name, e.cfu, e.date])).toEqual([
      ['c1', 'Uno', 6, '2027-01-20'],
      ['c2', 'Due', undefined, undefined],
    ])
  })

  it('senza modifiche non si perde nulla: completedAt, lode, inizio anno e i campi dei corsi restano', () => {
    const e = existing()
    const r = draftToRecords(draftFromExisting(e, 'it', []), e, NOW, newId)
    expect(r.profile).toMatchObject({ completedAt: 111, lodeValue: 32, yearStart: '10-01', name: 'Ada' })
    expect(r.removedCourseIds).toEqual([])
    expect(r.courses[0]).toEqual({
      id: 'c1',
      name: 'Uno',
      code: 'K1',
      degree: 'D',
      examNotes: 'note',
      semester: 1,
      color: '#fff',
      sampleDeck: 'deck',
      cfu: 6,
      examDate: '2027-01-20',
      difficulty: 2,
      sections: ['s'],
      updatedAt: NOW,
    })
  })

  it('un corso tolto dall’elenco, o con il nome svuotato, finisce tra i rimossi', () => {
    const e = existing()
    const d = draftFromExisting(e, 'it', [])
    d.exams = [{ ...d.exams[0]!, name: '' }]
    const r = draftToRecords(d, e, NOW, newId)
    expect(r.courses).toEqual([])
    expect(r.removedCourseIds.sort()).toEqual(['c1', 'c2'])
  })

  it('cancellare i CFU o la data li toglie dal corso', () => {
    const e = existing()
    const d = draftFromExisting(e, 'it', [])
    delete d.exams[0]!.cfu
    delete d.exams[0]!.date
    const c = draftToRecords(d, e, NOW, newId).courses[0]!
    expect('cfu' in c).toBe(false)
    expect('examDate' in c).toBe(false)
  })
})

describe('applyDraft', () => {
  let db: OrbitaDB
  beforeEach(() => {
    db = createDb(`wiz-${crypto.randomUUID()}`)
  })
  afterEach(async () => {
    await db.delete()
  })

  it('scrive corsi, impostazioni e regola in un colpo e cancella in modo logico i rimossi', async () => {
    await db.courses.put(course({ id: 'old', name: 'Da togliere' }))
    const existing: WizardExisting = { ...empty(), courses: [course({ id: 'old', name: 'Da togliere' })] }
    const d = draft({ name: 'Ada', exams: [{ key: 'a', name: 'Analisi', difficulty: 2 }], preset: '45/10', hoursPerDay: 5, otherDays: [6] })
    const records = draftToRecords(d, existing, NOW, newId)
    await applyDraft(db, records)

    expect((await getSetting(db, 'profile'))?.completedAt).toBe(NOW)
    expect((await getSetting(db, 'studyBlock')).preset).toBe('45/10')
    expect((await getSetting(db, 'language')).otherDays).toEqual([6])
    expect((await db.rules.get('ore-settimana'))?.thresholds.hoursPerDay).toBe(5)
    expect((await db.courses.get('new-' + n))?.name).toBe('Analisi')
    expect((await db.courses.get('old'))?.deletedAt).toBeGreaterThan(0)
  })
})
