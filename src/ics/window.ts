// L'anno accademico che contiene oggi: dal giorno di inizio più recente fino a un anno dopo, meno un giorno.

import type { ISODate } from '../lib/dates'
import { addMonthsClamped, civil, daysInMonth, epochDay, fromEpochDay, isoOf } from './time'

export const DEFAULT_YEAR_START = '09-01'

function validMonthDay(s: string): { m: number; d: number } | null {
  if (!/^\d{2}-\d{2}$/.test(s)) return null
  const m = Number(s.slice(0, 2))
  const d = Number(s.slice(3))
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(2001, m)) return null // 2001 non è bisestile: 02-29 non vale
  return { m, d }
}

export function academicWindow(yearStart: string, today: ISODate): { from: ISODate; to: ISODate } {
  const md = validMonthDay(yearStart) ?? validMonthDay(DEFAULT_YEAR_START)!
  const t = civil(today)
  let from = isoOf({ y: t.y, m: md.m, d: md.d })
  if (from > today) from = isoOf({ y: t.y - 1, m: md.m, d: md.d })
  const to = fromEpochDay(epochDay(addMonthsClamped(from, 12)) - 1)
  return { from, to }
}
