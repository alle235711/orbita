// Righello del tempo da oggi alla laurea (mockup Copertina-BucoNero, in basso).
// Scala lineare nei giorni; le etichette che si toccano salgono di una riga.

import type { Course, Deadline } from '../db/schema'
import type { I18n } from '../i18n'
import { addDays, diffDays, isMonthOnly, lastDayOfMonth, resolveDate, type ISODate } from '../lib/dates'

export interface RulerTick {
  x: number
  label: string
}

export type RulerMark =
  | { kind: 'next'; x: number; label: string; labelX: number; row: number }
  | { kind: 'exam'; x: number }
  | { kind: 'group'; x: number; x2: number; label: string; labelX: number; row: number }
  | { kind: 'period'; x: number; x2: number; label: string; labelX: number; row: number }
  | { kind: 'laurea'; x: number; label: string; labelX: number; anchor: 'start' | 'end'; row: number }

export interface RulerLayout {
  width: number
  rows: number
  ticks: RulerTick[]
  marks: RulerMark[]
  description: string
}

const CHAR = 6.8 // larghezza media di un carattere a 12 px, peso 700–800

/** Primo nome del corso: "Fisica", "Calcolo", "Topologia". */
export const shortName = (name: string) => name.split(/\s+/)[0] ?? name

type Dated = Deadline & { date: string }

/** Le scadenze con una data: un periodo resta senza finché non lo compili in Dati. */
const dated = (deadlines: Deadline[]): Dated[] => deadlines.filter((d): d is Dated => !!d.date && !d.deletedAt)

/** `graduationTarget` ('YYYY-MM-DD' o 'YYYY-MM') è la laurea prevista del profilo. */
export function layoutRuler(today: ISODate, courses: Course[], deadlines: Deadline[], width: number, i18n: Pick<I18n, 't' | 'f'>, graduationTarget?: string): RulerLayout {
  const { t, f } = i18n
  const laurea = graduationTarget ? { date: graduationTarget } : undefined
  const end = laurea ? (isMonthOnly(laurea.date) ? lastDayOfMonth(laurea.date) : addDays(laurea.date, 14)) : addDays(today, 270)
  const total = Math.max(1, diffDays(today, end))
  const xOf = (date: ISODate) => (Math.min(total, Math.max(0, diffDays(today, date))) / total) * width
  const inRange = (date: ISODate) => diffDays(today, date) >= 0 && diffDays(date, end) >= 0
  // un esame col solo mese resta in arrivo fino a fine mese
  const inRangeExam = (examDate: string) =>
    isMonthOnly(examDate) ? diffDays(today, lastDayOfMonth(examDate)) >= 0 && diffDays(resolveDate(examDate), end) >= 0 : inRange(examDate)

  // tacche dei mesi
  const ticks: RulerTick[] = []
  const [ty, tm] = today.split('-').map(Number)
  for (let i = 1; i <= 24; i++) {
    const m = ((tm! - 1 + i) % 12) + 1
    const y = ty! + Math.floor((tm! - 1 + i) / 12)
    const first = `${y}-${String(m).padStart(2, '0')}-01`
    if (diffDays(first, end) < 0) break
    ticks.push({ x: xOf(first), label: f.monthShort(m) })
  }

  const exams = courses
    .filter((c) => !c.deletedAt && c.examDate && inRangeExam(c.examDate))
    .sort((a, b) => resolveDate(a.examDate!).localeCompare(resolveDate(b.examDate!)))
  const singles = exams.filter((c) => !isMonthOnly(c.examDate!))
  const byMonth = new Map<string, Course[]>()
  for (const c of exams.filter((c) => isMonthOnly(c.examDate!))) byMonth.set(c.examDate!, [...(byMonth.get(c.examDate!) ?? []), c])

  const marks: RulerMark[] = []
  const labels: { start: number; end: number; set: (row: number) => void }[] = []
  const queue = (start: number, text: string, set: (row: number) => void) =>
    labels.push({ start: Math.max(0, start), end: Math.max(0, start) + text.length * CHAR, set })

  const next = exams[0]
  if (next) {
    const x = xOf(resolveDate(next.examDate!))
    const days = diffDays(today, next.examDate!)
    const label = `${shortName(next.name)} ${f.relativeDays(days)}`
    if (isMonthOnly(next.examDate!)) {
      // il più vicino è un gruppo di febbraio: lo evidenzia il gruppo stesso
    } else {
      const mark: RulerMark = { kind: 'next', x, label, labelX: Math.max(0, x - 68), row: 0 }
      marks.push(mark)
      queue(mark.labelX, label, (row) => (mark.row = row))
    }
  }
  for (const c of singles) if (c !== next) marks.push({ kind: 'exam', x: xOf(c.examDate!) })

  for (const [month, list] of byMonth) {
    const x = xOf(`${month}-01`)
    const x2 = xOf(`${month}-14`)
    const label = list.length === 1 ? shortName(list[0]!.name) : t.ruler.group({ n: list.length }, f)
    const mark: RulerMark = { kind: 'group', x, x2, label, labelX: x + 1, row: 0 }
    marks.push(mark)
    queue(mark.labelX, label, (row) => (mark.row = row))
  }

  for (const d of dated(deadlines).filter((d) => d.kind === 'periodo' && d.endDate)) {
    if (diffDays(today, d.endDate!) < 0) continue
    const x = xOf(d.date)
    const x2 = xOf(d.endDate!)
    const label = d.title
    const mark: RulerMark = { kind: 'period', x, x2, label, labelX: x + 4, row: 0 }
    marks.push(mark)
    queue(mark.labelX, label, (row) => (mark.row = row))
  }

  if (laurea && inRange(resolveDate(laurea.date))) {
    const x = xOf(isMonthOnly(laurea.date) ? `${laurea.date}-15` : laurea.date)
    const label = t.ruler.graduation
    const anchor = x + 10 + label.length * CHAR > width ? 'end' : 'start'
    const mark: RulerMark = { kind: 'laurea', x, label, labelX: anchor === 'start' ? x + 10 : x - 10, anchor, row: 0 }
    marks.push(mark)
    const start = anchor === 'start' ? x + 10 : x - 10 - label.length * CHAR
    queue(start, label, (row) => (mark.row = row))
  }

  // righe delle etichette: la prima libera da sinistra
  const rowEnds: number[] = []
  for (const l of labels.sort((a, b) => a.start - b.start)) {
    let row = rowEnds.findIndex((end) => l.start > end + 8)
    if (row < 0) row = rowEnds.length
    rowEnds[row] = l.end
    l.set(row)
  }

  return { width, rows: Math.max(1, rowEnds.length), ticks, marks, description: describe(today, exams, deadlines, i18n, graduationTarget) }
}

