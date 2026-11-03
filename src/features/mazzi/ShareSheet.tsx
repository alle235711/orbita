import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Sheet } from '../../components/Sheet'
import { db } from '../../db/db'
import { defaultMeta, exportDeck, saveDeck, type DeckEntry } from '../../db/decks'
import { newId } from '../../db/repo'
import { buildDeckFile, cleanMeta, type DeckFile, type DeckMeta } from '../../decks/file'
import { deckFileName } from '../../decks/names'
import { compressDeck, compressionSupported, deckBytes, deckToOrbita, deckToPayload } from '../../decks/pack'
import { QR_MAX_BYTES, qrFit, qrMatrix } from '../../decks/qr'
import { formatSize } from '../../decks/size'
import { AppError, renderError } from '../../i18n/errors'
import { getI18n, useI18n } from '../../i18n/store'
import { todayISO } from '../../lib/dates'
import { downloadBytes, downloadJson } from '../../lib/download'
import { QrCode } from './QrCode'
import './MazziPage.css'

export function ShareSheet({ entry, onClose }: { entry: DeckEntry | null; onClose: () => void }) {
  const { t } = useI18n()
  return (
    <Sheet open={!!entry} title={t.mazzi.sheet.title} onClose={onClose}>
      {entry ? <ShareForm entry={entry} /> : null}
    </Sheet>
  )
}

interface Shown {
  matrix: boolean[][]
  label: string
}

interface Notice {
  text: string
  error?: boolean
}

