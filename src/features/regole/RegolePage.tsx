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
import { useFmt, useT } from '../../i18n/store'
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
  const t = useT()
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
    toast(t.regole.resetDone)
  }

  return (
    <Page className="regole" labelledBy="titolo-regole">
      <Sky nebula="briefing" />
      <header className="brief__head">
        <p className="brief__date">
          <a href={href('briefing')}>{t.regole.back}</a>
        </p>
        <h1 id="titolo-regole" className="page__title">
          {t.regole.title}
        </h1>
        <p className="page__lead">
          {t.regole.lead}
        </p>
      </header>

      <ol className="rules" role="list">
        {RULES.map((def) => (
          <RuleRow key={def.id} def={def} config={byId.get(def.id)} tirocinioDated={tirocinioDated} />
        ))}
      </ol>

      <div className="rules__footer">
        <button type="button" className={`btn${confirmReset ? ' btn--danger' : ''}`} onClick={() => void reset()}>
          {confirmReset ? t.regole.resetConfirm : t.regole.reset}
        </button>
      </div>
    </Page>
  )
}

function RuleRow({ def, config, tirocinioDated }: { def: RuleDefinition; config?: RuleConfig; tirocinioDated: boolean }) {
  const t = useT()
  const enabled = config?.enabled ?? true
  const values = { ...defaultThresholds(def.id), ...config?.thresholds }
  return (
    <li className={`rule${enabled ? '' : ' rule--off'}`}>
      <span className="rule__n" aria-hidden="true">
        {def.n}
      </span>
      <div className="rule__body">
        <div className="rule__head">
          <h2 id={`rule-${def.id}`}>{t.regole.rules[def.id].title}</h2>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-labelledby={`rule-${def.id}`}
            className="switch"
            onClick={() => void saveRule(def.id, { enabled: !enabled })}
          >
            <span className="switch__thumb" />
            <span className="switch__text">{enabled ? t.regole.on : t.regole.off}</span>
          </button>
        </div>
        <p className="rule__summary">{t.regole.rules[def.id].summary}</p>
        <div className="rule__thresholds">
          {Object.entries(def.thresholds).map(([key, spec]) => (
            <Threshold key={key} label={t.regole.rules[def.id].thresholds[key] ?? key} spec={spec} value={values[key] ?? spec.value} disabled={!enabled} onCommit={(v) => void saveRule(def.id, { thresholds: { [key]: v } })} />
          ))}
        </div>
        {def.id === 'tirocinio' ? (
          <p className="rule__note">
            {tirocinioDated ? t.regole.periodDatesSet : t.regole.periodDatesMissing}
            <a href={href('dati')}>{t.regole.datiLink}</a>.
          </p>
        ) : null}
      </div>
    </li>
  )
}

function Threshold({ label, spec, value, disabled, onCommit }: { label: string; spec: ThresholdSpec; value: number; disabled: boolean; onCommit: (v: number) => void }) {
  const t = useT()
  const f = useFmt()
  const [text, setText] = useState(String(value).replace('.', ','))
  useEffect(() => setText(String(value).replace('.', ',')), [value])
  const commit = () => {
    const next = clampThreshold(spec, Number(text.replace(',', '.')))
    setText(String(next).replace('.', ','))
    if (next !== value) onCommit(next)
  }
  return (
    <label className="threshold">
      <span className="threshold__label">{label}</span>
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
        {spec.unit ? <span className="threshold__unit">{t.regole.units[spec.unit]}</span> : null}
      </span>
      <span className="threshold__range">
        {t.regole.range({ min: spec.min, max: spec.max }, f)}
      </span>
    </label>
  )
}
