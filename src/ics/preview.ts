// Dal testo del file all'anteprima da mostrare: lettura, espansione nell'anno accademico, gruppi per titolo. Puro.

import type { CalendarEvent, Course } from '../db/schema'
import { AppError } from '../i18n/errors'
import type { ISODate } from '../lib/dates'
import { expandIcs, type IcsExpansion } from './expand'
import { buildGroups, type IcsGroup } from './mapping'
import { parseIcs, type IcsParseResult } from './parse'
import { academicWindow } from './window'

export interface IcsPreview {
  parse: IcsParseResult
  expansion: IcsExpansion
  groups: IcsGroup[]
}
export interface PreviewContext {
  yearStart: string
  today: ISODate
  displayZone: string
  courses: Course[]
  existing: CalendarEvent[]
}

export function previewIcs(text: string, ctx: PreviewContext): IcsPreview {
  const parse = parseIcs(text)
  if (!parse.events.some((e) => e.start.kind !== 'date')) throw new AppError('icsNothingToImport')
  const window = academicWindow(ctx.yearStart, ctx.today)
  const expansion = expandIcs(parse, { window, displayZone: ctx.displayZone })
  // Una serie annullata o scartata dai limiti non è "fuori anno": la finestra errata si riconosce dal resto.
  if (!expansion.occurrences.length && !expansion.stats.tooMany && !expansion.series.some((s) => s.cancelled)) {
    throw new AppError('icsOutsideWindow', window)
  }
  const live = ctx.courses.filter((c) => !c.deletedAt)
  return { parse, expansion, groups: buildGroups(expansion, live, ctx.existing) }
}
