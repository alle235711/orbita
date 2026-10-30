import type { Format } from '../../format/types'
import { legacy } from './legacy'

export const ruler = {
  group: (p: { n: number }, f: Format) => f.count(p.n, 'esame', 'esami'),
  graduation: 'Laurea',
  description: (p: { parts: string[] }) => `Da oggi alla laurea: ${p.parts.join(', ')}.`,
  partExam: (p: { name: string; date: string }, f: Format) => `${p.name} ${f.on(p.date)}`,
  partPeriod: (p: { from: string; to: string }, f: Format) => `${legacy.periodSpoken} ${f.from(p.from)} ${f.to(p.to)}`,
  partMonthExams: (p: { n: number; month: string }, f: Format) => `${p.n === 1 ? 'un esame' : `${p.n} esami`} ${f.inMonth(p.month)}`,
  partGraduationMonth: (p: { month: string }, f: Format) => `laurea ${f.inMonth(p.month)}`,
  partGraduation: (p: { date: string }, f: Format) => `laurea ${f.on(p.date, { short: true })}`,
}
