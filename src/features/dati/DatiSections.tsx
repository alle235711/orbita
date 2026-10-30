import { useEffect, useState } from 'react'
import { DateField } from '../../components/DateField'
import { ModuleSwitches } from '../../components/ModuleSwitches'
import { NumberField } from '../../components/NumberField'
import { db } from '../../db/db'
import { useCourses, useDeadlines, useModules, useProfile, useResults } from '../../db/hooks'
import { courseStatus } from '../../libretto/grades'
import { normalizeProfile } from '../../db/profile'
import { patch, remove, save } from '../../db/repo'
import { importSampleDeck, listSampleDecks, loadSampleFile, type SampleDeck } from '../../db/sample-decks'
import { WORKOUT_ORDER, type Course, type Deadline } from '../../db/schema'
import { setSetting } from '../../db/settings'
import { renderError } from '../../i18n/errors'
import { getI18n, useI18n } from '../../i18n/store'
import { resolveDate } from '../../lib/dates'
import { DEFAULT_MODULES, normalizeModules, type ModulesSettings } from '../../modules/types'
import type { ContentFile } from '../../db/cards-io'

const DIFFICULTY: Course['difficulty'][] = [1, 2, 3]
const WEEK = [1, 2, 3, 4, 5, 6, 7]
const CONFIRM_MS = 4000

/** Profilo: si salva a ogni modifica; la prima crea la riga (senza `completedAt`). */
export function ProfileSection() {
  const { t, f } = useI18n()
  const tp = t.profilo.profile
  const profile = useProfile()
  const current = profile ?? normalizeProfile({})!
  const [month, day] = current.yearStart.split('-').map(Number) as [number, number]
  const save = (change: Record<string, unknown>) => void setSetting(db, 'profile', normalizeProfile({ ...current, ...change }))
  const text = (key: 'name' | 'university' | 'degree', label: string) => (
    <label className="dati__field dati__field--wide">
      <span className="date-field__label">{label}</span>
      <input className="field" key={`${key}-${current[key] ?? ''}`} defaultValue={current[key] ?? ''} onBlur={(e) => e.target.value.trim() !== (current[key] ?? '') && save({ [key]: e.target.value })} />
    </label>
  )
  return (
    <section className="dati__section" aria-labelledby="h-profilo">
      <h2 id="h-profilo">{tp.title}</h2>
      {profile === undefined ? null : (
        <>
          {text('name', tp.name)}
          {text('university', tp.university)}
          {text('degree', tp.degree)}
          <div className="dati__pair">
            <NumberField label={tp.totalCfu} value={current.totalCfu} min={1} max={600} onCommit={(v) => v !== undefined && save({ totalCfu: v })} />
            <NumberField label={tp.lode} value={current.lodeValue} min={30} max={40} onCommit={(v) => v !== undefined && save({ lodeValue: v })} />
          </div>
          <div className="dati__pair">
            <label className="dati__field">
              <span className="date-field__label">{`${tp.yearStart}: ${tp.yearMonth}`}</span>
              <select className="field" value={month} onChange={(e) => save({ yearStart: `${e.target.value.padStart(2, '0')}-${String(Math.min(day, 28)).padStart(2, '0')}` })}>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {f.monthName(i + 1)}
                  </option>
                ))}
              </select>
            </label>
            <NumberField label={tp.yearDay} value={day} min={1} max={31} onCommit={(v) => v !== undefined && save({ yearStart: `${String(month).padStart(2, '0')}-${String(v).padStart(2, '0')}` })} />
          </div>
          <DateField label={tp.graduation} value={current.graduationTarget} allowMonthOnly onChange={(v) => save({ graduationTarget: v })} />
        </>
      )}
    </section>
  )
}

/** Moduli: gli stessi interruttori del percorso guidato, applicati subito. */
export function ModulesSection() {
  const { t } = useI18n()
  const modules = useModules()
  return (
    <section className="dati__section" aria-labelledby="h-moduli">
      <h2 id="h-moduli">{t.profilo.modules.title}</h2>
      <p className="dati__hint">{t.profilo.modules.lead}</p>
      {modules ? <ModuleSwitches modules={modules} onChange={(next: ModulesSettings) => void setSetting(db, 'modules', normalizeModules(next))} /> : null}
    </section>
  )
}