function describe(today: ISODate, exams: Course[], deadlines: Deadline[], { t, f }: Pick<I18n, 't' | 'f'>, graduationTarget?: string): string {
  // in ordine di data: un periodo può cadere prima o dopo gli esami
  const parts: { at: ISODate; text: string }[] = []
  for (const c of exams.filter((c) => !isMonthOnly(c.examDate!))) parts.push({ at: c.examDate!, text: t.ruler.partExam({ name: c.name, date: c.examDate! }, f) })
  for (const p of dated(deadlines).filter((d) => d.kind === 'periodo')) {
    if (p.endDate && diffDays(today, p.endDate) >= 0) {
      parts.push({ at: resolveDate(p.date), text: t.ruler.partPeriod({ name: p.title, from: p.date, to: p.endDate }, f) })
    }
  }
  const months = new Map<string, number>()
  for (const c of exams.filter((c) => isMonthOnly(c.examDate!))) months.set(c.examDate!, (months.get(c.examDate!) ?? 0) + 1)
  for (const [m, n] of months) parts.push({ at: resolveDate(m), text: t.ruler.partMonthExams({ n, month: m }, f) })
  const laurea = graduationTarget ? { date: graduationTarget } : undefined
  if (laurea) {
    const monthOnly = isMonthOnly(laurea.date)
    parts.push({
      at: monthOnly ? lastDayOfMonth(laurea.date) : laurea.date,
      text: monthOnly ? t.ruler.partGraduationMonth({ month: laurea.date }, f) : t.ruler.partGraduation({ date: laurea.date }, f),
    })
  }
  parts.sort((a, b) => a.at.localeCompare(b.at))
  return t.ruler.description({ parts: parts.map((p) => p.text) })
}
