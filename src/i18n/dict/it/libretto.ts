import type { Format } from '../../format/types'
import type { ResultOutcome } from '../../../db/schema'

const outcome: Record<ResultOutcome, string> = {
  superato: 'Superato',
  rifiutato: 'Rifiutato',
  'non-superato': 'Non superato',
}

export const libretto = {
  title: 'Libretto',
  hero: {
    weighted: 'Media ponderata',
    arithmetic: 'Media aritmetica',
    empty: 'Nessun voto ancora',
    emptyHint: 'Registra il primo voto per vedere la media.',
    graded: (p: { n: number }, f: Format) => `su ${f.count(p.n, 'esame con voto', 'esami con voto')}`,
    noCfu: (p: { n: number }, f: Format) =>
      p.n === 1
        ? '1 esame con voto non ha i CFU: la media ponderata non lo conta. Inseriscili in Dati.'
        : `${f.count(p.n, 'esame', 'esami')} con voto non hanno i CFU: la media ponderata non li conta. Inseriscili in Dati.`,
  },
  cfu: {
    label: 'CFU',
    progress: (p: { earned: number; total: number }) => `${p.earned} di ${p.total} CFU`,
    missing: (p: { missing: number }) => `ne mancano ${p.missing}`,
    aria: (p: { earned: number; total: number }) => `CFU acquisiti: ${p.earned} su ${p.total}`,
    unknown: (p: { n: number }, f: Format) => `${f.count(p.n, 'esame superato', 'esami superati')} senza CFU`,
  },
  graduation: {
    label: 'Base di laurea',
    hint: (p: { scale: number; divisor: number }, f: Format) => `Media ponderata × ${f.number(p.scale, 0)} ÷ ${f.number(p.divisor, 0)}, più i bonus`,
    bonus: (p: { points: number }, f: Format) => `di cui bonus ${f.number(p.points, 1)}`,
    edit: 'Modifica la formula',
    none: 'Serve almeno un voto con i CFU.',
  },
  sim: {
    title: 'Simulatore',
    target: 'Media obiettivo',
    targetDown: 'Diminuisci l’obiettivo',
    targetUp: 'Aumenta l’obiettivo',
    possible: (p: { target: number; needed: number; exams: number; cfu: number }, f: Format) =>
      p.exams === 1
        ? `Per arrivare a ${f.number(p.target, 1)} ti serve almeno ${f.number(p.needed, 1)} nel prossimo esame (${p.cfu} CFU).`
        : `Per arrivare a ${f.number(p.target, 1)} ti serve almeno ${f.number(p.needed, 1)} nei prossimi ${p.exams} esami (${p.cfu} CFU).`,
    reached: (p: { target: number }, f: Format) => `La media di ${f.number(p.target, 1)} è già assicurata: basta superare i prossimi esami.`,
    impossible: (p: { target: number; best: number | null; exams: number; cfu: number }, f: Format) =>
      p.best === null
        ? `${f.number(p.target, 1)} non è più raggiungibile.`
        : p.exams === 1
          ? `${f.number(p.target, 1)} non è più raggiungibile: con 30 nel prossimo esame (${p.cfu} CFU) arrivi a ${f.number(p.best, 2)}.`
          : `${f.number(p.target, 1)} non è più raggiungibile: con 30 in tutti i prossimi ${p.exams} esami (${p.cfu} CFU) arrivi a ${f.number(p.best, 2)}.`,
    doneReached: (p: { target: number; mean: number }, f: Format) => `Non ci sono altri esami: la media finale è ${f.number(p.mean, 2)}, ${f.number(p.target, 1)} è raggiunto.`,
    doneMissed: (p: { target: number; mean: number }, f: Format) => `Non ci sono altri esami: la media finale è ${f.number(p.mean, 2)}, ${f.number(p.target, 1)} non è raggiunto.`,
    noExams: 'Aggiungi gli esami da sostenere, con i CFU, in Dati.',
    noData: 'Il simulatore parte dal primo voto con i CFU.',
  },
  list: {
    passed: 'Esami superati',
    attempts: 'Tentativi',
    emptyPassed: 'Nessun esame superato.',
    emptyAttempts: 'Nessun tentativo da ricordare.',
    idoneita: 'Idoneità',
    lode: 'e lode',
    gradeAria: (p: { grade: number; lode: boolean }) => (p.lode ? `${p.grade} e lode` : `${p.grade}`),
    cfu: (p: { n: number }) => `${p.n} CFU`,
    edit: (p: { name: string }) => `Modifica il risultato di ${p.name}`,
  },
  outcome,
  passedChip: 'Superato',
  add: 'Registra un voto',
  sheet: {
    titleNew: 'Registra un voto',
    titleEdit: 'Modifica il voto',
    course: 'Esame',
    coursePlaceholder: 'Scegli un esame',
    noCourses: 'Tutti gli esami sono già superati. Aggiungine uno in Dati.',
    date: 'Data',
    outcome: 'Esito',
    grade: 'Voto',
    noGrade: 'Idoneità, senza voto',
    lode: 'Con lode',
    save: 'Salva',
    cancel: 'Annulla',
    delete: 'Elimina',
    deleteConfirm: 'Tocca ancora per eliminare',
  },
  formula: {
    title: 'Formula del voto di laurea',
    lead: 'Nessuna regola d’ateneo è scritta nell’app: imposta qui la tua.',
    scale: 'Scala (di solito 110)',
    divisor: 'Divisore (di solito 30)',
    bonuses: 'Bonus',
    addBonus: 'Aggiungi un bonus',
    bonusLabel: 'Nome del bonus',
    bonusPoints: 'Punti',
    kind: { fixed: 'Fisso', perLode: 'Per ogni lode' },
    remove: (p: { name: string }) => `Togli il bonus ${p.name}`,
    reset: 'Ripristina la formula predefinita',
    preview: (p: { total: number }, f: Format) => `Con i voti di adesso: ${f.number(p.total, 1)}`,
    max: (p: { n: number }) => `Al massimo ${p.n} bonus.`,
    invalid: (p: { min: number; max: number }) => `Scrivi un numero da ${p.min} a ${p.max}.`,
  },
  multiverse: { title: 'Multiverso degli appelli', hint: 'Confronta gli appelli possibili, esame per esame.' },
  toast: { saved: 'Voto salvato.', deleted: 'Risultato eliminato.' },
}