/** Un'azione distruttiva si conferma toccando ancora entro pochi secondi. */
function useConfirm(action: () => void) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const id = window.setTimeout(() => setArmed(false), CONFIRM_MS)
    return () => window.clearTimeout(id)
  }, [armed])
  return {
    armed,
    press: () => {
      if (!armed) return setArmed(true)
      setArmed(false)
      action()
    },
  }
}

export function ExamsSection({ cardCounts }: { cardCounts: Map<string, number> | undefined }) {
  const { t } = useI18n()
  const td = t.dati
  const courses = useCourses()
  const results = useResults()
  const passed = new Set(courses.filter((c) => courseStatus(c.id, results).kind === 'superato').map((c) => c.id))
  const [adding, setAdding] = useState(false)
  const byExam = (a: Course, b: Course) =>
    (a.examDate ? resolveDate(a.examDate) : '9999').localeCompare(b.examDate ? resolveDate(b.examDate) : '9999') || a.name.localeCompare(b.name, 'it')
  const first = courses.filter((c) => c.semester !== 2).sort(byExam)
  const later = courses.filter((c) => c.semester === 2).sort(byExam)
  return (
    <section className="dati__section dati__section--courses" aria-labelledby="h-corsi">
      <h2 id="h-corsi">{td.courses}</h2>
      <p className="dati__hint">{td.coursesHint}</p>
      <ul className="courses" role="list">
        {first.map((c) => (
          <CourseRow key={c.id} course={c} cards={cardCounts?.get(c.id) ?? 0} passed={passed.has(c.id)} />
        ))}
      </ul>
      {later.length ? (
        <>
          <h3 className="dati__sub">{td.secondSemester}</h3>
          <ul className="courses" role="list">
            {later.map((c) => (
              <CourseRow key={c.id} course={c} cards={cardCounts?.get(c.id) ?? 0} passed={passed.has(c.id)} />
            ))}
          </ul>
        </>
      ) : null}
      {!courses.length && !adding ? <p className="dati__hint">{t.profilo.exams.empty}</p> : null}
      {adding ? (
        <NewExam onDone={() => setAdding(false)} />
      ) : (
        <div className="dati__actions">
          <button type="button" className="btn" onClick={() => setAdding(true)}>
            {t.profilo.exams.add}
          </button>
        </div>
      )}
    </section>
  )
}

function NewExam({ onDone }: { onDone: () => void }) {
  const { t } = useI18n()
  const te = t.profilo.exams
  const [name, setName] = useState('')
  const [cfu, setCfu] = useState<number | undefined>()
  const submit = async () => {
    const clean = name.trim()
    if (!clean) return
    await save<Course>(db.courses, { name: clean, sections: [], difficulty: 2, ...(cfu ? { cfu } : {}) })
    onDone()
  }
  return (
    <form
      className="course course--new"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <label className="dati__field dati__field--wide">
        <span className="date-field__label">{te.name}</span>
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
      </label>
      <NumberField label={te.cfu} value={cfu} min={1} max={60} optional onCommit={setCfu} />
      <div className="dati__actions">
        <button type="submit" className="btn btn--primary">
          {te.add}
        </button>
        <button type="button" className="btn" onClick={onDone}>
          {t.common.cancel}
        </button>
      </div>
    </form>
  )
}

