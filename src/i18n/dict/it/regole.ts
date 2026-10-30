import type { RuleId } from '../../../db/schema'
import type { Format } from '../../format/types'
import { legacy } from './legacy'

interface RuleText {
  title: string
  /** La regola in una riga: "se … → …" */
  summary: string
  thresholds: Record<string, string>
}

const rules: Record<RuleId, RuleText> = {
  'esame-vicino': {
    title: 'Esame vicino',
    summary: 'Un esame entro la soglia rende quella materia la priorità 1.',
    thresholds: { days: 'Giorni all’esame' },
  },
  'energia-bassa': {
    title: 'Energia bassa',
    summary: 'Sgr A* e LINER: niente teoria nuova, blocchi brevi, ripasso attivo e schede.',
    thresholds: { maxEnergy: 'Fino al livello', block: 'Durata dei blocchi' },
  },
  'energia-media': {
    title: 'Energia regolare',
    summary: 'Seyfert: l’esame più vicino per primo, blocchi lunghi con una pausa.',
    thresholds: { block: 'Durata dei blocchi', pause: 'Pausa dopo ogni blocco' },
  },
  'energia-alta': {
    title: 'Energia alta',
    summary: 'Quasar e Blazar: la teoria più difficile nelle prime ore.',
    thresholds: { minEnergy: 'Dal livello', block: 'Durata dei blocchi' },
  },
  sport: {
    title: 'Arrampicata e corsa',
    summary: 'Meno arrampicate del previsto entro giovedì: proponi una sessione. Poche corse: proponi una corsa.',
    thresholds: {
      climbs: 'Arrampicate a settimana',
      deadline: 'Entro il giorno (1 = lunedì)',
      runs: 'Corse a settimana',
      minutes: 'Durata di una corsa',
    },
  },
  lean: {
    title: `${legacy.lean} fermo`,
    summary: `${legacy.lean} fermo da più giorni della soglia: mezz’ora nel piano del giorno dopo.`,
    thresholds: { days: `Giorni senza ${legacy.lean}`, minutes: 'Minuti da inserire' },
  },
  'ore-settimana': {
    title: 'Ore della settimana',
    summary: 'Ore degli ultimi 7 giorni sotto l’obiettivo: alza l’obiettivo di domani.',
    thresholds: { hoursPerDay: 'Ore al giorno', maxHours: 'Massimo per domani' },
  },
  'schede-scadute': {
    title: 'Schede scadute',
    summary: 'Ci sono schede di ripasso scadute: inserisci il ripasso a 10 dita.',
    thresholds: { minMinutes: 'Minimo', maxMinutes: 'Massimo' },
  },
  tirocinio: {
    title: legacy.periodRuleTitle,
    summary: legacy.periodRuleSummary,
    thresholds: { hoursPerDay: 'Ore al giorno', gym: 'Palestra a settimana', deadline: 'Entro il giorno (1 = lunedì)', runs: 'Corse a settimana' },
  },
}

export const regole = {
  title: 'Regole',
  back: 'Briefing',
  lead: 'Il piano di Oggi e il briefing nascono da queste nove regole. Spegnile o cambiane le soglie: valgono subito e restano su questo dispositivo.',
  resetConfirm: 'Tocca ancora per ripristinare tutto',
  reset: 'Ripristina i valori iniziali',
  resetDone: 'Regole riportate ai valori iniziali.',
  on: 'Attiva',
  off: 'Spenta',
  periodDatesSet: legacy.periodDatesSet,
  periodDatesMissing: legacy.periodDatesMissing,
  datiLink: 'Dati',
  rules,
  units: { days: 'giorni', min: 'min', hours: 'h' },
  range: (p: { min: number; max: number }, f: Format) => `da ${f.number(p.min)} a ${f.number(p.max)}`,
}
