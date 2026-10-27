import { dismiss, useToasts } from './toast'
import './Toasts.css'

export function Toasts() {
  const messages = useToasts()
  return (
    <div className="toasts" role="status" aria-live="polite">
      {messages.map((m) => (
        <p key={m.id} className={`toast toast--${m.tone}`}>
          <span>{m.text}</span>
          <button type="button" className="toast__close" onClick={() => dismiss(m.id)} aria-label="Chiudi">
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </p>
      ))}
    </div>
  )
}
