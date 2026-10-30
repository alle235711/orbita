import { describe, expect, it } from 'vitest'
import { DEFAULT_STUDY_BLOCK } from '../../modules/types'
import { fakeRules, v1Fixture } from '../../test/fixtures'
import { parseBackup } from '../backup'
import { diffTables, migrateToV2, V2_INPUT_TABLES, type RawRow, type RawTables } from './v2'

const row = <T extends RawRow>(rows: T[] | undefined, id: string): T | undefined => rows?.find((r) => r.id === id)
const value = (t: RawTables, id: string) => row(t.settings, id)?.value as Record<string, unknown>

describe('migrateToV2: campo per campo', () => {
  const out = migrateToV2(v1Fixture())

  it('sessioni: lean diventa abilita e inglese diventa lingua, il resto resta com’è', () => {
    expect(row(out.sessions, 's1')).toEqual({ id: 's1', date: '2026-10-20', minutes: 40, type: 'abilita', updatedAt: 1000 })
    expect(row(out.sessions, 's2')).toEqual({ id: 's2', date: '2026-10-21', minutes: 15, type: 'lingua', score: 71, notes: 'app', updatedAt: 1100 })
    expect(row(out.sessions, 's3')).toEqual(v1Fixture().sessions!.find((r) => r.id === 's3'))
    expect(row(out.sessions, 's4')).toEqual(v1Fixture().sessions!.find((r) => r.id === 's4'))
    expect(out.sessions!.some((s) => s.planned !== undefined)).toBe(false)
  })

  it('corsi, allenamenti e pesi non cambiano', () => {
    const v1 = v1Fixture()
    expect(out.courses).toEqual(v1.courses)
    expect(out.workouts).toEqual(v1.workouts)
    expect(out.weights).toEqual(v1.weights)
    expect(out.courses!.every((c) => c.cfu === undefined && c.sampleDeck === undefined)).toBe(true)
  })

  it('regole: lean → abilita e tirocinio → periodo, con il loro updatedAt', () => {
    expect(row(out.rules, 'lean')).toBeUndefined()
    expect(row(out.rules, 'tirocinio')).toBeUndefined()
    expect(row(out.rules, 'abilita')).toEqual({ id: 'abilita', enabled: false, thresholds: { days: 3, minutes: 25 }, updatedAt: 1500 })
    expect(row(out.rules, 'periodo')).toEqual({ id: 'periodo', enabled: true, thresholds: {}, updatedAt: 4000 })
  })

  it('regole: sport tiene solo la scadenza, le energie perdono il blocco e la pausa', () => {
    expect(row(out.rules, 'sport')).toEqual({ id: 'sport', enabled: true, thresholds: { deadline: 5 }, updatedAt: 2000 })
    expect(row(out.rules, 'energia-bassa')!.thresholds as unknown).toEqual({ maxEnergy: 2 })
    expect(row(out.rules, 'energia-media')).toEqual({ id: 'energia-media', enabled: true, thresholds: {}, updatedAt: 3000 })
    expect(row(out.rules, 'energia-alta')!.thresholds as unknown).toEqual({ minEnergy: 4 })
  })

  it('regole: le altre restano uguali, anche le ore al giorno a 8', () => {
    const v1 = v1Fixture()
    for (const id of ['esame-vicino', 'ore-settimana', 'schede-scadute']) expect(row(out.rules, id)).toEqual(row(v1.rules, id))
    expect((row(out.rules, 'ore-settimana')!.thresholds as Record<string, number>).hoursPerDay).toBe(8)
  })

  it('scadenze: il periodo tiene id e titolo e ottiene le eccezioni dalla regola', () => {
    expect(row(out.deadlines, 'tirocinio')).toEqual({
      id: 'tirocinio',
      title: 'Periodo estivo',
      kind: 'periodo',
      date: '2027-03-15',
      endDate: '2027-04-24',
      notes: 'Note del periodo',
      hoursPerDay: 7,
      sport: { arrampicata: 0, palestra: 2, corsa: 1 },
      deadlineDay: 3,
      updatedAt: 4000,
    })
    expect(row(out.deadlines, 'esame-extra')).toEqual(row(v1Fixture().deadlines, 'esame-extra'))
  })

  it('scadenze: la laurea sparisce fisicamente e la data va nel profilo', () => {
    expect(row(out.deadlines, 'laurea')).toBeUndefined()
    expect(out.deadlines).toHaveLength(2)
    expect(row(out.settings, 'profile')).toEqual({
      id: 'profile',
      value: { totalCfu: 180, lodeValue: 30, yearStart: '09-01', graduationTarget: '2027-07' },
      updatedAt: 900,
    })
    expect(Object.keys(value(out, 'profile'))).not.toContain('name')
    expect(Object.keys(value(out, 'profile'))).not.toContain('completedAt')
  })

  it('studyBlock: il blocco medio 70 (a pari distanza) va sul preset più lungo, updatedAt dalle regole di energia', () => {
    expect(row(out.settings, 'studyBlock')).toEqual({
      id: 'studyBlock',
      value: { preset: '90/15', hint: DEFAULT_STUDY_BLOCK.hint },
      updatedAt: 3000,
    })
  })

  it('moduli: tutto acceso e lo sport dalle soglie della regola', () => {
    const modules = row(out.settings, 'modules')!
    expect(modules.updatedAt).toBe(2000)
    expect(modules.value).toEqual({
      sport: {
        enabled: true,
        types: {
          arrampicata: { enabled: true, target: 4, minutes: 120 },
          corsa: { enabled: true, target: 3, minutes: 35 },
          palestra: { enabled: true, target: 0, minutes: 60 },
          nuoto: { enabled: false, target: 0, minutes: 45 },
          altro: { enabled: false, target: 0, minutes: 45 },
        },
      },
      dattilografia: { enabled: true },
      abilita: { enabled: true },
      lingua: { enabled: true },
      lavoro: { enabled: true },
      lettura: { enabled: true },
      peso: { enabled: true },
    })
  })

  it('impostazioni: seedVersion a 2, il timer cambia tipo, le altre invariate con il loro updatedAt', () => {
    expect(row(out.settings, 'seedVersion')).toEqual({ id: 'seedVersion', value: 2, updatedAt: 0 })
    expect(row(out.settings, 'activeTimer')).toEqual({
      id: 'activeTimer',
      value: { key: 'lean', title: 'Pratica', kind: 'session', type: 'abilita', startedAt: 1_700_000_100_000 },
      updatedAt: 800,
    })
    const v1 = v1Fixture()
    for (const id of ['newCardsPerDay', 'targetAverage', 'cardsImported', 'lastBackupAt', 'language']) expect(row(out.settings, id)).toEqual(row(v1.settings, id))
  })
})

