import type { GroupId, RuleId } from '../../../db/schema'
import type { Format } from '../../format/types'

interface GroupText {
  title: string
  thresholds: Record<string, string>
}

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
    thresholds: { days: 'Giorni all’esame', warnDays: 'Avviso entro (giorni)' },
  },
  'energia-bassa': {
    title: 'Energia bassa',
    summary: 'Sgr A* e LINER: niente teoria nuova, blocchi brevi, ripasso attivo e schede.',
    thresholds: { maxEnergy: 'Fino al livello' },
  },
  'energia-media': {
    title: 'Energia regolare',
    summary: 'Seyfert: l’esame più vicino per primo, blocchi lunghi con una pausa.',
    thresholds: {},
  },
  'energia-alta': {
    title: 'Energia alta',
    summary: 'Quasar e Blazar: la teoria più difficile nelle prime ore.',
    thresholds: { minEnergy: 'Dal livello' },
  },
  sport: {
    title: 'Sport',
    summary: 'Meno sessioni del previsto per un tipo di sport entro il giorno scelto: proponi una sessione. Gli obiettivi di ogni tipo si impostano in Dati.',
    thresholds: { deadline: 'Entro il giorno (1 = lunedì)' },
  },
  abilita: {
    title: 'Abilità ferma',
    summary: 'L’abilità è ferma da più giorni della soglia: qualche minuto nel piano del giorno dopo.',
    thresholds: { days: 'Giorni senza praticare', minutes: 'Minuti da inserire' },
  },
  'ore-settimana': {
    title: 'Ore della settimana',
    summary: 'Ore degli ultimi 7 giorni sotto l’obiettivo: alza l’obiettivo di domani.',
    thresholds: { hoursPerDay: 'Ore al giorno', maxHours: 'Massimo per domani', warnDeficitDays: 'Avviso da (giorni di ritardo)' },
  },
  'schede-scadute': {
    title: 'Schede scadute',
    summary: 'Ci sono schede di ripasso scadute: inserisci il ripasso a 10 dita.',
    thresholds: { minMinutes: 'Minimo', maxMinutes: 'Massimo', warnDue: 'Avviso sopra (schede)' },
  },
  periodo: {
    title: 'Periodo speciale',
    summary: 'Durante un periodo con le sue date valgono le eccezioni su ore al giorno e obiettivi di sport.',
    thresholds: {},
  },
}

const groups: Record<GroupId, GroupText> = {
  giornata: {
    title: 'La giornata',
    thresholds: {
      dayStart: 'Inizio della giornata',
      dayEnd: 'Fine della giornata',
      eveningFrom: 'La sera comincia alle',
      roundStep: 'Arrotonda gli orari a',
      secondExerciseMinutes: 'Secondo esercizio (minuti)',
      walkMinutes: 'Camminata (minuti)',
      readingMinutes: 'Lettura (minuti)',
      fillerBelow: 'Aggiungi la lettura sotto N attività',
    },
  },
  storico: {
    title: 'Quanto indietro guardare',
    thresholds: {
      sessionsDays: 'Sessioni (giorni)',
      workoutsDays: 'Allenamenti (giorni)',
      eventsDays: 'Impegni, per lato (giorni)',
      typingDays: 'Prove di battitura (giorni)',
      scoreDays: 'Punteggio della lingua (giorni)',
    },
  },
  ripasso: {
    title: 'Ripasso',
    thresholds: {
      box1: 'Scatola 1 (giorni)',
      box2: 'Scatola 2 (giorni)',
      box3: 'Scatola 3 (giorni)',
      box4: 'Scatola 4 (giorni)',
      box5: 'Scatola 5 (giorni)',
      minAccuracy: 'Precisione minima (%)',
      minSimilarity: 'Somiglianza minima (%)',
    },
  },
  dattilografia: {
    title: 'Dattilografia',
    thresholds: {
      passAccuracy: 'Precisione per superare (%)',
      passWpm: 'Parole al minuto per superare',
      minSeconds: 'Secondi minimi nel calcolo',
      worstKeys: 'Tasti peggiori mostrati',
      worstKeysMinHits: 'Tentativi minimi per tasto',
    },
  },
  registra: {
    title: 'Registra',
    thresholds: {
      studyMinutes: 'Studio (minuti)',
      lavoroMinutes: 'Lavoro (minuti)',
      abilitaMinutes: 'Abilità (minuti)',
      linguaMinutes: 'Lingua (minuti)',
      letturaMinutes: 'Lettura (minuti)',
    },
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
  periodNote: 'Date ed eccezioni dei periodi si cambiano in ',
  datiLink: 'Dati',
  rules,
  groups,
  groupsTitle: 'Soglie generali',
  abilityTitle: (p: { name: string }) => `${p.name}: troppi giorni senza pratica`,
  periodSummaryNoSport: 'Durante un periodo con le sue date vale l’obiettivo di ore al giorno che scegli.',
  units: { days: 'giorni', min: 'min', hours: 'h' },
  range: (p: { min: number; max: number }, f: Format) => `da ${f.number(p.min)} a ${f.number(p.max)}`,
}
