import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import { href, navigate, useRoute } from '../../app/router'
import { MathText } from '../../components/MathText'
import { db } from '../../db/db'
import { useCourses } from '../../db/hooks'
import { alive } from '../../db/repo'
import { applyConversions } from '../../db/review-actions'
import type { Card } from '../../db/schema'
import { renderError } from '../../i18n/errors'
import { getI18n, useI18n } from '../../i18n/store'
import { convertCard, relocateKey } from '../../math/convert'

const PAGE = 12
const CONFIRM_MS = 4000

interface Proposal {
  card: Card
  text: string
  key: string
  keyLost: boolean
}

const byId = (a: Card, b: Card) => a.id.localeCompare(b.id, 'it', { numeric: true })

/**
 * Converti in LaTeX: per le schede del corso (e della sezione) scelti, il
 * testo attuale accanto alla proposta già resa. Nulla cambia senza conferma.
 */
export function LatexConverter() {
  const { t, f } = useI18n()
  const tc = t.math.converter
  const route = useRoute()
  const courses = useCourses()
  const cards = useLiveQuery(async () => alive(await db.cards.toArray()))
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [limit, setLimit] = useState(PAGE)
  const [notice, setNotice] = useState('')
  const [armed, setArmed] = useState(false)
  const status = useRef<HTMLParagraphElement>(null)

  const withCards = useMemo(() => {
    const ids = new Set(cards?.map((c) => c.courseId))
    return courses.filter((c) => ids.has(c.id)).sort((a, b) => a.name.localeCompare(b.name, 'it'))
  }, [cards, courses])
  const course = withCards.find((c) => c.id === route.query.get('corso')) ?? withCards[0]
  const inCourse = useMemo(() => (cards ?? []).filter((c) => c.courseId === course?.id), [cards, course])
  const sections = useMemo(() => {
    const listed = course?.sections ?? []
    return [...listed, ...new Set(inCourse.map((c) => c.section).filter((s) => !listed.includes(s)))]
  }, [course, inCourse])
  const section = sections.find((s) => s === route.query.get('sezione')) ?? ''
  const scope = useMemo(() => inCourse.filter((c) => !section || c.section === section).sort(byId), [inCourse, section])

  const proposals = useMemo<Proposal[]>(() => {
    const out: Proposal[] = []
    for (const card of scope) {
      const conv = convertCard(card)
      if (conv.alreadyLatex || !conv.changed) continue
      const draft = drafts[card.id]
      const text = draft ?? conv.text
      const { key, lost } = draft === undefined ? { key: conv.key, lost: conv.keyLost } : relocateKey(text, card.key)
      out.push({ card, text, key, keyLost: lost })
    }
    return out
  }, [scope, drafts])

  useEffect(() => {
    setLimit(PAGE)
    setArmed(false)
  }, [course?.id, section])

  useEffect(() => {
    if (!armed) return
    const id = window.setTimeout(() => setArmed(false), CONFIRM_MS)
    return () => window.clearTimeout(id)
  }, [armed])

  const choose = (corso: string, sezione = '') => navigate('dati', { vista: 'latex', corso, ...(sezione ? { sezione } : {}) })

  const run = async (items: Proposal[], message: string) => {
    try {
      await applyConversions(items.map((p) => ({ id: p.card.id, text: p.text, key: p.key })))
      setDrafts((d) => {
        const next = { ...d }
        for (const p of items) delete next[p.card.id]
        return next
      })
      setNotice(message)
    } catch (error) {
      setNotice(renderError(error, getI18n()))
    }
    // La scheda convertita esce dall'elenco: il focus passa al resoconto.
    status.current?.focus({ preventScroll: true })
  }

  const convertAll = () => {
    if (!armed) return setArmed(true)
    setArmed(false)
    const ready = proposals.filter((p) => !p.keyLost)
    void run(ready, tc.convertedAll({ n: ready.length, skipped: proposals.length - ready.length }, f))
  }

  return (
    <>
      <header className="dati__head">
        <a className="link-button latex__back" href={href('dati')}>
          {tc.back}
        </a>
        <h1 id="titolo-latex" className="page__title">
          {tc.title}
        </h1>
        <p className="page__lead">{tc.lead}</p>
      </header>

      {cards && !withCards.length ? <p className="dati__hint">{tc.noCards}</p> : null}

      {course ? (
        <section className="latex" aria-labelledby="titolo-latex">
          <div className="dati__pair latex__filters">
            <label className="dati__field">
              <span className="date-field__label">{tc.course}</span>
              <select className="field" value={course.id} onChange={(e) => choose(e.target.value)}>
                {withCards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="dati__field">
              <span className="date-field__label">{tc.section}</span>
              <select className="field" value={section} onChange={(e) => choose(course.id, e.target.value)}>
                <option value="">{tc.allSections}</option>
                {sections.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="latex__bar">
            <p className="dati__status">{proposals.length ? tc.count({ n: proposals.length, total: scope.length }, f) : tc.none}</p>
            {proposals.length ? (
              section ? (
                <button type="button" className={`btn${armed ? ' btn--danger' : ' btn--primary'}`} onClick={convertAll}>
                  {armed ? tc.applyAllConfirm({ n: proposals.filter((p) => !p.keyLost).length }, f) : tc.applyAll({ n: proposals.filter((p) => !p.keyLost).length }, f)}
                </button>
              ) : (
                <p className="dati__hint">{tc.pickSection}</p>
              )
            ) : null}
          </div>
          <p ref={status} tabIndex={-1} className="dati__message latex__status" role="status" aria-live="polite">
            {notice}
          </p>

          <ul className="latex__list" role="list">
            {proposals.slice(0, limit).map((p) => (
              <ProposalItem
                key={p.card.id}
                proposal={p}
                onDraft={(text) => setDrafts((d) => ({ ...d, [p.card.id]: text }))}
                onApply={() => void run([p], tc.converted)}
              />
            ))}
          </ul>
          {proposals.length > limit ? (
            <div className="dati__actions">
              <button type="button" className="btn" onClick={() => setLimit((n) => n + PAGE)}>
                {tc.more}
              </button>
            </div>
          ) : null}
        </section>
      ) : null}
    </>
  )
}

function ProposalItem({ proposal, onDraft, onApply }: { proposal: Proposal; onDraft: (text: string) => void; onApply: () => void }) {
  const { t } = useI18n()
  const tc = t.math.converter
  const { card, text, key, keyLost } = proposal
  const headingId = `latex-${card.id}`
  return (
    <li className="latex-item" aria-labelledby={headingId}>
      <div className="latex-item__head">
        <h2 id={headingId} className="course__title">
          {card.title}
        </h2>
        <span className="course__meta">{card.section}</span>
      </div>
      <div className="latex-item__pair">
        <div className="latex-item__col">
          <span className="date-field__label">{tc.source}</span>
          <p className="latex-item__source">{card.text}</p>
        </div>
        <div className="latex-item__col">
          <span className="date-field__label">{tc.rendered}</span>
          <MathText as="p" className="latex-item__render" source={text} reading={card.formulaReading} />
        </div>
      </div>
      <details className="latex-item__edit">
        <summary>{tc.proposalSource}</summary>
        <textarea className="field" rows={4} value={text} aria-label={tc.proposalSource} spellCheck={false} onChange={(e) => onDraft(e.target.value)} />
      </details>
      {keyLost ? <p className="dati__message dati__message--error">{tc.keyLost({ key: card.key })}</p> : null}
      {!keyLost && key !== card.key ? <p className="dati__hint">{tc.keyChanged({ key })}</p> : null}
      <div className="dati__actions">
        <button type="button" className="btn btn--primary" onClick={onApply}>
          {tc.apply}
        </button>
      </div>
    </li>
  )
}
