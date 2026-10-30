import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Page } from '../../app/Page'
import { useToday } from '../../app/useToday'
import { DateField } from '../../components/DateField'
import { backupFileName, exportAll, importBackup, parseBackup } from '../../db/backup'
import { exportCards, importCards, parseContentFile } from '../../db/cards-io'
import { db } from '../../db/db'
import { useCourses, useDeadlines, useSetting } from '../../db/hooks'
import { patch } from '../../db/repo'
import type { Course } from '../../db/schema'
import { setSetting } from '../../db/settings'
import { LANG_NAME, LANGS, MAX_OTHER_DAYS, normalizeLanguage, otherLang, type Lang } from '../../i18n/lang'
import { diffDays, resolveDate, todayISO } from '../../lib/dates'
import { renderError } from '../../i18n/errors'
import { getI18n, useI18n } from '../../i18n/store'
import { downloadJson, readJsonFile } from '../../lib/download'
import './DatiPage.css'

type Area = 'backup' | 'schede'
interface Notice {
  area: Area
  text: string
  error?: boolean
}

const DIFFICULTY: Course['difficulty'][] = [1, 2, 3]
const WEEK = [1, 2, 3, 4, 5, 6, 7]

export default function DatiPage() {
  const { t, f } = useI18n()
  const td = t.dati
  const today = useToday()
  const courses = useCourses()
  const deadlines = useDeadlines()
  const newPerDay = useSetting('newCardsPerDay')
  const lastBackupAt = useSetting('lastBackupAt')
  const language = normalizeLanguage(useSetting('language'))
  const cardCounts = useLiveQuery(async () => {
    const cards = (await db.cards.toArray()).filter((c) => !c.deletedAt)
    const byCourse = new Map<string, number>()
    for (const c of cards) byCourse.set(c.courseId, (byCourse.get(c.courseId) ?? 0) + 1)
    return { total: cards.length, byCourse, needsFix: cards.filter((c) => c.needsFix).length }
  })
  const [persisted, setPersisted] = useState<boolean | undefined>()
  const [notice, setNotice] = useState<Notice | null>(null)
  const [overwriteEdited, setOverwriteEdited] = useState(false)
  const backupInput = useRef<HTMLInputElement>(null)
  const cardsInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void navigator.storage?.persisted?.().then(setPersisted)
  }, [])

  const tirocinio = deadlines.find((d) => d.id === 'tirocinio')
  const laurea = deadlines.find((d) => d.id === 'laurea')
  const byExam = (a: Course, b: Course) =>
    (a.examDate ? resolveDate(a.examDate) : '9999').localeCompare(b.examDate ? resolveDate(b.examDate) : '9999') ||
    a.name.localeCompare(b.name, 'it')
  const examCourses = courses.filter((c) => c.semester !== 2).sort(byExam)
  const laterCourses = courses.filter((c) => c.semester === 2).sort(byExam)

  const run = async (area: Area, task: () => Promise<string>) => {
    try {
      setNotice({ area, text: await task() })
    } catch (error) {
      setNotice({ area, text: renderError(error, getI18n()), error: true })
    }
  }

  const exportBackup = () =>
    run('backup', async () => {
      downloadJson(backupFileName(todayISO()), await exportAll(db))
      await setSetting(db, 'lastBackupAt', Date.now())
      return td.backupSaved
    })

  const importBackupFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    void run('backup', async () => {
      const r = await importBackup(db, parseBackup(await readJsonFile(file)))
      return td.backupImported(r, f)
    })
  }

  const exportCardsFile = () =>
    run('schede', async () => {
      const file = await exportCards(db)
      downloadJson(`orbita-schede-${todayISO()}.json`, file)
      return td.cardsExported({ n: file.schede.length }, f)
    })

  const importCardsFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    void run('schede', async () => {
      const r = await importCards(db, parseContentFile(await readJsonFile(file)), { overwriteEdited })
      return td.cardsImported(r, f)
    })
  }

  const askPersistence = async () => {
    setPersisted(await navigator.storage?.persist?.())
  }

  const saveLanguage = (next: { base?: Lang; otherDays?: number[] }) =>
    void setSetting(db, 'language', normalizeLanguage({ ...language, ...next }))
  const toggleDay = (day: number) =>
    saveLanguage({ otherDays: language.otherDays.includes(day) ? language.otherDays.filter((d) => d !== day) : [...language.otherDays, day] })
  const daysFull = language.otherDays.length >= MAX_OTHER_DAYS

  const backupAge = lastBackupAt ? diffDays(todayISO(new Date(lastBackupAt)), today) : null

  return (
    <Page className="dati" labelledBy="titolo-dati">
      <header className="dati__head">
        <h1 id="titolo-dati" className="page__title">
          {td.title}
        </h1>
        <p className="page__lead">{td.lead}</p>
      </header>

      <div className="dati__grid">
        <section className="dati__section dati__section--courses" aria-labelledby="h-corsi">
          <h2 id="h-corsi">{td.courses}</h2>
          <p className="dati__hint">{td.coursesHint}</p>
          <ul className="courses" role="list">
            {examCourses.map((c) => (
              <CourseRow key={c.id} course={c} cards={cardCounts?.byCourse.get(c.id) ?? 0} />
            ))}
          </ul>
          <h3 className="dati__sub">{td.secondSemester}</h3>
          <ul className="courses" role="list">
            {laterCourses.map((c) => (
              <CourseRow key={c.id} course={c} cards={cardCounts?.byCourse.get(c.id) ?? 0} />
            ))}
          </ul>
        </section>

        <section className="dati__section" aria-labelledby="h-scadenze">
          <h2 id="h-scadenze">{td.deadlines}</h2>
          {tirocinio ? (
            <>
              <div className="dati__pair">
                <DateField
                  label={td.periodStart}
                  value={tirocinio.date}
                  onChange={(v) => void patch(db.deadlines, tirocinio.id, { date: v })}
                />
                <DateField
                  label={td.periodEnd}
                  value={tirocinio.endDate}
                  onChange={(v) => void patch(db.deadlines, tirocinio.id, { endDate: v })}
                />
              </div>
              {!tirocinio.date || !tirocinio.endDate ? (
                <p className="dati__hint">{td.periodMissing}</p>
              ) : null}
            </>
          ) : null}
          {laurea ? (
            <DateField
              label={td.graduation}
              value={laurea.date}
              allowMonthOnly
              onChange={(v) => v && void patch(db.deadlines, laurea.id, { date: v })}
            />
          ) : null}
        </section>

        <section className="dati__section" aria-labelledby="h-backup">
          <h2 id="h-backup">{td.backup}</h2>
          <p className="dati__status">
            {backupAge === null ? td.backupNone : td.lastBackup({ days: backupAge }, f)}{' '}
            {persisted === true ? td.persistedYes : persisted === false ? td.persistedNo : ''}
          </p>
          <div className="dati__actions">
            <button type="button" className="btn btn--primary" onClick={() => void exportBackup()}>
              {td.exportAll}
            </button>
            <button type="button" className="btn" onClick={() => backupInput.current?.click()}>
              {td.importBackup}
            </button>
            {persisted === false ? (
              <button type="button" className="btn" onClick={() => void askPersistence()}>
                {td.askPersist}
              </button>
            ) : null}
            <input ref={backupInput} type="file" accept="application/json,.json" hidden onChange={importBackupFile} />
          </div>
          <p className="dati__hint">{td.mergeHint}</p>
          <Message notice={notice} area="backup" />
        </section>

        <section className="dati__section" aria-labelledby="h-schede">
          <h2 id="h-schede">{td.cards}</h2>
          <p className="dati__status">
            {cardCounts ? td.cardsCount({ total: cardCounts.total }, f) : td.cardsLoading}
            {cardCounts?.needsFix ? td.cardsNeedFix({ n: cardCounts.needsFix }) : ''}.
          </p>
          <label className="dati__number">
            <span>{td.newPerDay}</span>
            <input
              className="field"
              type="number"
              inputMode="numeric"
              min={0}
              max={60}
              value={newPerDay ?? 15}
              onChange={(e) => {
                const n = Math.max(0, Math.min(60, Math.round(Number(e.target.value))))
                if (Number.isFinite(n)) void setSetting(db, 'newCardsPerDay', n)
              }}
            />
          </label>
          <div className="dati__actions">
            <button type="button" className="btn" onClick={() => void exportCardsFile()}>
              {td.exportCards}
            </button>
            <button type="button" className="btn" onClick={() => cardsInput.current?.click()}>
              {td.importCards}
            </button>
            <input ref={cardsInput} type="file" accept="application/json,.json" hidden onChange={importCardsFile} />
          </div>
          <label className="date-field__check">
            <input type="checkbox" checked={overwriteEdited} onChange={(e) => setOverwriteEdited(e.target.checked)} />
            {td.overwrite}
          </label>
          <Message notice={notice} area="schede" />
        </section>

        <section className="dati__section" aria-labelledby="h-lingua">
          <h2 id="h-lingua">{td.language.title}</h2>
          <div className="dati__field">
            <span className="date-field__label" id="l-base">
              {td.language.base}
            </span>
            <div className="segmented" role="group" aria-labelledby="l-base">
              {LANGS.map((l) => (
                <button
                  key={l}
                  type="button"
                  className="segmented__item"
                  lang={l}
                  aria-pressed={language.base === l}
                  onClick={() => saveLanguage({ base: l, otherDays: language.otherDays })}
                >
                  {LANG_NAME[l]}
                </button>
              ))}
            </div>
          </div>
          <div className="dati__field">
            <span className="date-field__label" id="l-giorni">
              {td.language.otherDays}
            </span>
            <div className="dati__days" role="group" aria-labelledby="l-giorni">
              {WEEK.map((day) => {
                const on = language.otherDays.includes(day)
                return (
                  <button
                    key={day}
                    type="button"
                    className="chip"
                    aria-pressed={on}
                    aria-label={f.weekdayName(day)}
                    disabled={daysFull && !on}
                    onClick={() => toggleDay(day)}
                  >
                    {f.weekdayShort(day)}
                  </button>
                )
              })}
            </div>
          </div>
          <p className="dati__hint">
            {language.otherDays.length ? td.language.otherDaysUsage({ other: otherLang(language.base) }) : td.language.otherDaysNone}
            {daysFull ? ` ${td.language.otherDaysMax}` : ''}
          </p>
        </section>
      </div>
    </Page>
  )
}

function CourseRow({ course, cards }: { course: Course; cards: number }) {
  const { t, f } = useI18n()
  const td = t.dati
  const meta = [course.code, course.degree, cards ? td.cardsMeta({ n: cards }, f) : null].filter(Boolean).join(', ')
  return (
    <li className="course">
      <div className="course__name">
        <span className="course__title">{course.name}</span>
        {meta ? <span className="course__meta">{meta}</span> : null}
      </div>
      <DateField
        label={course.examDate ? td.exam({ date: course.examDate }, f) : td.examTbd}
        value={course.examDate}
        allowMonthOnly
        onChange={(v) => void patch(db.courses, course.id, { examDate: v })}
      />
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
    </li>
  )
}

function Message({ notice, area }: { notice: Notice | null; area: Area }) {
  return (
    <p className={`dati__message${notice?.error ? ' dati__message--error' : ''}`} role="status" aria-live="polite">
      {notice?.area === area ? notice.text : ''}
    </p>
  )
}
