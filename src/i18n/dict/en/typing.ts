import type { Finger, Hand } from '../../../review/keyboard'
import type { LessonId } from '../../../typing/lessons'
import type { Format } from '../../format/types'

const lessons: Record<LessonId, { title: string; detail: string }> = {
  base: { title: 'Home row', detail: 'Fingers at rest: a s d f, j k l ò, with the bumps on f and j.' },
  superiore: { title: 'Top row', detail: 'One row up without losing the home row.' },
  inferiore: { title: 'Bottom row', detail: 'One row down: z x c v, b n m and punctuation.' },
  accenti: { title: 'Accents and capitals', detail: 'Accented vowels and the Shift of the opposite hand.' },
  numeri: { title: 'Numbers and symbols', detail: 'The number row and the Shift symbols, as in the card formulas.' },
  testi: { title: 'Texts', detail: 'The review cards, in full.' },
  mirato: { title: 'Targeted exercise', detail: 'Words built on the keys you slip on most.' },
}

/** Plural names, for the colour legend. */
const fingers: Record<Finger, string> = {
  mignolo: 'pinkies',
  anulare: 'ring fingers',
  medio: 'middle fingers',
  indice: 'index fingers',
  pollice: 'thumbs',
}

const fingerOne: Record<Finger, string> = { mignolo: 'pinky', anulare: 'ring finger', medio: 'middle finger', indice: 'index finger', pollice: 'thumb' }
const handWord: Record<Hand, string> = { sinistra: 'left', destra: 'right' }

export const typing = {
  keyboardRecall: 'Italian keyboard: the keys you mistyped are in red.',
  keyboardTyping: (p: { hint: string }) => `Italian keyboard with the keys coloured by finger. ${p.hint}`,
  lessons,
  fingers,
  legendLabel: 'Finger colours',
  /** Hint about the key to press. `shift` = the Shift hand. */
  hint: {
    space: 'Space, with the thumb',
    special: (p: { char: string }) => `«${p.char}»: special character`,
    /** `altGr` = the character is on the third level: Alt Gr with the right thumb, plus Shift on the fourth. */
    finger: (p: { char: string; finger: Finger; hand: Hand; shift?: Hand; altGr?: boolean }) =>
      `«${p.char}», ${handWord[p.hand]} ${fingerOne[p.finger]}${p.altGr ? ' with Alt Gr (right thumb)' : ''}${p.shift ? `${p.altGr ? ' and' : ' with'} the ${handWord[p.shift]} Shift` : ''}`,
  },

  title: 'Typing',
  leadPractice: (p: { accuracy: number; wpm: number }) =>
    `One step at a time, without looking at the keyboard: you move on to the next lesson at ${p.accuracy}% accuracy and ${p.wpm} words per minute.`,
  leadStats: 'Lessons are done on the computer’s physical keyboard. Here you’ll find the stats: errors per key and latest attempts.',
  path: 'The path',
  todo: 'To do',
  best: (p: { wpm: number; accuracy: number }, f: Format) => `${p.wpm} words per minute, ${f.number(p.accuracy * 100, 0)}%`,
  passed: ', passed',
  upNext: ', up next',
  exerciseLabel: (p: { title: string }) => `Exercise: ${p.title}`,
  another: 'Another exercise',
  needRuns: 'A couple more attempts are needed to see where you slip.',
  preparing: 'Preparing the exercise…',
  result: (p: { wpm: number; accuracy: number }, f: Format) => `${p.wpm} words per minute, ${f.number(p.accuracy * 100, 0)}%.`,
  lessonPassed: 'Lesson passed.',
  toPass: (p: { accuracy: number; wpm: number }) => `To pass: ${p.accuracy}% and ${p.wpm} words per minute.`,
  errorsByKey: 'Errors per key',
  targeted: 'Targeted exercise',
  worstLead: 'You slip most on',
  noErrors: 'No errors recorded yet: the map fills with colour as you practise.',
  heatLabel: 'Error map by key: the redder, the more errors.',
  lastRuns: 'Latest attempts',
  colDay: 'Day',
  colLesson: 'Lesson',
  colWpm: 'Words per minute',
  colAccuracy: 'Accuracy',
  noRuns: 'No attempts yet.',
}
