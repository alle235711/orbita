import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { Page } from '../../app/Page'
import { navigate, useRoute } from '../../app/router'
import { useActivityClock } from '../../app/useActivityClock'
import { useToday } from '../../app/useToday'
import { SubjectChalk } from '../../art/Chalk'
import { db } from '../../db/db'
import { useCourses, useSetting } from '../../db/hooks'
import { alive } from '../../db/repo'
import { saveReview, setNeedsFix } from '../../db/review-actions'
import type { Card, ReviewMode } from '../../db/schema'
import { formatDate, relativeDays, diffDays, withDate } from '../../lib/dates'
import { MIN_ACCURACY, MODE_LABEL, modeForBox } from '../../review/leitner'
import { courseRank, dailyQueue } from '../../review/queue'
import { CardEditor } from './CardEditor'
import { RecallExercise, type RecallDone } from './RecallExercise'
import { TypingExercise, type TypingDone } from './TypingExercise'
import './RipassoPage.css'

const INSTRUCTIONS: Record<ReviewMode, string> = {
  copia: 'Ricopiala senza guardare la tastiera: la ripeti e intanto alleni le dita.',
  completa: 'La parte nascosta va scritta a memoria, insieme a tutto il resto.',
  nome: 'Leggi l’enunciato e scrivi il nome della scheda.',
  memoria: 'Scrivi l’enunciato a memoria, poi confrontalo con il testo.',
}

