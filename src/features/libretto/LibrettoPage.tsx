import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Page } from '../../app/Page'
import { href } from '../../app/router'
import { BlackHole } from '../../art/BlackHole'
import { starPoints } from '../../multiverse/sky'
import { Grain, Sky } from '../../art/Sky'
import { db } from '../../db/db'
import { useCourses, useGraduation, useProfile, useResults, useTargetAverage } from '../../db/hooks'
import type { ExamResult } from '../../db/schema'
import { setSetting } from '../../db/settings'
import { useI18n } from '../../i18n/store'
import { buildGradebook, gradeProfile, normalizeTargetAverage, simulatorMode, type AttemptRow, type Gradebook, type PassedRow } from '../../libretto/grades'
import { CfuBar } from './CfuBar'
import { FormulaSheet } from './FormulaSheet'
import { ResultSheet } from './ResultSheet'
import './LibrettoPage.css'

const TARGET_STEP = 0.5

export default function LibrettoPage() {
  const { t } = useI18n()
  const tl = t.libretto
  const courses = useCourses()
  const results = useResults()
  const profile = useProfile()
  const graduation = useGraduation()
  const target = useTargetAverage()
  const loaded = useLiveQuery(async () => {
    await Promise.all([db.courses.count(), db.results.count()])
    return true
  }, [])
  const ready = !!loaded && profile !== undefined && graduation !== undefined && target !== undefined
  const [sheet, setSheet] = useState<{ editing?: ExamResult } | null>(null)
  const [formulaOpen, setFormulaOpen] = useState(false)

  const book = useMemo<Gradebook | null>(
    () =>
      ready
        ? buildGradebook({ courses, results, profile: gradeProfile(profile), formula: graduation.formula, target })
        : null,
    [ready, courses, results, profile, graduation, target],
  )

  const addButton = (
    <button type="button" className="btn btn--primary lib__add" onClick={() => setSheet({})} aria-haspopup="dialog">
      {tl.add}
    </button>
  )

  return (
    <Page className="libretto" labelledBy="titolo-libretto">
      <Hero book={book} onFormula={() => setFormulaOpen(true)} />

      <div className="lib__body">
        <div className="lib__main">
          <div className="lib__aside">
            <Simulator book={book} target={target} />
            <MultiverseLink />
          </div>
          <div className="lib__add-mobile">{addButton}</div>
          <PassedList rows={book?.passed ?? []} onEdit={(r) => setSheet({ editing: r })} header={<div className="lib__add-wide">{addButton}</div>} />
          <AttemptList rows={book?.attempts ?? []} onEdit={(r) => setSheet({ editing: r })} />
        </div>
      </div>

      <ResultSheet open={!!sheet} editing={sheet?.editing} onClose={() => setSheet(null)} />
      <FormulaSheet open={formulaOpen} book={book} onClose={() => setFormulaOpen(false)} />
    </Page>
  )
}

/** Porta al Multiverso degli appelli: il confronto dei futuri possibili. */
function MultiverseLink() {
  const { t } = useI18n()
  const tm = t.libretto.multiverse
  return (
    <a className="lib__multi" href={href('multiverso')}>
      <svg className="lib__multi-art" width="64" height="44" viewBox="0 0 64 44" aria-hidden="true" focusable="false">
        <path d="M6 36 Q20 6 40 18" fill="none" stroke="var(--error)" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="3 3" />
        <path d="M4 30 L22 24 L22 28 Z" fill="var(--disk)" fillOpacity="0.7" />
        <circle cx="24" cy="26" r="3.4" fill="#fff" />
        <circle cx="40" cy="18" r="3" fill="#fff" />
        <polygon points={starPoints(54, 12, 6)} fill="var(--cue)" />
      </svg>
      <span className="lib__multi-text">
        <strong>{tm.title}</strong>
        <span>{tm.hint}</span>
      </span>
      <svg className="lib__multi-go" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
        <path d="M5 2.5L9.5 7 5 11.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </a>
  )
}

