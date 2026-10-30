import { useEffect, useState } from 'react'
import { DateField } from '../../components/DateField'
import { Sheet } from '../../components/Sheet'
import { db } from '../../db/db'
import { addAppello, editAppello, removeAppello } from '../../db/multiverse-actions'
import type { Appello, Course } from '../../db/schema'
import { renderError } from '../../i18n/errors'
import { useI18n } from '../../i18n/store'
import { addDays, type ISODate } from '../../lib/dates'
import { isUsableDate, MAX_NOTE, sittingsOf, type SittingInfo } from '../../multiverse/scenario'

const FOLLOWING_SITTING_DAYS = 14
const FALLBACK_DAYS = 30

interface SheetProps {
  open: boolean
  onClose: () => void
  /** Gli esami ancora da fare, già in ordine. */
  courses: Course[]
  appelli: Appello[]
  today: ISODate
}

export function SittingsSheet({ open, onClose, courses, appelli, today }: SheetProps) {
  const { t } = useI18n()
  const ts = t.multiverso.sittings
  return (
    <Sheet open={open} title={ts.title} onClose={onClose}>
      <div className="sit">
        <p className="sit__lead">{ts.lead}</p>
        {courses.length === 0 ? <p className="sit__empty">{ts.empty}</p> : null}
        {courses.map((c) => (
          <CourseSittings key={c.id} course={c} sittings={sittingsOf(c.id, appelli, today)} today={today} />
        ))}
      </div>
    </Sheet>
  )
}

function CourseSittings({ course, sittings, today }: { course: Course; sittings: SittingInfo[]; today: ISODate }) {
  const { t, f } = useI18n()
  const tm = t.multiverso
  const [error, setError] = useState<string | null>(null)
  const fail = (e: unknown) => setError(renderError(e, { t, f }))
  const cfu = typeof course.cfu === 'number' && course.cfu > 0 ? tm.exam.cfu({ n: course.cfu }) : tm.exam.noCfu

  const current = typeof course.examDate === 'string' && isUsableDate(course.examDate) ? course.examDate : undefined
  const latest = sittings[sittings.length - 1]
  const useCurrent = !latest && !!current
  const suggested = latest ? addDays(latest.resolved, FOLLOWING_SITTING_DAYS) : (current ?? addDays(today, FALLBACK_DAYS))

  return (
    <section className="sit__course" aria-label={course.name}>
      <h3>
        {course.name} <span className="sit__cfu tnum">{cfu}</span>
      </h3>
      {sittings.length === 0 ? <p className="sit__none">{tm.sittings.none}</p> : null}
      <ul className="sit__rows" role="list">
        {sittings.map((s, i) => (
          <SittingRow key={s.id} s={s} n={i + 1} course={course} onError={setError} fail={fail} />
        ))}
      </ul>
      {error ? (
        <p className="sit__error" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        className="btn sit__add"
        onClick={() => {
          setError(null)
          addAppello(db, { courseId: course.id, date: suggested }).catch(fail)
        }}
      >
        {useCurrent ? tm.sittings.useCurrent({ date: suggested }, f) : tm.sittings.add({ name: course.name })}
      </button>
    </section>
  )
}

function SittingRow({ s, n, course, onError, fail }: { s: SittingInfo; n: number; course: Course; onError: (e: string | null) => void; fail: (e: unknown) => void }) {
  const { t, f } = useI18n()
  const tm = t.multiverso
  const [note, setNote] = useState(s.note ?? '')
  useEffect(() => setNote(s.note ?? ''), [s.note])
  return (
    <li className={`sit__row${s.expired ? ' sit__row--past' : ''}`}>
      <DateField
        label={tm.sittings.date({ n })}
        value={s.date}
        allowMonthOnly
        onChange={(v) => {
          onError(null)
          editAppello(db, s.id, { date: v ?? '' }).catch(fail)
        }}
      />
      <div className="sit__side">
        <label className="sit__note">
          <span className="date-field__label">{tm.sittings.note}</span>
          <input
            className="field"
            type="text"
            value={note}
            maxLength={MAX_NOTE}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => note.trim() !== (s.note ?? '') && void editAppello(db, s.id, { note }).catch(fail)}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
        </label>
        {s.expired ? <span className="sit__past">{tm.sittings.past}</span> : null}
        <button type="button" className="sit__remove" aria-label={tm.sittings.remove({ name: course.name, date: s.date }, f)} onClick={() => void removeAppello(db, s.id)}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </li>
  )
}
