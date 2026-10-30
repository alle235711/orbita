import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { toast } from '../../app/toast'
import { useToday } from '../../app/useToday'
import { Sheet } from '../../components/Sheet'
import { db } from '../../db/db'
import { useActiveCourses, useCourses } from '../../db/hooks'
import { recordResult, removeResult } from '../../db/result-actions'
import type { ExamResult, ResultOutcome } from '../../db/schema'
import { renderError } from '../../i18n/errors'
import { useI18n } from '../../i18n/store'
import { validateResultDraft, type ResultDraft, type ResultErrorCode, type ResultField } from '../../libretto/grades'
import { examsAhead } from '../../rules/rules'

const OUTCOMES: ResultOutcome[] = ['superato', 'rifiutato', 'non-superato']
const CONFIRM_MS = 3000

interface ResultSheetProps {
  open: boolean
  onClose: () => void
  editing?: ExamResult
}

export function ResultSheet({ open, onClose, editing }: ResultSheetProps) {
  const { t } = useI18n()
  return (
    <Sheet open={open} title={editing ? t.libretto.sheet.titleEdit : t.libretto.sheet.titleNew} onClose={onClose}>
      <ResultForm key={editing?.id ?? 'new'} editing={editing} onClose={onClose} />
    </Sheet>
  )
}

