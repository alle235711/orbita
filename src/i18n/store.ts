// Lingua corrente: piccolo store esterno (useSyncExternalStore), senza dipendenze.

import { useMemo, useSyncExternalStore } from 'react'
import type { DayPlan } from '../rules/types'
import type { Dict } from './dict'
import type { Format } from './format/types'
import { i18nFor, type I18n } from './index'
import type { Lang } from './lang'
import { renderPlan, type RenderedPlan } from './render'

export const LANG_STORAGE_KEY = 'orbita.lang'

function initial(): Lang {
  try {
    return localStorage.getItem(LANG_STORAGE_KEY) === 'en' ? 'en' : 'it'
  } catch {
    return 'it'
  }
}

let lang: Lang = initial()
let base: Lang = lang
const listeners = new Set<() => void>()

const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}

/** Solo per <LangSync/> e per i test. Avvisa chi ascolta se qualcosa cambia. */
export function setLang(next: Lang, nextBase: Lang = base): void {
  if (next === lang && nextBase === base) return
  lang = next
  base = nextBase
  listeners.forEach((fn) => fn())
}

export const getLang = (): Lang => lang
export const getBase = (): Lang => base
export const getI18n = (): I18n => i18nFor(lang)
export const getT = (): Dict => getI18n().t
export const getFmt = (): Format => getI18n().f

export const useLang = (): Lang => useSyncExternalStore(subscribe, getLang)
export const useBaseLang = (): Lang => useSyncExternalStore(subscribe, getBase)
export const useI18n = (): I18n => i18nFor(useLang())
export const useT = (): Dict => useI18n().t
export const useFmt = (): Format => useI18n().f

export function useRenderedPlan(plan: DayPlan | undefined): RenderedPlan | undefined {
  const l = useLang()
  return useMemo(() => (plan ? renderPlan(plan, i18nFor(l)) : undefined), [plan, l])
}
