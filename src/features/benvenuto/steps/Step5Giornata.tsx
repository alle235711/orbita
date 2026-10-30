import { NumberField } from '../../../components/NumberField'
import { WeekdayToggles } from '../../../components/WeekdayToggles'
import { useI18n } from '../../../i18n/store'
import { BLOCK_PRESET_IDS } from '../../../modules/types'
import { blocksFor } from '../../../rules/blocks'
import { validateStep } from '../wizard'
import type { StepProps } from './types'

/** Ore al giorno, preset del blocco di studio e giorni nell'altra lingua. */
export function Step5Giornata({ draft, change, errors }: StepProps) {
  const { t } = useI18n()
  const ts = t.benvenuto.step5
  return (
    <div className="welcome__fields">
      <div className="welcome__field">
        <NumberField label={ts.hours} value={draft.hoursPerDay} strict invalid={!!validateStep(5, draft)?.hoursPerDay} onCommit={(v) => v !== undefined && change({ hoursPerDay: v })} />
        {validateStep(5, draft)?.hoursPerDay ? <p className="welcome__error" role="alert">{t.benvenuto.errHours}</p> : null}
      </div>
      <div className="welcome__field">
        <span className="welcome__label" id="w-preset">
          {ts.preset}
        </span>
        <div className="choices" role="radiogroup" aria-labelledby="w-preset">
          {BLOCK_PRESET_IDS.map((p) => (
            <button key={p} type="button" role="radio" aria-checked={draft.preset === p} className="chip" title={t.blocks.presets[p]} onClick={() => change({ preset: p })}>
              {p}
            </button>
          ))}
        </div>
        <p className="welcome__hint">
          {t.blocks.presets[draft.preset]}. {ts.presetHint({ preset: blocksFor(draft.preset, 'low').preset })}
        </p>
      </div>
      <div className="welcome__field">
        <span className="welcome__label" id="w-days">
          {ts.days}
        </span>
        <WeekdayToggles value={draft.otherDays} onChange={(otherDays) => change({ otherDays })} labelledBy="w-days" />
        <p className="welcome__hint">{ts.daysHint}</p>
        {errors?.otherDays ? <p className="welcome__error">{t.benvenuto.errRange}</p> : null}
      </div>
    </div>
  )
}
