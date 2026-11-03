import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { href } from '../../app/router'
import { MathText } from '../../components/MathText'
import { db } from '../../db/db'
import { useCourses } from '../../db/hooks'
import { importTexCards } from '../../db/tex-import'
import { AppError, renderError } from '../../i18n/errors'
import { getI18n, useI18n } from '../../i18n/store'
import { DEFAULT_ENVIRONMENTS, parseEnvList, parseTexFiles, type TexSource } from '../../tex/parse'
import { previewRows, texSummary } from '../../tex/plan'
import { readTexFile } from '../../tex/read'

interface Notice {
  text: string
  error?: boolean
  courseId?: string
}

/**
 * Importa le schede da uno o più file .tex: si scelgono i file, si controlla
 * l'anteprima (resa KaTeX, errori per blocco), si sceglie il corso e si importa.
 * Il file si legge solo sul dispositivo.
 */
export function TexImport() {
  const i18n = useI18n()
  const { t, f } = i18n
  const tt = t.tex
  const courses = useCourses()
  const [files, setFiles] = useState<TexSource[]>([])
  const [readErrors, setReadErrors] = useState<AppError[]>([])
  const [extra, setExtra] = useState('')
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(new Set())
  const [courseId, setCourseId] = useState('')
  const [notice, setNotice] = useState<Notice | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const status = useRef<HTMLParagraphElement>(null)
  const allBox = useRef<HTMLInputElement>(null)

  const results = useMemo(() => parseTexFiles(files, parseEnvList(extra)), [files, extra])
  const rows = useMemo(() => previewRows(results), [results])
  const summary = texSummary(results)
  const picked = rows.filter((r) => !excluded.has(r.key))
  const sortedCourses = useMemo(() => [...courses].sort((a, b) => a.name.localeCompare(b.name, 'it')), [courses])
  const course = sortedCourses.find((c) => c.id === courseId)
  const problems = results.filter((r) => r.errors.length)
  const problemCount = summary.errors + readErrors.length
  const hasFiles = files.length > 0 || readErrors.length > 0

  const allChecked = rows.length > 0 && picked.length === rows.length
  useEffect(() => {
    if (allBox.current) allBox.current.indeterminate = picked.length > 0 && picked.length < rows.length
  }, [picked.length, rows.length])

  const choose = (e: ChangeEvent<HTMLInputElement>) => {
    const chosen = [...(e.target.files ?? [])]
    e.target.value = ''
    if (!chosen.length) return
    void (async () => {
      const read: TexSource[] = []
      const failed: AppError[] = []
      for (const file of chosen) {
        try {
          read.push({ name: file.name, text: await readTexFile(file) })
        } catch (error) {
          failed.push(error instanceof AppError ? error : new AppError('texReadFailed', { name: file.name }))
        }
      }
      setFiles(read)
      setReadErrors(failed)
      setExcluded(new Set())
      setNotice(null)
    })()
  }

  const toggle = (key: string, on: boolean) =>
    setExcluded((prev) => {
      const next = new Set(prev)
      if (on) next.delete(key)
      else next.add(key)
      return next
    })

  const toggleAll = (on: boolean) => setExcluded(on ? new Set() : new Set(rows.map((r) => r.key)))

  const run = async () => {
    try {
      const r = await importTexCards(db, courseId, picked)
      setNotice({ text: t.dati.cardsImported(r, f), courseId })
    } catch (error) {
      setNotice({ text: renderError(error, getI18n()), error: true })
    }
    status.current?.focus({ preventScroll: true })
  }

  const disabledReason = !picked.length ? tt.needCards : !course ? tt.needCourse : ''

  return (
    <>
      <header className="dati__head">
        <a className="link-button latex__back" href={href('dati')}>
          {tt.back}
        </a>
        <h1 id="titolo-tex" className="page__title">
          {tt.title}
        </h1>
        <p className="page__lead">{tt.lead}</p>
      </header>

      <div className="tex">
        <section className="tex__section" aria-labelledby="tex-limiti">
          <h2 id="tex-limiti">{tt.limits.title}</h2>
          <ul className="tex__limits">
            <li>{tt.limits.newcommand}</li>
            <li>{tt.limits.input}</li>
            <li>{tt.limits.bibliography}</li>
            <li>{tt.limits.key}</li>
          </ul>
        </section>

        <section className="tex__section" aria-labelledby="tex-file">
          <h2 id="tex-file">{tt.step1}</h2>
          <div className="dati__actions">
            <button type="button" className="btn btn--primary" onClick={() => input.current?.click()}>
              {hasFiles ? tt.chooseOther : tt.choose}
            </button>
            <input ref={input} type="file" multiple accept=".tex,text/x-tex,text/plain" hidden onChange={choose} />
          </div>
          {hasFiles ? <p className="dati__status">{tt.filesRead({ n: files.length }, f)}</p> : null}
          <label className="dati__field dati__field--wide tex__envs">
            <span className="date-field__label">{tt.environments}</span>
            <input
              className="field"
              type="text"
              value={extra}
              placeholder={tt.environmentsPlaceholder}
              spellCheck={false}
              autoCapitalize="none"
              aria-describedby="tex-envs-hint"
              onChange={(e) => setExtra(e.target.value)}
            />
          </label>
          <p id="tex-envs-hint" className="dati__hint">
            {tt.environmentsHint({ list: DEFAULT_ENVIRONMENTS.join(', ') })}
          </p>
        </section>

        {hasFiles ? (
          <section className="tex__section" aria-labelledby="tex-schede">
            <h2 id="tex-schede">{tt.step2}</h2>
            <p className="dati__status" role="status" aria-live="polite">
              {summary.cards ? tt.found({ n: summary.cards, files: summary.files }, f) : tt.foundNone}
            </p>

            {problemCount ? (
              <div className="tex__problems">
                <h3 className="tex__problems-title">{tt.problemsTitle({ n: problemCount }, f)}</h3>
                <ul role="list">
                  {readErrors.map((e, i) => (
                    <li key={`read-${i}`}>{renderError(e, i18n)}</li>
                  ))}
                  {problems.flatMap((r) =>
                    r.errors.map((e, i) => (
                      <li key={`${r.fileName}-${i}`}>
                        <strong className="tex__file">{r.fileName}</strong> {renderError(new AppError(e.code, e.params), i18n)}
                      </li>
                    )),
                  )}
                </ul>
                <p className="dati__hint">{tt.problemsRest}</p>
              </div>
            ) : null}

            {rows.length ? (
              <>
                <div className="tex__bar">
                  <label className="date-field__check">
                    <input ref={allBox} type="checkbox" checked={allChecked} onChange={(e) => toggleAll(e.target.checked)} />
                    {tt.selectAll}
                  </label>
                  <span className="dati__status">{tt.selected({ n: picked.length, total: rows.length })}</span>
                </div>
                <table className="tex-table" role="table">
                  <caption className="sr-only">{tt.tableCaption}</caption>
                  <thead role="rowgroup" className="tex-table__head">
                    <tr role="row">
                      <th role="columnheader" scope="col">
                        <span className="sr-only">{tt.colImport}</span>
                      </th>
                      <th role="columnheader" scope="col">
                        {tt.colCard}
                      </th>
                      <th role="columnheader" scope="col">
                        {tt.colText}
                      </th>
                    </tr>
                  </thead>
                  <tbody role="rowgroup">
                    {rows.map((row) => (
                      <tr key={row.key} role="row" className="tex-table__row">
                        <td role="cell" className="tex-table__check">
                          <input
                            type="checkbox"
                            checked={!excluded.has(row.key)}
                            aria-label={tt.rowImport({ title: row.card.title })}
                            onChange={(e) => toggle(row.key, e.target.checked)}
                          />
                        </td>
                        <th role="rowheader" scope="row" className="tex-table__card">
                          <span className="tex-table__title">{row.card.title}</span>
                          <span className="tex-table__meta">
                            {tt.meta({ kind: row.card.kind, section: row.card.section, file: row.card.fileName, line: row.card.line })}
                          </span>
                        </th>
                        <td role="cell" className="tex-table__text">
                          <MathText as="div" source={row.card.text} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : null}
          </section>
        ) : null}

        {rows.length ? (
          <section className="tex__section" aria-labelledby="tex-corso">
            <h2 id="tex-corso">{tt.step3}</h2>
            {sortedCourses.length ? (
              <label className="dati__field dati__field--wide tex__course">
                <span className="date-field__label">{tt.course}</span>
                <select className="field" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                  <option value="">{tt.pickCourse}</option>
                  {sortedCourses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="dati__hint">
                {tt.noCourses}{' '}
                <a href={href('dati')}>{tt.back}</a>
              </p>
            )}
            <div className="dati__actions">
              <button type="button" className="btn btn--primary" disabled={!!disabledReason} aria-describedby="tex-why" onClick={() => void run()}>
                {tt.action({ n: picked.length }, f)}
              </button>
              {notice?.courseId && !notice.error ? (
                <a className="btn" href={href('ripasso', { materia: notice.courseId })}>
                  {tt.review}
                </a>
              ) : null}
            </div>
            <p id="tex-why" className="dati__hint">
              {disabledReason}
            </p>
            <p ref={status} tabIndex={-1} className={`dati__message tex__status${notice?.error ? ' dati__message--error' : ''}`} role="status" aria-live="polite">
              {notice?.text ?? ''}
            </p>
          </section>
        ) : null}
      </div>
    </>
  )
}
