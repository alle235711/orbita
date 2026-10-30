// Il catalogo dei messaggi del piano. Chiavi e parametri sono il contratto di `PlanMsg`.

import { ENERGY, type Energy } from '../../../lib/energy'
import type { WorkoutType } from '../../../db/schema'
import type { Format } from '../../format/types'
import { sport } from './sport'

type NoParams = Record<never, never>

/** "L’esame è oggi." / "domani." / "N giorni all’esame." */
const examIn = (days: number) => (days === 0 ? 'L’esame è oggi.' : days === 1 ? 'L’esame è domani.' : `${days} giorni all’esame.`)

const ABILITY_FALLBACK = 'Abilità personale'

const energyName = (energy: Energy) => ENERGY[energy].name

export const plan = {
  msg: {
    headlineLowA: (_p: NoParams) => 'Una giornata',
    headlineLowB: (_p: NoParams) => 'per ricaricarsi',
    headlineMidA: (_p: NoParams) => 'Una giornata',
    headlineMidB: (_p: NoParams) => 'da esercizi',
    headlineHighA: (_p: NoParams) => 'Una giornata',
    headlineHighB: (_p: NoParams) => 'da teoria nuova',

    ruleLow: (p: { block: number }) => `Disco quasi spento: niente teoria nuova, blocchi da ${p.block} minuti e tanto ripasso attivo.`,
    ruleHigh: (p: { energy: Energy }) => `Regime da ${p.energy === 5 ? 'blazar' : 'quasar'}: la teoria più difficile nelle prime ore, quando la testa regge.`,
    ruleMidExam: (p: { block: number }) => `Accrescimento regolare: l’esame più vicino va per primo, in blocchi da ${p.block} minuti.`,
    // La fase 1 scrive "di pausa" dopo il numero nudo: si riproduce alla lettera.
    ruleMid: (p: { block: number; pause: number }) => `Accrescimento regolare: blocchi da ${p.block} minuti con ${p.pause} di pausa.`,

    studyFreeTitle: (_p: NoParams) => 'Studio',
    studyFreeDetail: (_p: NoParams) => 'Nessun esame in calendario: scegli tu la materia.',
    activeReviewTitle: (p: { course: string }) => `Ripasso attivo di ${p.course}`,
    activeReviewDetail: (_p: NoParams) => 'Spiega a voce i risultati principali: niente teoria nuova.',
    exercisesTitle: (p: { course: string }) => `Esercizi di ${p.course}`,
    exercisesFirstDetail: (p: { days: number }) => `Esercizi d’esame. ${examIn(p.days)}`,
    exercisesSecondDetail: (_p: NoParams) => 'Un esercizio completo, dall’inizio alla fine.',
    exercisesHighDetail: (p: { days: number }) => examIn(p.days),
    theoryTitle: (p: { course: string }) => `Teoria nuova di ${p.course}`,
    theoryDetail: (_p: NoParams) => 'Ricostruisci le dimostrazioni senza appunti.',
    walkTitle: (_p: NoParams) => 'Camminata',
    walkDetail: (_p: NoParams) => 'Recupero attivo, lo sport aspetta.',
    readingTitle: (_p: NoParams) => 'Lettura',
    readingDetail: (_p: NoParams) => 'Un capitolo, senza telefono.',

    sportTitle: (p: { sport: WorkoutType }) => sport.label[p.sport],
    sportMainDetail: (p: { n: number; total: number }, f: Format) => `La ${f.ordinal(p.n)} delle ${f.numberWord(p.total)} di questa settimana.`,
    runDetailFirst: (_p: NoParams) => 'Nessuna corsa ancora questa settimana.',
    runDetailNth: (p: { n: number }, f: Format) => `La ${f.ordinal(p.n)} corsa della settimana.`,
    sportProgress: (p: { sport: WorkoutType; done: number; target: number }) => `${sport.label[p.sport]}: ${p.done} su ${p.target}`,
    sportMissing: (p: { missing: number; byDay: number | null; inPlanToday: boolean }, f: Format) =>
      `${f.plural(p.missing, 'Ne manca', 'Ne mancano')} ${p.missing}${p.byDay === null ? ' questa settimana' : ` entro ${f.weekdayName(p.byDay)}`}${p.inPlanToday ? ': una è nel piano di oggi' : ''}.`,
    runsCrowded: (p: { missing: number; sport: WorkoutType }, f: Format) => `${f.plural(p.missing, 'Ne manca', 'Ne mancano')} ${p.missing}: oggi c’è già ${sport.lower[p.sport]}, la corsa va nei prossimi giorni.`,
    runsPlanned: (p: { missing: number; minutes: number }, f: Format) => `${f.plural(p.missing, 'Ne manca', 'Ne mancano')} ${p.missing}: una corsa da ${f.count(p.minutes, 'minuto', 'minuti')} è nel piano.`,

    sportCrowded: (p: { missing: number; sport: WorkoutType; other: WorkoutType }, f: Format) =>
      `${f.plural(p.missing, 'Ne manca', 'Ne mancano')} ${p.missing}: oggi c’è già ${sport.lower[p.other]}, il resto va nei prossimi giorni.`,
    sportPlanned: (p: { missing: number; sport: WorkoutType; minutes: number }, f: Format) =>
      `${f.plural(p.missing, 'Ne manca', 'Ne mancano')} ${p.missing}: una sessione da ${f.count(p.minutes, 'minuto', 'minuti')} è nel piano.`,

    periodTitle: (p: { period: string }) => p.period,
    periodText: (p: { end: string; hoursPerDay: number | null; sport: boolean }, f: Format) =>
      `${f.until(p.end, { capital: true })}: ${
        p.hoursPerDay === null && !p.sport
          ? 'nessuna eccezione'
          : `${p.hoursPerDay === null ? '' : `obiettivo di ${f.hours(p.hoursPerDay)} al giorno`}${p.hoursPerDay !== null && p.sport ? ', ' : ''}${p.sport ? 'sport con obiettivi a parte' : ''}`
      }.`,

    lowTitle: (_p: NoParams) => 'Niente teoria nuova',
    lowText: (p: { energy: Energy; block: number }) => `Disco da ${energyName(p.energy)}: blocchi da ${p.block} minuti, ripasso attivo e schede.`,
    midTitle: (_p: NoParams) => 'L’esame più vicino per primo',
    midText: (p: { energy: Energy; block: number; pause: number }) => `Disco da ${energyName(p.energy)}: blocchi da ${p.block} minuti con ${p.pause} di pausa.`,
    highTitle: (_p: NoParams) => 'Teoria difficile nelle prime ore',
    highText: (p: { energy: Energy }) => `Disco da ${energyName(p.energy)}: la teoria più impegnativa va al mattino, quando la testa regge.`,

    examTitle: (p: { name: string }) => `${p.name} è la priorità 1`,
    examText: (p: { days: number; date: string; threshold: number }, f: Format) =>
      `L’esame ${p.days === 0 ? 'è oggi' : p.days === 1 ? 'è domani' : `è tra ${p.days} giorni`} (${f.date(p.date)}), entro la soglia di ${f.count(p.threshold, 'giorno', 'giorni')}.`,

    abilityItemTitle: (p: { name: string | null }) => p.name ?? ABILITY_FALLBACK,
    abilityItemDetail: (p: { days: number }, f: Format) => `Nessuna sessione da ${f.count(p.days, 'giorno', 'giorni')}: esercizi del capitolo in corso.`,
    abilityItemDetailNever: (_p: NoParams) => 'Riprendi dal capitolo in corso.',
    abilityIdleTitle: (p: { name: string | null; days: number }, f: Format) => `${p.name ?? ABILITY_FALLBACK}: nessuna sessione da ${f.count(p.days, 'giorno', 'giorni')}`,
    abilityNeverTitle: (p: { name: string | null }) => `${p.name ?? ABILITY_FALLBACK}: nessuna sessione ancora`,
    abilityText: (p: { threshold: number; minutes: number; alsoToday: boolean }, f: Format) =>
      `Oltre la soglia di ${p.threshold}: ${f.count(p.minutes, 'minuto', 'minuti')} nel piano di domani${p.alsoToday ? ' e già in quello di oggi' : ''}.`,

    hoursTitle: (p: { last7: number; target7: number }, f: Format) => `${f.hours(p.last7)} su ${f.hours(p.target7)} negli ultimi 7 giorni`,
    hoursText: (p: { deficit: number; perDay: number; tomorrow: number }, f: Format) =>
      `${f.hours(p.deficit)} sotto il ritmo di ${f.hours(p.perDay)} al giorno: l’obiettivo di domani sale a ${f.hours(p.tomorrow)}.`,

    cardsItemTitle: (_p: NoParams) => 'Ripasso a 10 dita',
    cardsDueDetail: (p: { due: number; course: string }, f: Format) => `${f.count(p.due, 'scheda scaduta', 'schede scadute')}, prima ${p.course}.`,
    cardsFreshDetail: (p: { fresh: number; course: string }, f: Format) => `${f.count(p.fresh, 'scheda nuova', 'schede nuove')} di ${p.course}.`,
    cardsNoteTitle: (p: { due: number }, f: Format) => f.count(p.due, 'scheda scaduta', 'schede scadute'),
    cardsNoteText: (p: { minutes: number; course: string }, f: Format) => `Nel piano ${f.count(p.minutes, 'minuto', 'minuti')} di ripasso a 10 dita, a partire da ${p.course}.`,
  },
}
