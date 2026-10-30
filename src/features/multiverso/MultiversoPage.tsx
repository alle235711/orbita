import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Page } from '../../app/Page'
import { href } from '../../app/router'
import { useToday } from '../../app/useToday'
import { BlackHoleLite } from '../../art/BlackHoleLite'
import { Sky } from '../../art/Sky'
import { db } from '../../db/db'
import { useAppelli, useCourses, useDeadlines, useGraduation, useMultiverseParams, useProfile, useResults, useUniverses } from '../../db/hooks'
import { createUniverse, ensureUniverses } from '../../db/multiverse-actions'
import type { Course, Universe } from '../../db/schema'
import { renderError } from '../../i18n/errors'
import { useI18n } from '../../i18n/store'
import { diffDays } from '../../lib/dates'
import { activeCourses, gradeProfile, weightedMean } from '../../libretto/grades'
import { applyUniverse, compareUniverses, type Comparison, evaluateUniverse, examSet, MAX_UNIVERSES, MIN_UNIVERSES, sittingsOf, type UniverseEvaluation } from '../../multiverse/scenario'
import { buildSky, sharedScale, SKY_LAYOUT, starPoints, type UniverseSky } from '../../multiverse/sky'
import '../briefing/BriefingPage.css'
import { ChooseSheet } from './ChooseSheet'
import { ParamsPanel } from './ParamsPanel'
import { SittingsSheet } from './SittingsSheet'
import { UniverseCard, type PickRow } from './UniverseCard'
import './MultiversoPage.css'

const PHONE_QUERY = '(max-width: 699px)'
const DOT_THRESHOLD = 0.6

function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

interface Model {
  set: Course[]
  shown: Universe[]
  evals: UniverseEvaluation[]
  skies: UniverseSky[]
  rows: PickRow[]
  cmp: Comparison
  defaultGrade: number | null
  /** Le date d'esame dell'app sono già quelle dell'universo. */
  inUse: boolean[]
  open: Course[]
}

type Dated = { examDate?: string; name: string }
const byDateThenName = (a: Dated, b: Dated) => {
  const da = a.examDate ?? '9999'
  const db_ = b.examDate ?? '9999'
  return da < db_ ? -1 : da > db_ ? 1 : a.name.localeCompare(b.name)
}

