import { useEffect, useId, useRef, type ReactNode } from 'react'
import { useT } from '../i18n/store'
import './Sheet.css'

interface SheetProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

/**
 * Pannello modale sul <dialog> nativo (focus trattenuto, Esc per chiudere):
 * in alto a destra sugli schermi larghi, dal basso sul telefono.
 */
export function Sheet({ open, title, onClose, children }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const t = useT()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
    >
      <div className="sheet__body">
        <div className="sheet__head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="sheet__close" onClick={onClose} aria-label={t.common.close}>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {open ? children : null}
      </div>
    </dialog>
  )
}