export default function RipassoPage() {
  const route = useRoute()
  const today = useToday()
  const courses = useCourses()
  const newPerDay = useSetting('newCardsPerDay') ?? 15
  // Scheda, modalità e scatola si fissano quando la scheda arriva: salvando
  // la revisione la scatola cambia, ma l'esercizio in corso no.
  const [current, setCurrent] = useState<{ id: string; mode: ReviewMode; box: number; fresh: boolean } | null>(null)
  const [skipped, setSkipped] = useState<Set<string>>(new Set())
  const [early, setEarly] = useState(false)
  const [saved, setSaved] = useState<string | undefined>()
  const [editing, setEditing] = useState<Card | null>(null)
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 700px)').matches)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 700px)')
    const on = () => setWide(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  const data = useLiveQuery(async () => {
    const [cards, states, reviews] = await Promise.all([
      db.cards.toArray(),
      db.cardState.toArray(),
      db.cardReviews.where('date').equals(today).toArray(),
    ])
    return { cards: alive(cards), states: alive(states), reviews: alive(reviews) }
  }, [today])

  // Materie con schede, dall'esame più vicino.
  const subjects = useMemo(() => {
    if (!data) return []
    const withCards = new Set(data.cards.map((c) => c.courseId))
    const rank = courseRank(courses, today)
    return courses.filter((c) => withCards.has(c.id)).sort((a, b) => rank(a.id) - rank(b.id))
  }, [data, courses, today])

  const subjectId = route.query.get('materia') ?? subjects[0]?.id
  const subject = subjects.find((s) => s.id === subjectId) ?? subjects[0]
  const section = route.query.get('sezione') ?? ''
  const review = useActivityClock('ripasso', today, subject?.id)

  const queue = useMemo(() => {
    if (!data || !subject) return null
    return dailyQueue({ today, cards: data.cards, states: data.states, courses, newPerDay }, { courseId: subject.id, section: section || undefined })
  }, [data, subject, section, today, courses, newPerDay])

  const states = useMemo(() => new Map(data?.states.map((s) => [s.id, s]) ?? []), [data])
  const cardsById = useMemo(() => new Map(data?.cards.map((c) => [c.id, c]) ?? []), [data])

  const todo = useMemo(() => (queue ? [...queue.due, ...queue.fresh].filter((c) => !skipped.has(c.id)) : []), [queue, skipped])
  const ahead = useMemo(() => {
    if (!data || !subject) return []
    return data.cards
      .filter((c) => c.courseId === subject.id && (!section || c.section === section) && states.get(c.id) && states.get(c.id)!.due > today && !skipped.has(c.id))
      .sort((a, b) => states.get(a.id)!.due.localeCompare(states.get(b.id)!.due))
  }, [data, subject, section, states, today, skipped])

  // La scheda corrente resta la stessa finché non passi alla successiva.
  useEffect(() => {
    if (current) return
    const next = (early ? ahead : todo)[0]
    if (!next) return
    const st = states.get(next.id)
    setCurrent({ id: next.id, mode: modeForBox(st?.box), box: st?.box ?? 1, fresh: !st })
  }, [current, todo, ahead, early, states])

  const card = current ? cardsById.get(current.id) : undefined
  const mode = current?.mode ?? 'copia'
  const doneToday = data && subject ? new Set(data.reviews.filter((r) => cardsById.get(r.cardId)?.courseId === subject.id).map((r) => r.cardId)).size : 0

  const choose = (materia: string, sezione = '') => {
    setCurrent(null)
    setSkipped(new Set())
    setEarly(false)
    setSaved(undefined)
    navigate('ripasso', { materia, ...(sezione ? { sezione } : {}) })
  }

  const next = () => {
    if (card && !saved) setSkipped((s) => new Set(s).add(card.id))
    setSaved(undefined)
    setCurrent(null)
  }

  const describe = (ok: boolean, boxAfter: number, isEarly: boolean, due?: string) => {
    if (isEarly) return `${ok ? 'Giusta' : 'Da rivedere'}: era in anticipo, resta nella scatola ${boxAfter}.`
    const when = due ? relativeDays(diffDays(today, due)) : ''
    return ok ? `Sale nella scatola ${boxAfter}: la rivedi ${when}.` : `Torna nella scatola 1: la rivedi ${when}.`
  }

  const onTypingDone = async (r: TypingDone) => {
    if (!card) return
    review(r.activeMs)
    const ok = r.accuracy >= MIN_ACCURACY
    const outcome = await saveReview(card.id, { mode, wpm: r.wpm, score: r.accuracy, wrongChars: r.wrongChars, ok }, today)
    setSaved(describe(ok, outcome.boxAfter, outcome.early, outcome.state.due))
  }

  const onRecallDecide = async (r: RecallDone) => {
    if (!card) return
    review(r.activeMs)
    const outcome = await saveReview(card.id, { mode, wpm: r.wpm, score: r.similarity, wrongChars: r.typos, ok: r.ok }, today)
    setSaved(describe(r.ok, outcome.boxAfter, outcome.early, outcome.state.due))
  }

  if (!data) return <Page className="ripasso" />

  if (!subjects.length) {
    return (
      <Page className="ripasso" labelledBy="titolo-ripasso">
        <h1 id="titolo-ripasso" className="page__title">
          Ripasso a 10 dita
        </h1>
        <p className="page__lead">
          Non ci sono ancora schede. Importale dalla pagina <a href="#/dati">Dati</a>.
        </p>
      </Page>
    )
  }

  const remaining = todo.length
  const total = doneToday + remaining

  return (
    <Page className="ripasso" labelledBy="titolo-ripasso">
      {subject ? <SubjectChalk courseId={subject.id} className="ripasso__chalk" /> : null}

      <div className="ripasso__subjects">
        <div className="choices" role="group" aria-label="Materia">
          {subjects.map((s) => (
            <button key={s.id} type="button" className="chip" aria-pressed={s.id === subject?.id} onClick={() => choose(s.id)}>
              {s.name}
            </button>
          ))}
        </div>
        {subject?.sections.length ? (
          <label className="ripasso__section">
            <span className="sr-only">Sezione del programma</span>
            <select className="field" value={section} onChange={(e) => subject && choose(subject.id, e.target.value)}>
              <option value="">Tutto il programma</option>
              {subject.sections.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {card && subject ? (
        <>
          <header className="ripasso__head">
            <h1 id="titolo-ripasso" className="ripasso__title">
              {mode === 'nome' && !saved ? 'Di che cosa si tratta?' : card.title}
            </h1>
            <p className="ripasso__lead">
              {subject.name}, {early ? 'in anticipo' : `scheda ${Math.min(total, doneToday + 1)} di ${total}`}. {INSTRUCTIONS[mode]}
            </p>
            <p className="ripasso__meta">
              <span>
                Scatola {current?.box ?? 1} di 5, {MODE_LABEL[mode]}
                {current?.fresh ? ', scheda nuova' : ''}
              </span>
              <button type="button" className="link-button" aria-pressed={card.needsFix} onClick={() => void setNeedsFix(card.id, !card.needsFix)}>
                {card.needsFix ? 'Segnata da correggere' : 'Segna da correggere'}
              </button>
              <button type="button" className="link-button" onClick={() => setEditing(card)}>
                Modifica la scheda
              </button>
            </p>
          </header>

          {mode === 'copia' || mode === 'completa' ? (
            <TypingExercise
              key={`${card.id}:${mode}`}
              text={card.text}
              mode={mode}
              hiddenKey={card.key}
              outcome={saved}
              onDone={(r) => void onTypingDone(r)}
              onNext={next}
              showKeyboard={wide}
              inputLabel={mode === 'copia' ? 'Ricopia la definizione' : 'Scrivi la definizione, parte nascosta compresa'}
            />
          ) : (
            <RecallExercise
              key={`${card.id}:${mode}`}
              mode={mode}
              reference={mode === 'nome' ? card.title : card.text}
              prompt={mode === 'nome' ? card.text : undefined}
              saved={saved}
              onDecide={(r) => void onRecallDecide(r)}
              onNext={next}
              showKeyboard={wide}
            />
          )}
        </>
      ) : (
        <header className="ripasso__head ripasso__head--done">
          <h1 id="titolo-ripasso" className="ripasso__title">
            Per oggi è tutto
          </h1>
          <p className="ripasso__lead">
            {subject ? `Hai finito le schede di ${subject.name} di oggi` : 'Hai finito le schede di oggi'}
            {doneToday ? `: ${doneToday} ripassate.` : '.'} Puoi ripassarne altre in anticipo: contano per le statistiche ma non cambiano scatola.
          </p>
          <NextDue cards={data.cards.filter((c) => c.courseId === subject?.id)} states={states} today={today} />
          {ahead.length ? (
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                setEarly(true)
                setCurrent(null)
              }}
            >
              Continua in anticipo
            </button>
          ) : null}
        </header>
      )}

      <CardEditor card={editing} sections={subject?.sections ?? []} onClose={() => setEditing(null)} />
    </Page>
  )
}

function NextDue({ cards, states, today }: { cards: Card[]; states: Map<string, { due: string }>; today: string }) {
  const dues = cards.map((c) => states.get(c.id)?.due).filter((d): d is string => !!d && d > today).sort()
  if (!dues.length) return null
  const first = dues[0]!
  const count = dues.filter((d) => d === first).length
  return (
    <p className="ripasso__meta">
      Le prossime: {count} {count === 1 ? 'scheda' : 'schede'} {withDate('il', formatDate(first))}.
    </p>
  )
}