export default function MultiversoPage() {
  const { t, f } = useI18n()
  const tm = t.multiverso
  const today = useToday()
  const courses = useCourses()
  const results = useResults()
  const appelli = useAppelli()
  const universes = useUniverses()
  const deadlines = useDeadlines()
  const profile = useProfile()
  const graduation = useGraduation()
  const params = useMultiverseParams()
  const ready = profile !== undefined && graduation !== undefined && params !== undefined
  const phone = useMedia(PHONE_QUERY)

  const [sittingsOpen, setSittingsOpen] = useState(false)
  const [choosing, setChoosing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const model = useMemo<Model | null>(() => {
    if (!ready) return null
    const gp = gradeProfile(profile)
    const set = examSet(courses, results, appelli, today).sort(byDateThenName)
    const shown = universes.slice(0, MAX_UNIVERSES)
    const evals: UniverseEvaluation[] = shown.map((u) => evaluateUniverse({ universe: u, courses, results, appelli, periods: deadlines, today, params, profile: gp, formula: graduation.formula }))
    const scale = sharedScale(evals, today)
    const allExamIds = set.map((c) => c.id)
    const skies: UniverseSky[] = evals.map((evaluation) => buildSky({ evaluation, periods: deadlines, allExamIds, today, scale, layout: SKY_LAYOUT }))
    const rows: PickRow[] = set.map((course) => ({ course, sittings: sittingsOf(course.id, appelli, today).map((s) => ({ ...s, days: Math.max(0, diffDays(today, s.resolved)) })) }))
    return {
      set,
      shown,
      evals,
      skies,
      rows,
      cmp: compareUniverses(evals),
      inUse: evals.map((ev) => ev.exams.length > 0 && applyUniverse(ev, courses).length === 0),
      defaultGrade: weightedMean(courses, results, gp),
      open: activeCourses(courses, results).sort(byDateThenName),
    }
  }, [ready, courses, results, appelli, universes, deadlines, profile, graduation, params, today])

  const alive = universes.length
  const limitReached = alive >= MAX_UNIVERSES
  const noExams = !model || model.set.length === 0
  const create = () => void createUniverse(db, today).catch((e) => setError(renderError(e, { t, f })))

  return (
    <Page className="multiverso" labelledBy="titolo-multiverso">
      <Sky nebula="briefing" />
      <a className="mv__back" href={href('libretto')} aria-label={tm.backAria}>
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
          <path d="M9 2.5L4.5 7 9 11.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {tm.back}
      </a>

      <header className="mv__head">
        <h1 id="titolo-multiverso" className="page__title">
          {tm.title}
        </h1>
        <p className="page__lead">{tm.lead}</p>
        {ready ? (
          <div className="mv__actions">
            <button type="button" className="btn" onClick={() => setSittingsOpen(true)} aria-haspopup="dialog">
              {tm.openSittings}
            </button>
            <button type="button" className="btn btn--primary" disabled={limitReached || noExams} aria-describedby={limitReached ? 'mv-limit' : undefined} onClick={create}>
              {tm.newUniverse}
            </button>
            {limitReached ? (
              <span id="mv-limit" className="mv__hint">
                {tm.limit({ n: MAX_UNIVERSES })}
              </span>
            ) : null}
          </div>
        ) : null}
        {error ? (
          <p className="mv__error" role="alert">
            {error}
          </p>
        ) : null}
      </header>

      {model && params ? (
        <>
          <Legend phone={phone} />
          {model.shown.length >= MIN_UNIVERSES && model.set.length > 0 ? (
            <Universes model={model} phone={phone} universesCount={alive} onChoose={setChoosing} />
          ) : (
            <Empty
              kind={activeCourses(courses, results).length === 0 ? 'noCourses' : appelli.length === 0 || model.set.length === 0 ? 'noSittings' : 'fewUniverses'}
              onSittings={() => setSittingsOpen(true)}
              onCreate={() => void ensureUniverses(db, today)}
            />
          )}
          {alive > MAX_UNIVERSES ? <p className="mv__overflow">{tm.overflow({ n: alive - MAX_UNIVERSES })}</p> : null}
          <ParamsPanel params={params} />
          <SittingsSheet open={sittingsOpen} onClose={() => setSittingsOpen(false)} courses={model.open} appelli={appelli} today={today} />
          {(() => {
            const i = model.shown.findIndex((u) => u.id === choosing)
            if (i < 0) return null
            const u = model.shown[i]!
            const ev = model.evals[i]!
            return (
              <ChooseSheet
                open
                onClose={() => setChoosing(null)}
                universeId={u.id}
                name={u.name || tm.universe.default({ n: i + 1 })}
                evaluation={ev}
                changes={applyUniverse(ev, courses)}
                missing={ev.missingPicks.map((id) => model.set.find((c) => c.id === id)?.name ?? id)}
                today={today}
              />
            )
          })()}
        </>
      ) : null}
    </Page>
  )
}

function Universes({ model, phone, universesCount, onChoose }: { model: Model; phone: boolean; universesCount: number; onChoose: (id: string) => void }) {
  const { t } = useI18n()
  const tm = t.multiverso
  const { shown, evals, skies, rows, cmp, defaultGrade } = model
  const box = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)

  // I puntini sotto il carosello seguono la scheda più visibile; senza IntersectionObserver non si fanno.
  useEffect(() => {
    const root = box.current
    if (!phone || !root || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index))
      },
      { root, threshold: DOT_THRESHOLD },
    )
    root.querySelectorAll<HTMLElement>('[data-index]').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [phone, shown.length])

  return (
    <section className="mv__universes" aria-label={tm.universes}>
      <div
        ref={box}
        className="mv__grid"
        data-n={shown.length}
        role={phone ? 'group' : undefined}
        aria-roledescription={phone ? tm.carousel.role : undefined}
        aria-label={phone ? tm.carousel.label : undefined}
        tabIndex={phone ? 0 : undefined}
      >
        {shown.map((u, i) => (
          <div key={u.id} className="mv__slot" data-index={i}>
            <UniverseCard
              universe={u}
              index={i}
              total={shown.length}
              evaluation={evals[i]!}
              sky={skies[i]!}
              rows={rows}
              best={{ graduation: cmp.earliestGraduation.includes(u.id), conflicts: cmp.fewestConflicts.includes(u.id), load: cmp.lightestPeak.includes(u.id) }}
              inUse={model.inUse[i]!}
              defaultGrade={defaultGrade}
              canRemove={universesCount > MIN_UNIVERSES}
              onChoose={() => onChoose(u.id)}
              carousel={phone}
            />
          </div>
        ))}
      </div>
      {phone && shown.length > 1 ? (
        <div className="mv__dots" aria-hidden="true">
          {shown.map((u, i) => (
            <span key={u.id} className={`mv__dot${i === active ? ' mv__dot--on' : ''}`} />
          ))}
        </div>
      ) : null}
    </section>
  )
}

