import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState, type ComponentType, type FormEvent } from 'react'
import { href, useRoute } from '../../app/router'
import { toast } from '../../app/toast'
import { BlackHole, type BlackHoleStage } from '../../art/BlackHole'
import { Grain, Sky } from '../../art/Sky'
import { db } from '../../db/db'
import { normalizeProfile } from '../../db/profile'
import { alive, newId } from '../../db/repo'
import { importSampleDeck, loadSampleFile } from '../../db/sample-decks'
import { getSetting } from '../../db/settings'
import { renderError } from '../../i18n/errors'
import { normalizeLanguage, type Lang } from '../../i18n/lang'
import { getI18n, useI18n } from '../../i18n/store'
import { normalizeModules, normalizeStudyBlock } from '../../modules/types'
import { Step1Nome } from './steps/Step1Nome'
import { Step2Ateneo } from './steps/Step2Ateneo'
import { Step3Esami } from './steps/Step3Esami'
import { Step4Moduli } from './steps/Step4Moduli'
import { Step5Giornata } from './steps/Step5Giornata'
import type { StepProps } from './steps/types'
import { applyDraft, draftFromExisting, draftToRecords, emptyDraft, validateStep, type WizardDraft, type WizardExisting, type WizardRecords } from './wizard'
import './Benvenuto.css'

type Step = 1 | 2 | 3 | 4 | 5
const STEPS: Step[] = [1, 2, 3, 4, 5]
const BODY: Record<Step, ComponentType<StepProps>> = { 1: Step1Nome, 2: Step2Ateneo, 3: Step3Esami, 4: Step4Moduli, 5: Step5Giornata }

/** La lingua del browser: italiano se comincia per "it", altrimenti inglese. */
function browserLang(): Lang {
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('it') ? 'it' : 'en'
}

async function loadExisting(): Promise<WizardExisting & { language: ReturnType<typeof normalizeLanguage>; hasLanguage: boolean }> {
  const [courses, rules, profile, studyBlock, modules, language, row] = await Promise.all([
    db.courses.toArray(),
    db.rules.toArray(),
    getSetting(db, 'profile'),
    getSetting(db, 'studyBlock'),
    getSetting(db, 'modules'),
    getSetting(db, 'language'),
    db.settings.get('language'),
  ])
  return {
    profile: normalizeProfile(profile),
    courses: alive(courses),
    rules: alive(rules),
    studyBlock: normalizeStudyBlock(studyBlock),
    modules: normalizeModules(modules),
    language: normalizeLanguage(language),
    hasLanguage: !!row && !row.deletedAt,
  }
}

/** Importa in sottofondo i mazzi confermati: un errore non blocca l'arrivo sulla copertina. */
async function importConfirmedDecks(draft: WizardDraft, records: WizardRecords): Promise<void> {
  const pairs = draft.sampleDecks.filter((p) => records.examIds[p.examKey])
  if (!pairs.length) return
  try {
    const file = await loadSampleFile()
    for (const p of pairs) await importSampleDeck(db, file, p.deckId, records.examIds[p.examKey]!)
  } catch (error) {
    toast(renderError(error, getI18n()))
  }
}

interface BenvenutoProps {
  /** 'first' al primo avvio; 'complete' quando si riapre dal profilo da completare. */
  mode: 'first' | 'complete'
}

