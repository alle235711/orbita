import { useEffect, useState, type FormEvent } from 'react'
import { toast } from '../../app/toast'
import { Sheet } from '../../components/Sheet'
import { setNeedsFix, updateCard } from '../../db/review-actions'
import type { Card } from '../../db/schema'

interface CardEditorProps {
  card: Card | null
  sections: string[]
  onClose: () => void
}

/** Allinea una scheda alle slide del corso: da qui in poi le importazioni la lasciano stare. */
export function CardEditor({ card, sections, onClose }: CardEditorProps) {
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [key, setKey] = useState('')
  const [section, setSection] = useState('')
  const [kind, setKind] = useState('')
  const [fix, setFix] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!card) return
    setTitle(card.title)
    setText(card.text)
    setKey(card.key)
    setSection(card.section)
    setKind(card.kind)
    setFix(card.needsFix)
    setError('')
  }, [card])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!card) return
    const t = text.trim().replace(/\s+/g, ' ')
    if (!title.trim() || !t) return setError('Titolo e testo non possono restare vuoti.')
    if (key && !t.includes(key)) return setError('La chiave deve comparire nel testo così com’è, per poterla nascondere in Completa.')
    await updateCard(card.id, { title: title.trim(), text: t, key, section, kind: kind.trim() || card.kind })
    if (fix !== card.needsFix) await setNeedsFix(card.id, fix)
    toast('Scheda aggiornata. Le prossime importazioni non la sovrascriveranno.')
    onClose()
  }

  const options = card && !sections.includes(card.section) ? [card.section, ...sections] : sections

  return (
    <Sheet open={!!card} title="Modifica la scheda" onClose={onClose}>
      <form className="form" onSubmit={(e) => void submit(e)}>
        <label className="form-field">
          <span>Titolo</span>
          <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="form-field">
          <span>Testo</span>
          <textarea className="field" rows={6} value={text} onChange={(e) => setText(e.target.value)} />
        </label>
        <label className="form-field">
          <span>Chiave, la parte nascosta in Completa</span>
          <input className="field" value={key} onChange={(e) => setKey(e.target.value)} />
        </label>
        <div className="form-grid">
          <label className="form-field form-field--wide">
            <span>Sezione del programma</span>
            <select className="field" value={section} onChange={(e) => setSection(e.target.value)}>
              {options.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Tipo</span>
            <input className="field" value={kind} onChange={(e) => setKind(e.target.value)} />
          </label>
          <label className="check">
            <input type="checkbox" checked={fix} onChange={(e) => setFix(e.target.checked)} />
            Da correggere
          </label>
        </div>
        <p className="form-error" role="alert">
          {error}
        </p>
        <div className="sheet-actions">
          <button type="button" className="btn" onClick={onClose}>
            Annulla
          </button>
          <button type="submit" className="btn btn--primary">
            Salva
          </button>
        </div>
      </form>
    </Sheet>
  )
}