function Hero({ book, onFormula }: { book: Gradebook | null; onFormula: () => void }) {
  const { t, f } = useI18n()
  const tl = t.libretto
  const weighted = book?.weighted ?? null
  const text = weighted === null ? null : f.number(weighted, 2)
  return (
    <section className="lib__hero" aria-labelledby="titolo-libretto">
      <Sky nebula="briefing" />
      <BlackHole level={2} className="lib__bh" />
      <div className="lib__hero-in">
        <h1 id="titolo-libretto" className="lib__eyebrow">
          {tl.title}
        </h1>
        <p key={text ?? 'none'} className={`lib__mean${book ? ' swap-in' : ''}`} aria-label={text ? `${tl.hero.weighted}: ${text}` : undefined}>
          {text ?? '—'}
        </p>
        <p className="lib__caption">
          {book && weighted !== null ? (
            <>
              <strong>{tl.hero.weighted}</strong> {tl.hero.graded({ n: book.gradedCount }, f)}
            </>
          ) : book ? (
            <>
              {book.gradedWithoutCfu > 0 ? (
                tl.hero.noCfu({ n: book.gradedWithoutCfu }, f)
              ) : (
                <>
                  <strong>{tl.hero.empty}</strong> {tl.hero.emptyHint}
                </>
              )}
            </>
          ) : (
            ' '
          )}
        </p>
        {book && weighted !== null && book.gradedWithoutCfu > 0 ? <p className="lib__note">{tl.hero.noCfu({ n: book.gradedWithoutCfu }, f)}</p> : null}

        {book ? (
          <>
            <dl className="lib__stats">
              <div className="lib__stat">
                <dt>{tl.hero.arithmetic}</dt>
                <dd>{book.arithmetic === null ? '—' : f.number(book.arithmetic, 2)}</dd>
              </div>
              <div className="lib__stat">
                <dt>{tl.cfu.label}</dt>
                <dd>{book.cfu.earned}</dd>
                <dd className="lib__sub">{tl.cfu.progress({ earned: book.cfu.earned, total: book.cfu.total })}</dd>
              </div>
              <div className="lib__stat">
                <dt>{tl.graduation.label}</dt>
                {book.base ? (
                  <>
                    <dd key={book.base.total} className="swap-in">
                      {f.number(book.base.total, 1)}
                    </dd>
                    {book.base.bonus !== 0 ? <dd className="lib__sub tnum">{tl.graduation.bonus({ points: book.base.bonus }, f)}</dd> : null}
                  </>
                ) : (
                  <dd className="lib__sub">{tl.graduation.none}</dd>
                )}
                <dd className="lib__sub">
                  <button type="button" className="link-button" onClick={onFormula} aria-haspopup="dialog">
                    {tl.graduation.edit}
                  </button>
                </dd>
              </div>
            </dl>
            <CfuBar cfu={book.cfu} />
          </>
        ) : null}
      </div>
      <Grain />
    </section>
  )
}

/** Mette in evidenza il numero chiave di una frase già scritta nel dizionario. */
function highlight(text: string, key: string, from = 0): ReactNode {
  const i = text.indexOf(key, from)
  if (i < 0) return text
  return (
    <>
      {text.slice(0, i)}
      <strong className="lib__key">{key}</strong>
      {text.slice(i + key.length)}
    </>
  )
}

function Simulator({ book, target }: { book: Gradebook | null; target: number | undefined }) {
  const { t, f } = useI18n()
  const tl = t.libretto
  const [draft, setDraft] = useState<string | null>(null)
  useEffect(() => setDraft(null), [target])

  const save = (value: number) => {
    setDraft(null)
    void setSetting(db, 'targetAverage', normalizeTargetAverage(value))
  }
  const commitDraft = () => {
    if (draft === null) return
    const n = Number(draft.trim().replace(',', '.'))
    if (draft.trim() === '' || !Number.isFinite(n)) return setDraft(null)
    save(n)
  }
  const shown = draft ?? (target === undefined ? '' : String(target).replace('.', ','))

  let sentence: ReactNode = ' '
  let kind = 'wait'
  if (book && target !== undefined) {
    const { required, remaining } = book
    const tg = f.number(target, 1)
    kind = required.kind
    const mode = simulatorMode(book)
    if (mode === 'noExams') {
      sentence = tl.sim.noExams
    } else if (mode === 'noData') {
      kind = 'noData'
      sentence = tl.sim.noData
    } else if (mode === 'done') {
      const mean = book.cfu.earned > 0 && book.weighted !== null ? book.weighted : 0
      const p = { target, mean }
      sentence = required.kind === 'reached' ? highlight(tl.sim.doneReached(p, f), f.number(mean, 2)) : highlight(tl.sim.doneMissed(p, f), f.number(mean, 2))
    } else if (required.kind === 'possible') {
      const text = tl.sim.possible({ target, needed: required.neededRounded, exams: remaining.exams, cfu: remaining.cfu }, f)
      const first = text.indexOf(tg)
      sentence = highlight(text, f.number(required.neededRounded, 1), first >= 0 ? first + tg.length : 0)
      kind += required.neededRounded
    } else if (required.kind === 'reached') {
      sentence = highlight(tl.sim.reached({ target }, f), tg)
    } else {
      const text = tl.sim.impossible({ target, best: required.best, exams: remaining.exams, cfu: remaining.cfu }, f)
      sentence = required.best === null ? text : highlight(text, f.number(required.best, 2), text.indexOf(tg) + tg.length)
    }
  }

  return (
    <section className="lib__sim" aria-labelledby="lib-sim">
      <h2 id="lib-sim">{tl.sim.title}</h2>
      <div className="lib__target">
        <label htmlFor="lib-target">{tl.sim.target}</label>
        <div className="lib__stepper">
          <button type="button" className="lib__step" aria-label={tl.sim.targetDown} onClick={() => target !== undefined && save(target - TARGET_STEP)} disabled={target === undefined || target <= 18}>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
          <input
            id="lib-target"
            className="field tnum lib__target-input"
            type="text"
            inputMode="decimal"
            value={shown}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitDraft}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), commitDraft())}
          />
          <button type="button" className="lib__step" aria-label={tl.sim.targetUp} onClick={() => target !== undefined && save(target + TARGET_STEP)} disabled={target === undefined || target >= 30}>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
      <div aria-live="polite" className="lib__live">
        <p key={kind} className={`lib__sentence${book ? ' swap-in' : ''}`}>
          {sentence}
        </p>
      </div>
    </section>
  )
}

