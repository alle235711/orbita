import { describe, expect, it } from 'vitest'
import { dicts } from './dict'
import { i18nFor } from './index'
import { LANGS, type Lang } from './lang'
import { itFormat } from './format/it'
import { SAMPLES } from './samples'

// Guardia dei dizionari: stesso albero di chiavi in italiano e inglese, e ogni
// funzione, chiamata con i parametri di samples.ts, rende testo utilizzabile.

type Node = unknown
const isBranch = (n: Node): n is Record<string, Node> => typeof n === 'object' && n !== null
const BROKEN = /undefined|NaN|[{}]/

/** Percorsi di tutte le foglie (stringhe e funzioni), con il tipo della foglia. */
function leaves(node: Node, prefix = ''): { path: string; value: Node }[] {
  if (!isBranch(node)) return [{ path: prefix, value: node }]
  return Object.keys(node)
    .sort()
    .flatMap((k) => leaves(node[k], prefix ? `${prefix}.${k}` : k))
}

/** Foglie che devono restare uguali: nomi propri, nomi legacy, notazione, unità. */
const SAME_IN_BOTH = new Set<string>([
  'agenda.title', // "Agenda" e "Briefing"
  'oggi.cosmos.moon', // "nome, voto"
  'app.titles.agenda',
  'nav.items.agenda',
  'briefing.title',
  'regole.back',
  'app.titles.briefing',
  'nav.items.briefing',
  'quicklog.scorePlaceholder', // "0–100"
  'stats.hUnit', // " h"
  'regole.units.min', // "min"
  'regole.units.hours', // "h"
  // Parole identiche per natura: "Sport", "Backup", "4 g" e simili.
  'agenda.eventType.sport',
  'modules.sport.label',
  'profilo.exams.cfu', // sigla
  'stats.sportTitle',
  'plan.msg.periodTitle', // solo il nome del periodo
  'regole.rules.sport.title',
  'briefing.abilityTitle', // solo il nome
  'briefing.languageTitle',
  'stats.abilityTitle',
  'stats.languageTitle',
  'briefing.sport',
  'dati.backup',
  'oggi.planItemAria', // solo punteggiatura e parametri
  'plan.msg.abilityItemTitle', // solo il nome
  'stats.minutesFmt', // "45 min"
])

const shape = (lang: Lang) => leaves(dicts[lang]).map(({ path, value }) => `${path}:${typeof value}`)

describe('dizionari', () => {
  it('italiano e inglese hanno lo stesso albero di chiavi e gli stessi tipi di foglia', () => {
    expect(shape('en')).toEqual(shape('it'))
  })

  it('ogni foglia funzione ha un campione in samples.ts, e viceversa', () => {
    const fnPaths = leaves(dicts.it)
      .filter((l) => typeof l.value === 'function')
      .map((l) => l.path)
      .sort()
    expect(Object.keys(SAMPLES).sort()).toEqual(fnPaths)
  })

  it('le foglie inglesi non sono identiche a quelle italiane, salvo nomi propri, simboli e unità', () => {
    const samples = SAMPLES as Record<string, unknown[]>
    const render = (lang: Lang, path: string, value: unknown): unknown => {
      if (typeof value !== 'function') return value
      const { f } = i18nFor(lang)
      return (value as (...a: unknown[]) => unknown)(...samples[path]!.map((a) => (a === itFormat ? f : a)))
    }
    const itLeaves = new Map(leaves(dicts.it).map((l) => [l.path, l.value]))
    const same = leaves(dicts.en)
      .filter(({ path, value }) => render('en', path, value) === render('it', path, itLeaves.get(path)))
      .map((l) => l.path)
    expect(same.filter((p) => !SAME_IN_BOTH.has(p)).sort()).toEqual([])
    // niente voci superflue nell'elenco: se una foglia viene tradotta, va tolta da lì
    expect([...SAME_IN_BOTH].filter((p) => !same.includes(p)).sort()).toEqual([])
  })

  for (const lang of LANGS) {
    describe(lang, () => {
      const { f } = i18nFor(lang)

      it('le stringhe non sono rotte', () => {
        for (const { path, value } of leaves(dicts[lang])) {
          if (typeof value !== 'string') continue
          expect(value, path).not.toMatch(/undefined|NaN/)
        }
      })

      it('ogni funzione rende testo non vuoto e senza segnaposto rimasti', () => {
        const samples = SAMPLES as Record<string, unknown[]>
        for (const { path, value } of leaves(dicts[lang])) {
          if (typeof value !== 'function') continue
          const args = samples[path]!.map((a) => (a === itFormat ? f : a))
          const out = (value as (...a: unknown[]) => unknown)(...args)
          expect(typeof out, path).toBe('string')
          expect((out as string).trim(), path).not.toBe('')
          expect(out as string, path).not.toMatch(BROKEN)
        }
      })
    })
  }
})
