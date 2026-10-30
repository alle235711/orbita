import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Page } from '../../app/Page'
import { useToday } from '../../app/useToday'
import { backupFileName, exportAll, importBackup, parseBackup } from '../../db/backup'
import { exportCards, importCards, parseContentFile } from '../../db/cards-io'
import { db } from '../../db/db'
import { useSetting } from '../../db/hooks'
import { setSetting } from '../../db/settings'
import { LANG_NAME, LANGS, MAX_OTHER_DAYS, normalizeLanguage, otherLang, type Lang } from '../../i18n/lang'
import { diffDays, todayISO } from '../../lib/dates'
import { renderError } from '../../i18n/errors'
import { getI18n, useI18n } from '../../i18n/store'
import { downloadJson, readJsonFile } from '../../lib/download'
import { WeekdayToggles } from '../../components/WeekdayToggles'
import { DecksSection, ExamsSection, ModulesSection, PeriodsSection, ProfileSection } from './DatiSections'
import './DatiPage.css'

type Area = 'backup' | 'schede'
interface Notice {
  area: Area
  text: string
  error?: boolean
}


export default function DatiPage() {
  const { t, f } = useI18n()
  const td = t.dati
  const today = useToday()
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
        <ProfileSection />
        <LanguageSection />
        <ModulesSection />
        <ExamsSection cardCounts={cardCounts?.byCourse} />
        <PeriodsSection />
        <DecksSection cardCounts={cardCounts?.byCourse} />

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

      </div>
    </Page>
  )
}

function LanguageSection() {
  const { t } = useI18n()
  const td = t.dati
  const language = normalizeLanguage(useSetting('language'))
  const saveLanguage = (next: { base?: Lang; otherDays?: number[] }) =>
    void setSetting(db, 'language', normalizeLanguage({ ...language, ...next }))
  const daysFull = language.otherDays.length >= MAX_OTHER_DAYS
  return (
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
            <WeekdayToggles value={language.otherDays} onChange={(days) => saveLanguage({ otherDays: days })} labelledBy="l-giorni" />
          </div>
          <p className="dati__hint">
            {language.otherDays.length ? td.language.otherDaysUsage({ other: otherLang(language.base) }) : td.language.otherDaysNone}
            {daysFull ? ` ${td.language.otherDaysMax}` : ''}
          </p>
    </section>
  )
}

function Message({ notice, area }: { notice: Notice | null; area: Area }) {
  return (
    <p className={`dati__message${notice?.error ? ' dati__message--error' : ''}`} role="status" aria-live="polite">
      {notice?.area === area ? notice.text : ''}
    </p>
  )
}
