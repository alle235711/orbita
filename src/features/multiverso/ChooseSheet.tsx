import { useState } from 'react'
import { toast } from '../../app/toast'
import { Sheet } from '../../components/Sheet'
import { db } from '../../db/db'
import { chooseUniverse } from '../../db/multiverse-actions'
import { renderError } from '../../i18n/errors'
import { useI18n } from '../../i18n/store'
import type { ISODate } from '../../lib/dates'
import type { ExamDateChange, UniverseEvaluation } from '../../multiverse/scenario'

interface ChooseProps {
  open: boolean
  onClose: () => void
  universeId: string
  name: string
  evaluation: UniverseEvaluation
  changes: ExamDateChange[]
  /** Nomi degli esami senza appello scelto, per la frase "restano come sono". */
  missing: string[]
  today: ISODate
}

export function ChooseSheet({ open, onClose, universeId, name, evaluation, changes, missing, today }: ChooseProps) {
  const { t, f } = useI18n()
  const tm = t.multiverso
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const unchanged = evaluation.exams.length - changes.length
  const when = (d: string | undefined) => (d === undefined ? tm.choose.noFrom : f.date(d, { year: true }))

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      const done = await chooseUniverse(db, universeId, today)
      onClose()
      toast(tm.toast.chosen({ n: done.length }))
    } catch (e) {
      setError(renderError(e, { t, f }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} title={tm.choose.title({ name })} onClose={onClose}>
      <div className="choose">
        <p className="choose__lead">{tm.choose.lead}</p>
        {changes.length === 0 ? (
          <p className="choose__nothing">{tm.choose.nothing}</p>
        ) : (
          <ul className="choose__list" role="list">
            {changes.map((c) => (
              <li key={c.courseId}>{tm.choose.change({ name: c.name, from: when(c.from), to: when(c.to) })}</li>
            ))}
          </ul>
        )}
        {unchanged > 0 && changes.length > 0 ? <p className="choose__note">{tm.choose.unchanged({ n: unchanged })}</p> : null}
        {evaluation.counts.certain > 0 ? <p className="choose__warn">{tm.choose.warn({ n: evaluation.counts.certain })}</p> : null}
        {missing.length ? <p className="choose__note">{tm.choose.missing({ names: missing.join(', ') })}</p> : null}
        {error ? (
          <p className="choose__warn" role="alert">
            {error}
          </p>
        ) : null}
        <div className="choose__buttons">
          <button type="button" className="btn btn--primary" disabled={changes.length === 0 || busy} onClick={() => void confirm()}>
            {tm.choose.confirm}
          </button>
          <button type="button" className="btn" onClick={onClose}>
            {t.common.cancel}
          </button>
        </div>
      </div>
    </Sheet>
  )
}
