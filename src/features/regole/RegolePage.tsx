import { useEffect, useState } from 'react'
import { Page } from '../../app/Page'
import { href } from '../../app/router'
import { toast } from '../../app/toast'
import { Sky } from '../../art/Sky'
import { db } from '../../db/db'
import { useModules, useRules, useStudyBlock } from '../../db/hooks'
import type { ConfigId, RuleConfig } from '../../db/schema'
import { setSetting } from '../../db/settings'
import { moduleLabel, ruleEnabledByModule } from '../../modules/registry'
import { BLOCK_PRESET_IDS, DEFAULT_MODULES, DEFAULT_STUDY_BLOCK, normalizeStudyBlock, type BlockPreset, type StudyBlockSettings } from '../../modules/types'
import { blocksFor } from '../../rules/blocks'
import { clampThreshold } from '../../rules/briefing'
import { GROUPS, GROUP_IDS, HINT_SPECS, RULES, defaultThresholds, type RuleDefinition, type ThresholdSpec } from '../../rules/defaults'
import '../briefing/BriefingPage.css'
import { useFmt, useT } from '../../i18n/store'
import './RegolePage.css'

async function saveRule(id: ConfigId, change: Partial<Pick<RuleConfig, 'enabled' | 'thresholds'>>) {
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
  const modules = useModules() ?? DEFAULT_MODULES
  const byId = new Map(saved.map((r) => [r.id, r]))
  const [confirmReset, setConfirmReset] = useState(false)
  // Le regole dei moduli spenti non compaiono; i numeri ripartono da 1 nell'ordine mostrato.
  const visible = RULES.filter((r) => ruleEnabledByModule(modules, r.id))

  const reset = async () => {
    if (!confirmReset) {
      setConfirmReset(true)
      window.setTimeout(() => setConfirmReset(false), 4000)
      return
    }
    // Si riportano a zero solo le righe che esistono; i gruppi si cancellano in modo logico.
    const now = Date.now()
    const existing = saved.filter((r) => RULES.some((x) => x.id === r.id))
    if (existing.length) await db.rules.bulkPut(existing.map((r) => ({ id: r.id, enabled: true, thresholds: defaultThresholds(r.id), updatedAt: now })))
    for (const r of saved) if (GROUP_IDS.includes(r.id as never)) await db.rules.put({ ...r, deletedAt: now, updatedAt: now })
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

      <BlocksCard />

      <ol className="rules" role="list">
        {visible.map((def, i) => (
          <RuleRow key={def.id} def={def} n={i + 1} config={byId.get(def.id)} title={def.id === 'abilita' ? t.regole.abilityTitle({ name: moduleLabel(modules, 'abilita', t) }) : undefined} summary={def.id === 'periodo' && !modules.sport.enabled ? t.regole.periodSummaryNoSport : undefined} />
        ))}
      </ol>

      <section className="groups" aria-labelledby="h-gruppi">
        <h2 id="h-gruppi">{t.regole.groupsTitle}</h2>
        {GROUP_IDS.filter((g) => g !== 'dattilografia' || modules.dattilografia.enabled).map((g) => (
          <GroupBlock key={g} id={g} config={byId.get(g)} />
        ))}
      </section>

      <div className="rules__footer">
        <button type="button" className={`btn${confirmReset ? ' btn--danger' : ''}`} onClick={() => void reset()}>
          {confirmReset ? t.regole.resetConfirm : t.regole.reset}
        </button>
      </div>
    </Page>
  )
}

