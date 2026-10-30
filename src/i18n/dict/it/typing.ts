import type { Finger, Hand } from '../../../review/keyboard'
import type { LessonId } from '../../../typing/lessons'
import type { Format } from '../../format/types'

const lessons: Record<LessonId, { title: string; detail: string }> = {
  base: { title: 'Riga di base', detail: 'Le dita a riposo: a s d f, j k l ò, con i rilievi su f e j.' },
  superiore: { title: 'Riga superiore', detail: 'Si sale di una riga senza perdere la base.' },
  inferiore: { title: 'Riga inferiore', detail: 'Si scende: z x c v, b n m e la punteggiatura.' },
  accenti: { title: 'Accenti e maiuscole', detail: 'Le vocali accentate e lo Shift della mano opposta.' },
  numeri: { title: 'Numeri e simboli', detail: 'La riga dei numeri e i simboli col Shift, come nelle formule delle schede.' },
  testi: { title: 'Testi', detail: 'Le schede del ripasso, intere.' },
  mirato: { title: 'Esercizio mirato', detail: 'Parole con i tasti dove sbagli di più.' },
}

/** Nomi al plurale, per la legenda dei colori. */
const fingers: Record<Finger, string> = {
  mignolo: 'mignoli',
  anulare: 'anulari',
  medio: 'medi',
  indice: 'indici',
  pollice: 'pollici',
}

const fingerOne: Record<Finger, string> = { mignolo: 'mignolo', anulare: 'anulare', medio: 'medio', indice: 'indice', pollice: 'pollice' }
const handWord: Record<Hand, string> = { sinistra: 'sinistro', destra: 'destro' }

export const typing = {
  lessons,
  fingers,
  legendLabel: 'Colori delle dita',
  /** Suggerimento sul tasto da premere. `shift` = la mano dello Shift. */
  hint: {
    space: 'Spazio, col pollice',
    special: (p: { char: string }) => `«${p.char}»: carattere speciale`,
    altGr: (p: { char: string; shift?: boolean }) =>
      `«${p.char}», tasto in basso a destra accanto ad alt gr${p.shift ? ', con lo Shift sinistro' : ''}`,
    finger: (p: { char: string; finger: Finger; hand: Hand; shift?: Hand }) =>
      `«${p.char}», ${fingerOne[p.finger]} ${handWord[p.hand]}${p.shift ? ` con lo Shift ${p.shift === 'destra' ? 'destro' : 'sinistro'}` : ''}`,
  },

  title: 'Dattilografia',
  leadPractice: (p: { accuracy: number; wpm: number }) =>
    `Un passo alla volta, senza guardare la tastiera: si passa alla lezione dopo con il ${p.accuracy}% di precisione e ${p.wpm} parole al minuto.`,
  leadStats: 'Le lezioni si fanno con la tastiera fisica del PC. Qui trovi le statistiche: errori per tasto e ultime prove.',
  path: 'Il percorso',
  todo: 'Da fare',
  best: (p: { wpm: number; accuracy: number }, f: Format) => `${p.wpm} parole al minuto, ${f.number(p.accuracy * 100, 0)}%`,
  passed: ', superata',
  upNext: ', la prossima',
  exerciseLabel: (p: { title: string }) => `Esercizio: ${p.title}`,
  another: 'Un altro esercizio',
  needRuns: 'Servono ancora un paio di prove per sapere dove sbagli.',
  preparing: 'Preparo l’esercizio…',
  result: (p: { wpm: number; accuracy: number }, f: Format) => `${p.wpm} parole al minuto, ${f.number(p.accuracy * 100, 0)}%.`,
  lessonPassed: 'Lezione superata.',
  toPass: (p: { accuracy: number; wpm: number }) => `Per superarla: ${p.accuracy}% e ${p.wpm} parole al minuto.`,
  errorsByKey: 'Errori per tasto',
  targeted: 'Esercizio mirato',
  worstLead: 'Sbagli di più su',
  noErrors: 'Ancora nessun errore registrato: la mappa si colora con le prove.',
  heatLabel: 'Mappa degli errori per tasto: più rosso, più errori.',
  lastRuns: 'Ultime prove',
  colDay: 'Giorno',
  colLesson: 'Lezione',
  colWpm: 'Parole al minuto',
  colAccuracy: 'Precisione',
  noRuns: 'Nessuna prova ancora.',
}
