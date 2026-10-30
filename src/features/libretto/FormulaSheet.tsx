import { useState } from 'react'
import { NumberField } from '../../components/NumberField'
import { Sheet } from '../../components/Sheet'
import { db } from '../../db/db'
import { useGraduation } from '../../db/hooks'
import { newId } from '../../db/repo'
import { setSetting } from '../../db/settings'
import { useI18n } from '../../i18n/store'
import {
  DEFAULT_FORMULA,
  MAX_BONUSES,
  graduationBase,
  normalizeFormula,
  normalizeGraduation,
  type BonusKind,
  type Gradebook,
  type GraduationBonus,
  type GraduationFormula,
} from '../../libretto/grades'

const KINDS: BonusKind[] = ['fixed', 'perLode']

const commit = (formula: GraduationFormula) => setSetting(db, 'graduation', normalizeGraduation({ formula }))

export function FormulaSheet({ open, onClose, book }: { open: boolean; onClose: () => void; book: Gradebook | null }) {
  const { t } = useI18n()
  return (
    <Sheet open={open} title={t.libretto.formula.title} onClose={onClose}>
      <FormulaForm book={book} onClose={onClose} />
    </Sheet>
  )
}

function FormulaForm({ book, onClose }: { book: Gradebook | null; onClose: () => void }) {
  const { t, f } = useI18n()
  const tf = t.libretto.formula
  const graduation = useGraduation()
  const formula = graduation?.formula ?? DEFAULT_FORMULA
  const [bad, setBad] = useState<{ scale?: boolean; divisor?: boolean }>({})
  const preview = book ? graduationBase(book.weighted, book.lodes, normalizeFormula(formula)) : null

  // Un valore fuori limite non si salva e non si corregge di nascosto: resta l'errore.
  const setField = (key: 'scale' | 'divisor', v: number | undefined, min: number, max: number) => {
    if (v === undefined) return
    const ok = Number.isFinite(v) && v >= min && v <= max
    setBad((b) => ({ ...b, [key]: !ok }))
    if (ok) void commit({ ...formula, [key]: v })
  }

  const setBonus = (id: string, change: Partial<GraduationBonus>) =>
    void commit({ ...formula, bonuses: formula.bonuses.map((b) => (b.id === id ? { ...b, ...change } : b)) })

  return (
    <div className="form lib-formula">
      <p className="lib-formula__lead">{tf.lead}</p>
      <div className="form-grid">
        <NumberField label={tf.scale} value={formula.scale} strict invalid={bad.scale} onCommit={(v) => setField('scale', v, 1, 1000)} />
        <NumberField label={tf.divisor} value={formula.divisor} strict invalid={bad.divisor} onCommit={(v) => setField('divisor', v, 1, 100)} />
      </div>
      <p className="form-error" role="alert">
        {bad.scale ? tf.invalid({ min: 1, max: 1000 }) : bad.divisor ? tf.invalid({ min: 1, max: 100 }) : ''}
      </p>

      <section className="lib-formula__bonuses" aria-labelledby="lib-bonuses">
        <h3 id="lib-bonuses">{tf.bonuses}</h3>
        <ul role="list">
          {formula.bonuses.map((b) => (
            <li key={b.id} className="lib-bonus">
              <label className="form-field lib-bonus__label">
                <span>{tf.bonusLabel}</span>
                <input
                  className="field"
                  key={b.label}
                  defaultValue={b.label}
                  maxLength={40}
                  onBlur={(e) => e.target.value !== b.label && setBonus(b.id, { label: e.target.value })}
                />
              </label>
              <label className="form-field">
                <span aria-hidden="true" className="lib-bonus__spacer" />
                <select className="field" aria-label={tf.kind[b.kind]} value={b.kind} onChange={(e) => setBonus(b.id, { kind: e.target.value as BonusKind })}>
                  {KINDS.map((k) => (
                    <option key={k} value={k}>
                      {tf.kind[k]}
                    </option>
                  ))}
                </select>
              </label>
              <NumberField label={tf.bonusPoints} value={b.points} min={-100} max={100} step={0.25} onCommit={(v) => v !== undefined && setBonus(b.id, { points: v })} />
              <button
                type="button"
                className="btn lib-bonus__remove"
                aria-label={tf.remove({ name: b.label || String(formula.bonuses.indexOf(b) + 1) })}
                onClick={() => void commit({ ...formula, bonuses: formula.bonuses.filter((x) => x.id !== b.id) })}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="btn"
          disabled={formula.bonuses.length >= MAX_BONUSES}
          onClick={() => void commit({ ...formula, bonuses: [...formula.bonuses, { id: newId(), label: '', kind: 'fixed', points: 0 }] })}
        >
          {tf.addBonus}
        </button>
        {formula.bonuses.length >= MAX_BONUSES ? <p className="lib-formula__hint">{tf.max({ n: MAX_BONUSES })}</p> : null}
      </section>

      <p className="lib-formula__preview tnum" aria-live="polite">
        {preview ? tf.preview({ total: preview.total }, f) : t.libretto.graduation.none}
      </p>

      <div className="sheet-actions">
        <button type="button" className="btn" onClick={() => void commit(DEFAULT_FORMULA)}>
          {tf.reset}
        </button>
        <span className="sheet-actions__spacer" />
        <button type="button" className="btn btn--primary" onClick={onClose}>
          {t.common.close}
        </button>
      </div>
    </div>
  )
}
