import { useId, useState } from 'react'
import { WORKOUT_ORDER, type WorkoutType } from '../db/schema'
import { useI18n } from '../i18n/store'
import { MODULE_IDS, moduleLabel } from '../modules/registry'
import { MAX_MODULE_NAME, normalizeModules, type ModuleId, type ModulesSettings } from '../modules/types'
import { NumberField } from './NumberField'
import './ModuleSwitches.css'

interface ModuleSwitchesProps {
  modules: ModulesSettings
  onChange: (next: ModulesSettings) => void
}

/** I sette interruttori dei moduli con i loro dettagli: stessi in Dati e nel percorso guidato. */
export function ModuleSwitches({ modules, onChange }: ModuleSwitchesProps) {
  const { t } = useI18n()
  const tm = t.profilo.modules
  const [justOff, setJustOff] = useState<ModuleId | null>(null)
  const set = (next: ModulesSettings) => onChange(normalizeModules(next))

  const toggle = (id: ModuleId) => {
    const enabled = !modules[id].enabled
    setJustOff(enabled ? null : id)
    set({ ...modules, [id]: { ...modules[id], enabled } })
  }

  return (
    <ul className="mods" role="list">
      {MODULE_IDS.map((id) => (
        <ModuleRow key={id} id={id} modules={modules} toggle={() => toggle(id)} set={set} note={justOff === id ? tm.offNote : ''} />
      ))}
    </ul>
  )
}

function ModuleRow({ id, modules, toggle, set, note }: { id: ModuleId; modules: ModulesSettings; toggle: () => void; set: (m: ModulesSettings) => void; note: string }) {
  const { t } = useI18n()
  const labelId = useId()
  const on = modules[id].enabled
  return (
    <li className={`mod${on ? '' : ' mod--off'}`}>
      <div className="mod__head">
        <div className="mod__text">
          <span className="mod__label" id={labelId}>
            {moduleLabel(modules, id, t)}
          </span>
          <span className="mod__desc">{t.modules[id].description}</span>
        </div>
        <button type="button" role="switch" aria-checked={on} aria-labelledby={labelId} className="switch" onClick={toggle}>
          <span className="switch__thumb" />
          <span className="switch__text">{on ? t.regole.on : t.regole.off}</span>
        </button>
      </div>
      <p className="mod__note" role="status" aria-live="polite">
        {note}
      </p>
      {on && id === 'sport' ? <SportDetails modules={modules} set={set} /> : null}
      {on && id === 'abilita' ? (
        <label className="mod__field">
          <span className="date-field__label">{t.modules.abilita.nameLabel}</span>
          <input
            className="field"
            maxLength={MAX_MODULE_NAME}
            defaultValue={modules.abilita.name ?? ''}
            onBlur={(e) => set({ ...modules, abilita: { ...modules.abilita, name: e.target.value } })}
          />
        </label>
      ) : null}
      {on && id === 'lingua' ? (
        <label className="mod__field">
          <span className="date-field__label">{t.modules.lingua.appLabel}</span>
          <input
            className="field"
            maxLength={MAX_MODULE_NAME}
            defaultValue={modules.lingua.appName ?? ''}
            onBlur={(e) => set({ ...modules, lingua: { ...modules.lingua, appName: e.target.value } })}
          />
        </label>
      ) : null}
    </li>
  )
}

function SportDetails({ modules, set }: { modules: ModulesSettings; set: (m: ModulesSettings) => void }) {
  const { t } = useI18n()
  const tm = t.profilo.modules
  const change = (type: WorkoutType, patch: Partial<ModulesSettings['sport']['types'][WorkoutType]>) =>
    set({ ...modules, sport: { ...modules.sport, types: { ...modules.sport.types, [type]: { ...modules.sport.types[type], ...patch } } } })
  return (
    <fieldset className="mod__sport">
      <legend className="date-field__label">{tm.sportTypes}</legend>
      {WORKOUT_ORDER.map((type) => {
        const c = modules.sport.types[type]
        return (
          <div key={type} className="mod__type">
            <label className="date-field__check">
              <input type="checkbox" checked={c.enabled} onChange={(e) => change(type, { enabled: e.target.checked })} aria-label={tm.typeOn({ name: t.sport.label[type] })} />
              {t.sport.label[type]}
            </label>
            {c.enabled ? (
              <>
                <NumberField label={tm.target} value={c.target} min={0} max={7} onCommit={(v) => change(type, { target: v ?? c.target })} />
                <NumberField label={tm.minutes} value={c.minutes} min={5} max={300} step={5} onCommit={(v) => change(type, { minutes: v ?? c.minutes })} />
              </>
            ) : null}
          </div>
        )
      })}
    </fieldset>
  )
}
