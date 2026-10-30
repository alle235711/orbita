import type { Format } from '../../format/types'
import type { ResultOutcome } from '../../../db/schema'

const outcome: Record<ResultOutcome, string> = {
  superato: 'Passed',
  rifiutato: 'Refused',
  'non-superato': 'Failed',
}

export const libretto = {
  title: 'Transcript',
  hero: {
    weighted: 'Weighted average',
    arithmetic: 'Simple average',
    empty: 'No grades yet',
    emptyHint: 'Record your first grade to see the average.',
    graded: (p: { n: number }, f: Format) => `across ${f.count(p.n, 'graded exam', 'graded exams')}`,
    noCfu: (p: { n: number }, f: Format) =>
      p.n === 1
        ? '1 graded exam has no credits: the weighted average leaves it out. Add them in Data.'
        : `${f.count(p.n, 'graded exam', 'graded exams')} have no credits: the weighted average leaves them out. Add them in Data.`,
  },
  cfu: {
    label: 'Credits',
    progress: (p: { earned: number; total: number }) => `${p.earned} of ${p.total} credits`,
    missing: (p: { missing: number }) => `${p.missing} to go`,
    aria: (p: { earned: number; total: number }) => `Credits earned: ${p.earned} of ${p.total}`,
    unknown: (p: { n: number }, f: Format) => `${f.count(p.n, 'passed exam', 'passed exams')} without credits`,
  },
  graduation: {
    label: 'Graduation base',
    hint: (p: { scale: number; divisor: number }, f: Format) => `Weighted average × ${f.number(p.scale, 0)} ÷ ${f.number(p.divisor, 0)}, plus bonuses`,
    bonus: (p: { points: number }, f: Format) => `of which bonus ${f.number(p.points, 1)}`,
    edit: 'Edit the formula',
    none: 'You need at least one grade with credits.',
  },
  sim: {
    title: 'Simulator',
    target: 'Target average',
    targetDown: 'Lower the target',
    targetUp: 'Raise the target',
    possible: (p: { target: number; needed: number; exams: number; cfu: number }, f: Format) =>
      p.exams === 1
        ? `To reach ${f.number(p.target, 1)} you need at least ${f.number(p.needed, 1)} in the next exam (${p.cfu} credits).`
        : `To reach ${f.number(p.target, 1)} you need at least ${f.number(p.needed, 1)} across the next ${p.exams} exams (${p.cfu} credits).`,
    reached: (p: { target: number }, f: Format) => `An average of ${f.number(p.target, 1)} is already secured: just pass the remaining exams.`,
    impossible: (p: { target: number; best: number | null; exams: number; cfu: number }, f: Format) =>
      p.best === null
        ? `${f.number(p.target, 1)} is out of reach.`
        : p.exams === 1
          ? `${f.number(p.target, 1)} is out of reach: with 30 in the next exam (${p.cfu} credits) you get to ${f.number(p.best, 2)}.`
          : `${f.number(p.target, 1)} is out of reach: with 30 in all of the next ${p.exams} exams (${p.cfu} credits) you get to ${f.number(p.best, 2)}.`,
    doneReached: (p: { target: number; mean: number }, f: Format) => `No exams left: the final average is ${f.number(p.mean, 2)}, so ${f.number(p.target, 1)} is reached.`,
    doneMissed: (p: { target: number; mean: number }, f: Format) => `No exams left: the final average is ${f.number(p.mean, 2)}, so ${f.number(p.target, 1)} is not reached.`,
    noExams: 'Add the exams you still have to take, with their credits, in Data.',
    noData: 'The simulator starts from your first grade with credits.',
  },
  list: {
    passed: 'Passed exams',
    attempts: 'Attempts',
    emptyPassed: 'No passed exams.',
    emptyAttempts: 'No attempts to remember.',
    idoneita: 'Pass/fail',
    lode: 'with honours',
    gradeAria: (p: { grade: number; lode: boolean }) => (p.lode ? `${p.grade} with honours` : `${p.grade}`),
    cfu: (p: { n: number }) => `${p.n} credits`,
    edit: (p: { name: string }) => `Edit the result of ${p.name}`,
  },
  outcome,
  passedChip: 'Passed',
  add: 'Record a result',
  sheet: {
    titleNew: 'Record a result',
    titleEdit: 'Edit the result',
    course: 'Exam',
    coursePlaceholder: 'Choose an exam',
    noCourses: 'Every exam is already passed. Add one in Data.',
    date: 'Date',
    outcome: 'Outcome',
    grade: 'Grade',
    noGrade: 'Pass without a grade',
    lode: 'With honours',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    deleteConfirm: 'Tap again to delete',
  },
  formula: {
    title: 'Graduation score formula',
    lead: 'No university rule is built into the app: set your own here.',
    scale: 'Scale (usually 110)',
    divisor: 'Divisor (usually 30)',
    bonuses: 'Bonuses',
    addBonus: 'Add a bonus',
    bonusLabel: 'Bonus name',
    bonusPoints: 'Points',
    kind: { fixed: 'Fixed', perLode: 'Per honours' },
    remove: (p: { name: string }) => `Remove the bonus ${p.name}`,
    reset: 'Restore the default formula',
    preview: (p: { total: number }, f: Format) => `With your grades now: ${f.number(p.total, 1)}`,
    max: (p: { n: number }) => `At most ${p.n} bonuses.`,
    invalid: (p: { min: number; max: number }) => `Enter a number from ${p.min} to ${p.max}.`,
  },
  toast: { saved: 'Grade saved.', deleted: 'Result deleted.' },
}