describe('migrateToV2: valori predefiniti e righe del seed', () => {
  it('righe mai toccate (updatedAt 0) danno righe derivate con updatedAt 0', () => {
    const rules = [
      { id: 'sport', enabled: true, thresholds: { climbs: 3, deadline: 4, runs: 2, minutes: 40 }, updatedAt: 0 },
      { id: 'lean', enabled: true, thresholds: { days: 2, minutes: 30 }, updatedAt: 0 },
      { id: 'energia-media', enabled: true, thresholds: { block: 90, pause: 15 }, updatedAt: 0 },
    ]
    const out = migrateToV2({ settings: [], rules, deadlines: [{ id: 'laurea', title: 'Laurea', kind: 'laurea', date: '2027-07', updatedAt: 0 }] })
    expect(row(out.settings, 'profile')!.updatedAt).toBe(0)
    expect(row(out.settings, 'studyBlock')).toMatchObject({ updatedAt: 0, value: { preset: '90/15' } })
    expect(row(out.settings, 'modules')!.updatedAt).toBe(0)
    expect(row(out.rules, 'abilita')!.updatedAt).toBe(0)
  })

  it('senza righe di origine usa i predefiniti', () => {
    const out = migrateToV2({ settings: [], rules: [], deadlines: [{ id: 'tirocinio', title: 'P', kind: 'periodo', updatedAt: 0 }] })
    expect(row(out.deadlines, 'tirocinio')).toMatchObject({ hoursPerDay: 8, sport: { arrampicata: 0, palestra: 3, corsa: 2 }, deadlineDay: 4, updatedAt: 0 })
    expect(value(out, 'profile')).toEqual({ totalCfu: 180, lodeValue: 30, yearStart: '09-01' })
    expect(value(out, 'studyBlock').preset).toBe('90/15')
    const types = (value(out, 'modules').sport as { types: Record<string, { target: number; minutes: number }> }).types
    expect(types.arrampicata).toMatchObject({ target: 3, minutes: 120 })
    expect(types.corsa).toMatchObject({ target: 2, minutes: 40 })
  })

  it('una tabella presente ma senza nulla da cambiare torna uguale; le assenti restano assenti', () => {
    const input: RawTables = { rules: fakeRules().filter((r) => r.id === 'esame-vicino') as unknown as RawRow[], weights: [] }
    const out = migrateToV2(input)
    expect(out.rules).toEqual(input.rules)
    expect(out.weights).toEqual([])
    expect('settings' in out).toBe(false)
    expect('sessions' in out).toBe(false)
  })

  it('se esistono sia l’id vecchio sia quello nuovo, vince il nuovo e il vecchio sparisce', () => {
    const rules = [
      { id: 'lean', enabled: true, thresholds: { days: 9, minutes: 99 }, updatedAt: 5 },
      { id: 'abilita', enabled: false, thresholds: { days: 1, minutes: 10 }, updatedAt: 6 },
      { id: 'tirocinio', enabled: true, thresholds: {}, updatedAt: 7 },
      { id: 'periodo', enabled: false, thresholds: {}, updatedAt: 8 },
    ]
    const out = migrateToV2({ rules })
    expect(out.rules).toEqual([rules[1], rules[3]])
  })

  it('non sovrascrive profilo, moduli, studyBlock e le eccezioni già presenti', () => {
    const settings = [
      { id: 'profile', value: { totalCfu: 120, lodeValue: 31, yearStart: '10-01' }, updatedAt: 11 },
      { id: 'modules', value: { sport: { enabled: false } }, updatedAt: 12 },
      { id: 'studyBlock', value: { preset: '25/5' }, updatedAt: 13 },
    ]
    const deadlines = [{ id: 'tirocinio', title: 'P', kind: 'periodo', hoursPerDay: 5, sport: { corsa: 1 }, deadlineDay: 2, updatedAt: 14 }]
    const out = migrateToV2({ settings, deadlines })
    expect(out.settings).toEqual(settings)
    expect(out.deadlines).toEqual(deadlines)
  })

  it('seedVersion già a 2 o più non cambia', () => {
    const out = migrateToV2({ settings: [{ id: 'seedVersion', value: 3, updatedAt: 0 }] })
    expect(row(out.settings, 'seedVersion')!.value).toBe(3)
  })
})

