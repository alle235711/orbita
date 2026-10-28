// Righello del tempo da oggi alla laurea (mockup Copertina-BucoNero, in basso).
// Scala lineare nei giorni; le etichette che si toccano salgono di una riga.

import type { Course, Deadline } from '../db/schema'
import { addDays, diffDays, formatDate, formatShort, isMonthOnly, monthShort, resolveDate, type ISODate } from '../lib/dates'

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

const lastDayOfMonth = (ym: string) => {
  const [y, m] = ym.split('-').map(Number) as [number, number]
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
  return addDays(next, -1)
}

/** Primo nome del corso: "Struttura", "Calcolo", "Topologia". */
export const shortName = (name: string) => name.split(/\s+/)[0] ?? name

type Dated = Deadline & { date: string }

/** Le scadenze con una data: il tirocinio resta senza finché non lo compili in Dati. */
const dated = (deadlines: Deadline[]): Dated[] => deadlines.filter((d): d is Dated => !!d.date && !d.deletedAt)

export function layoutRuler(today: ISODate, courses: Course[], deadlines: Deadline[], width: number): RulerLayout {
  const laurea = dated(deadlines).find((d) => d.kind === 'laurea')
  const end = laurea ? (isMonthOnly(laurea.date) ? lastDayOfMonth(laurea.date) : addDays(laurea.date, 14)) : addDays(today, 270)
  const total = Math.max(1, diffDays(today, end))
  const xOf = (date: ISODate) => (Math.min(total, Math.max(0, diffDays(today, date))) / total) * width
  const inRange = (date: ISODate) => diffDays(today, date) >= 0 && diffDays(date, end) >= 0

  // tacche dei mesi
  const ticks: RulerTick[] = []
  const [ty, tm] = today.split('-').map(Number)
  for (let i = 1; i <= 24; i++) {
    const m = ((tm! - 1 + i) % 12) + 1
    const y = ty! + Math.floor((tm! - 1 + i) / 12)
    const first = `${y}-${String(m).padStart(2, '0')}-01`
    if (diffDays(first, end) < 0) break
    ticks.push({ x: xOf(first), label: monthShort(m) })
  }

  const exams = courses
    .filter((c) => !c.deletedAt && c.examDate && inRange(resolveDate(c.examDate)))
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
    const label = `${shortName(next.name)} ${days === 0 ? 'oggi' : days === 1 ? 'domani' : `tra ${days} giorni`}`
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
    const label = list.length === 1 ? shortName(list[0]!.name) : `${list.length} esami`
    const mark: RulerMark = { kind: 'group', x, x2, label, labelX: x + 1, row: 0 }
    marks.push(mark)
    queue(mark.labelX, label, (row) => (mark.row = row))
  }

  for (const d of dated(deadlines).filter((d) => d.kind === 'periodo' && d.endDate)) {
    if (diffDays(today, d.endDate!) < 0) continue
    const x = xOf(d.date)
    const x2 = xOf(d.endDate!)
    const label = d.id === 'tirocinio' ? 'Maldive' : d.title
    const mark: RulerMark = { kind: 'period', x, x2, label, labelX: x + 4, row: 0 }
    marks.push(mark)
    queue(mark.labelX, label, (row) => (mark.row = row))
  }

  if (laurea && inRange(resolveDate(laurea.date))) {
    const x = xOf(isMonthOnly(laurea.date) ? `${laurea.date}-15` : laurea.date)
    const label = 'Laurea'
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

  return { width, rows: Math.max(1, rowEnds.length), ticks, marks, description: describe(today, exams, deadlines) }
}

function describe(today: ISODate, exams: Course[], deadlines: Deadline[]): string {
  // in ordine di data: il tirocinio può cadere prima o dopo gli esami
  const parts: { at: ISODate; text: string }[] = []
  for (const c of exams.filter((c) => !isMonthOnly(c.examDate!))) parts.push({ at: c.examDate!, text: `${c.name} il ${formatDate(c.examDate!)}` })
  const tir = dated(deadlines).find((d) => d.id === 'tirocinio')
  if (tir?.endDate && diffDays(today, tir.endDate) >= 0) {
    parts.push({ at: resolveDate(tir.date), text: `tirocinio alle Maldive dal ${formatDate(tir.date)} al ${formatDate(tir.endDate)}` })
  }
  const months = new Map<string, number>()
  for (const c of exams.filter((c) => isMonthOnly(c.examDate!))) months.set(c.examDate!, (months.get(c.examDate!) ?? 0) + 1)
  for (const [m, n] of months) parts.push({ at: resolveDate(m), text: `${n === 1 ? 'un esame' : `${n} esami`} a ${formatDate(m).split(' ')[0]}` })
  const laurea = dated(deadlines).find((d) => d.kind === 'laurea')
  if (laurea) {
    const at = isMonthOnly(laurea.date) ? lastDayOfMonth(laurea.date) : laurea.date
    parts.push({ at, text: `laurea ${isMonthOnly(laurea.date) ? `a ${formatDate(laurea.date).split(' ')[0]}` : `il ${formatShort(laurea.date)}`}` })
  }
  parts.sort((a, b) => a.at.localeCompare(b.at))
  return `Da oggi alla laurea: ${parts.map((p) => p.text).join(', ')}.`
}
