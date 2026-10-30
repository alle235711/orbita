import { useLayoutEffect } from 'react'
import { useSetting } from '../db/hooks'
import { useToday } from '../app/useToday'
import { langForDate, normalizeLanguage } from './lang'
import { LANG_STORAGE_KEY, setLang } from './store'

/** Allinea lo store, <html lang> e la lingua ricordata alla lingua di oggi. */
export function LangSync(): null {
  const today = useToday()
  const raw = useSetting('language')
  const loaded = raw !== undefined
  const settings = normalizeLanguage(raw)
  const lang = langForDate(today, settings)
  const base = settings.base

  useLayoutEffect(() => {
    if (!loaded) return
    setLang(lang, base)
    document.documentElement.lang = lang
    try {
      localStorage.setItem(LANG_STORAGE_KEY, lang)
    } catch {
      // modalità privata: si resta con la lingua in memoria
    }
  }, [loaded, lang, base])

  return null
}