function Row({ row, onEdit, right }: { row: PassedRow | AttemptRow; onEdit: (r: ExamResult) => void; right: ReactNode }) {
  const { t, f } = useI18n()
  const tl = t.libretto
  const { course, result } = row
  return (
    <li>
      <button type="button" className="lib__row swap-in" aria-label={tl.list.edit({ name: course.name })} onClick={() => onEdit(result)} aria-haspopup="dialog">
        <span className="lib__row-main">
          <span className="lib__row-name">{course.name}</span>
          <span className="lib__row-meta">
            {f.date(result.date, { year: true })}
            {course.cfu ? ` · ${tl.list.cfu({ n: course.cfu })}` : ''}
          </span>
        </span>
        {right}
      </button>
    </li>
  )
}

function PassedList({ rows, onEdit, header }: { rows: PassedRow[]; onEdit: (r: ExamResult) => void; header: ReactNode }) {
  const { t } = useI18n()
  const tl = t.libretto
  return (
    <section className="lib__list" aria-labelledby="lib-passed">
      <div className="lib__list-head">
        <h2 id="lib-passed">{tl.list.passed}</h2>
        {header}
      </div>
      {rows.length ? (
        <ul role="list">
          {rows.map((r) => {
            const { grade, lode } = r.result
            const label = grade === undefined ? tl.list.idoneita : tl.list.gradeAria({ grade, lode: lode === true && grade === 30 })
            return (
              <Row
                key={r.result.id}
                row={r}
                onEdit={onEdit}
                right={
                  grade === undefined ? (
                    <span className="lib__word">{tl.list.idoneita}</span>
                  ) : (
                    <span className={`lib__grade tnum${grade === 30 ? ' lib__grade--top' : ''}`} aria-label={label} role="img">
                      <span aria-hidden="true">{grade}</span>
                      {lode === true && grade === 30 ? (
                        <span className="lib__lode" aria-hidden="true">
                          {tl.list.lode}
                        </span>
                      ) : null}
                    </span>
                  )
                }
              />
            )
          })}
        </ul>
      ) : (
        <p className="lib__empty">{tl.list.emptyPassed}</p>
      )}
    </section>
  )
}

function AttemptList({ rows, onEdit }: { rows: AttemptRow[]; onEdit: (r: ExamResult) => void }) {
  const { t } = useI18n()
  const tl = t.libretto
  return (
    <section className="lib__list" aria-labelledby="lib-attempts">
      <div className="lib__list-head">
        <h2 id="lib-attempts">{tl.list.attempts}</h2>
      </div>
      {rows.length ? (
        <ul role="list">
          {rows.map((r) => (
            <Row key={r.result.id} row={r} onEdit={onEdit} right={<span className="lib__word lib__word--dim">{tl.outcome[r.result.outcome]}</span>} />
          ))}
        </ul>
      ) : (
        <p className="lib__empty">{tl.list.emptyAttempts}</p>
      )}
    </section>
  )
}