function ShareForm({ entry }: { entry: DeckEntry }) {
  const i18n = useI18n()
  const { t, f } = i18n
  const ts = t.mazzi.sheet
  const courseId = entry.course.id
  const [meta, setMeta] = useState<DeckMeta>(() => defaultMeta(entry.course, entry.deck))
  const [shown, setShown] = useState<Shown | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const status = useRef<HTMLParagraphElement>(null)
  const qrId = useId()
  const qrBox = useRef<HTMLDivElement>(null)
  const whyId = useId()
  const canCompress = useMemo(() => compressionSupported(), [])
  const cards = useLiveQuery(() => db.cards.where('courseId').equals(courseId).toArray(), [courseId])
  const placeholderId = useMemo(() => entry.deck?.id ?? newId(), [entry.deck?.id])
  const name = cleanMeta(meta).name

  // Il peso del file si stima mentre si scrive, con i metadati correnti: serve a sapere in anticipo se il QR è possibile.
  const [sizes, setSizes] = useState<{ cards: number; json: number; packed: number | null } | null>(null)
  useEffect(() => {
    if (!cards) return
    let stale = false
    const clean = cleanMeta(meta)
    const file = buildDeckFile(
      { id: placeholderId, courseId, ...clean, updatedAt: entry.deck?.updatedAt ?? Date.now() },
      entry.course,
      cards,
      todayISO(),
    )
    const count = file.schede.length
    const json = deckBytes(file).length
    if (!canCompress) {
      setSizes({ cards: count, json, packed: null })
      return
    }
    void compressDeck(file).then(
      (packed) => !stale && setSizes({ cards: count, json, packed: packed.length }),
      () => !stale && setSizes({ cards: count, json, packed: null }),
    )
    return () => {
      stale = true
    }
  }, [cards, meta, canCompress, placeholderId, courseId, entry.course, entry.deck?.updatedAt])

  // Il codice sta in fondo al foglio, che può scorrere: appena compare lo si porta in vista.
  useEffect(() => {
    if (shown) qrBox.current?.scrollIntoView({ block: 'end' })
  }, [shown])

  const set = (key: keyof DeckMeta) => (value: string) => {
    setMeta((m) => ({ ...m, [key]: value }))
    // Il codice mostrato non corrisponde più ai campi: si rigenera quando lo si chiede.
    setShown(null)
  }

  /** Salva i metadati e restituisce il file da condividere. Gli errori finiscono nel messaggio. */
  const run = async (task: (file: DeckFile) => Promise<Notice | null>) => {
    try {
      await saveDeck(db, courseId, meta)
      setNotice(await task(await exportDeck(db, courseId)))
    } catch (error) {
      setNotice({ text: renderError(error, getI18n()), error: true })
    }
    status.current?.focus({ preventScroll: true })
  }

  const downloadJsonFile = () =>
    run(async (file) => {
      const fileName = deckFileName(file.mazzo.nome, 'json')
      downloadJson(fileName, file)
      return { text: ts.saved({ file: fileName }) }
    })

  const downloadOrbitaFile = () =>
    run(async (file) => {
      const fileName = deckFileName(file.mazzo.nome, 'orbita')
      downloadBytes(fileName, await deckToOrbita(file))
      return { text: ts.saved({ file: fileName }) }
    })

  const toggleQr = () => {
    if (shown) {
      setShown(null)
      setNotice(null)
      return
    }
    void run(async (file) => {
      const payload = await deckToPayload(file)
      const fit = qrFit(payload)
      if (!fit.fits) {
        setShown(null)
        throw new AppError('qrTooBig', { size: formatSize(fit.bytes, f), max: formatSize(fit.max, f) })
      }
      setShown({
        matrix: qrMatrix(payload),
        label: ts.qrLabel({ name: file.mazzo.nome, cards: file.schede.length, size: formatSize(fit.bytes, f) }, f),
      })
      return { text: ts.qrFits({ size: formatSize(fit.bytes, f), max: formatSize(QR_MAX_BYTES, f) }) }
    })
  }

  return (
    <form className="form" onSubmit={(e) => e.preventDefault()}>
      <p className="dati__hint">{ts.lead}</p>
      <div className="form-grid">
        <label className="form-field form-field--wide">
          <span>{ts.name}</span>
          <input className="field" type="text" value={meta.name} aria-describedby={name ? undefined : whyId} onChange={(e) => set('name')(e.target.value)} />
        </label>
        <label className="form-field">
          <span>{ts.author}</span>
          <input className="field" type="text" autoComplete="off" value={meta.author} onChange={(e) => set('author')(e.target.value)} />
        </label>
        <label className="form-field">
          <span>{ts.university}</span>
          <input className="field" type="text" autoComplete="off" value={meta.university} onChange={(e) => set('university')(e.target.value)} />
        </label>
        <label className="form-field form-field--wide">
          <span>{ts.course}</span>
          <input className="field" type="text" value={meta.course} onChange={(e) => set('course')(e.target.value)} />
        </label>
        <label className="form-field">
          <span>{ts.year}</span>
          <input className="field" type="text" value={meta.year} placeholder={ts.yearPlaceholder} onChange={(e) => set('year')(e.target.value)} />
        </label>
        <label className="form-field">
          <span>{ts.license}</span>
          <input className="field" type="text" value={meta.license} placeholder={ts.licensePlaceholder} onChange={(e) => set('license')(e.target.value)} />
        </label>
        <label className="form-field form-field--wide">
          <span>{ts.notes}</span>
          <textarea className="field" rows={2} value={meta.notes} onChange={(e) => set('notes')(e.target.value)} />
        </label>
      </div>

      <p className="dati__hint">
        {sizes
          ? ts.sizes({ cards: sizes.cards, json: formatSize(sizes.json, f), packed: sizes.packed === null ? null : formatSize(sizes.packed, f), max: formatSize(QR_MAX_BYTES, f) }, f)
          : ''}
      </p>
      {canCompress ? null : <p className="dati__hint">{ts.noCompression}</p>}

      <div className="dati__actions">
        <button type="button" className="btn btn--primary" disabled={!name} onClick={() => void downloadJsonFile()}>
          {ts.json}
        </button>
        {canCompress ? (
          <button type="button" className="btn" disabled={!name} onClick={() => void downloadOrbitaFile()}>
            {ts.orbita}
          </button>
        ) : null}
        {canCompress ? (
          <button type="button" className="btn" disabled={!name} aria-expanded={!!shown} aria-controls={qrId} onClick={toggleQr}>
            {shown ? ts.hideQr : ts.showQr}
          </button>
        ) : null}
      </div>
      <p id={whyId} className="dati__hint">
        {name ? '' : ts.needName}
      </p>

      <p ref={status} tabIndex={-1} className={`mazzi-sheet__status${notice?.error ? ' mazzi-sheet__status--error' : ''}`} role="status" aria-live="polite">
        {notice?.text ?? ''}
      </p>
      <div id={qrId} ref={qrBox} className="mazzi-qr">
        {shown ? (
          <figure className="qr-figure">
            <figcaption>{ts.qrCaption}</figcaption>
            <QrCode matrix={shown.matrix} label={shown.label} />
          </figure>
        ) : null}
      </div>
    </form>
  )
}
