import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { toast } from '../../app/toast'
import { useToday } from '../../app/useToday'
import { Sheet } from '../../components/Sheet'
import { db } from '../../db/db'
import { useCourses, useProfile } from '../../db/hooks'
import { normalizeProfile } from '../../db/profile'
import { renderError } from '../../i18n/errors'
import type { Format } from '../../i18n/format/types'
import { useI18n } from '../../i18n/store'
import { applyIcsPlan } from '../../ics/apply'
import { deviceZone } from '../../ics/import'
import { defaultMapping, type IcsMapping, type IcsTarget } from '../../ics/mapping'
import { planIcsImport } from '../../ics/plan'
import { previewIcs, type IcsPreview } from '../../ics/preview'
import { readIcsFile } from '../../ics/read'

type Phase = 'idle' | 'reading' | 'error' | 'preview'

const NONE = 'none'
const SKIP = 'skip'
const COURSE = 'course:'

/** Foglio per importare l'orario da un file .ics: legge, propone gli abbinamenti, scrive solo dopo la conferma. */
export function IcsImportSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n()
  return (
    <Sheet open={open} title={t.agenda.ics.title} onClose={onClose}>
      <ImportBody onClose={onClose} />
    </Sheet>
  )
}

function ImportBody({ onClose }: { onClose: () => void }) {
  const i18n = useI18n()
  const { t, f } = i18n
  const ti = t.agenda.ics
  const today = useToday()
  const courses = useCourses()
  const profile = useProfile()
  const input = useRef<HTMLInputElement>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<IcsPreview | null>(null)
  const [choices, setChoices] = useState<Map<string, string>>(new Map())
  const [saving, setSaving] = useState(false)

  const imported = useLiveQuery(async () => (await db.events.toArray()).filter((e) => e.source === 'ics'), [])
  const sorted = useMemo(() => [...courses].sort((a, b) => a.name.localeCompare(b.name, 'it')), [courses])

  const mapping: IcsMapping = useMemo(() => {
    const m = new Map<string, IcsTarget>()
    for (const [summary, v] of choices) m.set(summary, v === SKIP ? { kind: 'skip' } : v.startsWith(COURSE) ? { kind: 'course', courseId: v.slice(COURSE.length) } : { kind: 'none' })
    return m
  }, [choices])

  const plan = useMemo(
    () => (preview && imported ? planIcsImport(imported, preview.expansion, mapping, ti.untitled) : null),
    [preview, imported, mapping, ti.untitled],
  )
  const lessons = preview ? preview.groups.filter((g) => mapping.get(g.summary)?.kind !== 'skip').reduce((n, g) => n + g.lessons, 0) : 0

  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // lo stesso file si può scegliere di nuovo
    if (!file) return
    setPhase('reading')
    setFileName(file.name)
    try {
      const text = await readIcsFile(file)
      const existing = (await db.events.toArray()).filter((ev) => ev.source === 'ics')
      const result = previewIcs(text, {
        yearStart: (profile ?? normalizeProfile({}))?.yearStart ?? '09-01',
        today,
        displayZone: deviceZone(),
        courses,
        existing,
      })
      const initial = defaultMapping(result.groups)
      setChoices(new Map([...initial].map(([s, target]) => [s, target.kind === 'course' ? COURSE + target.courseId : NONE])))
      setPreview(result)
      setPhase('preview')
    } catch (err) {
      setError(renderError(err, i18n))
      setPreview(null)
      setPhase('error')
    }
  }

  const run = async () => {
    if (!plan) return
    setSaving(true)
    try {
      const done = await applyIcsPlan(db, plan)
      toast(ti.done(done))
      onClose()
    } catch (err) {
      setError(renderError(err, i18n))
      setPhase('error')
    } finally {
      setSaving(false)
    }
  }

  const notes = preview
    ? [
        [preview.parse.skipped.unsupportedRule, ti.skipped.unsupportedRule],
        [preview.parse.skipped.rdate, ti.skipped.rdate],
        [preview.expansion.stats.tooMany, ti.skipped.tooMany],
        [preview.parse.skipped.badEvent, ti.skipped.badEvent],
        [preview.parse.skipped.thisAndFuture, ti.skipped.thisAndFuture],
        [preview.expansion.stats.allDay, ti.skipped.allDay],
        [preview.parse.warnings.unknownZone, ti.skipped.unknownZone],
      ].filter(([n]) => (n as number) > 0)
    : []

  const busy = phase === 'reading' || saving
  const chooseLabel = phase === 'idle' ? ti.choose : ti.chooseAnother

  return (
    <div className="ics">
      <input ref={input} type="file" accept=".ics,text/calendar" hidden tabIndex={-1} onChange={(e) => void pick(e)} />
      <div key={phase} className="swap-in ics__stage">
        {phase === 'idle' ? <p className="ics__lead">{ti.intro}</p> : null}
        {phase === 'reading' ? (
          <p className="ics__lead" role="status">
            {ti.reading}
          </p>
        ) : null}
        {phase === 'error' ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        {phase === 'preview' && preview ? (
          <>
            <div className="ics__file">
              <span className="ics__filename">{fileName}</span>
              <button type="button" className="btn" disabled={busy} onClick={() => input.current?.click()}>
                {ti.chooseAnother}
              </button>
            </div>
            <p className="ics__lead">{ti.window(preview.expansion.window, f)}</p>
            <p className="ics__hint">{ti.confirmHint}</p>
            {!courses.length ? <p className="ics__hint">{ti.noCourses}</p> : null}
            <ul role="list" className="ics-groups">
              {preview.groups.map((g) => {
                const value = choices.get(g.summary) ?? NONE
                const isProposal = !!g.proposal && value === COURSE + g.proposal.courseId
                const label = g.summary || ti.untitled
                return (
                  <li key={g.summary} className="ics-group">
                    <strong className="ics-group__name">{label}</strong>
                    <span className="ics-group__meta">{ti.groupMeta({ count: g.lessons, first: g.first, last: g.last }, f)}</span>
                    <select
                      className="field ics-group__select"
                      aria-label={ti.courseLabel({ summary: label })}
                      value={value}
                      disabled={busy}
                      onChange={(e) => setChoices(new Map(choices).set(g.summary, e.target.value))}
                    >
                      {sorted.map((c) => (
                        <option key={c.id} value={COURSE + c.id}>
                          {c.name}
                        </option>
                      ))}
                      <option value={NONE}>{ti.optNone}</option>
                      <option value={SKIP}>{ti.optSkip}</option>
                    </select>
                    {isProposal && g.proposal ? <span className="ics-group__tag">{ti.by[g.proposal.by]}</span> : null}
                  </li>
                )
              })}
            </ul>
            {notes.length ? (
              <ul className="ics__notes">
                {notes.map(([n, fn], i) => (
                  <li key={i}>{(fn as (p: { n: number }, fmt: Format) => string)({ n: n as number }, f)}</li>
                ))}
              </ul>
            ) : null}
            <p className="ics__summary" aria-live="polite">
              {plan
                ? plan.add.length || plan.update.length || plan.remove.length || plan.keptEdited
                  ? ti.summary({ add: plan.add.length, update: plan.update.length, remove: plan.remove.length, keptEdited: plan.keptEdited }, f)
                  : ti.nothingChanges
                : ''}
            </p>
          </>
        ) : null}
      </div>

      <div className="sheet-actions">
        {phase === 'preview' ? (
          <>
            <span className="sheet-actions__spacer" />
            <button type="button" className="btn" onClick={onClose}>
              {t.common.cancel}
            </button>
            <button type="button" className="btn btn--primary" disabled={busy || lessons === 0 || !plan} onClick={() => void run()}>
              {ti.importAction({ count: lessons }, f)}
            </button>
          </>
        ) : (
          <>
            <span className="sheet-actions__spacer" />
            <button type="button" className="btn btn--primary" disabled={busy} onClick={() => input.current?.click()}>
              {chooseLabel}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
