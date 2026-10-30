import { describe, expect, it } from 'vitest'
import { dicts } from '../i18n/dict'
import { ROUTES } from '../app/router'
import {
  briefingTiles,
  enabledModules,
  eventTypeEnabled,
  moduleLabel,
  MODULE_IDS,
  quickLogKinds,
  routeEnabled,
  ruleEnabledByModule,
  sessionTypeEnabled,
  statsPanels,
  workoutTypeEnabled,
  workSessionTypes,
} from './registry'
import { DEFAULT_MODULES, normalizeModules, type ModulesSettings } from './types'

const allOn = (): ModulesSettings => {
  const m = structuredClone(DEFAULT_MODULES)
  for (const id of MODULE_IDS) m[id].enabled = true
  for (const t of Object.values(m.sport.types)) t.enabled = true
  return m
}
const allOff = (): ModulesSettings => {
  const m = allOn()
  for (const id of MODULE_IDS) m[id].enabled = false
  return m
}

describe('registro dei moduli', () => {
  it('ordine di visualizzazione e moduli accesi', () => {
    expect(MODULE_IDS).toEqual(['sport', 'dattilografia', 'abilita', 'lingua', 'lavoro', 'lettura', 'peso'])
    expect(enabledModules(DEFAULT_MODULES).map((d) => d.id)).toEqual(['sport', 'dattilografia', 'lettura'])
  })

  it('le sezioni di base restano sempre, la dattilografia segue il suo modulo', () => {
    for (const r of ROUTES) if (r !== 'dattilografia') expect(routeEnabled(allOff(), r)).toBe(true)
    expect(routeEnabled(allOff(), 'dattilografia')).toBe(false)
    expect(routeEnabled(allOn(), 'dattilografia')).toBe(true)
  })

  it('tipi di sessione: studio e ripasso di base, gli altri col modulo', () => {
    const off = allOff()
    expect(sessionTypeEnabled(off, 'studio')).toBe(true)
    expect(sessionTypeEnabled(off, 'ripasso')).toBe(true)
    for (const t of ['abilita', 'lingua', 'lavoro', 'lettura', 'dattilografia'] as const) {
      expect(sessionTypeEnabled(off, t)).toBe(false)
      expect(sessionTypeEnabled(allOn(), t)).toBe(true)
    }
  })

  it('tipi di allenamento: serve lo sport acceso e il tipo acceso', () => {
    const m = allOn()
    expect(workoutTypeEnabled(m, 'nuoto')).toBe(true)
    m.sport.types.nuoto.enabled = false
    expect(workoutTypeEnabled(m, 'nuoto')).toBe(false)
    m.sport.enabled = false
    expect(workoutTypeEnabled(m, 'corsa')).toBe(false)
    // spegnere lo sport non tocca la configurazione dei tipi
    expect(m.sport.types.corsa.enabled).toBe(true)
  })

  it('regole: sport e abilità seguono il loro modulo, le altre sono di base', () => {
    expect(ruleEnabledByModule(allOff(), 'sport')).toBe(false)
    expect(ruleEnabledByModule(allOff(), 'abilita')).toBe(false)
    for (const r of ['esame-vicino', 'energia-bassa', 'energia-media', 'energia-alta', 'ore-settimana', 'schede-scadute', 'periodo'] as const) expect(ruleEnabledByModule(allOff(), r)).toBe(true)
    expect(ruleEnabledByModule(allOn(), 'sport')).toBe(true)
  })

  it('Registra: ordine fisso e solo i tipi di sport accesi', () => {
    expect(quickLogKinds(allOn())).toEqual(['studio', 'lavoro', 'arrampicata', 'palestra', 'corsa', 'nuoto', 'altro', 'abilita', 'lingua', 'lettura', 'peso'])
    expect(quickLogKinds(allOff())).toEqual(['studio'])
    expect(quickLogKinds(DEFAULT_MODULES)).toEqual(['studio', 'corsa', 'lettura'])
  })

  it('pannelli delle statistiche e riquadri del briefing', () => {
    expect([...statsPanels(allOn())].sort()).toEqual(['ability', 'language', 'sport', 'typing', 'weight', 'workHours'])
    expect([...statsPanels(allOff())]).toEqual([])
    expect([...briefingTiles(allOn())].sort()).toEqual(['ability', 'language', 'sport', 'typing'])
    expect([...briefingTiles(DEFAULT_MODULES)].sort()).toEqual(['sport', 'typing'])
  })

  it('tipi di impegno: sport e lavoro col modulo, gli altri sempre', () => {
    for (const t of ['lezione', 'studio', 'esame', 'altro'] as const) expect(eventTypeEnabled(allOff(), t)).toBe(true)
    expect(eventTypeEnabled(allOff(), 'sport')).toBe(false)
    expect(eventTypeEnabled(allOff(), 'lavoro')).toBe(false)
    expect(eventTypeEnabled(allOn(), 'lavoro')).toBe(true)
  })

  it('le ore di lavoro contano il lavoro solo se il modulo è acceso', () => {
    expect(workSessionTypes(allOn())).toEqual(['studio', 'ripasso', 'lavoro'])
    expect(workSessionTypes(allOff())).toEqual(['studio', 'ripasso'])
  })

  it('le etichette: il nome scritto dall’utente, altrimenti quello del dizionario', () => {
    const m = normalizeModules({ abilita: { enabled: true, name: 'Chitarra' }, lingua: { enabled: true } })
    expect(moduleLabel(m, 'abilita', dicts.it)).toBe('Chitarra')
    expect(moduleLabel(m, 'lingua', dicts.it)).toBe('Lingua straniera')
    expect(moduleLabel(m, 'lingua', dicts.en)).toBe('Foreign language')
    expect(moduleLabel(DEFAULT_MODULES, 'abilita', dicts.en)).toBe('Personal skill')
    expect(moduleLabel(m, 'sport', dicts.it)).toBe('Sport')
  })
})