function CourseRow({ course, cards, passed }: { course: Course; cards: number; passed: boolean }) {
  const { t, f } = useI18n()
  const td = t.dati
  const te = t.profilo.exams
  const meta = [course.code, course.degree, cards ? td.cardsMeta({ n: cards }, f) : null].filter(Boolean).join(', ')
  const del = useConfirm(() => void remove(db.courses, course.id))
  return (
    <li className="course">
      <div className="course__name">
        <input
          className="field course__input"
          aria-label={te.name}
          key={course.name}
          defaultValue={course.name}
          onBlur={(e) => {
            const v = e.target.value.trim()
            if (!v) e.target.value = course.name
            else if (v !== course.name) void patch(db.courses, course.id, { name: v })
          }}
        />
        {meta ? <span className="course__meta">{meta}</span> : null}
        {passed ? <span className="course__chip">{t.libretto.passedChip}</span> : null}
      </div>
      <DateField
        label={course.examDate ? td.exam({ date: course.examDate }, f) : td.examTbd}
        value={course.examDate}
        allowMonthOnly
        onChange={(v) => void patch(db.courses, course.id, { examDate: v })}
      />
      <NumberField label={te.cfu} value={course.cfu} min={1} max={60} optional onCommit={(v) => void patch(db.courses, course.id, { cfu: v })} />
      <div className="course__difficulty" role="radiogroup" aria-label={td.difficultyGroup({ name: course.name })}>
        <span className="date-field__label" aria-hidden="true">
          {td.difficulty}
        </span>
        <div className="segmented">
          {DIFFICULTY.map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={course.difficulty === d}
              className="segmented__item"
              onClick={() => void patch(db.courses, course.id, { difficulty: d })}
            >
              {td.levels[d]}
            </button>
          ))}
        </div>
      </div>
      <div className="dati__actions">
        <button type="button" className={`btn${del.armed ? ' btn--danger' : ''}`} onClick={del.press}>
          {del.armed ? te.removeConfirm : te.remove}
        </button>
      </div>
    </li>
  )
}

/** Periodi speciali: nome, date, ore al giorno, obiettivi di sport e giorno limite. */
export function PeriodsSection() {
  const { t } = useI18n()
  const tp = t.profilo.periods
  const periods = useDeadlines()
    .filter((d) => d.kind === 'periodo')
    .sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999') || a.title.localeCompare(b.title, 'it'))
  const add = () => {
    void save<Deadline>(db.deadlines, { title: tp.untitled, kind: 'periodo' })
  }
  return (
    <section className="dati__section" aria-labelledby="h-periodi">
      <h2 id="h-periodi">{tp.title}</h2>
      <p className="dati__hint">{tp.hint}</p>
      {periods.length ? (
        <ul className="courses" role="list">
          {periods.map((p) => (
            <PeriodRow key={p.id} period={p} />
          ))}
        </ul>
      ) : (
        <p className="dati__hint">{tp.empty}</p>
      )}
      <div className="dati__actions">
        <button type="button" className="btn" onClick={add}>
          {tp.add}
        </button>
      </div>
    </section>
  )
}

