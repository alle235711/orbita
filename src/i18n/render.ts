import type { BriefingNote, DayPlan, PlanItem } from '../rules/types'
import type { I18n } from './index'
import { renderMsg } from './messages'

export interface RenderedItem extends Omit<PlanItem, 'title' | 'detail'> {
  title: string
  detail: string
}
export interface RenderedNote extends Omit<BriefingNote, 'title' | 'text'> {
  title: string
  text: string
}
export interface RenderedPlan extends Omit<DayPlan, 'headline' | 'rule' | 'items' | 'tomorrow' | 'notes'> {
  headline: [string, string]
  rule: string
  items: RenderedItem[]
  tomorrow: RenderedItem[]
  notes: RenderedNote[]
}

export function renderItem(item: PlanItem, i18n: I18n): RenderedItem {
  return { ...item, title: renderMsg(item.title, i18n), detail: renderMsg(item.detail, i18n) }
}

export function renderNote(note: BriefingNote, i18n: I18n): RenderedNote {
  return { ...note, title: renderMsg(note.title, i18n), text: renderMsg(note.text, i18n) }
}

export function renderPlan(plan: DayPlan, i18n: I18n): RenderedPlan {
  return {
    ...plan,
    headline: [renderMsg(plan.headline[0], i18n), renderMsg(plan.headline[1], i18n)],
    rule: renderMsg(plan.rule, i18n),
    items: plan.items.map((i) => renderItem(i, i18n)),
    tomorrow: plan.tomorrow.map((i) => renderItem(i, i18n)),
    notes: plan.notes.map((n) => renderNote(n, i18n)),
  }
}
