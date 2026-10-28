import { useEffect, useState } from 'react'
import { Page } from '../../app/Page'
import { href } from '../../app/router'
import { toast } from '../../app/toast'
import { Sky } from '../../art/Sky'
import { db } from '../../db/db'
import { useDeadlines, useRules } from '../../db/hooks'
import type { RuleConfig, RuleId } from '../../db/schema'
import { clampThreshold } from '../../rules/briefing'
import { RULES, defaultThresholds, type RuleDefinition, type ThresholdSpec } from '../../rules/defaults'
import '../briefing/BriefingPage.css'
import './RegolePage.css'

async function saveRule(id: RuleId, change: Partial<Pick<RuleConfig, 'enabled' | 'thresholds'>>) {
  const current = await db.rules.get(id)
  await db.rules.put({
    id,
    enabled: change.enabled ?? current?.enabled ?? true,
    thresholds: { ...defaultThresholds(id), ...current?.thresholds, ...change.thresholds },
    updatedAt: Date.now(),
  })
}

export default function RegolePage() {
  const saved = useRules()
  const byId = new Map(saved.map((r) => [r.id, r]))
  const tirocinio = useDeadlines().find((d) => d.id === 'tirocinio')
  const tirocinioDated = !!tirocinio?.date && !!tirocinio.endDate
  const [confirmReset, setConfirmReset] = useState(false)

  const reset = async () => {
    if (!confirmReset) {
      setConfirmReset(true)
      window.setTimeout(() => setConfirmReset(false), 4000)
      return
    }
    await db.rules.bulkPut(RULES.map((r) => ({ id: r.id, enabled: true, thresholds: defaultThresholds(r.id), updatedAt: Date.now() })))
    setConfirmReset(false)
    toast('Regole riportate ai valori iniziali.')
  }

  return (
    <Page className="regole" labelledBy="titolo-regole">
      <Sky nebula="briefing" />
      <header className="brief__head">
        <p className="brief__date">
          <a href={href('briefing')}>Briefing</a>
        </p>
        <h1 id="titolo-regole" className="page__title">
          Regole
        </h1>
        <p className="page__lead">
          Il piano di Oggi e il briefing nascono da queste nove regole. Spegnile o cambiane le soglie: valgono subito e restano su questo dispositivo.
        </p>
      </header>

      <ol className="rules" role="list">
        {RULES.map((def) => (
          <RuleRow key={def.id} def={def} config={byId.get(def.id)} tirocinioDated={tirocinioDated} />
        ))}
      </ol>

      <div className="rules__footer">
        <button type="button" className={`btn${confirmReset ? ' btn--danger' : ''}`} onClick={() => void reset()}>
          {confirmReset ? 'Tocca ancora per ripristinare tutto' : 'Ripristina i valori iniziali'}
        </button>
      </div>
    </Page>
  )
}

function RuleRow({ def, config, tirocinioDated }: { def: RuleDefinition; config?: RuleConfig; tirocinioDated: boolean }) {
  const enabled = config?.enabled ?? true
  const values = { ...defaultThresholds(def.id), ...config?.thresholds }
  return (
    <li className={`rule${enabled ? '' : ' rule--off'}`}>
      <span className="rule__n" aria-hidden="true">
        {def.n}
      </span>
      <div className="rule__body">
        <div className="rule__head">
          <h2 id={`rule-${def.id}`}>{def.title}</h2>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-labelledby={`rule-${def.id}`}
            className="switch"
            onClick={() => void saveRule(def.id, { enabled: !enabled })}
          >
            <span className="switch__thumb" />
            <span className="switch__text">{enabled ? 'Attiva' : 'Spenta'}</span>
          </button>
        </div>
        <p className="rule__summary">{def.summary}</p>
        <div className="rule__thresholds">
          {Object.entries(def.thresholds).map(([key, spec]) => (
            <Threshold key={key} spec={spec} value={values[key] ?? spec.value} disabled={!enabled} onCommit={(v) => void saveRule(def.id, { thresholds: { [key]: v } })} />
          ))}
        </div>
        {def.id === 'tirocinio' ? (
          <p className="rule__note">
            {tirocinioDated ? 'Le date del tirocinio si cambiano in ' : 'Mancano le date del tirocinio: inseriscile in '}
            <a href={href('dati')}>Dati</a>.
          </p>
        ) : null}
      </div>
    </li>
  )
}

function Threshold({ spec, value, disabled, onCommit }: { spec: ThresholdSpec; value: number; disabled: boolean; onCommit: (v: number) => void }) {
  const [text, setText] = useState(String(value).replace('.', ','))
  useEffect(() => setText(String(value).replace('.', ',')), [value])
  const commit = () => {
    const next = clampThreshold(spec, Number(text.replace(',', '.')))
    setText(String(next).replace('.', ','))
    if (next !== value) onCommit(next)
  }
  return (
    <label className="threshold">
      <span className="threshold__label">{spec.label}</span>
      <span className="threshold__input">
        <input
          className="field"
          inputMode="decimal"
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
        />
        {spec.unit ? <span className="threshold__unit">{spec.unit}</span> : null}
      </span>
      <span className="threshold__range">
        da {String(spec.min).replace('.', ',')} a {String(spec.max).replace('.', ',')}
      </span>
    </label>
  )
}