function PeriodRow({ period }: { period: Deadline }) {
  const { t, f } = useI18n()
  const tp = t.profilo.periods
  const modules = useModules() ?? DEFAULT_MODULES
  const del = useConfirm(() => void remove(db.deadlines, period.id))
  const types = WORKOUT_ORDER.filter((x) => modules.sport.enabled && modules.sport.types[x].enabled)
  const setSport = (type: (typeof WORKOUT_ORDER)[number], v: number | undefined) => {
    const next = { ...period.sport }
    if (v === undefined) delete next[type]
    else next[type] = v
    void patch(db.deadlines, period.id, { sport: Object.keys(next).length ? next : undefined })
  }
  return (
    <li className="course">
      <div className="course__name">
        <input
          className="field course__input"
          aria-label={tp.name}
          key={period.title}
          defaultValue={period.title}
          onBlur={(e) => {
            const v = e.target.value.trim()
            if (!v) e.target.value = period.title
            else if (v !== period.title) void patch(db.deadlines, period.id, { title: v })
          }}
        />
      </div>
      <div className="dati__pair">
        <DateField label={tp.start} value={period.date} onChange={(v) => void patch(db.deadlines, period.id, { date: v })} />
        <DateField label={tp.end} value={period.endDate} onChange={(v) => void patch(db.deadlines, period.id, { endDate: v })} />
      </div>
      {!period.date || !period.endDate ? <p className="dati__hint">{tp.missing}</p> : null}
      <div className="dati__pair">
        <NumberField label={tp.hours} value={period.hoursPerDay} min={1} max={12} step={0.5} optional placeholder={tp.hoursPlaceholder} onCommit={(v) => void patch(db.deadlines, period.id, { hoursPerDay: v })} />
        {types.map((type) => (
          <NumberField key={type} label={tp.sportTarget({ sport: t.sport.label[type] })} value={period.sport?.[type]} min={0} max={7} optional placeholder={tp.targetPlaceholder} onCommit={(v) => setSport(type, v)} />
        ))}
        {types.length ? (
          <label className="dati__field">
            <span className="date-field__label">{tp.deadlineDay}</span>
            <select
              className="field"
              value={period.deadlineDay ?? ''}
              onChange={(e) => void patch(db.deadlines, period.id, { deadlineDay: e.target.value ? Number(e.target.value) : undefined })}
            >
              <option value="">{tp.deadlineSame}</option>
              {WEEK.map((d) => (
                <option key={d} value={d}>
                  {f.weekdayName(d)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <div className="dati__actions">
        <button type="button" className={`btn${del.armed ? ' btn--danger' : ''}`} onClick={del.press}>
          {del.armed ? t.profilo.exams.removeConfirm : tp.remove}
        </button>
      </div>
    </li>
  )
}

/** Mazzi d'esempio: si caricano solo qui, si collegano a un corso a scelta. */
export function DecksSection({ cardCounts }: { cardCounts: Map<string, number> | undefined }) {
  const { t, f } = useI18n()
  const td = t.profilo.decks
  const courses = useCourses()
  const [file, setFile] = useState<ContentFile | null>(null)
  const [failed, setFailed] = useState(false)
  const [picked, setPicked] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let cancelled = false
    loadSampleFile().then(
      (loaded) => !cancelled && setFile(loaded),
      () => !cancelled && setFailed(true),
    )
    return () => {
      cancelled = true
    }
  }, [])

  const decks: SampleDeck[] = file ? listSampleDecks(file) : []
  const run = async (deck: SampleDeck) => {
    const courseId = picked[deck.id]
    if (!file || !courseId) return
    try {
      const r = await importSampleDeck(db, file, deck.id, courseId)
      setNotice(td.imported({ n: r.added + r.updated + r.unchanged + r.keptEdited }, f))
    } catch (error) {
      setNotice(renderError(error, getI18n()))
    }
  }

  return (
    <section className="dati__section" aria-labelledby="h-mazzi">
      <h2 id="h-mazzi">{td.title}</h2>
      <p className="dati__hint">{td.lead}</p>
      {failed ? <p className="dati__message dati__message--error">{td.error}</p> : null}
      {!file && !failed ? <p className="dati__hint">{td.loading}</p> : null}
      {file && !decks.length ? <p className="dati__hint">{td.none}</p> : null}
      <ul className="courses" role="list">
        {decks.map((deck) => {
          const linked = courses.find((c) => c.sampleDeck === deck.id)
          return (
            <li key={deck.id} className="course">
              <div className="course__name">
                <span className="course__title">{deck.name}</span>
                <span className="course__meta">{linked ? `${td.already}: ${linked.name}, ${td.cards({ n: cardCounts?.get(linked.id) ?? deck.cards }, f)}` : td.cards({ n: deck.cards }, f)}</span>
              </div>
              {courses.length ? (
                <div className="dati__pair">
                  <label className="dati__field">
                    <span className="date-field__label">{td.course}</span>
                    <select className="field" value={picked[deck.id] ?? ''} onChange={(e) => setPicked({ ...picked, [deck.id]: e.target.value })}>
                      <option value="">{td.pick}</option>
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="dati__actions dati__actions--end">
                    <button type="button" className="btn" disabled={!picked[deck.id]} onClick={() => void run(deck)}>
                      {td.import}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="dati__hint">{td.noCourses}</p>
              )}
            </li>
          )
        })}
      </ul>
      <p className="dati__message" role="status" aria-live="polite">
        {notice}
      </p>
    </section>
  )
}