function ResultForm({ editing, onClose }: { editing?: ExamResult; onClose: () => void }) {
  const i18n = useI18n()
  const { t } = i18n
  const ts = t.libretto.sheet
  const today = useToday()
  const active = useActiveCourses()
  const all = useCourses()
  const [courseId, setCourseId] = useState(editing?.courseId ?? '')
  const [date, setDate] = useState(editing?.date ?? today)
  const [outcome, setOutcome] = useState<ResultOutcome>(editing?.outcome ?? 'superato')
  const [gradeText, setGradeText] = useState(editing?.grade !== undefined ? String(editing.grade) : '')
  const [noGrade, setNoGrade] = useState(!!editing && editing.outcome === 'superato' && editing.grade === undefined)
  const [lode, setLode] = useState(editing?.lode === true)
  const [errors, setErrors] = useState<Partial<Record<ResultField, ResultErrorCode>> | null>(null)
  const [fatal, setFatal] = useState('')
  const [armed, setArmed] = useState(false)
  const refs = { course: useRef<HTMLSelectElement>(null), date: useRef<HTMLInputElement>(null), grade: useRef<HTMLInputElement>(null) }

  useEffect(() => {
    if (!armed) return
    const id = window.setTimeout(() => setArmed(false), CONFIRM_MS)
    return () => window.clearTimeout(id)
  }, [armed])

  // Gli esami più vicini per primi, poi gli altri per nome.
  const options = useMemo(() => {
    const soon = examsAhead(active, today).map((e) => e.course)
    const ids = new Set(soon.map((c) => c.id))
    const rest = active.filter((c) => !ids.has(c.id)).sort((a, b) => a.name.localeCompare(b.name, 'it'))
    return [...soon, ...rest]
  }, [active, today])

  const editedCourse = editing ? all.find((c) => c.id === editing.courseId) : undefined
  const noCourses = !editing && options.length === 0
  const gradeNumber = gradeText.trim() === '' ? NaN : Number(gradeText.replace(',', '.'))
  const lodeAllowed = outcome === 'superato' && !noGrade && gradeNumber === 30

  const draft = (): ResultDraft => ({
    courseId,
    date,
    outcome,
    grade: outcome === 'superato' ? (noGrade ? null : gradeNumber) : undefined,
    lode: lodeAllowed && lode,
  })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const d = draft()
    // Una convalida in anticipo serve a portare il cursore sul primo campo sbagliato.
    const found = validateResultDraft(d, new Set((editing ? all : active).map((c) => c.id)))
    setErrors(found)
    setFatal('')
    if (found) {
      const first = (['course', 'date', 'grade'] as const).find((k) => found[k])
      if (first) refs[first].current?.focus()
      return
    }
    try {
      await recordResult(db, d, editing ? { id: editing.id } : undefined)
      toast(t.libretto.toast.saved)
      onClose()
    } catch (err) {
      setFatal(renderError(err, i18n))
    }
  }

  const del = async () => {
    if (!editing) return
    if (!armed) return setArmed(true)
    await removeResult(db, editing.id)
    toast(t.libretto.toast.deleted)
    onClose()
  }

  const fieldError = (field: ResultField) => (errors?.[field] ? t.errors.resultInvalid({ field, code: errors[field]! }) : '')

  if (noCourses) {
    return (
      <div className="form">
        <p>{ts.noCourses}</p>
        <div className="sheet-actions">
          <span className="sheet-actions__spacer" />
          <button type="button" className="btn" onClick={onClose}>
            {ts.cancel}
          </button>
        </div>
      </div>
    )
  }

  return (
    <form className="form" onSubmit={(e) => void submit(e)} noValidate>
      <div className="form-field">
        {editing ? (
          <>
            <span>{ts.course}</span>
            <strong className="lib-sheet__course">{editedCourse?.name}</strong>
          </>
        ) : (
          <label className="form-field">
            <span>{ts.course}</span>
            <select
              ref={refs.course}
              aria-label={ts.course}
              className="field"
              value={courseId}
              aria-invalid={errors?.course ? true : undefined}
              onChange={(e) => setCourseId(e.target.value)}
            >
              <option value="">{ts.coursePlaceholder}</option>
              {options.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <p className="form-error" role="alert">
          {fieldError('course')}
        </p>
      </div>

      <div className="form-field">
        <label className="form-field">
          <span>{ts.date}</span>
          <input
            ref={refs.date}
            className="field"
            type="date"
            value={date}
            aria-invalid={errors?.date ? true : undefined}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <p className="form-error" role="alert">
          {fieldError('date')}
        </p>
      </div>

      <div className="form-field" role="radiogroup" aria-label={ts.outcome}>
        <span aria-hidden="true">{ts.outcome}</span>
        <div className="segmented lib-sheet__outcome">
          {OUTCOMES.map((o) => (
            <button key={o} type="button" role="radio" aria-checked={outcome === o} className="segmented__item" onClick={() => setOutcome(o)}>
              {t.libretto.outcome[o]}
            </button>
          ))}
        </div>
      </div>

      {outcome === 'superato' ? (
        <div className="form-field">
          <label className="form-field">
            <span>{ts.grade}</span>
            <input
              ref={refs.grade}
              className="field tnum"
              type="number"
              inputMode="numeric"
              min={18}
              max={30}
              step={1}
              value={noGrade ? '' : gradeText}
              disabled={noGrade}
              aria-invalid={errors?.grade ? true : undefined}
              onChange={(e) => {
                setGradeText(e.target.value)
                if (e.target.value.trim() !== '30') setLode(false)
              }}
            />
          </label>
          <label className="lib-sheet__check">
            <input
              type="checkbox"
              checked={noGrade}
              onChange={(e) => {
                setNoGrade(e.target.checked)
                if (e.target.checked) {
                  setGradeText('')
                  setLode(false)
                }
              }}
            />
            {ts.noGrade}
          </label>
          <label className="lib-sheet__check">
            <input type="checkbox" checked={lodeAllowed && lode} disabled={!lodeAllowed} onChange={(e) => setLode(e.target.checked)} />
            {ts.lode}
          </label>
          <p className="form-error" role="alert">
            {fieldError('grade')}
          </p>
        </div>
      ) : null}

      <p className="form-error" role="alert">
        {fatal}
      </p>
      <div className="sheet-actions">
        {editing ? (
          <button type="button" className="btn btn--danger" onClick={() => void del()}>
            {armed ? ts.deleteConfirm : ts.delete}
          </button>
        ) : null}
        <span className="sheet-actions__spacer" />
        <button type="button" className="btn" onClick={onClose}>
          {ts.cancel}
        </button>
        <button type="submit" className="btn btn--primary" disabled={!editing && !courseId}>
          {ts.save}
        </button>
      </div>
    </form>
  )
}
