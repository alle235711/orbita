import type { CfuStatus } from '../../libretto/grades'
import { useI18n } from '../../i18n/store'

/** Barra dei CFU: la riempie la frazione, con una scalatura dal bordo sinistro. */
export function CfuBar({ cfu }: { cfu: CfuStatus }) {
  const { t, f } = useI18n()
  const tl = t.libretto.cfu
  return (
    <div className="cfu">
      <div
        className="cfu__track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={cfu.total}
        aria-valuenow={Math.min(cfu.earned, cfu.total)}
        aria-label={tl.aria({ earned: cfu.earned, total: cfu.total })}
      >
        <div className="cfu__fill" style={{ transform: `scaleX(${cfu.fraction})` }} />
      </div>
      <p className="cfu__text tnum">
        <span>{tl.progress({ earned: cfu.earned, total: cfu.total })}</span>
        <span>{tl.missing({ missing: cfu.missing })}</span>
        {cfu.unknownCfu > 0 ? <span>{tl.unknown({ n: cfu.unknownCfu }, f)}</span> : null}
      </p>
    </div>
  )
}
