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
import { diffDays, formatDate, relativeDays, resolveDate, todayISO } from '../../lib/dates'
import { downloadJson, readJsonFile } from '../../lib/download'
import './DatiPage.css'

type Area = 'backup' | 'schede'
interface Notice {
  area: Area
  text: string
  error?: boolean
}

const DIFFICULTY: { value: Course['difficulty']; label: string }[] = [
  { value: 1, label: 'bassa' },
  { value: 2, label: 'media' },
  { value: 3, label: 'alta' },
]

export default function DatiPage() {
  const today = useToday()
  const courses = useCourses()
  const deadlines = useDeadlines()
  const newPerDay = useSetting('newCardsPerDay')
  const lastBackupAt = useSetting('lastBackupAt')
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
      setNotice({ area, text: error instanceof Error ? error.message : 'Qualcosa non ha funzionato.', error: true })
    }
  }

  const exportBackup = () =>
    run('backup', async () => {
      downloadJson(backupFileName(todayISO()), await exportAll(db))
      await setSetting(db, 'lastBackupAt', Date.now())
      return 'Backup salvato. Tienilo anche fuori da questo dispositivo.'
    })

  const importBackupFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    void run('backup', async () => {
      const r = await importBackup(db, parseBackup(await readJsonFile(file)))
      return `Backup importato: ${r.added} record nuovi, ${r.updated} aggiornati, ${r.skipped} già al passo.`
    })
  }

  const exportCardsFile = () =>
    run('schede', async () => {
      const file = await exportCards(db)
      downloadJson(`orbita-schede-${todayISO()}.json`, file)
      return `Esportate ${file.schede.length} schede.`
    })

  const importCardsFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    void run('schede', async () => {
      const r = await importCards(db, parseContentFile(await readJsonFile(file)), { overwriteEdited })
      const kept = r.keptEdited ? `, ${r.keptEdited} modificate da te lasciate come sono` : ''
      return `Schede importate: ${r.added} nuove, ${r.updated} aggiornate, ${r.unchanged} uguali${kept}.`
    })
  }

  const askPersistence = async () => {
    setPersisted(await navigator.storage?.persist?.())
  }

  const backupAge = lastBackupAt ? diffDays(todayISO(new Date(lastBackupAt)), today) : null

  return (
    <Page className="dati" labelledBy="titolo-dati">
      <header className="dati__head">
        <h1 id="titolo-dati" className="page__title">
          Dati
        </h1>
        <p className="page__lead">
          Tutto resta su questo dispositivo e funziona senza rete. Esporta un backup ogni tanto, e di sicuro prima di partire
          per le Maldive.
        </p>
      </header>

      <div className="dati__grid">
        <section className="dati__section dati__section--courses" aria-labelledby="h-corsi">
          <h2 id="h-corsi">Corsi ed esami</h2>
          <p className="dati__hint">
            Se conosci solo il mese, l’esame conta dal 1°. La difficoltà della teoria decide cosa va nelle prime ore quando
            l’energia è alta.
          </p>
          <ul className="courses" role="list">
            {examCourses.map((c) => (
              <CourseRow key={c.id} course={c} cards={cardCounts?.byCourse.get(c.id) ?? 0} />
            ))}
          </ul>
          <h3 className="dati__sub">Secondo semestre</h3>
          <ul className="courses" role="list">
            {laterCourses.map((c) => (
              <CourseRow key={c.id} course={c} cards={cardCounts?.byCourse.get(c.id) ?? 0} />
            ))}
          </ul>
        </section>

        <section className="dati__section" aria-labelledby="h-scadenze">
          <h2 id="h-scadenze">Scadenze</h2>
          {tirocinio ? (
            <div className="dati__pair">
              <DateField
                label="Tirocinio alle Maldive, partenza"
                value={tirocinio.date}
                onChange={(v) => v && void patch(db.deadlines, tirocinio.id, { date: v })}
              />
              <DateField
                label="Rientro"
                value={tirocinio.endDate}
                onChange={(v) => v && void patch(db.deadlines, tirocinio.id, { endDate: v })}
              />
            </div>
          ) : null}
          {laurea ? (
            <DateField
              label="Laurea"
              value={laurea.date}
              allowMonthOnly
              onChange={(v) => v && void patch(db.deadlines, laurea.id, { date: v })}
            />
          ) : null}
        </section>

        <section className="dati__section" aria-labelledby="h-backup">
          <h2 id="h-backup">Backup</h2>
          <p className="dati__status">
            {backupAge === null
              ? 'Nessun backup finora.'
              : `Ultimo backup ${backupAge === 0 ? 'oggi' : relativeDays(-backupAge)}.`}{' '}
            {persisted === true
              ? 'Il browser non cancellerà questi dati.'
              : persisted === false
                ? 'Il browser potrebbe cancellare i dati se manca spazio: installa Orbita sulla schermata Home.'
                : ''}
          </p>
          <div className="dati__actions">
            <button type="button" className="btn btn--primary" onClick={() => void exportBackup()}>
              Esporta tutti i dati
            </button>
            <button type="button" className="btn" onClick={() => backupInput.current?.click()}>
              Importa un backup
            </button>
            {persisted === false ? (
              <button type="button" className="btn" onClick={() => void askPersistence()}>
                Chiedi di conservarli
              </button>
            ) : null}
            <input ref={backupInput} type="file" accept="application/json,.json" hidden onChange={importBackupFile} />
          </div>
          <p className="dati__hint">
            L’importazione fonde i dati: per ogni record resta la versione modificata più di recente.
          </p>
          <Message notice={notice} area="backup" />
        </section>

        <section className="dati__section" aria-labelledby="h-schede">
          <h2 id="h-schede">Schede di ripasso</h2>
          <p className="dati__status">
            {cardCounts ? `${cardCounts.total} schede` : 'Schede in caricamento'}
            {cardCounts?.needsFix ? `, ${cardCounts.needsFix} da correggere` : ''}.
          </p>
          <label className="dati__number">
            <span>Nuove schede al giorno per la materia più urgente</span>
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
              Esporta le schede
            </button>
            <button type="button" className="btn" onClick={() => cardsInput.current?.click()}>
              Importa schede
            </button>
            <input ref={cardsInput} type="file" accept="application/json,.json" hidden onChange={importCardsFile} />
          </div>
          <label className="date-field__check">
            <input type="checkbox" checked={overwriteEdited} onChange={(e) => setOverwriteEdited(e.target.checked)} />
            Sovrascrivi anche le schede che ho modificato
          </label>
          <Message notice={notice} area="schede" />
        </section>
      </div>
    </Page>
  )
}

function CourseRow({ course, cards }: { course: Course; cards: number }) {
  const meta = [course.code, course.degree, cards ? `${cards} schede` : null].filter(Boolean).join(', ')
  return (
    <li className="course">
      <div className="course__name">
        <span className="course__title">{course.name}</span>
        {meta ? <span className="course__meta">{meta}</span> : null}
      </div>
      <DateField
        label={course.examDate ? `Esame, ${formatDate(course.examDate, true)}` : 'Esame, data da fissare'}
        value={course.examDate}
        allowMonthOnly
        onChange={(v) => void patch(db.courses, course.id, { examDate: v })}
      />
      <div className="course__difficulty" role="radiogroup" aria-label={`Difficoltà della teoria di ${course.name}`}>
        <span className="date-field__label" aria-hidden="true">
          Difficoltà
        </span>
        <div className="segmented">
          {DIFFICULTY.map((d) => (
            <button
              key={d.value}
              type="button"
              role="radio"
              aria-checked={course.difficulty === d.value}
              className="segmented__item"
              onClick={() => void patch(db.courses, course.id, { difficulty: d.value })}
            >
              {d.label}
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
