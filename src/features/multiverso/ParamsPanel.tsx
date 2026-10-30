import { NumberField } from '../../components/NumberField'
import { db } from '../../db/db'
import { DEFAULT_MULTIVERSE, setSetting, type MultiverseParams } from '../../db/settings'
import { useI18n } from '../../i18n/store'
import { normalizeMultiverse } from '../../multiverse/scenario'

const CLOSE = { min: 1, max: 30 }
const GAP = { min: 0, max: 365 }

/** Le due soglie del Multiverso: si confermano uscendo dal campo o con Invio. */
export function ParamsPanel({ params }: { params: MultiverseParams }) {
  const { t } = useI18n()
  const tp = t.multiverso.params
  const save = (change: Partial<MultiverseParams>) => void setSetting(db, 'multiverse', normalizeMultiverse({ ...params, ...change }))
  const isDefault = params.closeDays === DEFAULT_MULTIVERSE.closeDays && params.finalGapDays === DEFAULT_MULTIVERSE.finalGapDays
  return (
    <section className="mv__params" aria-labelledby="mv-params">
      <h2 id="mv-params">{tp.title}</h2>
      <div className="mv__fields">
        <div>
          <NumberField label={tp.closeDays} value={params.closeDays} min={CLOSE.min} max={CLOSE.max} step={1} onCommit={(v) => v !== undefined && save({ closeDays: v })} />
          <p className="mv__hint">{tp.closeHint({ n: params.closeDays })}</p>
        </div>
        <div>
          <NumberField label={tp.finalGapDays} value={params.finalGapDays} min={GAP.min} max={GAP.max} step={1} onCommit={(v) => v !== undefined && save({ finalGapDays: v })} />
          <p className="mv__hint">{tp.gapHint({ n: params.finalGapDays })}</p>
        </div>
      </div>
      <button type="button" className="link-button" disabled={isDefault} onClick={() => save(DEFAULT_MULTIVERSE)}>
        {tp.reset}
      </button>
    </section>
  )
}