function Empty({ kind, onSittings, onCreate }: { kind: 'noCourses' | 'noSittings' | 'fewUniverses'; onSittings: () => void; onCreate: () => void }) {
  const { t } = useI18n()
  const te = t.multiverso.empty
  return (
    <section className="mv__empty" aria-label={t.multiverso.universes}>
      <svg className="mv__empty-art" viewBox="0 0 360 140" aria-hidden="true" focusable="false">
        <BlackHoleLite x={290} y={70} scale={0.2} />
        <polygon points={starPoints(60, 40, 8)} fill="var(--cue)" />
      </svg>
      <p>{kind === 'noCourses' ? te.noCourses : kind === 'noSittings' ? te.noSittings : te.fewUniverses}</p>
      {kind === 'noCourses' ? (
        <a className="btn btn--primary" href={href('dati')}>
          {te.openData}
        </a>
      ) : kind === 'noSittings' ? (
        <button type="button" className="btn btn--primary" onClick={onSittings} aria-haspopup="dialog">
          {t.multiverso.openSittings}
        </button>
      ) : (
        <button type="button" className="btn btn--primary" onClick={onCreate}>
          {te.create}
        </button>
      )}
    </section>
  )
}

function Legend({ phone }: { phone: boolean }) {
  const { t } = useI18n()
  const tl = t.multiverso.legend
  const [open, setOpen] = useState(!phone)
  useEffect(() => setOpen(!phone), [phone])
  const items: { key: string; text: string; glyph: ReactNode }[] = [
    { key: 'hole', text: tl.hole, glyph: <circle cx="12" cy="12" r="5" fill="#000" stroke="#fff" strokeWidth="1.4" /> },
    { key: 'comet', text: tl.comet, glyph: <><path d="M3 12 L15 10 L15 14 Z" fill="var(--disk)" fillOpacity="0.7" /><circle cx="17" cy="12" r="3.4" fill="#fff" /></> },
    { key: 'month', text: tl.month, glyph: <><circle cx="12" cy="12" r="3" fill="#fff" /><circle cx="12" cy="12" r="6.4" fill="none" stroke="#fff" strokeOpacity="0.8" strokeDasharray="2.4 2.4" /></> },
    { key: 'arc', text: tl.arc, glyph: <path d="M3 17 Q12 2 21 17" fill="none" stroke="var(--error)" strokeWidth="2" strokeLinecap="round" /> },
    { key: 'band', text: tl.band, glyph: <rect x="3" y="7" width="18" height="10" rx="3" fill="var(--period)" fillOpacity="0.5" /> },
    { key: 'star', text: tl.star, glyph: <polygon points={starPoints(12, 12.6, 8)} fill="var(--cue)" /> },
    { key: 'curve', text: tl.curve, glyph: <path d="M2 18 Q7 4 12 13 T22 7" fill="none" stroke="var(--disk)" strokeWidth="2" strokeLinecap="round" /> },
  ]
  return (
    <details className="mv__legend" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>{tl.title}</summary>
      <ul role="list">
        {items.map((i) => (
          <li key={i.key}>
            <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              {i.glyph}
            </svg>
            <span>{i.text}</span>
          </li>
        ))}
      </ul>
    </details>
  )
}