export function Benvenuto({ mode }: BenvenutoProps) {
  const { t } = useI18n()
  const tb = t.benvenuto
  const route = useRoute()
  const existing = useLiveQuery(loadExisting, [])
  const [draft, setDraft] = useState<WizardDraft | null>(null)
  const [step, setStep] = useState<Step>(1)
  const [errors, setErrors] = useState<Record<string, string> | null>(null)
  const [busy, setBusy] = useState(false)
  const title = useRef<HTMLHeadingElement>(null)
  const moved = useRef(false)

  // La bozza si costruisce una volta sola, quando i dati sono arrivati.
  useEffect(() => {
    if (draft || !existing) return
    if (mode === 'complete') {
      setDraft(draftFromExisting(existing, existing.language.base, existing.language.otherDays))
      return
    }
    const lang = existing.hasLanguage ? existing.language.base : browserLang()
    setDraft({ ...emptyDraft(lang), otherDays: existing.language.otherDays })
    // Al primo avvio la lingua del browser vale subito: il percorso stesso la usa.
    if (!existing.hasLanguage && lang !== 'it') void db.settings.put({ id: 'language', value: { base: lang, otherDays: [] }, updatedAt: Date.now() })
  }, [draft, existing, mode])

  // Cambiando passo il fuoco va al titolo (che l'annuncio a voce legge insieme al contatore).
  useEffect(() => {
    if (!moved.current) {
      moved.current = true
      return
    }
    title.current?.focus({ preventScroll: true })
    window.scrollTo(0, 0)
  }, [step])

  const change = (patch: Partial<WizardDraft>) => setDraft((d) => (d ? { ...d, ...patch } : d))
  const heading = tb[`step${step}`]

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!draft || busy) return
    const found = validateStep(step, draft)
    setErrors(found)
    if (found) return
    if (step < 5) return setStep((step + 1) as Step)
    setBusy(true)
    try {
      const current = await loadExisting()
      const records = draftToRecords(draft, current, Date.now(), newId)
      await applyDraft(db, records)
      window.location.hash = href('oggi')
      void importConfirmedDecks(draft, records)
    } catch (error) {
      setBusy(false)
      toast(renderError(error, getI18n()))
    }
  }

  const back = () => {
    setErrors(null)
    setStep((step - 1) as Step)
  }
  const leave = () => {
    window.location.hash = href(route.id)
  }

  const Body = BODY[step]
  const announcement = tb.announce({ n: step, total: STEPS.length, title: `${heading.titleA} ${heading.titleB}` })

  return (
    <div className="welcome" data-step={step} data-mode={mode}>
      <Sky />
      <BlackHole level={3} className="welcome__bh" stage={(step - 1) as BlackHoleStage} />

      <form className="welcome__main" onSubmit={(e) => void submit(e)} noValidate>
        <header className="welcome__top">
          <p className="welcome__eyebrow tnum">{tb.stepOf({ n: step, total: STEPS.length })}</p>
          {mode === 'complete' ? (
            <button type="button" className="welcome__close" onClick={leave} aria-label={tb.complete.close}>
              {tb.close}
            </button>
          ) : null}
        </header>

        <h1 ref={title} tabIndex={-1} className="welcome__title" key={`t${step}`}>
          <span className="welcome__title-text swap-in">
            {heading.titleA}
            <br />
            {heading.titleB}
          </span>
        </h1>
        <p className="welcome__lead">{heading.lead}</p>

        <section className="welcome__panel swap-in" key={`p${step}`} aria-label={`${heading.titleA} ${heading.titleB}`}>
          {draft ? <Body draft={draft} change={change} errors={errors} mode={mode} /> : null}
        </section>

        <footer className="welcome__foot">
          <ol className="welcome__dots" aria-label={tb.progress}>
            {STEPS.map((n) => (
              <li key={n} data-on={n <= step ? 'true' : 'false'} aria-current={n === step ? 'step' : undefined}>
                <span className="sr-only">{tb.stepOf({ n, total: STEPS.length })}</span>
              </li>
            ))}
          </ol>
          <div className="welcome__actions">
            {step > 1 ? (
              <button type="button" className="btn" onClick={back} disabled={busy}>
                {tb.back}
              </button>
            ) : null}
            <button type="submit" className="btn btn--primary" disabled={!draft || busy}>
              {busy ? tb.saving : step === 5 ? tb.finish : tb.next}
            </button>
          </div>
        </footer>
      </form>

      <p className="sr-only" aria-live="polite" role="status">
        {announcement}
      </p>
      <Grain />
    </div>
  )
}
