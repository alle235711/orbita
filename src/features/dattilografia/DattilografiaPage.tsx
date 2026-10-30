import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { Page } from '../../app/Page'
import { navigate, useRoute } from '../../app/router'
import { useActivityClock } from '../../app/useActivityClock'
import { useToday } from '../../app/useToday'
import { FingerLegend, Keyboard } from '../../components/Keyboard'
import { db } from '../../db/db'
import { alive, save } from '../../db/repo'
import type { TypingRun } from '../../db/schema'
import { useI18n } from '../../i18n/store'
import { mulberry32 } from '../../lib/rng'
import { KEYS } from '../../review/keyboard'
import { corpusWords, generateDrill, generateTargeted, LESSON_BY_ID, LESSONS, TARGETED, type LessonId } from '../../typing/lessons'
import { isPassed, keyRates, lessonProgress, PASS, recommendedLesson, worstKeys } from '../../typing/stats'
import { TypingExercise, type TypingDone } from '../ripasso/TypingExercise'
import '../ripasso/RipassoPage.css'
import './DattilografiaPage.css'

/** Le lezioni si fanno con la tastiera fisica del PC; su iPad e telefono solo le statistiche. */
const hasPhysicalKeyboard = () => window.matchMedia('(pointer: fine)').matches && navigator.maxTouchPoints === 0

const keyName = (id: string) => {
  const key = KEYS.get(id)
  return key?.label || id
}

