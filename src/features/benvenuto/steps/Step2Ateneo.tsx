import { DateField } from '../../../components/DateField'
import { NumberField } from '../../../components/NumberField'
import { useI18n } from '../../../i18n/store'
import { validateStep } from '../wizard'
import type { StepProps } from './types'

/** Ateneo, corso di laurea, crediti totali e laurea prevista: tutto facoltativo tranne i crediti, che hanno un valore. */
export function Step2Ateneo({ draft, change }: StepProps) {
  const { t } = useI18n()
  // L'errore compare appena scrivi un valore non valido, senza aspettare Avanti.
  const invalid = !!validateStep(2, draft)?.totalCfu
  const tp = t.profilo.profile
  return (
    <div className="welcome__fields">
      <label className="welcome__field">
        <span className="welcome__label">{tp.university}</span>
        <input className="field" value={draft.university} maxLength={120} autoComplete="organization" onChange={(e) => change({ university: e.target.value })} />
      </label>
      <label className="welcome__field">
        <span className="welcome__label">{tp.degree}</span>
        <input className="field" value={draft.degree} maxLength={120} onChange={(e) => change({ degree: e.target.value })} />
      </label>
      <div className="welcome__pair">
        <div className="welcome__field">
          <NumberField label={tp.totalCfu} value={draft.totalCfu} strict invalid={invalid} onCommit={(v) => v !== undefined && change({ totalCfu: v })} />
          {invalid ? <p className="welcome__error" role="alert">{t.benvenuto.errCfuTotal}</p> : null}
        </div>
        <DateField label={tp.graduation} value={draft.graduationTarget} allowMonthOnly onChange={(v) => change({ graduationTarget: v })} />
      </div>
    </div>
  )
}
