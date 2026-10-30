import { dicts, type Dict } from './dict'
import { enFormat } from './format/en'
import { itFormat } from './format/it'
import type { Format } from './format/types'
import type { Lang } from './lang'

export interface I18n {
  lang: Lang
  t: Dict
  f: Format
}

const FORMATS: Record<Lang, Format> = { it: itFormat, en: enFormat }
const CACHE: Partial<Record<Lang, I18n>> = {}

/** Costanti memorizzate: stessa lingua, stesso oggetto. */
export function i18nFor(lang: Lang): I18n {
  return (CACHE[lang] ??= { lang, t: dicts[lang], f: FORMATS[lang] })
}

export type { Dict } from './dict'
export type { Format } from './format/types'
export type { Lang } from './lang'
export { m, renderMsg, type PlanMsg } from './messages'