describe('migrateToV2: proprietà', () => {
  it('non modifica l’ingresso', () => {
    const input = v1Fixture()
    const copy = structuredClone(input)
    migrateToV2(input)
    expect(input).toEqual(copy)
  })

  it('è idempotente', () => {
    const once = migrateToV2(v1Fixture())
    expect(migrateToV2(once)).toEqual(once)
    const seedOnly = migrateToV2({ settings: [{ id: 'seedVersion', value: 1, updatedAt: 0 }], rules: [], deadlines: [] })
    expect(migrateToV2(seedOnly)).toEqual(seedOnly)
  })

  it('è deterministica', () => {
    expect(migrateToV2(v1Fixture())).toEqual(migrateToV2(v1Fixture()))
  })
})

describe('diffTables', () => {
  it('elenca le righe cambiate o nuove e gli id spariti, solo per le tabelle in comune', () => {
    const before = v1Fixture()
    const after = migrateToV2(before)
    const d = diffTables(before, after)
    expect(d.sessions!.put.map((r) => r.id).sort()).toEqual(['s1', 's2'])
    expect(d.sessions!.deleteIds).toEqual([])
    expect(d.rules!.deleteIds.sort()).toEqual(['lean', 'tirocinio'])
    expect(d.rules!.put.map((r) => r.id).sort()).toEqual(['abilita', 'energia-alta', 'energia-bassa', 'energia-media', 'periodo', 'sport'])
    expect(d.deadlines).toEqual({ put: [expect.objectContaining({ id: 'tirocinio' })], deleteIds: ['laurea'] })
    expect(d.settings!.put.map((r) => r.id).sort()).toEqual(['activeTimer', 'modules', 'profile', 'seedVersion', 'studyBlock'])
    expect(d.courses).toEqual({ put: [], deleteIds: [] })
    expect(diffTables({ rules: [] }, { settings: [] })).toEqual({})
  })
})

describe('backup di formato 1 equivale all’aggiornamento', () => {
  it('parseBackup produce le stesse tabelle di migrateToV2 e dichiara il formato 2', () => {
    const v1 = v1Fixture()
    const backup = parseBackup({ app: 'orbita', format: 1, exportedAt: '2026-10-27T00:00:00Z', tables: structuredClone(v1) })
    expect(backup.format).toBe(2)
    const migrated = migrateToV2(v1)
    for (const name of V2_INPUT_TABLES) expect(backup.tables[name]).toEqual(migrated[name])
    expect(backup.tables.rules!.some((r) => r.id === 'lean' || r.id === 'tirocinio')).toBe(false)
    expect(backup.tables.deadlines!.some((r) => r.id === 'laurea')).toBe(false)
  })

  it('con tabelle mancanti produce comunque le righe derivate', () => {
    const backup = parseBackup({ app: 'orbita', format: 1, exportedAt: '', tables: { sessions: [{ id: 'a', date: '2026-10-20', minutes: 5, type: 'lean', updatedAt: 3 }] } })
    expect(backup.tables.sessions![0]).toMatchObject({ type: 'abilita' })
    expect(backup.tables.settings!.map((r) => r.id).sort()).toEqual(['modules', 'profile', 'studyBlock'])
    expect(backup.tables.rules).toEqual([])
    expect(backup.tables.deadlines).toEqual([])
    expect(backup.tables.courses).toBeUndefined()
  })

  it('un backup di formato 2 passa senza trasformazioni', () => {
    const tables = { sessions: [{ id: 'a', date: '2026-10-20', minutes: 5, type: 'abilita', updatedAt: 3 }] }
    expect(parseBackup({ app: 'orbita', format: 2, exportedAt: '', tables }).tables).toEqual(tables)
  })
})