function RuleRow({ def, config, n, title, summary }: { def: RuleDefinition; config?: RuleConfig; n: number; title?: string; summary?: string }) {
  const t = useT()
  const enabled = config?.enabled ?? true
  const values = { ...defaultThresholds(def.id), ...config?.thresholds }
  return (
    <li className={`rule${enabled ? '' : ' rule--off'}`}>
      <span className="rule__n" aria-hidden="true">
        {n}
      </span>
      <div className="rule__body">
        <div className="rule__head">
          <h2 id={`rule-${def.id}`}>{title ?? t.regole.rules[def.id].title}</h2>
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
        <p className="rule__summary">{summary ?? t.regole.rules[def.id].summary}</p>
        <div className="rule__thresholds">
          {Object.entries(def.thresholds).map(([key, spec]) => (
            <Threshold key={key} label={t.regole.rules[def.id].thresholds[key] ?? key} spec={spec} value={values[key] ?? spec.value} disabled={!enabled} onCommit={(v) => void saveRule(def.id, { thresholds: { [key]: v } })} />
          ))}
        </div>
        {def.id === 'periodo' ? (
          <p className="rule__note">
            {t.regole.periodNote}
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

/** Le soglie generali di un gruppo: un blocco richiudibile, chiuso di partenza. */
function GroupBlock({ id, config }: { id: keyof typeof GROUPS; config?: RuleConfig }) {
  const t = useT()
  const values = { ...defaultThresholds(id), ...config?.thresholds }
  return (
    <details className="group">
      <summary>{t.regole.groups[id].title}</summary>
      <div className="rule__thresholds">
        {Object.entries(GROUPS[id]).map(([key, spec]) => (
          <Threshold key={key} label={t.regole.groups[id].thresholds[key] ?? key} spec={spec} value={values[key] ?? spec.value} disabled={false} onCommit={(v) => void saveRule(id, { thresholds: { [key]: v } })} />
        ))}
      </div>
    </details>
  )
}


/** Il blocco di studio: quattro preset e il suggerimento di passare a uno più lungo. */
function BlocksCard() {
  const t = useT()
  const saved = useStudyBlock()
  const current = saved ?? DEFAULT_STUDY_BLOCK
  const save = (next: StudyBlockSettings) => void setSetting(db, 'studyBlock', normalizeStudyBlock(next))
  const low = blocksFor(current.preset, 'low').preset
  const hint = current.hint
  return (
    <section className="blocks-card" aria-labelledby="h-blocchi">
      <h2 id="h-blocchi">{t.blocks.title}</h2>
      <p className="rule__summary">{t.blocks.lead}</p>
      <div className="choices" role="radiogroup" aria-label={t.blocks.group}>
        {BLOCK_PRESET_IDS.map((p: BlockPreset) => (
          <button key={p} type="button" role="radio" aria-checked={current.preset === p} className="chip" title={t.blocks.presets[p]} onClick={() => save({ ...current, preset: p })}>
            {p}
          </button>
        ))}
      </div>
      <p className="rule__note">
        {t.blocks.presets[current.preset]}. {t.blocks.lowHint({ preset: low })}
      </p>
      <div className="group group--open">
        <h3 className="group__title">{t.blocks.hintTitle}</h3>
        <div className="rule__head">
          <span id="hint-on">{t.blocks.hintOn}</span>
          <button type="button" role="switch" aria-checked={hint.enabled} aria-labelledby="hint-on" className="switch" onClick={() => save({ ...current, hint: { ...hint, enabled: !hint.enabled } })}>
            <span className="switch__thumb" />
            <span className="switch__text">{hint.enabled ? t.regole.on : t.regole.off}</span>
          </button>
        </div>
        <div className="rule__thresholds">
          <Threshold label={t.blocks.hintLookback} spec={HINT_SPECS.lookbackDays} value={hint.lookbackDays} disabled={!hint.enabled} onCommit={(v) => save({ ...current, hint: { ...hint, lookbackDays: v } })} />
          <Threshold label={t.blocks.hintMinSessions} spec={HINT_SPECS.minSessions} value={hint.minSessions} disabled={!hint.enabled} onCommit={(v) => save({ ...current, hint: { ...hint, minSessions: v } })} />
          <Threshold label={t.blocks.hintMinShare} spec={HINT_SPECS.minShare} value={Math.round(hint.minShare * 100)} disabled={!hint.enabled} onCommit={(v) => save({ ...current, hint: { ...hint, minShare: v / 100 } })} />
          <Threshold label={t.blocks.hintOverrun} spec={HINT_SPECS.overrunPct} value={hint.overrunPct} disabled={!hint.enabled} onCommit={(v) => save({ ...current, hint: { ...hint, overrunPct: v } })} />
        </div>
      </div>
    </section>
  )
}
