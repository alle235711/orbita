import { useEffect, useRef, useState } from 'react'
import { db } from '../../db/db'
import { removeUniverse, renameUniverse, setExpectedGrade, setPick } from '../../db/multiverse-actions'
import type { Course, Universe } from '../../db/schema'
import { useI18n } from '../../i18n/store'
import { starPoints, type UniverseSky as Sky } from '../../multiverse/sky'
import type { SittingInfo, UniverseEvaluation } from '../../multiverse/scenario'
import { renderError } from '../../i18n/errors'
import { LoadStrip } from './LoadStrip'
import { UniverseSky } from './UniverseSky'

const CONFIRM_MS = 3000
const GRADE_DIGITS = 1

export type SittingRow = SittingInfo & { days: number }
export interface PickRow {
  course: Course
  sittings: SittingRow[]
}
export interface Best {
  graduation: boolean
  conflicts: boolean
  load: boolean
}

interface CardProps {
  universe: Universe
  index: number
  total: number
  evaluation: UniverseEvaluation
  sky: Sky
  rows: PickRow[]
  best: Best
  inUse: boolean
  /** Voto atteso predefinito (la media di adesso), se c'è. */
  defaultGrade: number | null
  canRemove: boolean
  onChoose: () => void
  carousel: boolean
}

function Glyph({ kind }: { kind: 'star' | 'arc' | 'curve' }) {
  return (
    <svg className="uni__glyph" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
      {kind === 'star' ? <polygon points={starPoints(7, 7.4, 6.2)} fill="var(--cue)" /> : null}
      {kind === 'arc' ? <path d="M1.5 11 Q7 -1 12.5 11" fill="none" stroke="var(--error)" strokeWidth="1.8" strokeLinecap="round" /> : null}
      {kind === 'curve' ? <path d="M1 11 Q4 2 7 7 T13 4" fill="none" stroke="var(--disk)" strokeWidth="1.8" strokeLinecap="round" /> : null}
    </svg>
  )
}

