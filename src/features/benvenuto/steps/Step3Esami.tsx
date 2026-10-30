import { DateField } from '../../../components/DateField'
import { NumberField } from '../../../components/NumberField'
import { newId } from '../../../db/repo'
import { useI18n } from '../../../i18n/store'
import { SampleDeckOffer } from '../SampleDeckOffer'
import { validateStep, type ExamDraft } from '../wizard'
import type { StepProps } from './types'

const DIFFICULTY: ExamDraft['difficulty'][] = [1, 2, 3]

/** Elenco degli esami: nome, crediti, data o mese e difficoltà; anche zero righe vanno bene. */
export function Step3Esami({ draft, change }: StepProps) {
  const { t } = useI18n()
  const ts = t.benvenuto.step3
  const update = (key: string, patch: Partial<ExamDraft>) => change({ exams: draft.exams.map((e) => (e.key === key ? { ...e, ...patch } : e)) })
  const remove = (key: string) => change({ exams: draft.exams.filter((e) => e.key !== key), sampleDecks: draft.sampleDecks.filter((d) => d.examKey !== key) })
  const add = () => change({ exams: [...draft.exams, { key: newId(), name: '', difficulty: 2 }] })

  return (
    <div className="welcome__fields">
      {draft.exams.length ? (
        <ul className="welcome__exams" role="list">
          {draft.exams.map((exam, i) => (
            <li key={exam.key} className="welcome__exam">
              <label className="welcome__field welcome__field--grow">
                <span className="welcome__label">{ts.exam({ n: i + 1 })}</span>
                <input
                  className="field"
                  value={exam.name}
                  maxLength={120}
                  placeholder={t.profilo.exams.name}
                  onChange={(e) => update(exam.key, { name: e.target.value })}
                />
              </label>
              <DateField label={ts.date} value={exam.date} allowMonthOnly onChange={(v) => update(exam.key, { date: v })} />
              <div className="welcome__field">
                <NumberField label={t.profilo.exams.cfu} value={exam.cfu} strict optional invalid={!!validateStep(3, { ...draft, exams: [exam] })} placeholder={ts.cfuPlaceholder} onCommit={(v) => update(exam.key, { cfu: v })} />
                {validateStep(3, { ...draft, exams: [exam] }) ? <p className="welcome__error" role="alert">{t.benvenuto.errCfuExam}</p> : null}
              </div>
              <div className="welcome__field" role="radiogroup" aria-label={t.dati.difficultyGroup({ name: exam.name || ts.exam({ n: i + 1 }) })}>
                <span className="welcome__label" aria-hidden="true">
                  {t.dati.difficulty}
                </span>
                <div className="segmented">
                  {DIFFICULTY.map((d) => (
                    <button key={d} type="button" role="radio" aria-checked={exam.difficulty === d} className="segmented__item" onClick={() => update(exam.key, { difficulty: d })}>
                      {t.dati.levels[d]}
                    </button>
                  ))}
                </div>
              </div>
              <button type="button" className="btn welcome__remove" onClick={() => remove(exam.key)}>
                {exam.name.trim() ? ts.remove({ name: exam.name.trim() }) : ts.removeUnnamed}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="welcome__hint">{ts.empty}</p>
      )}
      <div>
        <button type="button" className="btn" onClick={add}>
          {ts.add}
        </button>
      </div>
      <SampleDeckOffer draft={draft} change={change} />
    </div>
  )
}
