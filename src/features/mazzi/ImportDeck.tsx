import { useRef, useState, type ChangeEvent } from 'react'
import { href } from '../../app/router'
import { db } from '../../db/db'
import { importDeck, previewDeckImport, type DeckImportPreview } from '../../db/decks'
import type { DeckFile } from '../../decks/file'
import { readDeckBytes } from '../../decks/pack'
import { AppError, renderError } from '../../i18n/errors'
import { getI18n, useI18n } from '../../i18n/store'

/** Un file più grande non è un mazzo (un corso intero sta in qualche centinaio di KB). */
const MAX_FILE_MB = 20

interface Notice {
  text: string
  error?: boolean
  courseId?: string
}

/** Importa un mazzo da file: anteprima del resoconto (nuove, aggiornate, uguali, saltate) e conferma. Il file si legge solo qui. */
export function ImportDeck() {
  const { t, f } = useI18n()
  const ti = t.mazzi.import
  const [picked, setPicked] = useState<{ file: DeckFile; preview: DeckImportPreview } | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const status = useRef<HTMLParagraphElement>(null)

  const choose = (e: ChangeEvent<HTMLInputElement>) => {
    const chosen = e.target.files?.[0]
    e.target.value = ''
    if (!chosen) return
    void (async () => {
      try {
        if (chosen.size > MAX_FILE_MB * 1024 * 1024) throw new AppError('deckFileTooLarge', { mb: MAX_FILE_MB })
        let bytes: Uint8Array
        try {
          bytes = new Uint8Array(await chosen.arrayBuffer())
        } catch {
          throw new AppError('deckReadFailed', { name: chosen.name })
        }
        const file = await readDeckBytes(bytes, chosen.name)
        setPicked({ file, preview: await previewDeckImport(db, file) })
        setNotice(null)
      } catch (error) {
        setPicked(null)
        setNotice({ text: renderError(error, getI18n()), error: true })
      }
      status.current?.focus({ preventScroll: true })
    })()
  }

  const run = async () => {
    if (!picked) return
    try {
      const r = await importDeck(db, picked.file)
      setNotice({ text: ti.done(r.cards, f), courseId: r.courseId })
      setPicked(null)
    } catch (error) {
      setNotice({ text: renderError(error, getI18n()), error: true })
    }
    status.current?.focus({ preventScroll: true })
  }

  const header = picked?.file.mazzo
  const details: [string, string][] = header
    ? ([
        [t.mazzi.sheet.author, header.autore],
        [t.mazzi.sheet.university, header.ateneo],
        [t.mazzi.sheet.course, header.corso],
        [t.mazzi.sheet.year, header.anno],
        [t.mazzi.sheet.license, header.licenza],
        [t.mazzi.sheet.notes, header.note],
      ] as [string, string][]).filter(([, v]) => v)
    : []
  const summary = picked?.preview.plan.cards

  return (
    <section className="dati__section" aria-labelledby="h-importa">
      <h2 id="h-importa">{ti.title}</h2>
      <p className="dati__hint">{ti.lead}</p>
      <div className="dati__actions">
        <button type="button" className="btn btn--primary" onClick={() => input.current?.click()}>
          {picked ? ti.chooseOther : ti.choose}
        </button>
        <input ref={input} type="file" accept=".json,.orbita,application/json" hidden onChange={choose} />
      </div>

      {picked && header && summary ? (
        <div className="mazzi-preview" role="group" aria-labelledby="mazzi-anteprima">
          <h3 id="mazzi-anteprima" className="dati__sub">
            {ti.previewTitle}: {header.nome}
          </h3>
          {details.map(([label, value]) => (
            <p key={label} className="dati__hint">
              <strong>{label}:</strong> {value}
            </p>
          ))}
          <p className="dati__hint">{ti.cardsInDeck({ n: picked.file.schede.length }, f)}</p>
          <p className="dati__hint">{ti.deckState[picked.preview.plan.deck]}</p>
          <p className="dati__hint">{picked.preview.courseExists ? ti.intoExisting({ name: picked.preview.courseName }) : ti.intoNew({ name: picked.preview.courseName })}</p>
          <p className="dati__status">{ti.summary(summary, f)}</p>
          {summary.skipped && (summary.keptEdited || summary.elsewhere) ? <p className="dati__hint">{ti.skippedWhy(summary, f)}</p> : null}
          <div className="dati__actions">
            <button type="button" className="btn btn--primary" onClick={() => void run()}>
              {ti.action}
            </button>
            <button type="button" className="btn" onClick={() => setPicked(null)}>
              {ti.cancel}
            </button>
          </div>
        </div>
      ) : null}

      <p ref={status} tabIndex={-1} className={`dati__message mazzi-import__status${notice?.error ? ' dati__message--error' : ''}`} role="status" aria-live="polite">
        {notice?.text ?? ''}
      </p>
      {notice?.courseId && !notice.error ? (
        <div className="dati__actions">
          <a className="btn" href={href('ripasso', { materia: notice.courseId })}>
            {ti.review}
          </a>
        </div>
      ) : null}
    </section>
  )
}