export function UniverseCard({ universe, index, total, evaluation: ev, sky, rows, best, inUse, defaultGrade, canRemove, onChoose, carousel }: CardProps) {
  const { t, f } = useI18n()
  const tm = t.multiverso
  const label = universe.name || tm.universe.default({ n: index + 1 })
  const [name, setName] = useState(universe.name)
  useEffect(() => setName(universe.name), [universe.name])
  const [armed, setArmed] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const [error, setError] = useState<string | null>(null)

  const names = new Map(rows.map((r) => [r.course.id, r.course.name]))
  const nameOf = (id: string) => names.get(id) ?? id

  const remove = () => {
    if (!armed) {
      setArmed(true)
      timer.current = window.setTimeout(() => setArmed(false), CONFIRM_MS)
      return
    }
    window.clearTimeout(timer.current)
    setArmed(false)
    removeUniverse(db, universe.id).catch((e) => setError(renderError(e, { t, f })))
  }

  const commitName = () => {
    if (name.trim() !== universe.name) void renameUniverse(db, universe.id, name)
  }

  const bestNames = [best.graduation ? tm.best.graduation : '', best.conflicts ? tm.best.conflicts : '', best.load ? tm.best.load : ''].filter(Boolean)

  // Fatti: i valori che cambiano con gli appelli portano una chiave, così entrano con `.swap-in`.
  const graduation = !ev.graduationDate
    ? tm.facts.graduationNone
    : (ev.graduationUncertain && ev.graduationEarliest && ev.graduationLatest
        ? tm.facts.graduationRange({ from: ev.graduationEarliest, to: ev.graduationLatest }, f)
        : f.date(ev.graduationDate, { year: true })) + (ev.complete ? '' : ` ${tm.facts.provisional}`)
  const average = ev.expectedAverage === null ? '—' : f.number(ev.expectedAverage, 2)
  const base = ev.expectedBase ? f.number(ev.expectedBase.total, 1) : '—'
  const peak = ev.peak ? tm.facts.peakValue({ cfu: f.number(ev.peak.cfu, 1), week: f.dateShort(ev.peak.week) }) : '—'
  const conflicts = ev.counts.certain + ev.counts.uncertain === 0 ? tm.facts.noConflicts : tm.facts.conflictsCount(ev.counts, f)

  const drawn = new Set(sky.comets.map((c) => c.courseId))
  const byExam = new Map(ev.exams.map((e) => [e.courseId, e]))

  // Frasi per i lettori di schermo: gli stessi fatti delle immagini, tutti gli esami.
  const sr: string[] = []
  for (const e of ev.exams) {
    const p = { name: e.name, date: e.date, cfu: e.cfu ?? null, grade: e.expectedGrade }
    sr.push(e.monthOnly ? tm.sr.examMonth(p, f) : tm.sr.exam(p, f))
  }
  for (const c of ev.tooClose) sr.push(c.uncertain ? tm.sr.closeUncertain({ a: nameOf(c.a), b: nameOf(c.b) }) : tm.sr.close({ a: nameOf(c.a), b: nameOf(c.b), days: c.gap }, f))
  for (const c of ev.periodConflicts) {
    const p = { name: nameOf(c.courseId), period: c.periodName }
    sr.push(c.uncertain ? tm.sr.periodUncertain(p) : tm.sr.period(p))
  }
  if (ev.peak) sr.push(tm.sr.load({ cfu: ev.peak.cfu, week: ev.peak.week }, f))
  if (ev.graduationDate) {
    sr.push(ev.graduationUncertain && ev.graduationEarliest && ev.graduationLatest ? tm.sr.graduationRange({ from: ev.graduationEarliest, to: ev.graduationLatest }, f) : tm.sr.graduation({ date: ev.graduationDate }, f))
    if (!ev.complete) sr.push(tm.sr.provisional)
  }
  if (ev.expectedAverage !== null) sr.push(tm.sr.average({ value: ev.expectedAverage }, f))
  if (ev.expectedBase) sr.push(tm.sr.base({ value: ev.expectedBase.total }, f))
  if (ev.missingPicks.length) sr.push(tm.sr.missing({ names: ev.missingPicks.map(nameOf).join(', ') }))
  if (bestNames.length) sr.push(tm.sr.best({ criteria: bestNames.join(', ') }))

  return (
    <article className="uni" role={carousel ? 'group' : undefined} aria-label={carousel ? tm.carousel.item({ n: index + 1, total }) : undefined} data-universe={universe.id}>
      <header className="uni__head">
        <input
          className="uni__name"
          value={name}
          maxLength={40}
          placeholder={tm.universe.default({ n: index + 1 })}
          aria-label={tm.universe.nameLabel}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
        <button type="button" className={`uni__remove${armed ? ' uni__remove--armed' : ''}`} disabled={!canRemove} aria-label={canRemove ? (armed ? tm.universe.removeConfirm : tm.universe.remove({ name: label })) : tm.universe.removeMin} onClick={remove}>
          {armed ? (
            <span className="uni__remove-text">{tm.universe.removeConfirm}</span>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </header>

      {inUse || bestNames.length ? (
        <ul className="uni__chips" role="list">
          {inUse ? <li className="uni__chip uni__chip--use">{tm.universe.inUse}</li> : null}
          {best.graduation ? (
            <li className="uni__chip">
              <Glyph kind="star" />
              {tm.best.graduation}
            </li>
          ) : null}
          {best.conflicts ? (
            <li className="uni__chip">
              <Glyph kind="arc" />
              {tm.best.conflicts}
            </li>
          ) : null}
          {best.load ? (
            <li className="uni__chip">
              <Glyph kind="curve" />
              {tm.best.load}
            </li>
          ) : null}
        </ul>
      ) : null}

      <div className="uni__sky">
        <UniverseSky sky={sky} />
        <LoadStrip strip={sky.strip} />
      </div>

      <dl className="uni__facts">
        <div className="uni__fact uni__fact--wide">
          <dt>{tm.facts.graduation}</dt>
          <dd key={graduation} className="uni__big swap-in">
            {graduation}
          </dd>
        </div>
        <div className="uni__fact">
          <dt>{tm.facts.average}</dt>
          <dd key={average} className="uni__big swap-in">
            {average}
          </dd>
        </div>
        <div className="uni__fact">
          <dt>{tm.facts.base}</dt>
          <dd key={base} className="uni__big swap-in">
            {base}
          </dd>
        </div>
        <div className="uni__fact uni__fact--wide">
          <dt>{tm.facts.peak}</dt>
          <dd key={peak} className="uni__small swap-in">
            {peak}
          </dd>
        </div>
        <div className="uni__fact uni__fact--wide">
          <dt>{tm.facts.conflicts}</dt>
          <dd key={conflicts} className="uni__small swap-in">
            {conflicts}
          </dd>
        </div>
      </dl>

      {ev.missingPicks.length ? <p className="uni__incomplete">{tm.universe.incomplete({ n: ev.missingPicks.length })}</p> : null}

      <ul className="uni__picks" role="list">
        {rows.map(({ course, sittings }) => {
          const exam = byExam.get(course.id)
          const picked = exam?.appelloId ?? ''
          const grade = universe.grades[course.id]
          return (
            <PickItem
              key={course.id}
              course={course}
              sittings={sittings}
              picked={picked}
              grade={grade}
              placeholder={defaultGrade === null ? '' : f.number(Math.round(defaultGrade * 10) / 10, GRADE_DIGITS)}
              notDrawn={sky.hidden > 0 && !!exam && !drawn.has(course.id)}
              onPick={(id) => void setPick(db, universe.id, course.id, id || null).catch((e) => setError(renderError(e, { t, f })))}
              onGrade={(g) => void setExpectedGrade(db, universe.id, course.id, g)}
            />
          )
        })}
      </ul>
      {error ? (
        <p className="uni__error" role="alert">
          {error}
        </p>
      ) : null}

      <button type="button" className="btn btn--primary uni__choose" disabled={ev.exams.length === 0} onClick={onChoose} aria-haspopup="dialog">
        {tm.universe.choose}
      </button>

      <div className="sr-only">
        <h3>{label}</h3>
        <ul>
          {sr.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </div>
    </article>
  )
}

function PickItem({ course, sittings, picked, grade, placeholder, notDrawn, onPick, onGrade }: { course: Course; sittings: SittingRow[]; picked: string; grade: number | undefined; placeholder: string; notDrawn: boolean; onPick: (id: string) => void; onGrade: (g: number | null) => void }) {
  const { t, f } = useI18n()
  const tm = t.multiverso
  const shown = grade === undefined ? '' : f.number(grade, GRADE_DIGITS)
  const [text, setText] = useState(shown)
  useEffect(() => setText(shown), [shown])
  const commit = () => {
    const raw = text.trim().replace(',', '.')
    if (raw === '') return onGrade(null)
    const n = Number(raw)
    if (!Number.isFinite(n)) return setText(shown)
    onGrade(n)
  }
  const cfu = typeof course.cfu === 'number' && course.cfu > 0 ? tm.exam.cfu({ n: course.cfu }) : tm.exam.noCfu
  return (
    <li className="pick">
      <div className="pick__name">
        <strong>{course.name}</strong>
        <span className="pick__cfu tnum">{cfu}</span>
        {notDrawn ? <span className="pick__note">{tm.exam.notDrawn}</span> : null}
      </div>
      <div className="pick__controls">
        <select className="field pick__select" aria-label={tm.exam.pick({ name: course.name })} value={picked} onChange={(e) => onPick(e.target.value)}>
          <option value="">{tm.exam.none}</option>
          {sittings.map((s) => {
            const text = s.monthOnly ? tm.exam.monthOption({ date: s.date }, f) : tm.exam.option({ date: s.date, days: s.days }, f)
            return (
              <option key={s.id} value={s.id} disabled={s.expired}>
                {s.expired ? `${text} · ${tm.exam.past}` : text}
              </option>
            )
          })}
        </select>
        <input
          className="field pick__grade tnum"
          type="text"
          inputMode="decimal"
          value={text}
          placeholder={placeholder}
          aria-label={tm.exam.expectedAria({ name: course.name })}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), commit())}
        />
      </div>
    </li>
  )
}
