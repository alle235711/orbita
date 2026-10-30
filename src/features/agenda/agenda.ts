// Logica pura dell'Agenda: impaginazione della giornata, raggruppamento per
// settimana, ore di ogni giorno e geometria della galassia a sette bracci.

import type { CalendarEvent, Session } from '../../db/schema'
import { toMinutes, weekDays, type ISODate } from '../../lib/dates'
import { WORK_TYPES } from '../../rules/rules'
import type { Tuning } from '../../rules/defaults'

/** Le ore intere che l'agenda mostra di base: dalla soglia di inizio a quella di fine della giornata. */
export function agendaWindow(tuning: Tuning): { start: number; end: number } {
  const g = tuning.giornata
  return { start: Math.floor(g.dayStart! / 60) * 60, end: Math.ceil(g.dayEnd! / 60) * 60 }
}

export interface Placed<T> {
  item: T
  start: number
  end: number
  column: number
  columns: number
}

/**
 * Impegni che si sovrappongono vanno affiancati: ogni gruppo di impegni
 * sovrapposti si divide in colonne, la prima libera per ciascuno.
 */
export function layoutDay<T extends { start: string; end: string }>(items: T[]): Placed<T>[] {
  const sorted = items
    .map((item) => ({ item, start: toMinutes(item.start), end: Math.max(toMinutes(item.end), toMinutes(item.start) + 15) }))
    .sort((a, b) => a.start - b.start || b.end - a.end)
  const out: Placed<T>[] = []
  let group: Placed<T>[] = []
  let groupEnd = -1
  const flush = () => {
    const columns = Math.max(1, ...group.map((p) => p.column + 1))
    for (const p of group) p.columns = columns
    group = []
  }
  for (const s of sorted) {
    if (s.start >= groupEnd) {
      flush()
      groupEnd = -1
    }
    const used = new Set(group.filter((p) => p.end > s.start).map((p) => p.column))
    let column = 0
    while (used.has(column)) column++
    const placed: Placed<T> = { ...s, column, columns: 1 }
    group.push(placed)
    out.push(placed)
    groupEnd = Math.max(groupEnd, s.end)
  }
  flush()
  return out
}

export function eventsByDay(events: CalendarEvent[], days: ISODate[]): Map<ISODate, CalendarEvent[]> {
  const map = new Map<ISODate, CalendarEvent[]>(days.map((d) => [d, []]))
  for (const e of events) {
    if (e.deletedAt) continue
    map.get(e.date)?.push(e)
  }
  for (const list of map.values()) list.sort((a, b) => toMinutes(a.start) - toMinutes(b.start))
  return map
}

/**
 * Ore di ogni giorno della settimana per la galassia: per i giorni passati e
 * per oggi quelle registrate (studio, ripasso, lavoro), per quelli futuri
 * quelle già in agenda.
 */
export function weekHours(day: ISODate, today: ISODate, sessions: Session[], events: CalendarEvent[], workTypes: readonly Session['type'][] = WORK_TYPES): number[] {
  return weekDays(day).map((d) => {
    if (d <= today) {
      return sessions.filter((s) => !s.deletedAt && s.date === d && workTypes.includes(s.type)).reduce((n, s) => n + s.minutes, 0) / 60
    }
    return events
      .filter((e) => !e.deletedAt && e.date === d && e.type !== 'sport')
      .reduce((n, e) => n + Math.max(0, toMinutes(e.end) - toMinutes(e.start)), 0) / 60
  })
}

// ——— galassia ———

export interface Arm {
  /** 0 = lunedì … 6 = domenica */
  index: number
  ribbon: string
  spine: string
  tip: { x: number; y: number }
}

/**
 * Sette bracci a spirale attorno al nucleo, uno per giorno: il lunedì parte
 * in alto e i giorni seguono in senso orario. Ogni braccio è un nastro che
 * si assottiglia verso la punta.
 */
export function galaxyArms(radius = 150, twist = 2.1): Arm[] {
  const arms: Arm[] = []
  const steps = 28
  for (let i = 0; i < 7; i++) {
    const theta0 = -Math.PI / 2 + (i * 2 * Math.PI) / 7
    const pts: { x: number; y: number; nx: number; ny: number; w: number }[] = []
    for (let k = 0; k <= steps; k++) {
      const t = k / steps
      const r = radius * (0.12 + 0.88 * t)
      const th = theta0 + twist * t
      const x = r * Math.cos(th)
      const y = r * Math.sin(th)
      // derivata per la normale
      const dr = radius * 0.88
      const dx = dr * Math.cos(th) - r * twist * Math.sin(th)
      const dy = dr * Math.sin(th) + r * twist * Math.cos(th)
      const len = Math.hypot(dx, dy) || 1
      pts.push({ x, y, nx: -dy / len, ny: dx / len, w: 2 + 15 * Math.sin(Math.PI * Math.min(1, t * 1.15)) * (1 - t * 0.55) })
    }
    const left = pts.map((p) => `${(p.x + p.nx * p.w).toFixed(1)},${(p.y + p.ny * p.w).toFixed(1)}`)
    const right = pts.map((p) => `${(p.x - p.nx * p.w).toFixed(1)},${(p.y - p.ny * p.w).toFixed(1)}`).reverse()
    const tip = pts.at(-1)!
    arms.push({
      index: i,
      ribbon: `M${left.join(' L')} L${right.join(' L')} Z`,
      spine: `M${pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L')}`,
      tip: { x: tip.x, y: tip.y },
    })
  }
  return arms
}

/** Luminosità di un braccio: 0,22 a vuoto, piena da 8 ore in su. */
export const armGlow = (hours: number) => 0.22 + 0.68 * Math.min(1, Math.max(0, hours) / 8)
