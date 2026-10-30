import { useRef, useState, type ChangeEvent } from 'react'
import { toast } from '../../../app/toast'
import { importBackup, parseBackup } from '../../../db/backup'
import { db } from '../../../db/db'
import { setSetting } from '../../../db/settings'
import { renderError } from '../../../i18n/errors'
import { LANG_NAME, LANGS, normalizeLanguage, type Lang } from '../../../i18n/lang'
import { getI18n, useI18n } from '../../../i18n/store'
import { readJsonFile } from '../../../lib/download'
import type { StepProps } from './types'

/** Nome, lingua di base e, solo al primo avvio, il ripristino di un backup. */
export function Step1Nome({ draft, change, mode }: StepProps) {
  const { t, f } = useI18n()
  const ts = t.benvenuto.step1
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')

  const setLang = (lang: Lang) => {
    change({ lang })
    // La lingua si applica subito: il percorso stesso cambia lingua.
    void setSetting(db, 'language', normalizeLanguage({ base: lang, otherDays: draft.otherDays }))
  }

  const restore = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    void (async () => {
      try {
        const r = await importBackup(db, parseBackup(await readJsonFile(file)))
        toast(ts.restored({ added: r.added }, f))
      } catch (err) {
        setError(renderError(err, getI18n()))
      }
    })()
  }

  return (
    <div className="welcome__fields">
      <label className="welcome__field">
        <span className="welcome__label">{ts.name}</span>
        <input className="field" value={draft.name} placeholder={ts.namePlaceholder} autoComplete="given-name" maxLength={60} onChange={(e) => change({ name: e.target.value })} />
      </label>
      <div className="welcome__field">
        <span className="welcome__label" id="w-lang">
          {ts.language}
        </span>
        <div className="segmented" role="group" aria-labelledby="w-lang">
          {LANGS.map((l) => (
            <button key={l} type="button" className="segmented__item" lang={l} aria-pressed={draft.lang === l} onClick={() => setLang(l)}>
              {LANG_NAME[l]}
            </button>
          ))}
        </div>
      </div>
      {mode === 'first' ? (
        <div className="welcome__field welcome__restore">
          <span className="welcome__hint">{ts.restoreHint}</span>
          <button type="button" className="btn" onClick={() => input.current?.click()}>
            {ts.restore}
          </button>
          <input ref={input} type="file" accept="application/json,.json" hidden onChange={restore} />
          <p className="welcome__error" role="alert">
            {error}
          </p>
        </div>
      ) : null}
    </div>
  )
}
