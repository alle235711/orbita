// Mette i blocchi del piano negli spazi liberi dell'agenda. I blocchi così
// trovati sono suggerimenti: diventano impegni solo quando li confermi.

import type { CalendarEvent } from '../db/schema'
import { toHHMM, toMinutes } from '../lib/dates'
import type { PlanItem } from './types'

export interface SuggestedBlock {
  /** `${item.key}#${n}`: n parte da 1. */
  key: string
  item: PlanItem
  title: string
  start: string
  end: string
  part: number
  parts: number
}

export interface ScheduleOptions {
  /** Minuti dalla mezzanotte: per oggi si parte da adesso. */
  from: number
  dayStart?: number
  dayEnd?: number
  /** Le attività "di sera" non partono prima di quest'ora, se c'è posto. */
  eveningFrom?: number
}

type Interval = [number, number]

const roundUp = (m: number, step = 15) => Math.ceil(m / step) * step

/** I blocchi già confermati in agenda hanno la chiave del piano. */
export const isPlanned = (events: CalendarEvent[], key: string) => events.some((e) => !e.deletedAt && e.planKey === key)

function firstGap(busy: Interval[], from: number, length: number, end: number): number | undefined {
  let cursor = from
  for (const [s, e] of busy) {
    if (e <= cursor) continue
    if (s - cursor >= length) break
    cursor = Math.max(cursor, e)
  }
  return cursor + length <= end ? cursor : undefined
}

export function scheduleDay(items: PlanItem[], events: CalendarEvent[], options: ScheduleOptions): SuggestedBlock[] {
  const dayStart = options.dayStart ?? 8 * 60
  const dayEnd = options.dayEnd ?? 21 * 60
  const eveningFrom = options.eveningFrom ?? 17 * 60 + 30
  const busy: Interval[] = events
    .filter((e) => !e.deletedAt)
    .map((e): Interval => [toMinutes(e.start), toMinutes(e.end)])
    .sort((a, b) => a[0] - b[0])

  const occupy = (start: number, end: number) => {
    busy.push([start, end])
    busy.sort((a, b) => a[0] - b[0])
  }

  const start = Math.max(dayStart, roundUp(options.from))
  let cursor = start
  const out: SuggestedBlock[] = []
  // Prima le attività del mattino, poi le altre nell'ordine del piano; le
  // attività serali per ultime, così non rubano il posto allo studio.
  const ordered = [...items.filter((i) => i.morning), ...items.filter((i) => !i.morning && !i.evening), ...items.filter((i) => i.evening && !i.morning)]

  for (const item of ordered) {
    if (item.at) continue // già in agenda con il suo orario
    const parts = item.blocks.count
    const blocks: SuggestedBlock[] = []
    let from = item.evening ? Math.max(cursor, eveningFrom) : cursor
    for (let n = 1; n <= parts; n++) {
      const key = `${item.key}#${n}`
      if (isPlanned(events, key)) continue
      let at = firstGap(busy, from, item.blocks.minutes, dayEnd)
      if (at === undefined && item.evening) at = firstGap(busy, start, item.blocks.minutes, dayEnd)
      if (at === undefined) break
      const end = at + item.blocks.minutes
      occupy(at, end + item.blocks.pause)
      blocks.push({
        key,
        item,
        title: item.title,
        start: toHHMM(at),
        end: toHHMM(end),
        part: n,
        parts,
      })
      from = end + item.blocks.pause
    }
    out.push(...blocks)
    if (!item.evening && blocks.length) cursor = Math.max(cursor, toMinutes(blocks.at(-1)!.end) + item.blocks.pause)
  }
  return out.sort((a, b) => toMinutes(a.start) - toMinutes(b.start))
}
