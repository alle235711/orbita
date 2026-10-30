import type { Format } from '../../format/types'

export const ruler = {
  group: (p: { n: number }, f: Format) => f.count(p.n, 'exam', 'exams'),
  graduation: 'Graduation',
  description: (p: { parts: string[] }) => `From today to graduation: ${p.parts.join(', ')}.`,
  partExam: (p: { name: string; date: string }, f: Format) => `${p.name} ${f.on(p.date)}`,
  partPeriod: (p: { name: string; from: string; to: string }, f: Format) => `${p.name} ${f.from(p.from)} ${f.to(p.to)}`,
  partMonthExams: (p: { n: number; month: string }, f: Format) => `${p.n === 1 ? 'one exam' : `${p.n} exams`} ${f.inMonth(p.month)}`,
  partGraduationMonth: (p: { month: string }, f: Format) => `graduation ${f.inMonth(p.month)}`,
  partGraduation: (p: { date: string }, f: Format) => `graduation ${f.on(p.date, { short: true })}`,
}