export default function DattilografiaPage() {
  const { t, f } = useI18n()
  const tt = t.typing
  const route = useRoute()
  const today = useToday()
  const [canPractice] = useState(hasPhysicalKeyboard)
  const [attempt, setAttempt] = useState(0)
  // Il seme cambia a ogni visita; dentro un tentativo il testo resta fermo,
  // anche quando salvare la prova aggiorna progressi e tasti peggiori.
  const [seedBase] = useState(() => Date.now() % 100_000)
  const [targetKeys, setTargetKeys] = useState<string[]>([])
  const [outcome, setOutcome] = useState<string | undefined>()
  const clock = useActivityClock('dattilografia', today)

  const data = useLiveQuery(async () => {
    const [runs, cards] = await Promise.all([db.typingRuns.toArray(), db.cards.toArray()])
    return { runs: alive(runs).sort((a, b) => b.at - a.at), texts: alive(cards).map((c) => c.text) }
  }, [])

  const runs = data?.runs ?? []
  const corpus = useMemo(() => corpusWords(data?.texts ?? []), [data?.texts])
  const progress = useMemo(() => lessonProgress(runs), [runs])
  const rates = useMemo(() => keyRates(runs), [runs])
  const worst = useMemo(() => worstKeys(runs), [runs])
  const recommended = recommendedLesson(runs)
  const requested = route.query.get('lezione') as LessonId | null
  // Senza scelta esplicita vale la lezione consigliata all'apertura: superarla
  // non deve far saltare l'esercizio alla lezione dopo.
  const [opened, setOpened] = useState<LessonId | null>(null)
  useEffect(() => {
    if (data && !opened) setOpened(recommended)
  }, [data, opened, recommended])
  const lessonId: LessonId = requested && LESSON_BY_ID[requested] ? requested : (opened ?? recommended)
  const lesson = LESSON_BY_ID[lessonId]

  const mirato = lessonId === 'mirato'
  useEffect(() => {
    if (mirato && !targetKeys.length && worst.length) setTargetKeys(worst.map((w) => w.key))
  }, [mirato, targetKeys.length, worst])

  const texts = data?.texts
  const text = useMemo(() => {
    if (!texts) return ''
    const seed = seedBase + attempt + 1
    if (lessonId === 'testi') return texts[Math.floor(mulberry32(seed)() * texts.length)] ?? ''
    if (lessonId === 'mirato') return generateTargeted(targetKeys, corpus, seed)
    return generateDrill(LESSON_BY_ID[lessonId], corpus, seed)
  }, [texts, lessonId, attempt, corpus, seedBase, targetKeys])

  const errorsByKey = useMemo(() => Object.fromEntries([...rates.values()].map((r) => [r.key, r.rate])), [rates])

  const choose = (id: LessonId) => {
    setOutcome(undefined)
    setAttempt(0)
    setTargetKeys(id === 'mirato' ? worst.map((w) => w.key) : [])
    navigate('dattilografia', { lezione: id })
  }

  const onDone = async (r: TypingDone) => {
    clock(r.activeMs)
    await save<TypingRun>(db.typingRuns, {
      date: today,
      at: Date.now(),
      lesson: lessonId,
      wpm: r.wpm,
      accuracy: Math.round(r.accuracy * 1000) / 1000,
      chars: r.chars,
      keyErrors: r.keyErrors,
      keyHits: r.keyHits,
    })
    const passed = r.accuracy >= PASS.accuracy && r.wpm >= PASS.wpm
    const tail =
      lessonId === 'testi' || lessonId === 'mirato'
        ? ''
        : passed
          ? tt.lessonPassed
          : tt.toPass({ accuracy: PASS.accuracy * 100, wpm: PASS.wpm })
    setOutcome(`${tt.result({ wpm: r.wpm, accuracy: r.accuracy }, f)} ${tail}`)
  }

  const next = () => {
    setOutcome(undefined)
    if (mirato) setTargetKeys(worst.map((w) => w.key))
    setAttempt((a) => a + 1)
  }

  return (
    <Page className="datti" labelledBy="titolo-datti">
      <header className="datti__head">
        <h1 id="titolo-datti" className="page__title">
          {tt.title}
        </h1>
        <p className="page__lead">
          {canPractice ? tt.leadPractice({ accuracy: PASS.accuracy * 100, wpm: PASS.wpm }) : tt.leadStats}
        </p>
      </header>

      <div className={`datti__grid${canPractice ? '' : ' datti__grid--stats'}`}>
        <section className="datti__path" aria-labelledby="h-percorso">
          <h2 id="h-percorso">{tt.path}</h2>
          <ol className="path" role="list">
            {LESSONS.map((l, i) => {
              const p = progress[l.id]
              const passed = isPassed(p)
              const current = canPractice && l.id === lessonId
              const body = (
                <>
                  <span className="path__n">{i + 1}</span>
                  <span className="path__body">
                    <span className="path__title">{tt.lessons[l.id].title}</span>
                    <span className="path__meta">
                      {p ? tt.best({ wpm: p.bestWpm, accuracy: p.bestAccuracy }, f) : tt.todo}
                      {passed ? tt.passed : l.id === recommended ? tt.upNext : ''}
                    </span>
                  </span>
                </>
              )
              return (
                <li key={l.id} className={`path__step${passed ? ' path__step--passed' : ''}`}>
                  {canPractice ? (
                    <button type="button" className="path__button" aria-current={current ? 'step' : undefined} onClick={() => choose(l.id)}>
                      {body}
                    </button>
                  ) : (
                    <div className="path__button">{body}</div>
                  )}
                </li>
              )
            })}
          </ol>
        </section>

        {canPractice ? (
          <div className="datti__practice">
            <div className="datti__lesson">
              <h2>{tt.lessons[lesson.id].title}</h2>
              <p>{tt.lessons[lesson.id].detail}</p>
            </div>
            {text ? (
              <TypingExercise
                key={`${lessonId}:${attempt}`}
                text={text}
                mode="copia"
                outcome={outcome}
                onDone={(r) => void onDone(r)}
                onNext={next}
                showKeyboard
                inputLabel={tt.exerciseLabel({ title: tt.lessons[lesson.id].title })}
                nextLabel={tt.another}
              />
            ) : (
              <p className="page__lead">{lessonId === 'mirato' ? tt.needRuns : tt.preparing}</p>
            )}
          </div>
        ) : null}
      </div>

      <section className="datti__errors" aria-labelledby="h-errori">
        <div className="datti__errors-head">
          <h2 id="h-errori">{tt.errorsByKey}</h2>
          {canPractice && worst.length ? (
            <button type="button" className="btn btn--primary" onClick={() => choose(TARGETED.id)}>
              {tt.targeted}
            </button>
          ) : null}
        </div>
        {worst.length ? (
          <p className="datti__worst">
            {tt.worstLead}{' '}
            {worst.map((w, i) => (
              <span key={w.key}>
                <strong className="datti__key">{keyName(w.key)}</strong> ({f.number(w.rate * 100, 0)}%){i < worst.length - 1 ? ', ' : '.'}
              </span>
            ))}
          </p>
        ) : (
          <p className="datti__worst">{tt.noErrors}</p>
        )}
        <div className="datti__heat">
          <Keyboard errors={errorsByKey} errorScale={0.25} label={tt.heatLabel} />
          <FingerLegend />
        </div>
      </section>

      <section className="datti__runs" aria-labelledby="h-prove">
        <h2 id="h-prove">{tt.lastRuns}</h2>
        {runs.length ? (
          <table className="runs">
            <thead>
              <tr>
                <th scope="col">{tt.colDay}</th>
                <th scope="col">{tt.colLesson}</th>
                <th scope="col" className="num">
                  {tt.colWpm}
                </th>
                <th scope="col" className="num">
                  {tt.colAccuracy}
                </th>
              </tr>
            </thead>
            <tbody>
              {runs.slice(0, 8).map((r) => (
                <tr key={r.id}>
                  <td>{f.dateShort(r.date)}</td>
                  <td>{tt.lessons[r.lesson as LessonId]?.title ?? r.lesson}</td>
                  <td className="num tnum">{r.wpm}</td>
                  <td className="num tnum">{f.number(r.accuracy * 100, 0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="datti__worst">{tt.noRuns}</p>
        )}
      </section>
    </Page>
  )
}
